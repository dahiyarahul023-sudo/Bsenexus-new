import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  isValidOneSignalKeyFormat,
  isOneSignalConfigured,
  sendOneSignalPush,
  setOneSignalApiKey,
  getOneSignalApiKey,
  ONESIGNAL_APP_ID,
} from '../services/oneSignal.js';

describe('OneSignal Push Service Resilience', () => {
  test('ONESIGNAL_APP_ID is present', () => {
    assert.ok(ONESIGNAL_APP_ID);
    assert.strictEqual(typeof ONESIGNAL_APP_ID, 'string');
  });

  test('validates key format and rejects dummy/placeholder/short keys', () => {
    assert.strictEqual(isValidOneSignalKeyFormat(''), false);
    assert.strictEqual(isValidOneSignalKeyFormat('short'), false);
    assert.strictEqual(isValidOneSignalKeyFormat('fvhgfdnzmenaer23gtpbwcyuy'), false); // 25 char dummy key
    assert.strictEqual(isValidOneSignalKeyFormat('placeholder_key_for_testing_123456'), false);
    assert.strictEqual(isValidOneSignalKeyFormat('dummy_key_1234567890123456789012345'), false);

    // Valid formats (>= 32 chars and not placeholder)
    assert.strictEqual(isValidOneSignalKeyFormat('os_v2_app_abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz'), true);
    assert.strictEqual(isValidOneSignalKeyFormat('N2NmOGY4ZjAtZWY4NC00MzU2LWJiOWMtZThlNDM4ZjJkYmM3YjM4OTRh'), true);
  });

  test('sendOneSignalPush fast-bails safely when unconfigured or dummy key without throwing', async () => {
    // Current environment has the dummy 25-char key
    const res = await sendOneSignalPush({
      title: 'Test push',
      message: 'Test message body',
    });

    assert.strictEqual(res.ok, false);
    assert.ok(typeof res.error === 'string');
    assert.ok(
      res.error.includes('not configured') ||
      res.error.includes('placeholder') ||
      res.error.includes('unauthorized')
    );
  });

  test('dynamic key updates are respected', () => {
    const originalKey = getOneSignalApiKey();
    setOneSignalApiKey('os_v2_app_testkey_12345678901234567890123456789012345');
    assert.strictEqual(getOneSignalApiKey(), 'os_v2_app_testkey_12345678901234567890123456789012345');
    assert.strictEqual(isOneSignalConfigured(), true);

    // Reset back
    setOneSignalApiKey(null);
    assert.strictEqual(getOneSignalApiKey(), originalKey);
  });
});
