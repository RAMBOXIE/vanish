import crypto from 'node:crypto';

export function dedupeKey({ broker = 'unknown', requestId = 'unknown', reason = 'unknown' } = {}) {
  const raw = `${broker}:${requestId}:${reason}`;
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
}

export function payloadIdentity(payload = {}, reason = 'unknown') {
  return {
    broker: payload.broker || 'unknown',
    requestId: payload.requestId || 'unknown',
    reason
  };
}
