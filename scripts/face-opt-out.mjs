#!/usr/bin/env node

// Browser-assisted opt-out from face-search services and face databases.
//
// Like ai-opt-out for AI platforms — walks you through the opt-out form
// on each service, one at a time. Records HMAC-signed audit trail +
// schedules follow-up re-verification (30 days for most, 60 for Clearview
// since they're slower).
//
// Usage:
//   vanish face-opt-out --pimeyes
//   vanish face-opt-out --pimeyes --facecheck --clearview
//   vanish face-opt-out --all
//   vanish face-opt-out --pimeyes --no-open   (test mode)

import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';

import { QueueStateStore } from '../src/queue/state-store.mjs';
import { signAuditEvents } from '../src/audit/signature.mjs';
import { resolveServiceKeys, planFaceOptOut } from '../src/face-scanner/face-scan-engine.mjs';

const require = createRequire(import.meta.url);
const catalog = require('../src/face-scanner/face-services-catalog.json');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) { out[key] = true; }
    else { out[key] = next; i++; }
  }
  return out;
}

function writeAsync(stream, text) {
  return new Promise((resolve, reject) => {
    stream.write(text, (err) => (err ? reject(err) : resolve()));
  });
}

function openUrl(url) {
  const platform = process.platform;
  const cmd = platform === 'win32' ? 'cmd'
            : platform === 'darwin' ? 'open'
            : 'xdg-open';
  const args = platform === 'win32' ? ['/c', 'start', '""', url]
            : [url];
  try {
    spawn(cmd, args, { stdio: 'ignore', detached: true }).unref();
    return true;
  } catch (err) {
    process.stderr.write(`Failed to open ${url}: ${err.message}\n`);
    return false;
  }
}

async function runServiceOptOut(entry, opts) {
  const { key, service } = entry;
  const w = service.optOutWalkthrough;

  await writeAsync(process.stdout,
    `\n━━━ ${service.displayName} (${key}) ━━━\n`
    + `Jurisdiction: ${service.jurisdiction}\n`
    + `Opt-out URL: ${service.optOutUrl}\n\n`
  );

  if (w.targetSetting) {
    await writeAsync(process.stdout, `🎯 Target: ${w.targetSetting}\n\n`);
  }

  if (!opts.noOpen && service.optOutUrl) {
    await writeAsync(process.stdout, `Opening: ${service.optOutUrl}\n`);
    openUrl(service.optOutUrl);
  }

  await writeAsync(process.stdout, `\nSteps:\n`);
  for (let i = 0; i < w.steps.length; i++) {
    await writeAsync(process.stdout, `  ${i + 1}. ${w.steps[i]}\n`);
  }

  if (w.verification) {
    await writeAsync(process.stdout, `\n✓ Success looks like: ${w.verification}\n`);
  }

  if (w.tierOverrides) {
    await writeAsync(process.stdout, `\n💡 Tier note: ${w.tierOverrides}\n`);
  }

  let confirmed = false;
  if (opts.noOpen) {
    confirmed = true;
  } else {
    const answer = await opts.promptLine(`\nDid you submit the request? [y = yes, s = skip, a = abort]: `);
    if (answer.toLowerCase().startsWith('a')) throw new Error('User aborted');
    if (answer.toLowerCase().startsWith('s')) {
      await writeAsync(process.stdout, `Skipped.\n`);
      return { skipped: true, service: key };
    }
    confirmed = answer.toLowerCase().startsWith('y');
  }

  if (!confirmed) {
    return { skipped: true, service: key };
  }

  const now = new Date();
  // Clearview + Meta-style services take longer. Default 45 days.
  // PimEyes/FaceCheck are typically 7-30 days — 30-day default works.
  const reverifyDays = key === 'clearview-ai' ? 60 : 30;
  const recheckAt = new Date(now.getTime() + reverifyDays * 24 * 60 * 60 * 1000);

  const entry_out = {
    id: `face_followup_${now.getTime()}_${crypto.randomBytes(3).toString('hex')}`,
    kind: 'face-service',
    service: key,
    displayName: service.displayName,
    category: service.category,
    jurisdiction: service.jurisdiction,
    submittedAt: now.toISOString(),
    recheckAt: recheckAt.toISOString(),
    status: 'pending-removal'
  };

  await writeAsync(process.stdout, `✓ Recorded. Re-verify scheduled for ${recheckAt.toISOString().slice(0, 10)}.\n`);
  return { service: key, recorded: [entry_out] };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || args.h) {
    await writeAsync(process.stdout, `
Browser-assisted opt-out from face-search services.

Usage:
  vanish face-opt-out [flags]

Services:
  --pimeyes          PimEyes — free one-time opt-out form (30-60 day approval)
  --facecheck        FaceCheck.ID — opt-out form with ID verification (7-14 days)
  --findclone        FindClone — contact-email request (Russian jurisdiction)
  --lenso            Lenso — GDPR Article 17 form (must respond in 30 days)
  --yandex           Yandex — per-URL removal (NOT full biometric deletion)
  --google-lens      Google 'Results about you' tool
  --tineye           DMCA / contact request (no blanket opt-out)
  --clearview        Clearview AI — CCPA/GDPR deletion (ID verification required)

  --all              Every service with an opt-out walkthrough (all 8)
  --use <csv>        --use pimeyes,facecheck,clearview

Other:
  --no-open          Test mode — skip browser open, auto-confirm
  --state-file <p>   Queue state file (default: data/queue-state.json)
  --help             This message

Examples:
  # The essential 3 — highest priority for privacy
  vanish face-opt-out --pimeyes --facecheck --clearview

  # Comprehensive
  vanish face-opt-out --all

Note: Opt-out processing times vary — PimEyes 7-30 days, Clearview up to
60 days. Vanish schedules a re-verify followUp to prompt you to check that
your data was actually removed. Run 'vanish queue list' to see scheduled
reverifies.
`);
    process.exit(0);
  }

  const keys = resolveServiceKeys(args, catalog);
  if (keys.length === 0) {
    await writeAsync(process.stderr, `
No services specified. Use --help, or:
  vanish face-opt-out --pimeyes --clearview
  vanish face-opt-out --use pimeyes,facecheck
  vanish face-opt-out --all
`);
    process.exit(1);
  }

  const plan = planFaceOptOut(keys, catalog);
  if (plan.length === 0) {
    await writeAsync(process.stderr, `None of the selected services have an opt-out walkthrough.\n`);
    process.exit(1);
  }

  const noOpen = Boolean(args['no-open']);
  const rl = noOpen ? null : readline.createInterface({ input: stdin, output: stdout });
  const opts = {
    noOpen,
    promptLine: async (q) => noOpen ? '' : (await rl.question(q)).trim()
  };

  await writeAsync(process.stdout,
    `\nFace-service opt-out: ${plan.length} service(s)\n`
    + `Mode: ${noOpen ? 'no-open (test)' : 'interactive'}\n`
  );

  const allRecorded = [];
  const allSkipped = [];
  try {
    for (const entry of plan) {
      try {
        const result = await runServiceOptOut(entry, opts);
        if (result.recorded) allRecorded.push(...result.recorded);
        if (result.skipped) allSkipped.push({ service: entry.key });
      } catch (err) {
        if (err.message === 'User aborted') throw err;
        await writeAsync(process.stderr, `\n✗ ${entry.key} failed: ${err.message}\n`);
      }
    }
  } finally {
    if (rl) rl.close();
  }

  if (allRecorded.length > 0) {
    const store = new QueueStateStore({
      filePath: path.resolve(args['state-file'] || 'data/queue-state.json')
    });
    await store.mutate(state => {
      state.followUp = state.followUp || [];
      state.followUp.push(...allRecorded);
      const auditEvents = allRecorded.map(entry => ({
        at: entry.submittedAt,
        event: 'face_opt_out_submitted_by_user',
        service: entry.service,
        category: entry.category,
        jurisdiction: entry.jurisdiction,
        followUpId: entry.id,
        userConfirmed: true
      }));
      state.audit = signAuditEvents([...(state.audit || []), ...auditEvents]);
      return state;
    });
  }

  await writeAsync(process.stdout, `\n━━━ Summary ━━━\n`);
  await writeAsync(process.stdout, `Recorded: ${allRecorded.length} opt-out(s)\n`);
  if (allSkipped.length > 0) {
    await writeAsync(process.stdout, `Skipped: ${allSkipped.length}\n`);
  }
  if (allRecorded.length > 0) {
    await writeAsync(process.stdout,
      `Re-verify scheduled: ${allRecorded.map(e => `${e.service}@${e.recheckAt.slice(0, 10)}`).join(', ')}\n`
      + `\nRun \`vanish queue list\` to see followUp queue.\n`
    );
  }

  process.exit(0);
}

main().catch(err => {
  process.stderr.write(`\nError: ${err.message}\n`, () => process.exit(1));
});
