import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import spokeoAdapter from '../src/adapters/brokers/spokeo.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const B1_LIVE_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'b1-live.mjs');

test('spokeo official mode blocks when compliance is not confirmed', async () => {
  const request = spokeoAdapter.prepareRequest({
    requestId: 'official-block-1',
    person: { fullName: 'Official User' }
  });

  const result = await spokeoAdapter.submit(request, {
    live: true,
    officialMode: true,
    operatorId: 'operator-1',
    lawfulBasis: 'consumer-request'
  });

  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'compliance_not_confirmed');
  assert.deepEqual(result.nextActions, [
    'Confirm termsAccepted=true before live official submission.',
    'Confirm lawfulBasis and operatorId are present.',
    'Configure the official endpoint before enabling execution.'
  ]);
  assert.equal(result.compliance.termsAccepted, false);
  assert.equal(result.compliance.operatorId, 'operator-1');
  assert.equal(result.compliance.lawfulBasis, 'consumer-request');
});

test('b1-live CLI forwards official-mode flags and exits blocked', () => {
  const result = spawnSync(process.execPath, [
    B1_LIVE_SCRIPT,
    'run',
    '--live',
    '--brokers', 'spokeo',
    '--official-mode',
    '--operator-id', 'operator-1',
    '--lawful-basis', 'consumer-request',
    '--auth-token', 'demo_token',
    '--auth-scopes', 'submit:spokeo',
    '--auth-expires-at', '2026-12-31T00:00:00.000Z'
  ], {
    encoding: 'utf8',
    env: { ...process.env, VANISH_AUDIT_HMAC_KEY: 'test-key' }
  });

  assert.equal(result.status, 1, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.status, 'blocked');
  assert.equal(payload.summary.blocked, 1);
  assert.equal(payload.results[0].reason, 'compliance_not_confirmed');
});
