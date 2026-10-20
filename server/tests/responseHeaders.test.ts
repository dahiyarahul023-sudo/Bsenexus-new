import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import { responseHeaders } from '../security/responseHeaders.js';

test('production document protection preserves OAuth popups, preview and public embeds', async () => {
  const app = express();
  app.set('trust proxy', 1);
  app.use(responseHeaders(true));
  app.get('*', (_req, res) => res.send('<html>test</html>'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const port = (server.address() as any).port;
  const request = (host: string, path = '/') => new Promise<{ headers: { get(name: string): string | null } }>((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port, path, headers: { Host: host, 'X-Forwarded-Host': 'preview.ai.studio' } }, response => {
      response.resume();
      resolve({ headers: { get: name => (response.headers[name] as string | undefined) ?? null } });
    }).on('error', reject);
  });
  try {
    const live = await request('bsenexus.in');
    assert.equal(live.headers.get('x-frame-options'), 'SAMEORIGIN');
    assert.match(live.headers.get('content-security-policy')!, /frame-ancestors 'self'/);
    assert.equal(live.headers.get('cross-origin-opener-policy'), 'same-origin-allow-popups');
    assert.match(live.headers.get('strict-transport-security')!, /max-age=31536000/);
    assert.equal((await request('preview.ai.studio')).headers.get('x-frame-options'), null);
    assert.equal((await request('bsenexus.in', '/embed/widget')).headers.get('x-frame-options'), null);
    assert.equal((await request('bsenexus.in', '/?preview=true')).headers.get('x-frame-options'), 'SAMEORIGIN');
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
