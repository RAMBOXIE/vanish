export class RetryQueue {
  constructor(options = {}) {
    this.maxAttempts = Number.isInteger(options.maxAttempts) ? options.maxAttempts : 3;
    this.baseDelayMs = Number.isInteger(options.baseDelayMs) ? options.baseDelayMs : 1000;
    this.factor = Number.isFinite(options.factor) ? options.factor : 2;
    this.maxDelayMs = Number.isInteger(options.maxDelayMs) ? options.maxDelayMs : 60000;
    this.items = [];
    this.attemptCounts = new Map();
  }

  getAttemptCount(payload) {
    return this.attemptCounts.get(queueKey(payload)) || 0;
  }

  willReachLimit(payload) {
    return this.getAttemptCount(payload) + 1 >= this.maxAttempts;
  }

  enqueue({ reason, payload, error, createdAt = new Date().toISOString() }) {
    const key = queueKey(payload);
    const attempt = this.getAttemptCount(payload) + 1;
    this.attemptCounts.set(key, attempt);

    const backoffMs = Math.min(
      this.baseDelayMs * Math.pow(this.factor, attempt - 1),
      this.maxDelayMs
    );

    const item = {
      reason,
      payload,
      error: serializeError(error),
      createdAt,
      status: 'queued',
      attempt,
      backoffMs,
      nextAttemptAt: new Date(Date.parse(createdAt) + backoffMs).toISOString()
    };

    this.items.push(item);
    return item;
  }
}

function queueKey(payload = {}) {
  return payload.queueKey || `${payload.broker || 'unknown'}:${payload.requestId || 'unknown'}`;
}

function serializeError(error) {
  if (!error) return null;
  return {
    name: error.name || 'Error',
    message: error.message || String(error),
    code: error.code || 'UNKNOWN',
    transient: Boolean(error.transient)
  };
}
