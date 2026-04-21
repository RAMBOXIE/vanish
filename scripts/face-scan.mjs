#!/usr/bin/env node

// Face-search service scanner — guides you through checking each major
// face-search service (PimEyes, FaceCheck.ID, FindClone, Lenso, Yandex,
// Google Lens, TinEye) to see if your face appears anywhere on the
// public web.
//
// Vanish does NOT upload your photo. You do, on each service's own page,
// in your own browser. Vanish just:
//   1. Opens each search page
//   2. Prints step-by-step instructions
//   3. Explains what free vs paid tiers show
//   4. Notes privacy concerns per service (e.g., PimEyes retains uploads 48h)
//
// Usage:
//   vanish face-scan --pimeyes
//   vanish face-scan --pimeyes --facecheck --findclone
//   vanish face-scan --use pimeyes,facecheck,lenso
//   vanish face-scan --all
//   vanish face-scan --free-only          (only services with free tier)

import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

import { resolveServiceKeys, planFaceScan } from '../src/face-scanner/face-scan-engine.mjs';

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

async function runServiceScan(entry, opts) {
  const { key, service } = entry;
  const w = service.scanWalkthrough;

  await writeAsync(process.stdout,
    `\n━━━ ${service.displayName} (${key}) ━━━\n`
    + `Category: ${service.category} | Access: ${service.accessModel} | Est. ${service.estimatedSeconds}s\n`
    + `Known for: ${service.knownFor}\n`
    + `Pricing: ${service.pricing}\n`
    + `Jurisdiction: ${service.jurisdiction}\n`
    + `Search page: ${service.searchUrl}\n\n`
  );

  if (!opts.noOpen && service.searchUrl) {
    await writeAsync(process.stdout, `Opening: ${service.searchUrl}\n`);
    openUrl(service.searchUrl);
  }

  await writeAsync(process.stdout, `\nHow to check:\n`);
  for (let i = 0; i < w.steps.length; i++) {
    await writeAsync(process.stdout, `  ${i + 1}. ${w.steps[i]}\n`);
  }

  if (w.verification) {
    await writeAsync(process.stdout, `\n✓ Success looks like: ${w.verification}\n`);
  }

  if (w.privacyNote) {
    await writeAsync(process.stdout, `\n⚠️  Privacy note: ${w.privacyNote}\n`);
  }

  if (!opts.noOpen) {
    await opts.promptLine(`\nPress ENTER when done (or 'a' to abort, 's' to skip rest): `)
      .then(answer => {
        if (answer.toLowerCase().startsWith('a')) throw new Error('User aborted');
        if (answer.toLowerCase().startsWith('s')) throw new Error('User skipped remaining');
      });
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || args.h) {
    await writeAsync(process.stdout, `
Face-search scanner — find where your face appears on the public web.

Vanish does NOT upload your photo. You upload it yourself on each
service's page. Vanish just opens each page and gives you a walkthrough
of what to do + what to expect.

Usage:
  vanish face-scan [flags]

Services:
  --pimeyes          PimEyes — the most infamous; best coverage; freemium
  --facecheck        FaceCheck.ID — growing competitor to PimEyes
  --findclone        FindClone — Russian service; best Slavic coverage; paid only
  --lenso            Lenso — newer EU-based; GDPR-compliant
  --yandex           Yandex Images — reverse image with face matching
  --google-lens      Google Lens — reverse image; limited face match
  --tineye           TinEye — exact/near-duplicate image finder (not face-specific)
  --clearview        Clearview AI — LE-only; can't scan yourself, only opt out

  --all              Every service with a scan walkthrough (7 excluding clearview)
  --use <csv>        Comma-separated: --use pimeyes,facecheck,lenso
  --free-only        Filter to services with free tier (skips findclone)

Other:
  --no-open          Don't open browser (test/scripting mode)
  --help             This message

Examples:
  # The classic 3-service face-scan audit
  vanish face-scan --pimeyes --facecheck --findclone

  # Quick free check
  vanish face-scan --pimeyes --facecheck --tineye --yandex --google-lens

  # See everything
  vanish face-scan --all

Note: After scanning, use 'vanish face-opt-out' to request removal from
services where you found unwanted matches.
`);
    process.exit(0);
  }

  let keys = resolveServiceKeys(args, catalog);

  // Apply --free-only filter
  if (args['free-only']) {
    keys = keys.filter(k => {
      const model = catalog.services[k].accessModel;
      return model === 'free' || model === 'freemium';
    });
  }

  if (keys.length === 0) {
    await writeAsync(process.stderr, `
No services specified. Use --help to see available flags, or:
  vanish face-scan --pimeyes --facecheck
  vanish face-scan --use pimeyes,facecheck,lenso
  vanish face-scan --all
`);
    process.exit(1);
  }

  const { plan, unscannable } = planFaceScan(keys, catalog);

  const noOpen = Boolean(args['no-open']);
  const rl = noOpen ? null : readline.createInterface({ input: stdin, output: stdout });
  const opts = {
    noOpen,
    promptLine: async (q) => noOpen ? '' : (await rl.question(q)).trim()
  };

  await writeAsync(process.stdout,
    `\nFace-search scan plan: ${plan.length} service(s)\n`
    + `Mode: ${noOpen ? 'no-open (test)' : 'interactive'}\n`
  );

  if (unscannable.length > 0) {
    await writeAsync(process.stdout,
      `\nNote: ${unscannable.length} service(s) have no public search — `
      + `use 'vanish face-opt-out' to request data removal from them instead:\n`
    );
    for (const { key, service } of unscannable) {
      await writeAsync(process.stdout, `  - ${service.displayName} (${service.accessModel})\n`);
    }
  }

  try {
    for (const entry of plan) {
      try {
        await runServiceScan(entry, opts);
      } catch (err) {
        if (err.message === 'User aborted') break;
        if (err.message === 'User skipped remaining') break;
        await writeAsync(process.stderr, `\n✗ ${entry.key} failed: ${err.message}\n`);
      }
    }
  } finally {
    if (rl) rl.close();
  }

  await writeAsync(process.stdout, `\n━━━ Summary ━━━\n`);
  await writeAsync(process.stdout, `Scanned: ${plan.length} service(s)\n`);
  await writeAsync(process.stdout,
    `\nFound matches you want removed? Run:\n`
    + `  vanish face-opt-out --pimeyes --facecheck --clearview  (or whichever)\n`
  );

  process.exit(0);
}

main().catch(err => {
  process.stderr.write(`\nError: ${err.message}\n`, () => process.exit(1));
});
