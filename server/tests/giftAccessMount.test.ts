import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { apiRouter } from '../api/routes.js';

test('the actual API mount distinguishes a disabled gift route, unauthenticated access and an unknown route', async () => {
  const saved = process.env.GIFT_ACCESS_ENABLED;
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);
  app.use((_req, res) => res.status(404).json({ success: false, error: 'API route not found' }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  try {
    delete process.env.GIFT_ACCESS_ENABLED;
    const disabled = await fetch(base + '/api/gifts/admin?offset=0');
    assert.equal(disabled.status, 503);
    assert.equal((await disabled.json()).error, 'Gift access is not enabled yet.');
    process.env.GIFT_ACCESS_ENABLED = 'true';
    assert.equal((await fetch(base + '/api/gifts/admin')).status, 401);
    assert.equal((await fetch(base + '/api/gifts/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401);
    assert.equal((await fetch(base + '/api/gift-route-that-does-not-exist')).status, 404);
  } finally {
    if (saved === undefined) delete process.env.GIFT_ACCESS_ENABLED; else process.env.GIFT_ACCESS_ENABLED = saved;
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
