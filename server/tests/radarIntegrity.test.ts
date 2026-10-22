import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { radarRecordFromSource, radarRecordFromNews, matchRadarCompany } from '../services/impactRadarService.js';
import { resolveStockDetailsStrict, resolveStockDetailsSync, getAllStockEntries, registerStockEntry } from '../utils/stockResolver.js';
import { isRadarEvent, radarUrl, radarHeadline, radarCaseLookup } from '../../src/shared/impactRadar.js';
import { ImpactRadarFeed } from '../../src/utils/impactRadarFeed.js';
const now = Date.parse('2026-10-17T05:00:00Z');
const company = { symbol: 'PNCINFRA', name: 'PNC Infratech Ltd', scripCode: '539150' };
const source = { name: 'BSE', url: 'https://www.bseindia.com/report.pdf', kind: 'disclosure' as const };
const input = { title: 'Supreme Court of India civil appeal no 123/2026 hearing listed', company, source, sourceId: 'one', publishedAt: '2026-10-13T14:30:19Z' };
const event = radarRecordFromSource(input, now)!.event;
const response = (data: any, status = 200) => new Response(JSON.stringify(data), { status });
test('F1: plural banks and ambiguous company/symbol headlines never select a stock; duplicate master aliases do not cause ambiguity', () => {
 const bank = { symbol: 'INDIANB', name: 'Indian Bank', scripCode: '532814' };
 assert.equal(matchRadarCompany('RBI penalty on Indian banks', [bank]), null);
 assert.equal(matchRadarCompany('RBI penalty on Indian Bank', [bank])?.symbol, 'INDIANB');
 assert.equal(matchRadarCompany('Indian Bank and PNC Infratech PNCINFRA face court orders', [bank, company]), null);
 assert.equal(matchRadarCompany('PNC Infratech court order', [company, company])?.symbol, 'PNCINFRA');
 assert.equal(matchRadarCompany('PNC Infratech court order', getAllStockEntries())?.symbol, 'PNCINFRA');
});
test('F2/F11: original news links and kind-specific source domains are required', () => {
 const news: any = { id: 'news', title: 'PNC Infratech Delhi High Court order', publishedAt: input.publishedAt, source: 'Publisher', link: 'https://publisher.example/story', publicationTimeKnown: true, hasArticleLink: true };
 assert.ok(radarRecordFromNews(news, [company], now));
 for (const flag of [false, undefined]) assert.equal(radarRecordFromNews({ ...news, hasArticleLink: flag }, [company], now), null);
 for (const link of ['https://google.com/search?q=PNC', 'https://www.bing.com/search?q=PNC', 'https://search.yahoo.com/search?p=PNC']) {
  assert.equal(radarUrl(link), null); assert.equal(radarRecordFromNews({ ...news, link }, [company], now), null);
 }
 assert.equal(isRadarEvent({ ...event, source: { ...source, url: 'https://google.com/report.pdf' } }), false);
 assert.equal(isRadarEvent({ ...event, source: { ...source, kind: 'official', url: 'https://fake.example/order' } }), false);
 assert.ok(isRadarEvent({ ...event, source: { ...source, kind: 'official', url: 'https://delhihighcourt.nic.in/order' } }));
});
test('F3: proceeding type participates in identity, while repeated same-type references append distinct updates', () => {
 const a = radarRecordFromSource(input, now)!;
 const b = radarRecordFromSource({ ...input, title: input.title.replace('appeal', 'petition') }, now)!;
 const c = radarRecordFromSource({ ...input, source: { ...source, url: 'https://www.bseindia.com/second.pdf' } }, now)!;
 assert.notEqual(a.event.id, b.event.id); assert.equal(a.event.id, c.event.id);
 assert.equal(a.event.id, radarRecordFromSource({ ...input, title: input.title.replace('appeal no', 'appeal number') }, now)!.event.id); assert.notEqual(a.update.id, c.update.id);
});
test('F4: strict identity rejects synthetic entries and resolves PNC code to its genuine NSE symbol', () => {
 assert.ok(resolveStockDetailsSync('999999'));
 assert.equal(resolveStockDetailsStrict('999999'), null);
 assert.deepEqual(resolveStockDetailsStrict('539150')?.symbol, company.symbol);
 registerStockEntry({ symbol: '539150', name: '539150', scripCode: '539150', nameKeywords: [] }, false);
 assert.equal(resolveStockDetailsStrict('539150')?.symbol, 'PNCINFRA', 'a legacy numeric cache overlay must not hide verified PNC identity');
 registerStockEntry({ ...company, nameKeywords: [] }, false);
 registerStockEntry({ symbol: 'PENDINGONLY', name: 'Pending Company Ltd', scripCode: '', nameKeywords: [] }, false);
 assert.equal(resolveStockDetailsSync('PENDINGONLY')?.name, 'Pending Company Ltd', 'legacy consumers keep existing incomplete lookup behavior');
 assert.equal(resolveStockDetailsStrict('PENDINGONLY'), null);
});
test('F5/F10: server category registry and strict offset-aware real-calendar timestamps', () => {
 assert.equal(isRadarEvent({ ...event, category: 'new_db_category' }, new Set(['new_db_category'])), true);
 assert.equal(isRadarEvent({ ...event, category: 'unregistered' }, new Set(['new_db_category'])), false);
 for (const t of ['2026-10-13T10:00:00', '2026-02-30T10:00:00Z', '2026-10-13T24:00:00Z', '2026-10-13T10:00:00+25:00']) assert.equal(isRadarEvent({ ...event, publishedAt: t, updatedAt: t }), false, t);
 for (const t of ['2026-10-13T10:00:00Z', '2026-10-13T10:00:00+05:30']) assert.equal(isRadarEvent({ ...event, publishedAt: t, updatedAt: t }), true);
});
test('F7/F8: failed following refresh retains closed records and a successful snapshot clears prior write errors', async () => {
 let failRead = false;
 const closed = { ...event, id: 'closed', status: 'closed' };
 const feed = new ImpactRadarFeed('alice', async (url, options) => options?.method ? response({}, 503) : url.endsWith('/following') ? failRead ? response({}, 503) : response({ success: true, ids: ['closed'], events: [closed] }) : response({ success: true, items: [] }));
 await feed.refresh(); assert.equal(feed.getSnapshot().items[0].id, 'closed');
 failRead = true; await feed.refresh(); feed.accept();
 assert.equal(feed.getSnapshot().items[0].id, 'closed'); assert.equal(feed.getSnapshot().followingError, true);
 await feed.toggle('closed'); assert.ok(feed.getSnapshot().actionError);
 failRead = false; await feed.refresh(); assert.equal(feed.getSnapshot().actionError, null); feed.dispose();
});
test('F15: scoped responsive grid preserves one/two/three columns, wrapping and the Home preview limit', () => {
 const css = fs.readFileSync('src/styles/impact-radar.css', 'utf8');
 assert.match(css, /@media\(min-width:768px\).*?impact-radar-grid.*?repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css, /@media\(min-width:1280px\).*?impact-radar-grid.*?repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(css, /min-width:0/); assert.match(css, /overflow-wrap/);
});
test('company-first summaries and actionable lookup instructions do not invent a case number', () => {
 const raw = { ...event, title: 'This is in continuation to the litigation disclosed in the offer documents' };
 assert.match(radarHeadline(raw), /^PNC Infratech Ltd:/); assert.doesNotMatch(radarHeadline(raw), /This is in continuation/);
 assert.equal(radarCaseLookup({ ...raw, information: 'The company disclosed an order.' }).reference, null);
 assert.match(radarCaseLookup(raw).instructions, /party-name search/);
});

test('reviewed PNC backfill preserves original disclosure time, order date, investor original and independently timed news', async () => {
 const { reviewedRadarRecords } = await import('../services/impactRadarService.js');
 const records = reviewedRadarRecords(now);
 assert.equal(records.length, 3);
 assert.ok(records.every(r => isRadarEvent(r.event)));
 assert.equal(new Set(records.map(r => r.event.id)).size, 1);
 assert.equal(records[0].event.occurredDate, '2026-10-12');
 assert.equal(radarCaseLookup(records[0].event).reference, null, 'the words case number in a missing-reference statement are not a case identifier');
 assert.equal(records[0].event.publishedAt, '2026-10-13T14:30:19.000Z');
 assert.equal(records[0].event.occurredSource?.kind, 'company');
 assert.equal(records.filter(r => r.update.source.kind === 'news').length, 2);
 assert.equal(records[2].event.scheduledDate, '2026-11-26'); assert.equal(records[2].event.scheduleConfirmed, false); assert.equal(records[2].event.scheduleSource?.kind, 'news');
 assert.ok(records.slice(1).every(r => Date.parse(r.update.publishedAt) > Date.parse(records[0].event.publishedAt)), 'available news is not claimed to precede the filing');
});

test('unknown company resolution requires the original Screener page BSE link to agree with the requested scrip', async () => {
 const { refreshRadarCompanyIdentity } = await import('../services/radarCompanyIdentity.js');
 const previous = globalThis.fetch;
 try {
  globalThis.fetch = (async input => String(input).includes('/api/') ? new Response(JSON.stringify([{ name: 'Wrong Search Hit Ltd', url: '/company/WRONGHIT/' }])) : new Response('<a href="https://www.bseindia.com/stock-share-price/wrong/wrong/500111/">BSE</a>')) as typeof fetch;
  await refreshRadarCompanyIdentity('599991'); assert.equal(resolveStockDetailsStrict('599991'), null);
  globalThis.fetch = (async input => String(input).includes('/api/') ? new Response(JSON.stringify([{ name: 'Verified Test Company Ltd', url: '/company/VERIFIEDTEST/' }])) : new Response('<a href="https://www.bseindia.com/stock-share-price/test/test/599992/">BSE</a>')) as typeof fetch;
  await refreshRadarCompanyIdentity('599992'); assert.equal(resolveStockDetailsStrict('599992')?.name, 'Verified Test Company Ltd');
 } finally { globalThis.fetch = previous; }
});
