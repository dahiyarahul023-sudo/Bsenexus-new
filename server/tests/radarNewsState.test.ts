import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchAllMultiSourceNewsFeeds, getNewsSourceState } from '../services/stockNewsService.js';
test('F14: successful six-minute-old cache is stale, while an actual failed fetch is unavailable', async t => {
 const previous = globalThis.fetch;
 t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-17T05:00:00Z') });
 try {
  globalThis.fetch = (async () => new Response('<rss><channel><item><title>PNC Infratech Delhi High Court order</title><link>https://publisher.example/story</link><pubDate>Sat, 17 Oct 2026 04:00:00 GMT</pubDate></item></channel></rss>')) as typeof fetch;
  await fetchAllMultiSourceNewsFeeds(true);
  assert.equal(getNewsSourceState().unavailable, false); assert.equal(getNewsSourceState().stale, false);
  t.mock.timers.tick(6 * 60_000);
  assert.equal(getNewsSourceState().unavailable, false); assert.equal(getNewsSourceState().stale, true);
  globalThis.fetch = (async () => new Response('Unavailable', { status: 503 })) as typeof fetch;
  await fetchAllMultiSourceNewsFeeds(true); assert.equal(getNewsSourceState().unavailable, true);
 } finally { globalThis.fetch = previous; t.mock.timers.reset(); }
});
