import test from 'node:test';
import assert from 'node:assert/strict';

import { signAuditEvent, verifyAuditEvent } from '../src/audit/signature.mjs';

test('audit signature signs and verifies canonical event payloads', () => {
  const event = {
    at: '2026-04-15T00:00:00.000Z',
    event: 'completed',
    broker: 'spokeo',
    requestId: 'audit-1'
  };

  const signed = signAuditEvent(event, { secret: 'audit-secret' });

  assert.equal(signed.event, 'completed');
  assert.match(signed.signature, /^sha256=/);
  assert.equal(verifyAuditEvent(signed, { secret: 'audit-secret' }), true);
  assert.equal(verifyAuditEvent({ ...signed, requestId: 'tampered' }, { secret: 'audit-secret' }), false);
});
