#!/usr/bin/env node

import { runB1Pipeline } from '../src/orchestrator/b1-runner.mjs';
import { RetryQueue } from '../src/queue/retry-queue.mjs';
import { ManualReviewQueue } from '../src/queue/manual-review-queue.mjs';

const input = {
  requestId: 'b1-demo-001',
  person: {
    fullName: 'Ada Example',
    emails: ['ada@example.test'],
    phones: ['+15550101010'],
    usernames: ['ada-example'],
    jurisdiction: 'US'
  },
  simulate: {
    whitepages: 'transient-error'
  }
};

const result = await runB1Pipeline({
  brokers: ['spokeo', 'whitepages', 'beenverified'],
  input,
  retryQueue: new RetryQueue({ maxAttempts: 3, baseDelayMs: 250 }),
  manualReviewQueue: new ManualReviewQueue()
});

console.log(JSON.stringify(result, null, 2));
