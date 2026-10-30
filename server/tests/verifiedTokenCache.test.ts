import { test, describe } from 'node:test';
import assert from 'node:assert';
import { createVerifiedTokenCache, resolveVerifyCacheMs } from '../security/verifiedTokenCache.js';

// PERF-1: one revocation-checked verification per token per window, and never
// longer than the token's own expiry. Failures must never be cached.
describe('verified Firebase token cache', () => {
  const claims = (exp: number) => ({ uid: 'u1', exp });

  test('reuses a successful verification inside the window', async () => {
    let t = 1_000_000;
    let calls = 0;
    const cache = createVerifiedTokenCache<ReturnType<typeof claims>>({ ttlMs: 60_000, now: () => t });
    const verifier = async () => { calls++; return claims(Math.floor(t / 1000) + 3600); };
    await cache.verify('tok', verifier);
    t += 30_000;
    await cache.verify('tok', verifier);
    assert.strictEqual(calls, 1);
  });

  test('re-verifies after the window so revocation is noticed', async () => {
    let t = 1_000_000;
    let calls = 0;
    const cache = createVerifiedTokenCache<ReturnType<typeof claims>>({ ttlMs: 60_000, now: () => t });
    const verifier = async () => { calls++; return claims(Math.floor(t / 1000) + 3600); };
    await cache.verify('tok', verifier);
    t += 61_000;
    await cache.verify('tok', verifier);
    assert.strictEqual(calls, 2);
  });

  test('never outlives the token expiry', async () => {
    let t = 1_000_000_000;
    let calls = 0;
    const cache = createVerifiedTokenCache<ReturnType<typeof claims>>({ ttlMs: 60_000, now: () => t });
    // token expires 10 s from now
    const verifier = async () => { calls++; return claims(Math.floor(t / 1000) + 10); };
    await cache.verify('tok', verifier);
    t += 11_000;
    await cache.verify('tok', verifier);
    assert.strictEqual(calls, 2);
  });

  test('parallel requests with the same token share one verification', async () => {
    let calls = 0;
    const cache = createVerifiedTokenCache<ReturnType<typeof claims>>({ ttlMs: 60_000 });
    const verifier = async () => { calls++; await new Promise((r) => setTimeout(r, 15)); return claims(Math.floor(Date.now() / 1000) + 3600); };
    await Promise.all(Array.from({ length: 8 }, () => cache.verify('tok', verifier)));
    assert.strictEqual(calls, 1);
  });

  test('failures are not cached and do not poison later attempts', async () => {
    let calls = 0;
    const cache = createVerifiedTokenCache<ReturnType<typeof claims>>({ ttlMs: 60_000 });
    const failing = async () => { calls++; throw new Error('revoked'); };
    await assert.rejects(() => cache.verify('bad', failing));
    await assert.rejects(() => cache.verify('bad', failing));
    assert.strictEqual(calls, 2);
    assert.strictEqual(cache.size(), 0);
    const ok = await cache.verify('bad', async () => claims(Math.floor(Date.now() / 1000) + 60));
    assert.strictEqual(ok.uid, 'u1');
  });

  test('different tokens are never confused', async () => {
    const cache = createVerifiedTokenCache<{ uid: string; exp: number }>({ ttlMs: 60_000 });
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const a = await cache.verify('token-a', async () => ({ uid: 'A', exp }));
    const b = await cache.verify('token-b', async () => ({ uid: 'B', exp }));
    assert.strictEqual(a.uid, 'A');
    assert.strictEqual(b.uid, 'B');
  });

  test('ttl 0 disables caching and sharing entirely', async () => {
    let calls = 0;
    const cache = createVerifiedTokenCache<ReturnType<typeof claims>>({ ttlMs: 0 });
    const verifier = async () => { calls++; return claims(Math.floor(Date.now() / 1000) + 3600); };
    await cache.verify('tok', verifier);
    await cache.verify('tok', verifier);
    assert.strictEqual(calls, 2);
  });

  test('size stays bounded', async () => {
    const cache = createVerifiedTokenCache<{ uid: string; exp: number }>({ ttlMs: 60_000, maxEntries: 5 });
    const exp = Math.floor(Date.now() / 1000) + 3600;
    for (let i = 0; i < 50; i++) await cache.verify(`t${i}`, async () => ({ uid: `u${i}`, exp }));
    assert.ok(cache.size() <= 5);
  });

  test('environment: off under test, default 60 s, clamped, 0 disables', () => {
    assert.strictEqual(resolveVerifyCacheMs({ NODE_ENV: 'test' } as any), 0);
    assert.strictEqual(resolveVerifyCacheMs({ NODE_TEST_CONTEXT: 'child' } as any), 0);
    assert.strictEqual(resolveVerifyCacheMs({ NODE_ENV: 'production' } as any), 60_000);
    assert.strictEqual(resolveVerifyCacheMs({ NODE_ENV: 'production', FIREBASE_VERIFY_CACHE_MS: '0' } as any), 0);
    assert.strictEqual(resolveVerifyCacheMs({ NODE_ENV: 'production', FIREBASE_VERIFY_CACHE_MS: '999999999' } as any), 300_000);
    assert.strictEqual(resolveVerifyCacheMs({ NODE_ENV: 'production', FIREBASE_VERIFY_CACHE_MS: 'abc' } as any), 0);
  });
});
