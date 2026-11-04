import test from 'node:test';
import assert from 'node:assert/strict';
import { isAdminEmail, ADMIN_EMAILS } from '../database/usersDao.js';
import { 
  checkServerAiQuota, 
  getServerAiQuotaStatus, 
  resetServerAiQuota, 
  resetAllServerAiQuotas, 
  resetUserAiQuota 
} from '../services/aiQuotaService.js';
import { readLocalJson, writeLocalJson } from '../database/localStore.js';

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

  // 2. uid = 'admin'
  const adminCheck2 = await checkServerAiQuota('admin', false);
  assert.equal(adminCheck2.allowed, true);
  assert.equal(adminCheck2.remaining, Infinity);
  assert.equal(adminCheck2.dailyLimit, Infinity);
});

test('getServerAiQuotaStatus returns tier admin with Infinity limits for admin', async () => {
  const status1 = await getServerAiQuotaStatus('any_uid', true);
  assert.equal(status1.tier, 'admin');
  assert.equal(status1.canGenerate, true);
  assert.equal(status1.dailyLimit, Infinity);
  assert.equal(status1.remaining, Infinity);

  const status2 = await getServerAiQuotaStatus('admin', false);
  assert.equal(status2.tier, 'admin');
  assert.equal(status2.canGenerate, true);
  assert.equal(status2.dailyLimit, Infinity);
  assert.equal(status2.remaining, Infinity);
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
