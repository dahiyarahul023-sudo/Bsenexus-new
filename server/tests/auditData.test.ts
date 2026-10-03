import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseShareablePath } from '../../src/utils/shareUrls.js';
import { isPublicIpv4, fetchPublicPage } from '../utils/publicPage.js';
import { resolvePersonalTelegramTarget } from '../utils/telegramTarget.js';

test('malformed share URLs never crash navigation; valid filing and result identities survive parsing', () => {
  assert.equal(parseShareablePath('/filing/%E0%A4%A/id'), null);
  assert.deepEqual(parseShareablePath('/filing/TEST/AUDIT-ID'), {kind:'filing',symbol:'TEST',newsId:'AUDIT-ID'});
  assert.deepEqual(parseShareablePath('/results/TEST/Q2FY27'), {kind:'results',symbol:'TEST',quarterKey:'Q2FY27'});
  assert.equal(parseShareablePath('/filing/TEST'), null);
});

test('personal Telegram delivery cannot select a different chat or fall back to the shared channel', () => {
  assert.equal(resolvePersonalTelegramTarget('123', undefined, '-100999'), '123');
  assert.equal(resolvePersonalTelegramTarget(' 123 ', '123', '-100999'), '123');
  for (const [stored, requested] of [[undefined,undefined],['123','456'],['-100999',undefined]]) {
    assert.throws(() => resolvePersonalTelegramTarget(stored, requested, '-100999'), /administrator/);
  }
});


test('SEO scraping rejects loopback, private, reserved and metadata addresses', async () => {
  for (const address of ['127.0.0.1','10.0.0.1','172.16.0.1','192.168.1.1','169.254.169.254','100.64.0.1','0.0.0.0','198.18.0.1','203.0.113.1','::1','::ffff:127.0.0.1']) {
    assert.equal(isPublicIpv4(address), false, address);
  }
  assert.equal(isPublicIpv4('93.184.216.34'), true);
  await assert.rejects(fetchPublicPage('http://127.0.0.1/'), /forbidden/);
  await assert.rejects(fetchPublicPage('http://169.254.169.254/computeMetadata/v1/'), /forbidden/);
  await assert.rejects(fetchPublicPage('file:///etc/passwd'), /public HTTP/);
});
