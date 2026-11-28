import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchFilingFeed } from './filing-cache.mjs';

const url = 'https://staging.example.test/api/announcements';
const response = (status = 200, headers = {}) => new Response('[]', {
  status,
  headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=5', ...headers },
});

function fixture(fetchOrigin = () => response()) {
  const cache = new Map();
  let calls = 0;
  return {
    calls: () => calls,
    stored: () => [...cache.values()],
    request: (path = url, init) => fetchFilingFeed(new Request(path, init), {
      cache: {
        async match(key) { return cache.get(key.url)?.clone(); },
        async put(key, entry) { cache.set(key.url, entry); },
      },
      fetchOrigin: () => { calls++; return fetchOrigin(); },
      waitUntil() {},
    }),
  };
}

test('shares public feed responses with a six-second edge TTL and preserves feed-delay headers', async () => {
  const f = fixture(() => response(200, { 'X-BSE-Feed-Stale': 'true', 'X-BSE-Feed-Updated-At': '123' }));
  await f.request();
  const cached = await f.request();
  assert.equal(f.calls(), 1);
  assert.equal(f.stored()[0].headers.get('cache-control'), 'public, max-age=6, must-revalidate');
  assert.equal(cached.headers.get('cache-control'), 'public, max-age=0, must-revalidate');
  assert.equal(cached.headers.get('x-bse-feed-stale'), 'true');
  assert.equal(cached.headers.get('x-bse-feed-updated-at'), '123');
  assert.equal(await cached.text(), '[]');
});

test('preserves query filters and bypasses cache for sign-in and forced refresh', async () => {
  const f = fixture();
  await f.request(url + '?limit=10');
  await f.request(url + '?limit=20');
  await f.request(url + '?limit=20', { headers: { cookie: 'session=fixture' } });
  await f.request(url + '?limit=20', { headers: { authorization: 'Bearer fixture' } });
  await f.request(url + '?limit=20', { headers: { 'cache-control': 'no-cache' } });
  await f.request(url + '?limit=20');
  assert.equal(f.calls(), 5);
});

test('never caches upstream failures or responses carrying private data', async () => {
  for (const result of [
    () => response(504),
    () => response(200, { 'set-cookie': 'session=fixture' }),
    () => response(200, { 'cache-control': 'private, no-store' }),
    () => response(200, { 'content-type': 'text/html' }),
  ]) {
    const f = fixture(result);
    await f.request();
    await f.request();
    assert.equal(f.calls(), 2);
  }
});
