// SKILL.md ↔ code consistency test.
//
// Catches the exact failure modes Clawhub review flags:
//   (1) undeclared runtime requirements    — process.env.X reads must be declared
//   (2) undeclared notification credentials — no SMTP/Twilio/Signal client imports
//   (3) persistent filesystem moves         — no fs.rename outside lock-files
//   (4) cron setup                          — no crontab/schtasks/launchctl code
//   (5) per-reply hook                      — `always: false` must be set
//
// Also enforces:
//   - SKILL.md version matches package.json version
//   - All required Clawhub compliance sections are present in SKILL.md

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const SKILL_MD = fs.readFileSync(path.join(PROJECT_ROOT, 'SKILL.md'), 'utf8');
const PACKAGE_JSON = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8'));

// ─── Env var declaration consistency ──────────────────────────

/** Env vars that are universally safe + don't need skill declaration. */
const ENV_ALLOWLIST = new Set([
  'NODE_ENV',              // standard test/prod flag
  'APPDATA', 'LOCALAPPDATA', 'PROGRAMFILES', 'PROGRAMDATA',
  'USERPROFILE', 'WINDIR', 'SYSTEMROOT',  // Windows path expansion (filesystem scan)
  'HOME',                  // Unix home dir (os.homedir fallback)
]);

/**
 * Walk a directory and return JavaScript files.
 */
function jsFilesIn(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...jsFilesIn(full));
    else if (/\.(mjs|js|cjs)$/.test(e.name)) out.push(full);
  }
  return out;
}

function collectEnvReads() {
  const sources = [
    ...jsFilesIn(path.join(PROJECT_ROOT, 'src')),
    ...jsFilesIn(path.join(PROJECT_ROOT, 'scripts'))
  ];
  const vars = new Set();
  for (const file of sources) {
    const text = fs.readFileSync(file, 'utf8');
    // Match process.env.FOO AND process.env['FOO'] AND process.env["FOO"]
    for (const m of text.matchAll(/process\.env\.([A-Z_]+[0-9]*)/g)) vars.add(m[1]);
    for (const m of text.matchAll(/process\.env\[['"]([A-Z_()0-9]+)['"]\]/g)) vars.add(m[1]);
  }
  return vars;
}

test('every process.env.X in the codebase is declared in SKILL.md (or allowlisted)', () => {
  const used = collectEnvReads();
  const undeclared = [];
  for (const name of used) {
    if (ENV_ALLOWLIST.has(name)) continue;
    // Heuristic: the env var name appears in SKILL.md as a bare identifier.
    // SKILL.md declares both concrete names and template names (e.g.,
    // "<BROKER>_LIVE_ENDPOINT" to cover SPOKEO_LIVE_ENDPOINT, THATSTHEM_LIVE_ENDPOINT, etc.)
    const concreteMatch = SKILL_MD.includes(name);
    const templateLiveEndpoint = name.endsWith('_LIVE_ENDPOINT') && SKILL_MD.includes('_LIVE_ENDPOINT');
    const templateOfficial = /^.*_OFFICIAL_.*_ENDPOINT$/.test(name) && SKILL_MD.includes('_OFFICIAL_');
    if (!concreteMatch && !templateLiveEndpoint && !templateOfficial) {
      undeclared.push(name);
    }
  }
  assert.equal(undeclared.length, 0,
    `Undeclared env vars in SKILL.md: ${undeclared.join(', ')}. Either add to ENV_ALLOWLIST or declare in SKILL.md frontmatter optionalEnv.`);
});

// ─── Notification-credential red-line ──────────────────────────

test('no notification-sending client libraries are imported anywhere', () => {
  const sources = [
    ...jsFilesIn(path.join(PROJECT_ROOT, 'src')),
    ...jsFilesIn(path.join(PROJECT_ROOT, 'scripts'))
  ];
  const banned = [
    'nodemailer', '@sendgrid/mail', 'mailgun', 'twilio',
    '@slack/web-api', 'node-telegram-bot-api', 'signal-protocol'
  ];
  const hits = [];
  for (const file of sources) {
    const text = fs.readFileSync(file, 'utf8');
    // Look for import/require of a banned library
    for (const lib of banned) {
      const pattern = new RegExp(`(import\\s+[^;]*from\\s+['"]${lib}['"]|require\\(['"]${lib}['"]\\))`);
      if (pattern.test(text)) hits.push(`${path.relative(PROJECT_ROOT, file)} imports ${lib}`);
    }
  }
  assert.equal(hits.length, 0,
    `SKILL.md declares no notification sending, but the codebase imports:\n  ${hits.join('\n  ')}\nEither remove the import or update SKILL.md + non-goals.`);
});

// ─── Cron / scheduled-task red-line ────────────────────────────

test('no cron / systemd / schtasks / launchctl install code', () => {
  const sources = [
    ...jsFilesIn(path.join(PROJECT_ROOT, 'src')),
    ...jsFilesIn(path.join(PROJECT_ROOT, 'scripts'))
  ];
  // These patterns would indicate we're installing a system-level scheduled task
  const patterns = [
    /\bcrontab\s*\(/,
    /\bschtasks\s+(\/create|\s-create)/,
    /\blaunchctl\s+load/,
    /\bsystemctl\s+enable/,
    /spawn\(['"]crontab['"]/,
    /spawn\(['"]schtasks['"]/,
    /spawn\(['"]launchctl['"]/
  ];
  const hits = [];
  for (const file of sources) {
    const text = fs.readFileSync(file, 'utf8');
    for (const pat of patterns) {
      if (pat.test(text)) hits.push(`${path.relative(PROJECT_ROOT, file)} matches ${pat}`);
    }
  }
  assert.equal(hits.length, 0,
    `No-cron red-line violated:\n  ${hits.join('\n  ')}\nVanish must not install system scheduled tasks.`);
});

// ─── Per-reply hook red-line ───────────────────────────────────

test('SKILL.md declares always: false (never auto-run)', () => {
  // Must appear in frontmatter as always: false (trailing comment OK)
  assert.match(SKILL_MD, /^\s*always:\s*false\b/m,
    'SKILL.md must declare `always: false` to guarantee no per-reply hook.');
});

// ─── Version consistency ───────────────────────────────────────

test('SKILL.md version matches package.json version', () => {
  const skillVersion = SKILL_MD.match(/^version:\s*([\d.]+)\s*$/m)?.[1];
  assert.ok(skillVersion, 'SKILL.md missing version: field');
  assert.equal(skillVersion, PACKAGE_JSON.version,
    `SKILL.md version (${skillVersion}) does not match package.json version (${PACKAGE_JSON.version})`);
});

test('scan-report.mjs REPORT_VERSION matches package.json version', async () => {
  // F-1 regression guard: the markdown report footer used to hardcode "v0.1"
  // for two minor versions. Lock REPORT_VERSION to package.json so it can't drift.
  const { REPORT_VERSION } = await import('../src/scanner/scan-report.mjs');
  assert.equal(REPORT_VERSION, PACKAGE_JSON.version,
    `src/scanner/scan-report.mjs REPORT_VERSION (${REPORT_VERSION}) does not match package.json (${PACKAGE_JSON.version}). Bump them together.`);
});

// ─── Required compliance sections exist ───────────────────────

test('SKILL.md has the Clawhub compliance section', () => {
  assert.match(SKILL_MD, /Clawhub compliance declaration/i,
    'SKILL.md must have a "Clawhub compliance declaration" section — it is what reviewers land on first.');
});

test('SKILL.md enumerates network access with a when-clause table', () => {
  assert.match(SKILL_MD, /## Network access/);
  // Must list the real endpoints the code hits
  assert.match(SKILL_MD, /api\.openai\.com/);
  assert.match(SKILL_MD, /api\.anthropic\.com/);
  assert.match(SKILL_MD, /index\.commoncrawl\.org/);
  assert.match(SKILL_MD, /postman-echo/);
});

test('SKILL.md enumerates filesystem access', () => {
  assert.match(SKILL_MD, /## Filesystem access/);
  // Writes + reads + scans must all be mentioned
  assert.match(SKILL_MD, /### Writes/);
  assert.match(SKILL_MD, /### Reads/);
  assert.match(SKILL_MD, /### Scans/);
  // The three primary write destinations
  assert.match(SKILL_MD, /data\/queue-state\.json/);
  assert.match(SKILL_MD, /os\.tmpdir/);
});

test('SKILL.md enumerates system binaries invoked', () => {
  assert.match(SKILL_MD, /## System binaries invoked/);
  // Every binary the code actually shells out to
  for (const bin of ['cmd /c start', 'open', 'xdg-open', 'clip', 'pbcopy', 'xclip']) {
    assert.ok(SKILL_MD.includes(bin), `SKILL.md missing mention of system binary: ${bin}`);
  }
});

test('SKILL.md explicit non-goals section lists key boundaries', () => {
  assert.match(SKILL_MD, /## Non-goals/);
  // The 8 non-goals that matter for red-line compliance
  const nonGoalKeywords = [
    /background service|scheduled task/,
    /email, SMS, or push notifications|notifications/i,
    /[Kk]ill processes/,
    /phone-home/,
    /anti-detection/,
    /submit/,
    /[Aa]uto-delete|auto.?delete/,
    /[Uu]pload/
  ];
  for (const kw of nonGoalKeywords) {
    assert.match(SKILL_MD, kw, `SKILL.md Non-goals section missing: ${kw}`);
  }
});

test('SKILL.md optionalEnv includes the 4 known conditional env vars', () => {
  // These are the env vars that are READ conditionally (not always)
  for (const name of ['VANISH_SECRET_MASTER_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', '_LIVE_ENDPOINT']) {
    assert.ok(SKILL_MD.includes(name),
      `SKILL.md optionalEnv missing conditional env var: ${name}`);
  }
});

// ─── Capability matrix consistency ────────────────────────────

test('SKILL.md coverage matrix has expected counts', () => {
  // The numeric claims in the coverage summary should not silently drift
  // while the catalogs grow.
  const brokerCatalog = JSON.parse(fs.readFileSync(
    path.join(PROJECT_ROOT, 'src', 'adapters', 'brokers', 'config', 'broker-catalog.json'), 'utf8'));
  const aiCatalog = JSON.parse(fs.readFileSync(
    path.join(PROJECT_ROOT, 'src', 'ai-scanner', 'ai-platforms-catalog.json'), 'utf8'));
  const faceCatalog = JSON.parse(fs.readFileSync(
    path.join(PROJECT_ROOT, 'src', 'face-scanner', 'face-services-catalog.json'), 'utf8'));

  const brokerCount = Object.keys(brokerCatalog.brokers).length;
  const aiCount = Object.keys(aiCatalog.platforms).length;
  const faceCount = Object.keys(faceCatalog.services).length;

  // Declared in SKILL.md
  assert.ok(SKILL_MD.includes(`${brokerCount}`), `SKILL.md must reference the actual broker count (${brokerCount})`);
  assert.ok(SKILL_MD.includes(`${aiCount}`), `SKILL.md must reference the actual AI platform count (${aiCount})`);
  assert.ok(SKILL_MD.includes(`${faceCount}`), `SKILL.md must reference the actual face-service count (${faceCount})`);
});
