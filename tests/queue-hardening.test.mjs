import test from 'node:test';
import assert from 'node:assert/strict';

import { RetryQueue } from '../src/queue/retry-queue.mjs';
import { ManualReviewQueue } from '../src/queue/manual-review-queue.mjs';
import { DeadLetterQueue } from '../src/queue/dead-letter-queue.mjs';
import { runB1Pipeline } from '../src/orchestrator/b1-runner.mjs';

const input = {
  requestId: 'queue-hardening-1',
  person: { fullName: 'Queue User' }
};

test('retry and manual queues deduplicate broker request reason hash', () => {
  const retry = new RetryQueue({ maxAttempts: 3, baseDelayMs: 10 });
  const payload = { broker: 'spokeo', requestId: 'dedupe-1' };

  const first = retry.enqueue({ reason: 'transient_submit_error', payload });
  const second = retry.enqueue({ reason: 'transient_submit_error', payload });

  assert.equal(first.id, second.id);
  assert.equal(retry.items.length, 1);
  assert.equal(second.deduped, true);

  const manual = new ManualReviewQueue();
  const firstManual = manual.enqueue({ reason: 'needs_operator', payload });
  const secondManual = manual.enqueue({ reason: 'needs_operator', payload });

  assert.equal(firstManual.id, secondManual.id);
  assert.equal(manual.items.length, 1);
  assert.equal(secondManual.deduped, true);
});

test('max attempts and non retryable errors are routed to dead letter queue', async () => {
  const retryQueue = new RetryQueue({ maxAttempts: 1, baseDelayMs: 10 });
  const manualReviewQueue = new ManualReviewQueue();
  const deadLetterQueue = new DeadLetterQueue();

  const transient = await runB1Pipeline({
    brokers: ['spokeo'],
    input: { ...input, simulate: { spokeo: 'transient-error' } },
    retryQueue,
    manualReviewQueue,
    deadLetterQueue
  });

  assert.equal(transient.summary.deadLetterQueued, 1);
  assert.equal(deadLetterQueue.items[0].reason, 'retry_limit_reached');
  assert.equal(manualReviewQueue.items.length, 0);

  const permanent = await runB1Pipeline({
    brokers: ['whitepages'],
    input: { ...input, requestId: 'queue-hardening-2', simulate: { whitepages: 'permanent-error' } },
    retryQueue,
    manualReviewQueue,
    deadLetterQueue
  });

  assert.equal(permanent.summary.deadLetterQueued, 1);
  assert.equal(deadLetterQueue.items.length, 2);
  assert.equal(deadLetterQueue.items[1].reason, 'submit_failed');
});
