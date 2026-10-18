import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
process.env.JWT_SECRET = 'test-only-impact-radar-api-secret';
process.env.SUPABASE_URL = 'https://radar-test.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only-service-role';
const originalFetch = globalThis.fetch;
let fail = false, externalCalls = 0, firstEvidence: any = null, relatedEvents: any[] | null = null, calls: { url: string; method: string; body: any }[] = [];
const event = { id: 'matter-1', title: 'Supreme Court hearing listed', companies: [{ symbol: 'TCS', name: 'Tata Consultancy Services', scripCode: '532540' }], category: 'liability', authority: 'Supreme Court', status: 'scheduled', scheduledDate: '2026-10-17', scheduleConfirmed: true, information: 'The company reported a listed hearing.', nextTrigger: null, source: { name: 'BSE', url: 'https://www.bseindia.com/report.pdf', kind: 'disclosure' }, publishedAt: '2026-10-15T10:00:00Z', updatedAt: '2026-10-15T10:00:00Z' };
globalThis.fetch = (async (input: any, init: any) => {
  const url = String(input?.url || input), method = init?.method || 'GET';
  if (!url.startsWith('https://radar-test.invalid')) { externalCalls++; return new Response('<rss><channel></channel></rss>', { status: 200 }); }
  const body = init?.body ? JSON.parse(String(init.body)) : null;
  calls.push({ url, method, body });
  const data = new URL(url).pathname.endsWith('/impact_categories') ? Object.entries((await import('../../src/shared/impactRadar.js')).RADAR_CATEGORIES).map(([id, label], i) => ({ id, label, sort_order: (i+1)*10, active: true })) : fail ? { message: 'unavailable' } : new URL(url).pathname.endsWith('/impact_radar_updates') && firstEvidence ? [{data:firstEvidence}] : new URL(url).pathname.endsWith('/impact_radar_events') ? new URL(url).searchParams.get('id')?.startsWith('eq.') ? { data: event } : (relatedEvents || [event]).map(data=>({data})) : [];
  return new Response(JSON.stringify(data), { status: fail ? 503 : 200, headers: { 'Content-Type': 'application/json' } });
}) as typeof fetch;
const { impactRadarRouter } = await import('../api/impactRadar.js');
const { radarRecordFromSource, classifyRadarEvent } = await import('../services/impactRadarService.js');
const app = express(); app.use(express.json());
app.use((req, _res, next) => { if (req.headers.authorization === 'Bearer alice') (req as any).user = { uid: 'alice', isAnonymous: false }; if (req.headers.authorization === 'Bearer admin') (req as any).user = { uid: 'admin', isAnonymous: false, isAdmin: true }; next(); });
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

 test('public event detail separates source history and future hearings preserve the historical report anchor', async () => {
  const detail = await originalFetch(url + '/matter-1');
  assert.equal(detail.status, 200); const body = await detail.json();
  assert.equal(body.event.id, event.id); assert.deepEqual(body.updates, []); assert.equal(body.firstUpdate, null); assert.deepEqual(body.related, []);
  assert.match(detail.headers.get('cache-control') || '', /no-store/);
  const movement = await originalFetch(url + '/matter-1/movement');
  assert.equal(movement.status, 200); const prices = await movement.json();
  assert.equal(prices.movement.basis, 'report-date'); assert.equal(prices.movement.anchorDate, event.publishedAt.slice(0,10)); assert.equal(prices.movement.status, 'unavailable'); assert.deepEqual(prices.movement.companies[0].sessions, []);
  const invalid = await originalFetch(url + '/%3Cbad%3E/movement'); assert.equal(invalid.status, 400);
});

test('F5/F13: category registry returns seven seeded options and the list is a database-only read', async () => {
 calls = []; externalCalls = 0;
 const result = await originalFetch(url);
 assert.equal(result.status, 200); assert.equal((await result.json()).items[0].id, event.id);
 assert.equal(externalCalls, 0);
 assert.ok(calls.every(c => new URL(c.url).pathname.endsWith('/impact_radar_events')));
 const categories = await originalFetch(url + '/categories');
 assert.equal(categories.status, 200); const rows = (await categories.json()).categories;
 assert.equal(rows.length, 7); assert.equal(rows[0].id, 'restriction');
});
test('F4/F9: admin rejects fake identity, wrong names and evidence newer than the event; real identity publishes', async () => {
 const master = (await import('../utils/stockResolver.js')).resolveStockDetailsStrict('532540')!;
 const valid = { ...event, companies: [{ symbol: master.symbol, scripCode: master.scripCode, name: master.name }] };
 const update = { id: 'admin-evidence', eventId: event.id, title: 'Supreme Court hearing listed', information: 'A sourced court listing.', source: event.source, publishedAt: event.publishedAt };
 const send = (e: any, u = update) => originalFetch(url + '/admin/publish', { method: 'POST', headers: { authorization: 'Bearer admin', 'Content-Type': 'application/json' }, body: JSON.stringify({ event: e, update: u }) });
 assert.equal((await send({ ...valid, companies: [{ ...valid.companies[0], name: 'Wrong company name' }] })).status, 400);
 assert.equal((await send({ ...valid, companies: [{ name: '999999', symbol: '999999', scripCode: '999999' }] })).status, 400);
 assert.equal((await send(valid, { ...update, publishedAt: '2026-10-16T10:00:00Z' })).status, 400);
 assert.equal((await send({ ...valid, category: 'unregistered-category' })).status, 400);
 assert.equal((await send(valid)).status, 200);
});
test('F12: event detail uses the shared API rate limiter before its database handler', async () => {
 const { apiRateLimiter } = await import('../security/auth.js');
 const route = (impactRadarRouter as any).stack.find((l: any) => l.route?.path === '/:id').route;
 assert.equal(route.stack[0].handle, apiRateLimiter);
});
test('earlier news remains the price anchor and related reports can connect a later official topic', async () => {
 firstEvidence = {id:'earlier-news',eventId:event.id,title:'TCS: reported court development',information:'Publisher reported this development.',source:{name:'Publisher',kind:'news',url:'https://publisher.example/story'},publishedAt:'2026-10-13T04:00:00Z'};
 const related = {...event,id:'news-separate',authority:'Independent report',source:firstEvidence.source};
 relatedEvents=[event,related,{...related,id:'different-company',companies:[{name:'PNC Infratech Ltd',symbol:'PNCINFRA',scripCode:'539150'}]},{...related,id:'old-report',publishedAt:'2026-09-01T10:00:00Z',updatedAt:'2026-09-01T10:00:00Z'}];
 try {
  const movement=await originalFetch(url+'/matter-1/movement'); assert.equal(movement.status,200);
  assert.equal((await movement.json()).movement.anchorDate,'2026-10-13');
  const detail=await (await originalFetch(url+'/matter-1')).json(); assert.deepEqual(detail.related.map((e:any)=>e.id),['news-separate','old-report']);
  assert.ok(calls.some(c=>c.url.includes('data=cs.')&&c.url.includes('532540')), 'company lookup is independent of the global feed window');
 } finally {firstEvidence=null;relatedEvents=null;}
});

test('a past report exposes newer company reports beyond seven days and independent of authority/category',async()=>{
 const original={publishedAt:event.publishedAt,updatedAt:event.updatedAt};
 const latest={...event,id:'latest-report',category:'legal',authority:'NCLT',publishedAt:'2026-10-18T04:00:00Z',updatedAt:'2026-10-18T04:00:00Z'};
 event.publishedAt='2026-09-01T04:00:00Z';event.updatedAt=event.publishedAt;relatedEvents=[latest,event];
 try{const r=await originalFetch(url+'/matter-1');assert.equal(r.status,200);const d=await r.json();assert.deepEqual(d.related.map((e:any)=>e.id),['latest-report']);assert.equal(d.event.publishedAt,event.publishedAt);}
 finally{Object.assign(event,original);relatedEvents=null;}
});
