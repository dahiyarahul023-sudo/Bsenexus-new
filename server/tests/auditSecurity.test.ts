import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import jwt from 'jsonwebtoken';
import { fetchBseDocument, isAllowedBseDocumentUrl, readBoundedDocument } from '../utils/bseDocument.js';
import { executeSimulatedPenTest, runSecurityAudit } from '../security/hardening.js';

// Separate all runtime writes from the real checkout and from other test files.
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bsenexus-audit-'));
process.chdir(directory);
process.env.JWT_SECRET = 'isolated-audit-test-secret-32-characters';
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

test('unverified checks never become passed and a failed connection never becomes a blocked attack', async () => {
  const report = await runSecurityAudit();
  assert.equal(report.checks.find(c => c.id === 18)?.status, 'warning');
  assert.equal(report.checks.find(c => c.id === 20)?.lastTested, 0);
  const server = express().listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const port = (server.address() as any).port;
  await new Promise<void>(resolve => server.close(() => resolve()));
  const unavailable = await executeSimulatedPenTest(`http://127.0.0.1:${port}`);
  assert.equal(unavailable.blockedAttacks, 0);
  assert.equal(unavailable.inconclusiveAttacks, 6);
  assert.ok(unavailable.results.every(r => r.actualStatus === 0 && !r.blocked));
});

test('PDF fetch rejects private URLs and off-domain redirects BEFORE contacting them', async () => {
  for (const url of ['http://169.254.169.254/', 'https://127.0.0.1/', 'https://bseindia.com.attacker.test/a.pdf',
    'https://user:pass@www.bseindia.com/a.pdf', 'https://www.bseindia.com:444/a.pdf']) {
    assert.equal(isAllowedBseDocumentUrl(url), false);
  }
  assert.equal(isAllowedBseDocumentUrl('https://www.bseindia.com/xml-data/corpfiling/AttachLive/document.pdf'), true);
  const original = globalThis.fetch;
  const called: string[] = [];
  globalThis.fetch = (async (url: any) => {
    called.push(String(url));
    return new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/computeMetadata/v1/' } });
  }) as any;
  try {
    await assert.rejects(fetchBseDocument('https://www.bseindia.com/a.pdf'), /Only official/);
    assert.deepEqual(called, ['https://www.bseindia.com/a.pdf']);
    await assert.rejects(fetchBseDocument('http://127.0.0.1/private'), /Only official/);
    assert.equal(called.length, 1);
  } finally { globalThis.fetch = original; }
});

test('PDF size limit applies to streamed bodies without Content-Length', async () => {
  const stream = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(6)); c.enqueue(new Uint8Array(6)); c.close(); } });
  await assert.rejects(readBoundedDocument(new Response(stream), 10), /download limit/);
});

test('anonymous and ordinary signed sessions cannot mutate shared administration or broadcast', async () => {
  const { apiRouter } = await import('../api/routes.js');
  const { authMiddleware } = await import('../security/auth.js');
  const app = express();
  app.use(express.json(), authMiddleware);
  app.use('/api', apiRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const ordinary = jwt.sign({ uid: 'ordinary-user', auth: true, isAnonymous: false,
    email: 'ordinary@example.test', emailVerified: true, isAdmin: false, isOwner: false }, process.env.JWT_SECRET!);
  try {
    const anonymousPaths = ['/seo/fetch-url', '/seo/write-content', '/settings', '/announcements/refresh', '/stocks/500325/fetch-deep-history',
      '/watchlist/fetch-deep-history', '/stocks/500325/boost-runup-priority', '/results-calendar/refresh',
      '/send-to-telegram-manual', '/send-holiday-telegram', '/results-calendar/telegram-broadcast',
      '/announcements/does-not-exist/generate-summary', '/news/summarize'];
    for (const endpoint of anonymousPaths) {
      const response = await fetch(base + '/api' + endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      assert.ok([401, 403].includes(response.status), `${endpoint}: ${response.status}`);
    }
    for (const endpoint of ['/seo/fetch-url', '/seo/write-content', '/send-to-telegram-manual', '/send-holiday-telegram', '/results-calendar/telegram-broadcast',
      '/stocks/500325/boost-runup-priority', '/watchlist/fetch-deep-history']) {
      const response = await fetch(base + '/api' + endpoint, { method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${ordinary}` }, body: '{}' });
      assert.equal(response.status, 403, endpoint);
    }
    const probes = await executeSimulatedPenTest(base);
    assert.equal(probes.blockedAttacks, 6);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});

test('parallel requests cannot consume more than the last local quota unit', async () => {
  const { saveUserProfile } = await import('../database/usersDao.js');
  const { checkAndConsumeServerAiQuota, getServerAiQuotaStatus } = await import('../services/aiQuotaService.js');
  const uid = 'concurrent-quota-user';
  await saveUserProfile(uid, { tier: 'pro', proExpiresAt: Date.now() + 86_400_000 }, true);
  const results = await Promise.all(Array.from({ length: 110 }, () => checkAndConsumeServerAiQuota(uid, false)));
  assert.equal(results.filter(r => r.allowed).length, 100);
  assert.equal((await getServerAiQuotaStatus(uid, false)).usedToday, 100);
  assert.equal((await checkAndConsumeServerAiQuota('admin', false)).allowed, false, 'UID text alone must not grant unlimited quota');
});

test('system alert rules cannot be disabled by any ordinary caller', async () => {
  const { getAllAlertRules, toggleAlertRule } = await import('../database/alertRulesDao.js');
  const preset = getAllAlertRules('ordinary-user').find(r => r.userId === 'system');
  assert.ok(preset);
  assert.equal(toggleAlertRule(preset.id, false, 'ordinary-user'), false);
  assert.equal(toggleAlertRule(preset.id, false, 'admin'), false);
});

test('empty durable/local feed returns no manufactured financial filings', async () => {
  const { getRecentAnnouncements } = await import('../database/announcementDao.js');
  assert.deepEqual(await getRecentAnnouncements(100), []);
});


test('unavailable or incomplete fund-flow sources never produce invented values', async () => {
  const { getLiveFiiDiiData } = await import('../services/fiiDiiService.js');
  const original = globalThis.fetch;
  try {
    globalThis.fetch = (async () => new Response('', { status: 503 })) as any;
    assert.equal(await getLiveFiiDiiData(true), null);
    globalThis.fetch = (async () => new Response(JSON.stringify([{ category:'DII' }, { category:'FII/FPI' }]), {status:200,headers:{'content-type':'application/json'}})) as any;
    assert.equal(await getLiveFiiDiiData(true), null);
  } finally { globalThis.fetch = original; }
});

test('maximum-length duplicate usernames reserve room for the numeric suffix', async () => {
  const { saveUserProfile, generateUniqueUsername, cleanAndDeduplicateAllUsernames, getUserProfile } = await import('../database/usersDao.js');
  const base = 'abcdefghijklmnopqrstuvwxy';
  await saveUserProfile('long-name-a', { username: base, email:'a@example.test' }, true);
  assert.equal(await generateUniqueUsername(base), base.slice(0,24) + '1');
  await saveUserProfile('long-name-b', { username: base, email:'b@example.test' }, true);
  const outcome = await cleanAndDeduplicateAllUsernames();
  assert.ok(outcome.cleanedCount >= 1);
  const profiles = await Promise.all(['long-name-a','long-name-b'].map(uid => getUserProfile(uid)));
  assert.notEqual(profiles[0]?.username, profiles[1]?.username);
});
