import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { runB1Pipeline } from '../src/orchestrator/b1-runner.mjs';
import { RetryQueue } from '../src/queue/retry-queue.mjs';
import { ManualReviewQueue } from '../src/queue/manual-review-queue.mjs';
import { DeadLetterQueue } from '../src/queue/dead-letter-queue.mjs';
import { createDefaultStore } from '../src/queue/state-store.mjs';
import { AuthSession } from '../src/auth/session-auth.mjs';

// Empty session bypasses the default SecretStore creation (which would
// otherwise touch data/secret-store.json). Dry-run pipeline doesn't validate.
const noAuth = new AuthSession({});
const liveAuth = new AuthSession({
  token: 'demo-token',
  scopes: ['submit:spokeo'],
  expiresAt: '2026-12-31T00:00:00.000Z'
});

const sampleInput = {
  requestId: 'b1-test-001',
  person: {
    fullName: 'Ada Example',
    emails: ['ada@example.test'],
    phones: ['+15550101010'],
    jurisdiction: 'US'
  }
};

// F-4 isolation: every test gets its own tmp state file so npm test never
// touches data/queue-state.json. runB1Pipeline's default store fallback
// would otherwise pollute the user's real audit trail.
function withIsolatedStore(fn) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vanish-b1-queue-'));
  const store = createDefaultStore({ filePath: path.join(tmpDir, 'queue-state.json') });
  return Promise.resolve(fn(store)).finally(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
}

test('transient submit error enters retry queue', async () => {
  await withIsolatedStore(async (store) => {
    const retryQueue = new RetryQueue({ maxAttempts: 3, baseDelayMs: 100 });
    const manualReviewQueue = new ManualReviewQueue();

    const result = await runB1Pipeline({
      brokers: ['spokeo'],
      input: {
        ...sampleInput,
        simulate: { spokeo: 'transient-error' }
      },
      retryQueue,
      manualReviewQueue,
      store,
      auth: noAuth
    });

    assert.equal(result.summary.successful, 0);
    assert.equal(result.summary.retryQueued, 1);
    assert.equal(result.summary.manualReviewQueued, 0);
    assert.equal(retryQueue.items.length, 1);
    assert.equal(retryQueue.items[0].payload.broker, 'spokeo');
    assert.equal(retryQueue.items[0].attempt, 1);
    assert.equal(manualReviewQueue.items.length, 0);
  });
});

test('exceed threshold enters dead letter queue', async () => {
  await withIsolatedStore(async (store) => {
    const retryQueue = new RetryQueue({ maxAttempts: 1, baseDelayMs: 100 });
    const manualReviewQueue = new ManualReviewQueue();
    const deadLetterQueue = new DeadLetterQueue();

    const result = await runB1Pipeline({
      brokers: ['whitepages'],
      input: {
        ...sampleInput,
        requestId: 'b1-test-002',
        simulate: { whitepages: 'transient-error' }
      },
      retryQueue,
      manualReviewQueue,
      deadLetterQueue,
      store,
      auth: noAuth
    });

    assert.equal(result.summary.successful, 0);
    assert.equal(result.summary.retryQueued, 0);
    assert.equal(result.summary.manualReviewQueued, 0);
    assert.equal(result.summary.deadLetterQueued, 1);
    assert.equal(retryQueue.items.length, 0);
    assert.equal(manualReviewQueue.items.length, 0);
    assert.equal(deadLetterQueue.items.length, 1);
    assert.equal(deadLetterQueue.items[0].reason, 'retry_limit_reached');
    assert.equal(deadLetterQueue.items[0].status, 'open');
    assert.equal(deadLetterQueue.items[0].payload.broker, 'whitepages');
  });
});

test('success path uses no queue', async () => {
  await withIsolatedStore(async (store) => {
    const retryQueue = new RetryQueue({ maxAttempts: 3, baseDelayMs: 100 });
    const manualReviewQueue = new ManualReviewQueue();

    const result = await runB1Pipeline({
      brokers: ['beenverified'],
      input: {
        ...sampleInput,
        requestId: 'b1-test-003'
      },
      retryQueue,
      manualReviewQueue,
      store,
      auth: noAuth
    });

    assert.equal(result.summary.successful, 1);
    assert.equal(result.summary.retryQueued, 0);
    assert.equal(result.summary.manualReviewQueued, 0);
    assert.equal(retryQueue.items.length, 0);
    assert.equal(manualReviewQueue.items.length, 0);
    assert.equal(result.results[0].broker, 'beenverified');
    assert.equal(result.results[0].status, 'success');
  });
});

test('official-mode compliance block is not recorded as completed', async () => {
  await withIsolatedStore(async (store) => {
    const result = await runB1Pipeline({
      brokers: ['spokeo'],
      input: {
        ...sampleInput,
        requestId: 'b1-test-official-block',
        officialMode: true,
        operatorId: 'operator-1',
        lawfulBasis: 'consumer-request'
      },
      store,
      live: true,
      auth: liveAuth
    });

    assert.equal(result.status, 'blocked');
    assert.equal(result.summary.successful, 0);
    assert.equal(result.summary.blocked, 1);
    assert.equal(result.queues.completed.length, 0);
    assert.equal(result.queues.failed.length, 1);
    assert.equal(result.results[0].status, 'blocked');
    assert.equal(result.results[0].reason, 'compliance_not_confirmed');
  });
});
