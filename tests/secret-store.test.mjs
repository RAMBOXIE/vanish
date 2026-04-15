import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { SecretStore } from '../src/auth/secret-store.mjs';

function tmpStore(name) {
  const base = path.resolve('tmp-test', 'secrets');
  fs.mkdirSync(base, { recursive: true });
  return path.join(base, `${name}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
}

test('secret store sets gets lists metadata and deletes without plaintext metadata leakage', async () => {
  const store = new SecretStore({
    filePath: tmpStore('basic'),
    masterKey: 'test-master-key',
    forceFallback: true
  });

  await store.setSecret('broker:spokeo', 'super-secret-token', { ttlSeconds: 60, tags: ['broker'] });

  assert.equal(await store.getSecret('broker:spokeo'), 'super-secret-token');
  const meta = await store.listMeta();
  assert.equal(meta.length, 1);
  assert.equal(meta[0].name, 'broker:spokeo');
  assert.equal(meta[0].tags[0], 'broker');
  assert.equal(JSON.stringify(meta).includes('super-secret-token'), false);

  assert.equal(await store.deleteSecret('broker:spokeo'), true);
  assert.equal(await store.getSecret('broker:spokeo'), null);
});

test('secret store rejects expired ttl usage', async () => {
  const store = new SecretStore({
    filePath: tmpStore('ttl'),
    masterKey: 'test-master-key',
    forceFallback: true
  });

  await store.setSecret('short', 'expired-secret', { ttlSeconds: -1 });

  await assert.rejects(
    () => store.getSecret('short'),
    error => error.code === 'SECRET_EXPIRED'
  );
});
