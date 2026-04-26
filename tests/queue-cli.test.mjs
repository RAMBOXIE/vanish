import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const QUEUE_CLI = path.join(PROJECT_ROOT, 'scripts', 'queue-cli.mjs');

// ─── F-2 regression guard: `queue list` defaults to table, --json keeps JSON

function spawnQueueList(stateFile, extraArgs = []) {
  return spawnSync(process.execPath, [
    QUEUE_CLI, 'list', '--state-file', stateFile, ...extraArgs
  ], { encoding: 'utf8', env: { ...process.env, NODE_ENV: 'test' } });
}

function withTmpState(seed, fn) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vanish-queue-cli-'));
  const stateFile = path.join(tmpDir, 'queue-state.json');
  fs.writeFileSync(stateFile, JSON.stringify(seed, null, 2));
  try { return fn(stateFile); }
  finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
}

test('queue list (default) renders a table with headers + box drawing chars', () => {
  withTmpState({
    retry: [], manualReview: [], deadLetter: [], completed: [], failed: [], audit: [],
    followUp: [
      {
        id: 'f1',
        kind: 'ai-platform',
        platform: 'openai-chatgpt',
        displayName: 'OpenAI ChatGPT',
        submittedAt: '2026-04-26T00:00:00.000Z',
        recheckAt:   '2026-06-25T00:00:00.000Z',
        status: 'pending-reverification'
      }
    ]
  }, (stateFile) => {
    const r = spawnQueueList(stateFile);
    assert.equal(r.status, 0, `queue list failed: ${r.stderr}`);
    // Header markers
    assert.match(r.stdout, /Vanish queue state/);
    assert.match(r.stdout, /KIND\b/);
    assert.match(r.stdout, /TARGET/);
    assert.match(r.stdout, /STATUS/);
    assert.match(r.stdout, /SUBMITTED/);
    assert.match(r.stdout, /RECHECK/);
    // Row content
    assert.match(r.stdout, /OpenAI ChatGPT/);
    assert.match(r.stdout, /ai-platform/);
    assert.match(r.stdout, /pending-reverification/);
    assert.match(r.stdout, /2026-04-26/);
    assert.match(r.stdout, /2026-06-25/);
    // Should NOT be raw JSON
    assert.doesNotMatch(r.stdout, /^\s*\{/m);
  });
});

test('queue list --json keeps the raw JSON format (script-friendly)', () => {
  withTmpState({
    retry: [], manualReview: [], deadLetter: [], completed: [], failed: [], audit: [],
    followUp: [
      { id: 'b1', broker: 'spokeo', recheckAt: '2026-06-25T00:00:00.000Z', status: 'pending-email-verification' }
    ]
  }, (stateFile) => {
    const r = spawnQueueList(stateFile, ['--json']);
    assert.equal(r.status, 0);
    // Should be parseable JSON
    const parsed = JSON.parse(r.stdout);
    assert.ok(parsed.followUp);
    assert.equal(parsed.followUp.length, 1);
    assert.equal(parsed.followUp[0].broker, 'spokeo');
  });
});

test('queue list with empty state prints a helpful "(no follow-up entries)" line', () => {
  withTmpState({
    retry: [], manualReview: [], deadLetter: [], completed: [], failed: [], audit: [],
    followUp: []
  }, (stateFile) => {
    const r = spawnQueueList(stateFile);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /no follow-up entries/i);
  });
});

test('queue list shows audit count + most-recent timestamp when audit present', () => {
  withTmpState({
    retry: [], manualReview: [], deadLetter: [], completed: [], failed: [], audit: [
      { at: '2026-04-26T01:23:45.000Z', event: 'opt_out_submitted_by_user', signature: 'sha256=abc' }
    ],
    followUp: []
  }, (stateFile) => {
    const r = spawnQueueList(stateFile);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /Audit log: 1 signed event/);
    assert.match(r.stdout, /2026-04-26 01:23:45/);
  });
});

test('queue list surfaces actionable hints when retry/manualReview/dueRecheck non-empty', () => {
  // Past-due recheckAt should trigger the verify hint
  const past = new Date(Date.now() - 86400000).toISOString();
  withTmpState({
    retry: [{ id: 'r1' }],
    manualReview: [{ id: 'm1' }],
    deadLetter: [], completed: [], failed: [], audit: [],
    followUp: [
      { id: 'f1', kind: 'ai-platform', platform: 'openai-chatgpt', displayName: 'OpenAI ChatGPT',
        submittedAt: past, recheckAt: past, status: 'pending-reverification' }
    ]
  }, (stateFile) => {
    const r = spawnQueueList(stateFile);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /due for re-verification/);
    assert.match(r.stdout, /vanish verify/);
    assert.match(r.stdout, /vanish queue resolve/);
    assert.match(r.stdout, /vanish queue retry/);
  });
});
