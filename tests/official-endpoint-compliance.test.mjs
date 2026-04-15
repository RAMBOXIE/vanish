import test from 'node:test';
import assert from 'node:assert/strict';

import spokeoAdapter from '../src/adapters/brokers/spokeo.mjs';

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
