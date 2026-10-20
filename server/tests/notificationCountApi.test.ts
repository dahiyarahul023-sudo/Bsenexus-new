import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), 'notification-count-api-')));
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-notification-count';
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
const { apiRouter } = await import('../api/routes.js');
const { addNotification } = await import('../database/notificationDao.js');
const app = express();
app.use(express.json());
// As in other API tests, supply identities already verified by authMiddleware.
// Unknown/invalid identities remain anonymous; no owner is accepted from query/body.
app.use((req, _res, next) => {
  const uid = req.headers.authorization;
  (req as any).user = uid === 'alice' || uid === 'bob'
    ? { uid, isAnonymous: false } : { uid: 'guest', isAnonymous: true };
  next();
});
app.use('/api', apiRouter);
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = 'http://127.0.0.1:' + (server.address() as any).port + '/api/notifications';
after(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
const call = (owner: string, suffix = '/unread-count', method = 'GET') => fetch(base + suffix, { method, headers: { authorization: owner } });

test('unread count rejects anonymous/invalid sessions instead of returning the shared guest count', async () => {
  for (const owner of ['', 'invalid-token', 'guest']) {
    const response = await call(owner);
    assert.equal(response.status, 401);
    assert.equal((await response.json()).unreadCount, undefined);
  }
});

test('verified counts are owner-scoped, not cacheable, and update after confirmed read', async () => {
  const common = { title: 'Results', message: 'Filed', type: 'RESULT' as const, priority: 'HIGH' as const, symbol: 'TEST', scripCode: '123456' };
  const alice = await addNotification({ ...common, id: 'alice-result', userId: 'alice', newsId: 'a' });
  await addNotification({ ...common, id: 'bob-result', userId: 'bob', newsId: 'b' });
  await addNotification({ ...common, id: 'guest-result', userId: 'guest', newsId: 'g' });
  const response = await call('alice', '/unread-count?userId=bob');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control') || '', /private, no-store/);
  assert.equal((await response.json()).unreadCount, 1);
  assert.equal((await call('alice', '/' + alice.id + '/read', 'POST')).status, 200);
  assert.equal((await (await call('alice')).json()).unreadCount, 0);
  assert.equal((await (await call('bob')).json()).unreadCount, 1);
});
