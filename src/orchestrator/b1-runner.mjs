import { getBrokerAdapters, listBrokerAdapters } from '../adapters/registry.mjs';
import { RetryQueue } from '../queue/retry-queue.mjs';
import { ManualReviewQueue } from '../queue/manual-review-queue.mjs';

export async function runB1Pipeline({
  brokers = listBrokerAdapters(),
  input,
  retryQueue = new RetryQueue(),
  manualReviewQueue = new ManualReviewQueue()
} = {}) {
  const results = [];
  const queued = {
    retry: [],
    manualReview: []
  };

  for (const adapter of getBrokerAdapters(brokers)) {
    const request = adapter.prepareRequest(input);

    try {
      const submission = await adapter.submit(request, input);
      results.push(adapter.parseResult(submission, request));
    } catch (error) {
      const payload = {
        broker: adapter.name,
        requestId: request.requestId,
        request,
        input,
        errorCode: error.code || 'UNKNOWN'
      };

      if (error.transient) {
        if (retryQueue.willReachLimit(payload)) {
          queued.manualReview.push(
            manualReviewQueue.enqueue({
              reason: 'retry_limit_reached',
              payload
            })
          );
        } else {
          queued.retry.push(
            retryQueue.enqueue({
              reason: 'transient_submit_error',
              payload,
              error
            })
          );
        }
      } else {
        queued.manualReview.push(
          manualReviewQueue.enqueue({
            reason: 'submit_failed',
            payload
          })
        );
      }
    }
  }

  return {
    status: queued.manualReview.length > 0 ? 'needs_review' : 'ok',
    mode: 'dry-run',
    inputRequestId: input?.requestId || null,
    brokers,
    results,
    queues: {
      retry: retryQueue.items,
      manualReview: manualReviewQueue.items
    },
    summary: {
      attempted: brokers.length,
      successful: results.length,
      retryQueued: queued.retry.length,
      manualReviewQueued: queued.manualReview.length
    }
  };
}
