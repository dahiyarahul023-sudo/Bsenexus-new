import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
process.env.JWT_SECRET = 'test-only-impact-radar-api-secret';
process.env.SUPABASE_URL = 'https://radar-test.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only-service-role';
const originalFetch = globalThis.fetch;
let fail = false, calls: { url: string; method: string; body: any }[] = [];
const event = { id: 'matter-1', title: 'Supreme Court hearing listed', companies: [{ symbol: 'TCS', name: 'Tata Consultancy Services', scripCode: '532540' }], category: 'liability', authority: 'Supreme Court', status: 'scheduled', scheduledDate: '2026-10-17', scheduleConfirmed: true, information: 'The company reported a listed hearing.', nextTrigger: null, source: { name: 'BSE', url: 'https://www.bseindia.com/report.pdf', kind: 'disclosure' }, publishedAt: '2026-10-15T10:00:00Z', updatedAt: '2026-10-15T10:00:00Z' };
globalThis.fetch = (async (input: any, init: any) => {
  const url = String(input?.url || input), method = init?.method || 'GET';
  if (!url.startsWith('https://radar-test.invalid')) return originalFetch(input, init);
  const body = init?.body ? JSON.parse(String(init.body)) : null;
  calls.push({ url, method, body });
  const data = fail ? { message: 'unavailable' } : new URL(url).pathname.endsWith('/impact_radar_events') ? new URL(url).searchParams.has('id') ? { data: event } : [{ data: event }] : [];
  return new Response(JSON.stringify(data), { status: fail ? 503 : 200, headers: { 'Content-Type': 'application/json' } });
}) as typeof fetch;
const { impactRadarRouter } = await import('../api/impactRadar.js');
const { radarRecordFromSource, classifyRadarEvent } = await import('../services/impactRadarService.js');
const app = express(); app.use(express.json());
app.use((req, _res, next) => { if (req.headers.authorization === 'Bearer alice') (req as any).user = { uid: 'alice', isAnonymous: false }; next(); });
app.use('/api/impact-radar', impactRadarRouter);
const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
const url = `http://127.0.0.1:${(server.address() as any).port}/api/impact-radar`;
after(async () => { globalThis.fetch = originalFetch; server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); });
test('guests cannot read private tracking or follow events', async () => {
  assert.equal((await originalFetch(url + '/following')).status, 401);
  assert.equal((await originalFetch(url + '/matter-1/follow', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{"followed":true}' })).status, 401);
});
test('read, follow and unfollow always bind to the verified UID, ignoring forged identity', async () => {
  calls = [];
  const headers = { authorization: 'Bearer alice', 'Content-Type': 'application/json', 'x-user-id': 'attacker' };
  const read = await originalFetch(url + '/following?uid=attacker', { headers });
  assert.equal(read.status, 200); assert.match(read.headers.get('cache-control') || '', /no-store/);
  assert.ok(calls.some(c => c.url.includes('user_id=eq.alice'))); assert.ok(calls.every(c => !c.url.includes('attacker')));
  const followed = await originalFetch(url + '/matter-1/follow', { method: 'PUT', headers, body: '{"followed":true,"uid":"attacker"}' });
  assert.equal(followed.status, 200); assert.ok(calls.some(c => c.body?.user_id === 'alice' && c.body?.event_id === 'matter-1'));
  const unfollowed = await originalFetch(url + '/matter-1/follow', { method: 'PUT', headers, body: '{"followed":false,"uid":"attacker"}' });
  assert.equal(unfollowed.status, 200); assert.ok(calls.some(c => c.method === 'DELETE' && c.url.includes('user_id=eq.alice') && c.url.includes('event_id=eq.matter-1')));
});
test('unconfirmed storage writes fail; malformed choices and ordinary-user publishing are denied', async () => {
  const headers = { authorization: 'Bearer alice', 'Content-Type': 'application/json' };
  const malformed = await originalFetch(url + '/matter-1/follow', { method: 'PUT', headers, body: '{"followed":"true"}' }); assert.equal(malformed.status, 400);
  const publish = await originalFetch(url + '/admin/publish', { method: 'POST', headers, body: '{}' }); assert.equal(publish.status, 403);
  fail = true;
  try { const r = await originalFetch(url + '/matter-1/follow', { method: 'PUT', headers, body: '{"followed":true}' }); assert.equal(r.status, 503); assert.equal((await r.json()).success, false); }
  finally { fail = false; }
});
test('discovery excludes generic compliance, forecasts, unknown times and unidentified companies', () => {
  assert.equal(classifyRadarEvent('Compliance certificate under SEBI Regulation 30'), null);
  const input = { sourceId: 'exchange-1', title: 'Supreme Court hearing on company petition', company: event.companies[0], source: event.source as any, publishedAt: event.publishedAt };
  const record = radarRecordFromSource(input, Date.parse('2026-10-16T10:00:00Z'));
  assert.equal(record?.event.status, 'scheduled'); assert.equal(record?.event.scheduledDate, null); assert.equal(record?.event.scheduleConfirmed, false);
  assert.equal(radarRecordFromSource({ ...input, title: 'Supreme Court judgment: shares could crash' }), null);
  assert.equal(radarRecordFromSource({ ...input, publishedAt: 'unknown' }), null);
  assert.equal(radarRecordFromSource({ ...input, company: { ...input.company, scripCode: '' } }), null);
});
test('explicit case references link source updates without merging unrelated cases or companies', () => {
  const input = { sourceId: 'source-a', title: 'Supreme Court appeal no 123/2026 hearing listed', company: event.companies[0], source: event.source as any, publishedAt: event.publishedAt };
  const a = radarRecordFromSource(input)!;
  const b = radarRecordFromSource({ ...input, sourceId: 'source-b', title: 'Supreme Court appeal no 123/2026 hearing deferred', source: { ...input.source, url: 'https://www.bseindia.com/next-report.pdf' } })!;
  assert.equal(a.event.id, b.event.id); assert.notEqual(a.update.id, b.update.id);
  assert.notEqual(a.event.id, radarRecordFromSource({ ...input, title: 'Supreme Court appeal no 124/2026 hearing listed' })!.event.id);
  assert.notEqual(a.event.id, radarRecordFromSource({ ...input, company: { ...input.company, symbol: 'INFY', scripCode: '500209' } })!.event.id);
  const highCourt = { ...input, title: 'High Court appeal no 123/2026 hearing listed' };
  assert.notEqual(radarRecordFromSource(highCourt)!.event.id, radarRecordFromSource({ ...highCourt, source: { ...input.source, url: 'https://www.bseindia.com/different-court.pdf' } })!.event.id, 'A generic High Court reference does not identify its jurisdiction');
});

 test('public event detail separates source history and scheduled events have no observed future movement', async () => {
  const detail = await originalFetch(url + '/matter-1');
  assert.equal(detail.status, 200); const body = await detail.json();
  assert.equal(body.event.id, event.id); assert.deepEqual(body.updates, []); assert.equal(body.firstUpdate, null); assert.deepEqual(body.related, []);
  assert.match(detail.headers.get('cache-control') || '', /no-store/);
  const movement = await originalFetch(url + '/matter-1/movement');
  assert.equal(movement.status, 200); const prices = await movement.json();
  assert.equal(prices.movement.status, 'upcoming'); assert.deepEqual(prices.movement.companies[0].sessions, []);
  const invalid = await originalFetch(url + '/%3Cbad%3E/movement'); assert.equal(invalid.status, 400);
});
