import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import '../../scripts/offline-tests.mjs';

test('routine tests reject an external HTTP request before transport', async () => {
  await assert.rejects(fetch('https://fixture.invalid/private-test-body', { method: 'POST', body: 'fixture' }), {
    code: 'ERR_TEST_NETWORK_DISABLED',
  });
});

test('routine tests reject external TCP clients before connecting', () => {
  assert.throws(() => new net.Socket().connect({ host: 'fixture.invalid', port: 443 }), {
    code: 'ERR_TEST_NETWORK_DISABLED',
  });
});
