import test from 'node:test';
import assert from 'node:assert/strict';

import { runB1Pipeline } from '../src/orchestrator/b1-runner.mjs';
import { RetryQueue } from '../src/queue/retry-queue.mjs';
import { ManualReviewQueue } from '../src/queue/manual-review-queue.mjs';

const sampleInput = {
  requestId: 'b1-test-001',
  person: {
    fullName: 'Ada Example',
    emails: ['ada@example.test'],
    phones: ['+15550101010'],
    jurisdiction: 'US'
  }
};

test('transient submit error enters retry queue', async () => {
  const retryQueue = new RetryQueue({ maxAttempts: 3, baseDelayMs: 100 });
  const manualReviewQueue = new ManualReviewQueue();

  const result = await runB1Pipeline({
    brokers: ['spokeo'],
    input: {
      ...sampleInput,
      simulate: { spokeo: 'transient-error' }
    },
    retryQueue,
    manualReviewQueue
  });

  assert.equal(result.summary.successful, 0);
  assert.equal(result.summary.retryQueued, 1);
  assert.equal(result.summary.manualReviewQueued, 0);
  assert.equal(retryQueue.items.length, 1);
  assert.equal(retryQueue.items[0].payload.broker, 'spokeo');
  assert.equal(retryQueue.items[0].attempt, 1);
  assert.equal(manualReviewQueue.items.length, 0);
});

test('exceed threshold enters manual review queue', async () => {
  const retryQueue = new RetryQueue({ maxAttempts: 1, baseDelayMs: 100 });
  const manualReviewQueue = new ManualReviewQueue();

  const result = await runB1Pipeline({
    brokers: ['whitepages'],
    input: {
      ...sampleInput,
      requestId: 'b1-test-002',
      simulate: { whitepages: 'transient-error' }
    },
    retryQueue,
    manualReviewQueue
  });

  assert.equal(result.summary.successful, 0);
  assert.equal(result.summary.retryQueued, 0);
  assert.equal(result.summary.manualReviewQueued, 1);
  assert.equal(retryQueue.items.length, 0);
  assert.equal(manualReviewQueue.items.length, 1);
  assert.equal(manualReviewQueue.items[0].reason, 'retry_limit_reached');
  assert.equal(manualReviewQueue.items[0].status, 'open');
  assert.equal(manualReviewQueue.items[0].payload.broker, 'whitepages');
});

test('success path uses no queue', async () => {
  const retryQueue = new RetryQueue({ maxAttempts: 3, baseDelayMs: 100 });
  const manualReviewQueue = new ManualReviewQueue();

  const result = await runB1Pipeline({
    brokers: ['beenverified'],
    input: {
      ...sampleInput,
      requestId: 'b1-test-003'
    },
    retryQueue,
    manualReviewQueue
  });

  assert.equal(result.summary.successful, 1);
  assert.equal(result.summary.retryQueued, 0);
  assert.equal(result.summary.manualReviewQueued, 0);
  assert.equal(retryQueue.items.length, 0);
  assert.equal(manualReviewQueue.items.length, 0);
  assert.equal(result.results[0].broker, 'beenverified');
  assert.equal(result.results[0].status, 'success');
});
