import { createDryRunBrokerAdapter } from './_dry-run-broker.mjs';
import officialEndpoints from './config/official-endpoints.json' with { type: 'json' };

const dry = createDryRunBrokerAdapter({ name: 'spokeo', displayName: 'Spokeo' });
const BLOCK_NEXT_ACTIONS = [
  'Confirm termsAccepted=true before live official submission.',
  'Confirm lawfulBasis and operatorId are present.',
  'Configure the official endpoint before enabling execution.'
];

export const spokeoAdapter = {
  ...dry,
  dryRun: false,
  liveCapable: true,

  async submit(request, input = {}) {
    if (!input.live) {
      return dry.submit(request, input);
    }

    if (input.officialMode || input.useOfficialEndpoint) {
      const compliance = complianceSnapshot(input);
      const endpointConfig = resolveOfficialEndpoint(input);
      if (!endpointConfig.configured || !compliance.termsAccepted || !compliance.lawfulBasis || !compliance.operatorId) {
        const complianceMissing = !compliance.termsAccepted || !compliance.lawfulBasis || !compliance.operatorId;
        return {
          broker: 'spokeo',
          status: 'blocked',
          reason: complianceMissing ? 'compliance_not_confirmed' : 'official_endpoint_not_configured',
          dryRun: false,
          nextActions: BLOCK_NEXT_ACTIONS,
          compliance,
          antiBot: antiBotPlaceholders(endpointConfig.config),
          complianceNotes: endpointConfig.config.complianceNotes
        };
      }

      await waitWithJitter(endpointConfig.config.rateLimitPolicy);
      const response = await fetch(endpointConfig.endpoint, {
        method: endpointConfig.method,
        headers: {
          'content-type': 'application/json',
          'user-agent': endpointConfig.config.userAgentStrategy.defaultUserAgent,
          ...(input.authHeaders || {})
        },
        body: JSON.stringify({
          broker: 'spokeo',
          requestId: request.requestId,
          action: request.action,
          identityHints: request.identityHints,
          compliance
        })
      });

      if (response.status === 403 && input.captchaDetected) {
        return {
          broker: 'spokeo',
          status: 'blocked',
          reason: 'captcha_requires_human',
          nextActions: ['Send the request to the captcha-to-human queue for operator handling.'],
          compliance,
          antiBot: antiBotPlaceholders(endpointConfig.config)
        };
      }

      if (response.status >= 500 || response.status === 429) {
        const error = new Error(`Spokeo official endpoint transient status ${response.status}`);
        error.code = `HTTP_${response.status}`;
        error.transient = true;
        throw error;
      }

      if (!response.ok) {
        const error = new Error(`Spokeo official endpoint rejected status ${response.status}`);
        error.code = `HTTP_${response.status}`;
        error.transient = false;
        throw error;
      }

      return {
        broker: 'spokeo',
        status: 'submitted',
        dryRun: false,
        ticketId: `spokeo-${request.requestId}-${Date.now()}`,
        submittedAt: new Date().toISOString(),
        endpoint: endpointConfig.endpoint,
        httpStatus: response.status,
        responseBody: await safeJson(response),
        compliance,
        antiBot: antiBotPlaceholders(endpointConfig.config)
      };
    }

    if (input.simulate?.spokeo === 'transient-error') {
      const error = new Error('Spokeo live endpoint temporary unavailable');
      error.code = 'BROKER_RATE_LIMITED';
      error.transient = true;
      throw error;
    }

    const endpoint = process.env.SPOKEO_LIVE_ENDPOINT || input.liveEndpoint || 'https://postman-echo.com/post';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(input.authHeaders || {})
      },
      body: JSON.stringify({
        broker: 'spokeo',
        requestId: request.requestId,
        action: request.action,
        identityHints: request.identityHints
      })
    });

    if (response.status >= 500 || response.status === 429) {
      const error = new Error(`Spokeo live transient status ${response.status}`);
      error.code = `HTTP_${response.status}`;
      error.transient = true;
      throw error;
    }

    if (!response.ok) {
      const error = new Error(`Spokeo live rejected status ${response.status}`);
      error.code = `HTTP_${response.status}`;
      error.transient = false;
      throw error;
    }

    const body = await response.json();
    return {
      broker: 'spokeo',
      status: 'submitted',
      dryRun: false,
      ticketId: `spokeo-${request.requestId}-${Date.now()}`,
      submittedAt: new Date().toISOString(),
      endpoint,
      httpStatus: response.status,
      responseBody: body
    };
  },

  parseResult(submission, request) {
    if (submission.status === 'blocked') {
      return {
        broker: 'spokeo',
        status: 'blocked',
        requestId: request.requestId,
        reason: submission.reason,
        nextActions: submission.nextActions,
        compliance: submission.compliance,
        antiBot: submission.antiBot,
        notes: submission.complianceNotes || []
      };
    }

    const parsed = dry.parseResult(submission, request);
    return {
      ...parsed,
      dryRun: Boolean(submission.dryRun),
      evidence: {
        endpoint: submission.endpoint || null,
        httpStatus: submission.httpStatus || null,
        echoRequestId: submission.responseBody?.json?.requestId || null
      },
      notes: submission.dryRun
        ? parsed.notes
        : ['Live HTTP submission executed against configured endpoint.']
    };
  }
};

export default spokeoAdapter;

function complianceSnapshot(input = {}) {
  return {
    termsAccepted: input.termsAccepted === true,
    lawfulBasis: input.lawfulBasis || null,
    operatorId: input.operatorId || null
  };
}

function resolveOfficialEndpoint(input = {}) {
  const config = officialEndpoints.spokeo;
  const mode = input.officialEndpointMode || 'api';
  const selected = config[mode] || config.api;
  const endpoint = input.officialEndpoint || process.env[selected.endpointEnv] || selected.endpoint;
  return {
    config,
    endpoint,
    method: selected.method || 'POST',
    configured: Boolean(config.enabled && endpoint)
  };
}

function antiBotPlaceholders(config) {
  return {
    rateLimiting: config.rateLimitPolicy,
    jitter: {
      enabled: true,
      minMs: config.rateLimitPolicy.jitterMsMin,
      maxMs: config.rateLimitPolicy.jitterMsMax
    },
    userAgentStrategy: config.userAgentStrategy,
    captchaToHumanQueue: config.captchaToHumanQueue
  };
}

async function waitWithJitter(policy = {}) {
  const min = Number(policy.jitterMsMin) || 0;
  const max = Number(policy.jitterMsMax) || min;
  const delay = Math.floor(min + Math.random() * Math.max(0, max - min));
  if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
