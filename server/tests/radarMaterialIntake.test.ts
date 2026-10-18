import { test } from 'node:test';
import assert from 'node:assert/strict';
import { radarRecordFromNews, radarRecordFromSource, matchRadarCompany } from '../services/impactRadarService.js';
import { isRadarEvent, radarHeadline } from '../../src/shared/impactRadar.js';
import { fetchAllMultiSourceNewsFeeds } from '../services/stockNewsService.js';
import { DEFAULT_RADAR_INTAKE_RULES, matchRadarIntakeRule, isRadarIntakeRule } from '../services/radarIntakePolicy.js';
import { getRadarMovement } from '../services/radarMovementService.js';
import { nseBhavcopyUrl } from '../services/radarMovementService.js';
const now = Date.parse('2026-10-17T05:00:00Z');
const company = { symbol: 'PNCINFRA', name: 'PNC Infratech Ltd', scripCode: '539150' };
const story = { id: 'original-news', title: 'PNC Infratech: Delhi High Court stays debarment', publishedAt: 'Sat, 17 Oct 2026 04:00:00 GMT', source: 'Original Publisher', sourceSlug: 'publisher', link: 'https://publisher.example/original-report', publicationTimeKnown: true, hasArticleLink: true, snippet: '', category: 'corporate' as const, timeAgo: '1h ago' };
test('RSS publication dates reach Radar as explicit UTC instants without waiting for a filing', () => {
 const record = radarRecordFromNews(story, [company], now);
 assert.ok(record); assert.equal(record.event.publishedAt, '2026-10-17T04:00:00.000Z');
 for (const date of ['17 Oct 2026 04:00:00', 'Mon, 30 Feb 2026 04:00:00 GMT', 'unknown']) assert.equal(radarRecordFromNews({ ...story, publishedAt: date }, [company], now), null);
});
test('material policy changes are literal, bounded and respect disabled rules and exclusions', () => {
 const custom = {...DEFAULT_RADAR_INTAKE_RULES[1], terms:['factory evacuation'],exclude_terms:['drill']};
 assert.equal(matchRadarIntakeRule('Company reports factory evacuation',[custom])?.category,'operations');
 assert.equal(matchRadarIntakeRule('Company completes factory evacuation drill',[custom]),null);
 assert.equal(matchRadarIntakeRule('Company reports factory evacuations',[custom]),null);
 assert.equal(matchRadarIntakeRule('Company reports factory evacuation',[{...custom,active:false}]),null);
 assert.equal(isRadarIntakeRule({...custom,terms:['(a+)+$']}),false);
 assert.equal(isRadarIntakeRule({...custom,id:undefined}),false);
 assert.equal(isRadarIntakeRule({...custom,category:null}),false);
});
test('three verified saved sessions survive an exchange outage without downloading report files', async () => {
 const record = radarRecordFromNews({...story,publishedAt:'2026-10-13T04:00:00Z'},[company],now)!;
 const sessions = ['2026-10-13','2026-10-14','2026-10-15'].map(date => ({date,symbol:'PNCINFRA',series:'EQ',close:100,previousClose:100,changePercent:0,sourceUrl:nseBhavcopyUrl(date)}));
 let saved = false;
 const result = await getRadarMovement(record.event,Date.parse('2026-10-15T12:00:00Z'),async()=>null,{read:async()=>sessions,save:async rows=>{saved=rows.some(r=>r.symbol==='539150');return true;}});
 assert.equal(result.status,'available'); assert.deepEqual(result.companies[0].sessions,sessions); assert.equal(saved,true);
});
test('independent allegations and operational incidents qualify without a court or regulator name', () => {
 for (const [title, category] of [['PNC Infratech: independent report alleges accounting irregularities', 'governance'], ['PNC Infratech halts production after plant fire', 'operations'], ['PNC Infratech discloses loan default', 'liability']]) {
  const record = radarRecordFromNews({ ...story, title, publishedAt: '2026-10-17T04:00:00Z' }, [company], now);
  assert.ok(record, title); assert.equal(record.event.category, category); assert.equal(record.event.source.kind, 'news');
  assert.match(record.event.information, /reported|report/i); assert.match(radarHeadline(record.event), /^PNC Infratech/);
 }
 assert.equal(radarRecordFromNews({ ...story, title: 'PNC Infratech shares rise today', publishedAt: '2026-10-17T04:00:00Z' }, [company], now), null);
});
test('a material RSS snippet can explain a neutral company headline without inventing a new headline', () => {
 const record = radarRecordFromNews({ ...story, title: 'PNC Infratech: company update', snippet: 'An independent report alleges accounting irregularities.', publishedAt: '2026-10-17T04:00:00Z' }, [company], now);
 assert.ok(record); assert.match(record.event.information, /Original Publisher/); assert.match(record.event.information, /accounting irregularities/);
 assert.equal(radarRecordFromNews({ ...story, title: 'Market update', snippet: 'PNC Infratech faces fraud allegations.', publishedAt: '2026-10-17T04:00:00Z' }, [company], now), null, 'snippet-only identity must not assign a generic multi-stock story');
});
test('bounded master aliases improve discovery without plural or ambiguous matching', () => {
 const tcs = { symbol: 'TCS', name: 'Tata Consultancy Services Ltd', scripCode: '532540', nameKeywords: ['TATA CONSULTANCY'] };
 assert.equal(matchRadarCompany('Tata Consultancy faces data breach', [tcs])?.symbol, 'TCS');
 assert.equal(matchRadarCompany('Tata Consultancy and PNC Infratech face investigations', [tcs, company]), null);
});
test('original independent reports are valid attributed sources, without pretending to be official', () => {
 const r = radarRecordFromSource({ sourceId: 'report', title: 'PNC Infratech: independent report alleges accounting irregularities', company, publishedAt: '2026-10-17T04:00:00Z', source: { name: 'Research publisher', kind: 'report', url: 'https://research.example/report.pdf' } as any }, now);
 assert.ok(r); assert.equal(isRadarEvent(r.event), true); assert.equal(r.event.scheduleConfirmed, false);
});
test('RSS parser emits normalized dates and retains the last usable news batch after a failed fetch', async () => {
 const previous = globalThis.fetch;
 try {
  globalThis.fetch = (async () => new Response(`<rss><channel><item><title>${story.title}</title><link>${story.link}</link><pubDate>${story.publishedAt}</pubDate></item></channel></rss>`)) as typeof fetch;
  const fresh = await fetchAllMultiSourceNewsFeeds(true);
  assert.equal(fresh[0].publishedAt, '2026-10-17T04:00:00.000Z');
  globalThis.fetch = (async () => new Response('Unavailable', { status: 503 })) as typeof fetch;
  assert.deepEqual(await fetchAllMultiSourceNewsFeeds(true), fresh);
 } finally { globalThis.fetch = previous; }
});
