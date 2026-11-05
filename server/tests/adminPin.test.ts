import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { timingSafePinEqual, verifyAndMigrateAdminPin } from '../security/adminPin.js';

process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), 'bn-pin-tests-')));
delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.RECAPTCHA_ENFORCE; delete process.env.FIREBASE_APPCHECK_ENFORCE;
process.env.NODE_ENV = 'test'; process.env.JWT_SECRET ||= 'disposable-pin-tests-secret';
const { getSettings, saveSettings, saveAdminPinHash } = await import('../database/settingsDao.js');
const { getSupabase, resetSupabaseClient } = await import('../database/supabase.js');
const { authRouter, authMiddleware } = await import('../security/auth.js');

async function serve(run: (post: (route: string, pin: string) => Promise<Response>) => Promise<void>) {
  const app = express(); app.use(express.json());
  app.use(cookieParser(), authMiddleware);
  const cookie = jwt.sign({ uid: 'verified-owner', email: 'dahiyarahul023@gmail.com', emailVerified: true, isOwner: true, isAnonymous: false }, process.env.JWT_SECRET!, { expiresIn: '1h' });
  app.use('/auth', authRouter);
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(r => server.once('listening', r));
  try { await run((route, pin) => fetch(`http://127.0.0.1:${(server.address() as any).port}/auth/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `authToken=${cookie}` }, body: JSON.stringify({ pin }) })); }
  finally { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); }
}
test('digest comparison handles different input lengths without throwing', () => {
  assert.equal(timingSafePinEqual('1234', '1234'), true); assert.equal(timingSafePinEqual('1', '1234'), false); assert.equal(timingSafePinEqual('1234', '1235'), false);
});
for (const route of ['login', 'verify-pin']) {
  test(`${route}: wrong PIN denied; matching plaintext migrates before elevation and only bcrypt is accepted thereafter`, async () => {
    await saveSettings({ appPinHash: '482916' }); delete process.env.APP_PIN;
    await serve(async post => {
      const wrong = await post(route, 'no'); assert.equal(wrong.status, 401); assert.equal(wrong.headers.get('set-cookie'), null); assert.equal((await getSettings()).appPinHash, '482916');
      assert.equal((await post(route, '482916')).status, 200);
      const hash = (await getSettings()).appPinHash!; assert.match(hash, /^\$2[ab]\$/); assert.equal(await bcrypt.compare('482916', hash), true);
      assert.equal((await post(route, '482916')).status, 200);
      assert.equal((await post(route, hash)).status, 401); assert.equal((await getSettings()).appPinHash, hash);
    });
  });
  test(`${route}: APP_PIN uses constant-time path, saves bcrypt, and cannot override stored hash`, async () => {
    await saveSettings({ appPinHash: '' }); process.env.APP_PIN = ' 735291 ';
    try { await serve(async post => {
      assert.equal((await post(route, '735291')).status, 200);
      assert.equal(await bcrypt.compare('735291', (await getSettings()).appPinHash!), true);
      process.env.APP_PIN = 'different'; assert.equal((await post(route, 'different')).status, 401);
    }); } finally { delete process.env.APP_PIN; }
  });
}
test('bcrypt errors never fall back to literal hash comparison; failed migration cannot authenticate', async () => {
  let writes = 0;
  assert.equal(await verifyAndMigrateAdminPin('$2b$malformed', '$2b$malformed', undefined, async () => { writes++; }), false);
  await assert.rejects(verifyAndMigrateAdminPin('legacy', 'legacy', undefined, async () => { throw new Error('store unavailable'); }), /store unavailable/);
  assert.equal(writes, 0);
});
test('production migration with no durable store fails closed', async () => {
  process.env.NODE_ENV = 'production';
  try { await assert.rejects(saveAdminPinHash(await bcrypt.hash('735291', 10)), /Payment store unavailable/); }
  finally { process.env.NODE_ENV = 'test'; }
});
test('a cloud migration failure returns retryable 503 and never elevates either route', async t => {
  await saveSettings({ appPinHash: '482916' });
  process.env.SUPABASE_URL = 'https://pin-fixture.invalid'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
  const client = getSupabase();
  t.mock.method(client, 'rpc', async () => ({ data: { failedAttempts: 0, lockedUntil: 0, remainingLockoutSec: 0 }, error: null }));
  t.mock.method(client, 'from', () => { throw new Error('store unavailable'); });
  try { await serve(async post => {
    for (const route of ['login', 'verify-pin']) { const response = await post(route, '482916'); assert.equal(response.status, 503); assert.equal(response.headers.get('set-cookie'), null); }
  }); } finally { delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY; resetSupabaseClient(); }
});
test('cloud migration uses CAS, reuses an existing matching bcrypt verifier and never overwrites a rotated PIN', async t => {
  process.env.SUPABASE_URL = 'https://pin-fixture.invalid'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
  let cloud: any = { appPinHash: '482916', botToken: '', chatId: '', isRunning: false, isFilterEnabled: true };
  let writes = 0, race = false;
  t.mock.method(getSupabase(), 'from', () => {
    let pending: any, expected: string | undefined;
    const chain: any = {
      select: () => chain, eq: (column: string, value: string) => { if (column === 'value') expected = value; return chain; },
      maybeSingle: async () => ({ data: { value: structuredClone(cloud) }, error: null }),
      update: (value: any) => { pending = value; return chain; },
      abortSignal: async () => {
        if (race) cloud = { ...cloud, isRunning: true };
        if (expected !== JSON.stringify(cloud)) return { data: [], error: null };
        cloud = pending.value; writes++; return { data: [{ key: 'global' }], error: null };
      },
    }; return chain;
  });
  try {
    await saveAdminPinHash(await bcrypt.hash('482916', 10), '482916');
    const first = cloud.appPinHash; assert.equal(await bcrypt.compare('482916', first), true); assert.equal(writes, 1);
    await saveAdminPinHash(await bcrypt.hash('482916', 10), '482916'); assert.equal(cloud.appPinHash, first); assert.equal(writes, 1);
    const rotated = await bcrypt.hash('new-pin', 10); cloud.appPinHash = rotated;
    await assert.rejects(saveAdminPinHash(await bcrypt.hash('482916', 10), '482916')); assert.equal(cloud.appPinHash, rotated);
    cloud.appPinHash = '482916'; race = true;
    await assert.rejects(saveAdminPinHash(await bcrypt.hash('482916', 10), '482916')); assert.equal(cloud.appPinHash, '482916'); assert.equal(cloud.isRunning, true); assert.equal(writes, 1);
  } finally { delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY; resetSupabaseClient(); }
});
