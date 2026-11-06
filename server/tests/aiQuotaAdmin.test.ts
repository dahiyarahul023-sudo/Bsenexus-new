import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Isolate fixture quotas/settings and initialize auth before imports capture env.
process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), 'bsenexus-quota-admin-')));
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ||= 'quota-regression-disposable-secret';
delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
const { isAdminEmail } = await import('../database/usersDao.js');
const { checkServerAiQuota, getServerAiQuotaStatus, resetAllServerAiQuotas, resetUserAiQuota } = await import('../services/aiQuotaService.js');
const { readLocalJson, writeLocalJson } = await import('../database/localStore.js');

test('Admin email identification recognizes both owner accounts', () => {
  assert.equal(isAdminEmail('dahiyarahul023@gmail.com'), true);
  assert.equal(isAdminEmail('rahrohdah@gmail.com'), true);
  assert.equal(isAdminEmail('  RAHROHDAH@GMAIL.COM  '), true);
  assert.equal(isAdminEmail('other.user@gmail.com'), false);
  assert.equal(isAdminEmail(null), false);
  assert.equal(isAdminEmail(undefined), false);
});

test('checkServerAiQuota grants unlimited access to admin accounts', async () => {
  // 1. Explicit isAdminUser = true
  const adminCheck1 = await checkServerAiQuota('any_uid', true);
  assert.equal(adminCheck1.allowed, true);
  assert.equal(adminCheck1.remaining, Infinity);
  assert.equal(adminCheck1.dailyLimit, Infinity);

  // UID text alone cannot confer a verified administrator role.
  const adminCheck2 = await checkServerAiQuota('admin', false);
  assert.equal(adminCheck2.allowed, false);
  assert.equal(adminCheck2.remaining, 0);
  assert.equal(adminCheck2.dailyLimit, 0);
});

test('getServerAiQuotaStatus returns tier admin with Infinity limits for admin', async () => {
  const status1 = await getServerAiQuotaStatus('any_uid', true);
  assert.equal(status1.tier, 'admin');
  assert.equal(status1.canGenerate, true);
  assert.equal(status1.dailyLimit, Infinity);
  assert.equal(status1.remaining, Infinity);

  const status2 = await getServerAiQuotaStatus('admin', false);
  assert.equal(status2.tier, 'free');
  assert.notEqual(status2.dailyLimit, Infinity);
  assert.deepEqual(status2, await getServerAiQuotaStatus('ordinary-quota-user', false));
});

test('resetAllServerAiQuotas clears all stored daily AI quotas', async () => {
  // Seed fake usage
  const AI_USAGE_FILE = 'ai_usage.json';
  const original = readLocalJson<Record<string, number>>(AI_USAGE_FILE, {});
  
  writeLocalJson(AI_USAGE_FILE, {
    'user1_2026-11-04': 50,
    'user2_2026-11-04': 100
  });

  const res = await resetAllServerAiQuotas();
  assert.equal(res.resetCount, 2);

  const after = readLocalJson<Record<string, number>>(AI_USAGE_FILE, {});
  assert.deepEqual(after, {});

  // Restore original
  writeLocalJson(AI_USAGE_FILE, original);
});

test('resetUserAiQuota resets a specific target user quota', async () => {
  const AI_USAGE_FILE = 'ai_usage.json';
  const original = readLocalJson<Record<string, number>>(AI_USAGE_FILE, {});

  const testUid = 'test_user_quota_reset_123';
  const istDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const yyyy = istDate.getFullYear();
  const mm = String(istDate.getMonth() + 1).padStart(2, '0');
  const dd = String(istDate.getDate()).padStart(2, '0');
  const todayKey = `${yyyy}-${mm}-${dd}`;
  const key = `${testUid}_${todayKey}`;

  writeLocalJson(AI_USAGE_FILE, { [key]: 95 });

  const resetResult = await resetUserAiQuota(testUid);
  assert.equal(resetResult.success, true);
  assert.equal(resetResult.uid, testUid);

  const after = readLocalJson<Record<string, number>>(AI_USAGE_FILE, {});
  assert.equal(after[key], undefined);

  // Restore original
  writeLocalJson(AI_USAGE_FILE, original);
});

// Real router and real middleware: stub only Firebase's external verifier.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ||= 'quota-regression-disposable-secret';
delete process.env.RECAPTCHA_ENFORCE;
delete process.env.FIREBASE_APPCHECK_ENFORCE;
const { authMiddleware, authRouter } = await import('../security/auth.js');
const { apiRouter } = await import('../api/routes.js');
const { getFirebaseAuth } = await import('../security/firebaseAdmin.js');
const { saveSettings } = await import('../database/settingsDao.js');
const adminEmail = 'dahiyarahul023@gmail.com';
const sessionCookie = (claims: object = {}) => jwt.sign({ uid: 'quota-owner', email: adminEmail,
  emailVerified: true, isOwner: true, isAnonymous: false, ...claims }, process.env.JWT_SECRET!, { expiresIn: '7d' });
async function withQuotaServer(run: (base: string) => Promise<void>) {
  const app = express(); app.use(express.json(), cookieParser(), authMiddleware);
  app.use('/auth', authRouter); app.use('/api', apiRouter);
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(r => server.once('listening', r));
  try { await run(`http://127.0.0.1:${(server.address() as any).port}`); }
  finally { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); }
}
const expiredBearer = 'Bearer firebase.expired.token';
function rejectExpired(t: any) {
  return t.mock.method(getFirebaseAuth(), 'verifyIdToken', async () => {
    throw Object.assign(new Error('expired'), { code: 'auth/id-token-expired' });
  });
}
const resetRequest = (base: string, headers: Record<string, string>) => fetch(base + '/api/billing/reset-quota', {
  method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify({ target: 'all' }),
});
test('expired Firebase Bearer falls back to verified cookie admin identity and elevation', async t => {
  rejectExpired(t);
  await withQuotaServer(async base => {
    const headers = { Authorization: expiredBearer, Cookie: `authToken=${sessionCookie({ adminElevatedUntil: Date.now() + 60000 })}` };
    const response = await resetRequest(base, headers);
    assert.equal(response.status, 200); assert.equal((await response.json()).success, true);
    const status = await (await fetch(base + '/auth/status', { headers })).json();
    assert.equal(status.user.uid, 'quota-owner'); assert.equal(status.isAdmin, true); assert.equal(status.isElevated, true);
  });
});
test('expired Bearer without valid cookie never gains identity or admin privilege', async t => {
  rejectExpired(t);
  await withQuotaServer(async base => {
    for (const cookie of ['', 'authToken=invalid']) {
      const headers = { Authorization: expiredBearer, Cookie: cookie };
      const response = await resetRequest(base, headers); const body = await response.json();
      assert.ok([401, 403].includes(response.status)); assert.equal(body.authRequired, true);
      assert.equal(body.tokenExpired, true); assert.notEqual(body.adminElevationRequired, true);
      const status = await (await fetch(base + '/auth/status', { headers })).json();
      assert.equal(status.isAuthenticated, false); assert.equal(status.isAdmin, false);
    }
  });
});
test('verified admin needs PIN; real verify-pin cookie enables reset for exactly 15 minutes', async t => {
  rejectExpired(t);
  await saveSettings({ appPinHash: 'test-only-quota-pin' });
  await withQuotaServer(async base => {
    const headers = { Authorization: expiredBearer, Cookie: `authToken=${sessionCookie()}` };
    const denied = await resetRequest(base, headers);
    assert.equal(denied.status, 403); assert.equal((await denied.json()).adminElevationRequired, true);
    const before = Date.now();
    const verified = await fetch(base + '/auth/verify-pin', { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ pin: 'test-only-quota-pin' }) });
    assert.equal(verified.status, 200);
    const cookie = verified.headers.get('set-cookie')!.split(';')[0];
    const claims: any = jwt.verify(decodeURIComponent(cookie.slice('authToken='.length)), process.env.JWT_SECRET!);
    assert.ok(claims.adminElevatedUntil >= before + 15 * 60000 && claims.adminElevatedUntil <= Date.now() + 15 * 60000);
    assert.equal(claims.uid, 'quota-owner');
    writeLocalJson('ai_usage.json', { 'fixture-a_today': 2, 'fixture-b_today': 3 });
    const reset = await resetRequest(base, { ...headers, Cookie: cookie });
    assert.equal(reset.status, 200); assert.equal((await reset.json()).resetCount, 2);
    t.mock.method(Date, 'now', () => claims.adminElevatedUntil + 1);
    const expired = await resetRequest(base, { ...headers, Cookie: cookie });
    assert.equal(expired.status, 403); const expiry = await expired.json();
    assert.equal(expiry.adminElevationRequired, true); assert.doesNotMatch(expiry.error, /Root Ops/);
    const status = await (await fetch(base + '/auth/status', { headers: { ...headers, Cookie: cookie } })).json();
    assert.equal(status.isAdmin, true); assert.equal(status.isElevated, false);
  });
});
test('guest verify-pin rejects identity before inspecting or migrating the PIN', async () => {
  await saveSettings({ appPinHash: 'unchanged-test-pin' });
  await withQuotaServer(async base => {
    const response = await fetch(base + '/auth/verify-pin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pin: 'unchanged-test-pin' }) });
    assert.equal(response.status, 403); assert.equal((await response.json()).code, 'ADMIN_AUTH_REQUIRED');
    assert.equal(response.headers.get('set-cookie'), null);
    const { getSettings } = await import('../database/settingsDao.js');
    assert.equal((await getSettings()).appPinHash, 'unchanged-test-pin');
  });
});

test('status verifies Firebase identity without requiring PIN or a local cookie', async t => {
  t.mock.method(getFirebaseAuth(), 'verifyIdToken', async () => ({ uid: 'quota-owner', email: adminEmail, email_verified: true }));
  await withQuotaServer(async base => {
    const headers = { Authorization: 'Bearer firebase.current.token' };
    const status = await (await fetch(base + '/auth/status', { headers })).json();
    assert.equal(status.isAuthenticated, true); assert.equal(status.isAdmin, true); assert.equal(status.isElevated, false);
    const denied = await resetRequest(base, headers);
    assert.equal(denied.status, 403); assert.equal((await denied.json()).adminElevationRequired, true);
  });
});
