import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isRadarEvent, isNeutralRadarText, publicRadarEvent, matchesRadarFilter, radarStatus, radarDay, radarUrl, type RadarEvent } from '../../src/shared/impactRadar.js';
import { ImpactRadarFeed } from '../../src/utils/impactRadarFeed.js';

const now = Date.parse('2026-10-16T17:00:00Z');
const event: RadarEvent = { id: 'case-1', title: 'Supreme Court hearing scheduled', companies: [{ symbol: 'TCS', name: 'Tata Consultancy Services', scripCode: '532540' }],
  category: 'liability', authority: 'Supreme Court', status: 'scheduled', scheduledDate: '2026-10-17', scheduleConfirmed: true,
  information: 'The company disclosed that a hearing is listed.', nextTrigger: 'The next listed hearing.', source: { name: 'BSE disclosure', url: 'https://www.bseindia.com/test.pdf', kind: 'disclosure' }, publishedAt: '2026-10-15T10:00:00Z', updatedAt: '2026-10-15T10:00:00Z' };
const response = (data: any, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const deferred = <T>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; };
test('future events carry sourced information without prediction fields', () => {
  assert.equal(isRadarEvent(event), true);
  for (const title of ['Stock could crash after judgment', 'Buy before the hearing', 'Price target raised', 'Bearish outcome likely']) assert.equal(isNeutralRadarText(title, 200), false);
  const projected = publicRadarEvent({ ...event, predictedReturn: -20, sentiment: 'negative', likelihood: 0.9 } as any) as any;
  assert.equal(projected.predictedReturn, undefined); assert.equal(projected.sentiment, undefined); assert.equal(projected.likelihood, undefined);
  assert.equal(isRadarEvent({ ...event, id: undefined }), false);
  assert.equal(isRadarEvent({ ...event, scheduledDate: '2026-02-30' }), false);
  assert.equal(radarUrl('javascript:alert(1)'), null); assert.equal(radarUrl('https://user:pass@example.com'), null);
});
test('IST day boundaries and scheduled dates never imply an outcome or live hearing', () => {
  assert.equal(radarDay(Date.parse('2026-10-16T18:30:00Z')), '2026-10-17');
  assert.equal(matchesRadarFilter(event, 'tomorrow', new Set(), now), true);
  assert.equal(matchesRadarFilter(event, 'live', new Set(), now), false);
  const overdue = { ...event, scheduledDate: '2026-10-15' };
  assert.equal(radarStatus(overdue, now), 'Awaiting update');
  assert.equal(matchesRadarFilter(overdue, 'live', new Set(), now), false);
  assert.equal(matchesRadarFilter({ ...event, status: 'monitoring' }, 'live', new Set(), now), true);
  assert.equal(matchesRadarFilter({ ...event, status: 'closed' }, 'tracking', new Set([event.id]), now), true);
});
test('failed refresh preserves displayed events; new arrivals wait for acceptance', async () => {
  let turn = 0;
  const feed = new ImpactRadarFeed('guest', async () => ++turn === 1 ? response({ success: true, items: [event] }) : turn === 2 ? response({}, 503) : response({ success: true, items: [{ ...event, title: 'Hearing date updated' }] }));
  await feed.refresh(); await feed.refresh();
  assert.equal(feed.getSnapshot().items[0].title, event.title); assert.ok(feed.getSnapshot().error);
  await feed.refresh(); assert.equal(feed.getSnapshot().items[0].title, event.title); assert.ok(feed.getSnapshot().pending);
  feed.accept(); assert.equal(feed.getSnapshot().items[0].title, 'Hearing date updated'); feed.dispose();
});
test('tracking is confirmed by the server, duplicate clicks are coalesced and a failed write keeps the previous state', async () => {
  let mutationCount = 0, fail = false;
  const save = deferred<Response>();
  const feed = new ImpactRadarFeed('alice', async (url, options) => {
    if (options?.method) { mutationCount++; return fail ? response({}, 503) : save.promise; }
    return url.endsWith('/following') ? response({ success: true, ids: [], events: [] }) : response({ success: true, items: [event] });
  });
  await feed.refresh(); const pending = feed.toggle(event.id); await feed.toggle(event.id);
  assert.equal(mutationCount, 1); assert.deepEqual(feed.getSnapshot().following, []);
  save.resolve(response({ success: true, id: event.id, followed: true })); await pending;
  assert.deepEqual(feed.getSnapshot().following, [event.id]);
  fail = true; await feed.toggle(event.id); assert.deepEqual(feed.getSnapshot().following, [event.id]); assert.ok(feed.getSnapshot().actionError); feed.dispose();
});
test('an old following snapshot cannot undo a tracking write that completes during refresh', async () => {
  let secondRead = false; const old = deferred<Response>();
  const feed = new ImpactRadarFeed('alice', async (url, options) => options?.method ? response({ success: true, id: event.id, followed: true }) :
    url.endsWith('/following') ? secondRead ? old.promise : response({ success: true, ids: [], events: [] }) : response({ success: true, items: [event] }));
  await feed.refresh(); secondRead = true; const pending = feed.refresh(); await feed.toggle(event.id);
  old.resolve(response({ success: true, ids: [], events: [] })); await pending;
  assert.deepEqual(feed.getSnapshot().following, [event.id]); feed.dispose();
});
test('disposed account work cannot set a saved state or resurrect an old feed', async () => {
  const late = deferred<Response>();
  const feed = new ImpactRadarFeed('guest', async () => late.promise);
  const pending = feed.refresh(); feed.dispose(); late.resolve(response({ success: true, items: [event] })); await pending;
  assert.deepEqual(feed.getSnapshot().items, []); assert.equal(feed.getSnapshot().loading, false);
});
