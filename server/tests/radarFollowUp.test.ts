import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { readBhavcopyZip, parseBhavcopy, getRadarMovement, nseBhavcopyUrl } from '../services/radarMovementService.js';
import { radarRecordFromSource, matchRadarCompany, classifyRadarEvent } from '../services/impactRadarService.js';
import { isRadarEvent, publicRadarEvent, radarTiming, matchesRadarFilter, radarVerificationSources, type RadarEvent } from '../../src/shared/impactRadar.js';
import { isRadarMovement } from '../../src/shared/radarMovement.js';
const day = '2026-10-13';
const header = 'TradDt,Sgmt,Src,FinInstrmTp,TckrSymb,SctySrs,ClsPric,PrvsClsgPric,TtlTradgVol';
const csv = `${header}\n${day},CM,NSE,STK,PNCINFRA,EQ,110,100,500\n${day},CM,NSE,STK,OTHER,EQ,80,100,500\n${day},CM,NSE,STK,ZERO,EQ,0,100,0`;
const source = { name: 'BSE', url: 'https://www.bseindia.com/report.pdf', kind: 'disclosure' as const };
const company = { symbol: 'PNCINFRA', name: 'PNC Infratech Ltd.', scripCode: '539150' };
const event: RadarEvent = { id: 'pnc-test', title: 'Delhi High Court stays debarment order', category: 'restriction', authority: 'Delhi High Court', companies: [company], status: 'monitoring', scheduledDate: null, scheduleConfirmed: false, information: 'The company disclosed a court order.', nextTrigger: null, source, publishedAt: '2026-10-13T14:30:19Z', updatedAt: '2026-10-13T14:30:19Z' };
function archive(text: string, reportDay = day) {
  const name = Buffer.from(`BhavCopy_NSE_CM_0_0_0_${reportDay.replaceAll('-', '')}_F_0000.csv`), plain = Buffer.from(text), compressed = deflateRawSync(plain);
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(8, 8); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(plain.length, 22); local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(8, 10); central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(plain.length, 24); central.writeUInt16LE(name.length, 28);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(central.length + name.length, 12); end.writeUInt32LE(local.length + name.length + compressed.length, 16);
  return Buffer.concat([local, name, compressed, central, name, end]);
}
test('official daily report parser calculates observed returns, keeps symbols separate and rejects false dates/archives', () => {
  assert.equal(readBhavcopyZip(archive(csv), day), csv);
  const rows = parseBhavcopy(csv, day);
  assert.ok(Math.abs(rows.get('PNCINFRA')!.changePercent - 10) < 1e-10);
  assert.ok(Math.abs(rows.get('OTHER')!.changePercent + 20) < 1e-10);
  assert.equal(rows.has('ZERO'), false);
  assert.throws(() => parseBhavcopy(csv.replaceAll(day, '2026-10-12'), day), /date mismatch/);
  assert.throws(() => parseBhavcopy('<html>Denied</html>', day), /format/);
  assert.throws(() => readBhavcopyZip(archive(csv, '2026-10-12'), day), /Unexpected report/);
  const bomb = archive(csv); const central = bomb.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02])); bomb.writeUInt32LE(100_000_000, central + 24);
  assert.throws(() => readBhavcopyZip(bomb, day), /Unexpected report/);
  assert.throws(() => nseBhavcopyUrl('2026-02-30'), /Invalid/);
});
test('after-close publication, missing reports and unavailable prices never become inferred reactions', async () => {
  const rows = parseBhavcopy(csv, day), called: string[] = [];
  const result = await getRadarMovement(event, Date.parse('2026-10-17T05:00:00Z'), async date => { called.push(date); return date === day ? rows : null; });
  assert.equal(result.basis, 'report-date'); assert.equal(result.anchorDate, day); assert.equal(result.afterClose, true); assert.equal(result.status, 'partial');
  assert.equal(result.companies[0].sessions.length, 1); assert.equal(result.companies[0].sessions[0].date, day);
  assert.equal(isRadarMovement(result), true); assert.ok(!called.includes('2026-10-17'));
  assert.equal(isRadarMovement({ ...result, companies: [{ symbol: 'PNCINFRA', sessions: [{ ...result.companies[0].sessions[0], changePercent: 99 }] }] }), false);
  const empty = await getRadarMovement(event, Date.parse('2026-10-17T05:00:00Z'), async () => { throw new Error('Blocked'); });
  assert.equal(empty.status, 'unavailable'); assert.deepEqual(empty.companies[0].sessions, []);
  let fetched = false;
  const future = await getRadarMovement({ ...event, status: 'scheduled', scheduledDate: '2026-10-20' }, Date.parse('2026-10-17T05:00:00Z'), async () => { fetched = true; return rows; });
  assert.equal(future.status, 'upcoming'); assert.equal(fetched, false);
});
test('exact sourced event dates and explicit next dates survive projection without guessing dates from publication', () => {
  const input = { sourceId: 'pnc', title: event.title, company, source, publishedAt: event.publishedAt };
  const record = radarRecordFromSource({ ...input, evidence: 'Delhi High Court order dated 12 October 2026. Next hearing on 20 October 2026.' }, Date.parse('2026-10-17T05:00:00Z'))!;
  assert.equal(record.event.occurredDate, '2026-10-12'); assert.equal(record.event.scheduledDate, '2026-10-20'); assert.equal(record.event.scheduleConfirmed, true);
  assert.equal(publicRadarEvent(record.event).occurredSource?.url, source.url);
  const projected = publicRadarEvent({ ...record.event, occurredSource: { ...source, sentiment: 'bullish' }, scheduleSource: { ...source, prediction: 'rise' } } as any) as any;
  assert.equal(projected.occurredSource.sentiment, undefined); assert.equal(projected.scheduleSource.prediction, undefined);
  assert.equal(isRadarEvent({ ...record.event, occurredSource: undefined }), false);
  const report = radarRecordFromSource({ ...input, source: { ...source, kind: 'news' }, evidence: 'Next hearing on 20 October 2026.' }, Date.parse('2026-10-17T05:00:00Z'))!;
  assert.equal(report.event.scheduleConfirmed, false); assert.equal(report.event.occurredDate, undefined);
  const may = radarRecordFromSource({ ...input, evidence: 'Next hearing on 20 May 2027.' }, Date.parse('2026-10-17T05:00:00Z'))!;
  assert.equal(may.event.scheduledDate, '2027-05-20'); assert.equal(may.event.scheduleConfirmed, true, 'the calendar month May is not tentative language');
  assert.equal(radarRecordFromSource(input, Date.parse('2026-10-17T05:00:00Z'))!.event.scheduledDate, null);
  assert.equal(radarRecordFromSource({ ...input, evidence: 'NHAI order dated 3 September 2026 was challenged.' }, Date.parse('2026-10-17T05:00:00Z'))!.event.occurredDate, undefined);
});
test('PNC short-name/Delhi HC discovery is unambiguous; timing is separate from following and future schedules', () => {
  assert.equal(matchRadarCompany('PNC Infratech gets Delhi HC relief', [company])?.scripCode, company.scripCode);
  assert.equal(classifyRadarEvent('PNC Infratech: Delhi HC stays debarment orders')?.authority, 'Delhi High Court');
  assert.equal(matchRadarCompany('PNC Infratech and Another Company get court relief', [company, { ...company, name: 'Another Company Ltd', symbol: 'ANOTHER', scripCode: '500001' }]), null);
  const now = Date.parse('2026-10-17T05:00:00Z');
  assert.equal(radarTiming(event, now), 'past'); assert.equal(matchesRadarFilter(event, 'past', new Set(), now), true);
  assert.equal(matchesRadarFilter({ ...event, updatedAt: '2026-10-17T04:00:00Z' }, 'live', new Set(), now), true);
  assert.equal(matchesRadarFilter({ ...event, status: 'scheduled', scheduledDate: '2026-10-17' }, 'live', new Set(), now), false);
  assert.equal(radarTiming({ ...event, status: 'scheduled', scheduledDate: '2026-10-18' }, now), 'upcoming');
  assert.equal(matchesRadarFilter({ ...event, status: 'closed' }, 'tracking', new Set([event.id]), now), true);
  assert.match(radarVerificationSources(event)[0].url, /delhihighcourt/);
});

 test('Radar and ordinary news share one simultaneous upstream RSS batch', async () => {
  const { fetchAllMultiSourceNewsFeeds, NEWS_FEEDS } = await import('../services/stockNewsService.js');
  const previous = globalThis.fetch; let calls = 0;
  globalThis.fetch = (async () => { calls++; return new Response('<rss><channel><item><title>PNC Infratech Delhi High Court order</title><link>https://example.com/one</link><pubDate>Tue, 13 Oct 2026 14:30:00 GMT</pubDate></item></channel></rss>', { status: 200 }); }) as typeof fetch;
  try {
    const results = await Promise.all([fetchAllMultiSourceNewsFeeds(true), fetchAllMultiSourceNewsFeeds(true), fetchAllMultiSourceNewsFeeds(true)]);
    assert.equal(calls, NEWS_FEEDS.length); assert.ok(results[0].length > 0); assert.deepEqual(results[0], results[1]);
  } finally { globalThis.fetch = previous; }
});

test('movement download path reads bounded exchange archives and coalesces concurrent views by report date', async () => {
  const previous = globalThis.fetch; let calls = 0;
  globalThis.fetch = (async input => { calls++; return String(input).includes('20261013') ? new Response(new Uint8Array(archive(csv)), { status: 200 }) : new Response('Report unavailable', { status: 404 }); }) as typeof fetch;
  try {
    const now = Date.parse('2026-10-17T05:00:00Z');
    const [a, b] = await Promise.all([getRadarMovement(event, now), getRadarMovement(event, now)]);
    assert.equal(calls, 4); assert.equal(a.companies[0].sessions.length, 1);
    assert.deepEqual(a, b); assert.equal(isRadarMovement(a), true);
  } finally { globalThis.fetch = previous; }
});
