import crypto from 'node:crypto';

const DEFAULT_SECRET = 'holmes-local-audit-development-key';

export function signAuditEvent(event, { secret = process.env.HOLMES_AUDIT_HMAC_KEY || DEFAULT_SECRET } = {}) {
  const unsigned = { ...event };
  delete unsigned.signature;
  delete unsigned.signatureAlgorithm;

  return {
    ...unsigned,
    signatureAlgorithm: 'HMAC-SHA256',
    signature: `sha256=${hmac(unsigned, secret)}`
  };
}

export function verifyAuditEvent(event, { secret = process.env.HOLMES_AUDIT_HMAC_KEY || DEFAULT_SECRET } = {}) {
  if (!event?.signature) return false;
  const expected = signAuditEvent(event, { secret }).signature;
  return timingSafeEqual(expected, event.signature);
}

export function signAuditEvents(events, options = {}) {
  return events.map(event => event.signature ? event : signAuditEvent(event, options));
}

function hmac(value, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(canonicalJson(value))
    .digest('hex');
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function timingSafeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}
