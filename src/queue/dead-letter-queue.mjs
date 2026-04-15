import { dedupeKey, payloadIdentity } from './dedupe.mjs';

export class DeadLetterQueue {
  constructor(items = []) {
    this.items = [...items];
    this.keys = new Map();
    for (const item of this.items) {
      if (item.dedupeKey) this.keys.set(item.dedupeKey, item);
    }
  }

  enqueue({ reason, payload, error, createdAt = new Date().toISOString(), status = 'open' }) {
    const key = dedupeKey(payloadIdentity(payload, reason));
    const existing = this.keys.get(key);
    if (existing) {
      existing.lastSeenAt = createdAt;
      existing.seenCount = (existing.seenCount || 1) + 1;
      return { ...existing, deduped: true };
    }

    const item = {
      id: `dlq:${key}`,
      dedupeKey: key,
      reason,
      payload,
      error: serializeError(error),
      createdAt,
      status,
      seenCount: 1
    };

    this.items.push(item);
    this.keys.set(key, item);
    return item;
  }
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
