import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), 'bsenexus-ip-test-')));
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
const { getSanitizedClientIp } = await import('../security/accountRateLimiter.js');

// AUTH-1 / FAQ-1 (24 Oct 2026 audit): the left-most X-Forwarded-For entry is
// written by the caller. It must never decide which "IP" a quota or lockout
// belongs to, otherwise every request can claim a fresh identity.
describe('getSanitizedClientIp ignores caller-controlled forwarding headers', () => {
  test('uses Express req.ip, not a spoofed X-Forwarded-For', () => {
    const req = { ip: '203.0.113.7', headers: { 'x-forwarded-for': '198.51.100.99, 203.0.113.7' }, socket: { remoteAddress: '10.0.0.1' } };
    assert.strictEqual(getSanitizedClientIp(req), '203.0.113.7');
  });

  test('rotating the spoofed header does not change the identity', () => {
    const a = getSanitizedClientIp({ ip: '203.0.113.7', headers: { 'x-forwarded-for': '1.1.1.1' } });
    const b = getSanitizedClientIp({ ip: '203.0.113.7', headers: { 'x-forwarded-for': '2.2.2.2' } });
    assert.strictEqual(a, b);
  });

  test('strips the IPv4-mapped IPv6 prefix and falls back to the socket address', () => {
    assert.strictEqual(getSanitizedClientIp({ ip: '::ffff:192.0.2.1', headers: {} }), '192.0.2.1');
    assert.strictEqual(getSanitizedClientIp({ headers: {}, socket: { remoteAddress: '192.0.2.5' } }), '192.0.2.5');
    assert.strictEqual(getSanitizedClientIp(undefined), 'unknown');
  });
});
