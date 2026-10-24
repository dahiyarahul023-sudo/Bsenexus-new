import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { hasExactScripCode } from '../../src/shared/scripMatching.js';
import { parseBseDate } from '../utils/helpers.js';
import { calendarDayKey, projectCalendarTiming } from '../../src/shared/calendarTiming.js';

function load(file: string, require: (path: string) => any, extra: any = {}) {
  const source = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const context = vm.createContext({ exports: {}, require, console, Date, Map, Set, process,
    URLSearchParams, AbortSignal, DOMException, setTimeout, clearTimeout, ...extra });
  vm.runInContext(source, context);
  return context.exports as any;
}
function service(rows: any[], events: any[] = [], meetings: any[] = [], fail = false) {
  const clock = Date.now();
  return load('server/services/resultsCalendarService.ts', path => {
    if (path === 'fs') return { existsSync: () => true, readFileSync: () => JSON.stringify({ items: meetings, lastUpdated: clock, lastAttempt: clock, universeVersion: 'fixture' }) };
    if (path === 'path') return { join: (...parts: string[]) => parts.join('/'), dirname: () => '/tmp' };
    if (path.endsWith('/scripMatching.js')) return { hasExactScripCode };
    if (path.endsWith('/calendarTiming.js')) return { calendarDayKey, projectCalendarTiming };
    if (path.endsWith('/calendarUniverse.js')) return { FNO_CALENDAR_VERSION: 'fixture' };
    if (path.endsWith('/helpers.js')) return { parseBseDate, resolveStockDetails: async () => ({ symbol: 'SUPREMEIND', scripCode: '509930', companyName: 'Supreme Industries' }) };
    if (path.endsWith('/supabase.js')) return { isSupabaseConfigured: () => false };
    if (path.endsWith('/circuitBreaker.js')) return { externalFeedsCircuitBreaker: { execute: async (run: any) => run() } };
    if (path.endsWith('/announcementDao.js')) return {
      getAnnouncementsForScrip: async (_code: string, _limit: number, strict: boolean) => {
        assert.equal(strict, true); if (fail) throw new Error('Stored filing history unavailable'); return rows;
      }, getRecentAnnouncements: async () => rows,
    };
    return {};
  }, { fetch: async () => Response.json(events) });
}
const filing = (id: string, time: string, subject = 'Financial Results for quarter ended June 30, 2026') => ({
  id, scrip_cd: '509930', bseTime: time, subject, pdfLink: `https://www.bseindia.com/${id}.pdf`,
});

test('a past NSE meeting naming results is not a declaration; numeric identity resolves to the company symbol', async () => {
  const api = service([], [{ date: '29-Jul-2026', purpose: 'Financial Results', bm_desc: 'To consider and approve the un-audited financial results' }]);
  const rows = await api.getStockResultsHistory('509930', '509930');
  assert.equal(rows.length, 1); assert.equal(rows[0].symbol, 'SUPREMEIND');
  assert.equal(rows[0].isOutcome, false); assert.equal(rows[0].status, 'Past Meeting');
  assert.equal(rows[0].declarationTime, undefined); assert.equal(rows[0].declaredAtFormatted, undefined);
  assert.equal(api.isPureResultOutcomeFiling('Board Meeting Intimation', 'To consider and approve financial results'), false);
});

test('first actual BSE result sets clock/PDF; fetched time, earlier notice, wrong stock and later corrections cannot replace it', async () => {
  const first = filing('first', '2026-07-29T11:30:45+05:30');
  const rows = await service([
    filing('correction', '2026-07-30T18:20:00+05:30'),
    filing('intimation', '2026-07-29T09:00:00+05:30', 'Board Meeting Intimation to consider and approve financial results'),
    { ...filing('wrong', '2026-07-29T08:00:00+05:30'), scrip_cd: '500049' },
    { id: 'ingested', scrip_cd: '509930', subject: 'Financial Results', fetched_at: Date.parse('2026-07-29T07:00:00+05:30') },
    { ...first, bseTimestamp: Date.parse('2026-07-29T07:00:00+05:30') },
  ]).getStockResultsHistory('509930');
  assert.equal(rows.length, 1); assert.equal(rows[0].id, 'first'); assert.equal(rows[0].declarationTime, '11:30:45');
  assert.equal(rows[0].pdfLink, first.pdfLink); assert.equal(rows[0].isOutcome, true);
  assert.equal(rows[0].submissionTimestamp, Date.parse(first.bseTime));
});

test('durable-store errors stay errors rather than becoming an empty history', async () => {
  await assert.rejects(service([], [], [], true).getStockResultsHistory('509930'), /Stored filing history unavailable/);
});

test('calendar history reads the public snapshot, preserving a non-watchlist past meeting without claiming a result', async () => {
  const row = { id: 'meeting', symbol: 'SUPREMEIND', scripCode: '509930', companyName: 'Supreme', purpose: 'Financial Results', meetingDate: '29 Jul 2026', meetingTimestamp: Date.parse('2026-07-29T00:00:00+05:30') };
  const rows = await service([], [], [row]).getStockResultsHistory('509930');
  assert.equal(rows.length, 1); assert.equal(rows[0].isOutcome, false);
});

test('read recovery runs for meeting-only history, and poll reads never restart exchange work', async () => {
  const api = load('server/services/resultHistoryRead.ts', () => ({}));
  let starts = 0, reads = 0;
  const job = { state: 'running', id: 'receipt', processed: 0 };
  let status: any = null;
  const deps = { read: async () => { reads++; return [{ status: 'Past Meeting', isOutcome: false }]; },
    start: async () => { starts++; status = job; }, status: () => status };
  const result = await api.readResultHistory('KPITTECH', '542651', '', true, deps);
  assert.equal(result.historySync.id, 'receipt'); assert.equal(reads, 2); assert.equal(starts, 1);
  await api.readResultHistory('KPITTECH', '542651', '', false, deps);
  assert.equal(starts, 1);
  status = { ...job, state: 'failed', error: 'BSE unavailable' };
  assert.equal((await api.readResultHistory('KPITTECH', '542651', '', true, deps)).historySync.state, 'failed');
  assert.equal(starts, 1, 'no automatic failed-source retry loop');
});

test('client follows running archive to completion and refreshes history without restarting the import', async () => {
  const api = load('src/utils/resultHistoryClient.ts', () => ({}));
  const signal = new AbortController().signal, calls: string[] = [], updates: any[] = [];
  const request = async (url: string) => {
    calls.push(url); return Response.json({ success: true, history: calls.length === 1 ? [] : [{ id: 'result' }],
      historySync: { state: calls.length === 1 ? 'running' : 'complete', processed: calls.length } });
  };
  await api.watchResultHistory({ symbol: 'BEL', scripCode: '500049' }, signal, (rows: any[], sync: any) => updates.push({ rows, sync }), true, request, async () => {});
  assert.match(calls[0], /autoSync=1/); assert.match(calls[1], /autoSync=0/);
  assert.equal(updates[1].rows[0].id, 'result');
  await assert.rejects(api.watchResultHistory({ symbol: 'BEL', scripCode: '500049' }, signal, () => {}, true,
    async () => Response.json({ error: 'Store unavailable' }, { status: 503 }), async () => {}), /Store unavailable/);
  await assert.rejects(api.waitForResultArchive({ state: 'running', id: 'x', scripCode: '500049', years: 1 }, signal, () => {},
    async () => Response.json({ job: { state: 'failed', error: 'BSE unavailable' } }), async () => {}), /BSE unavailable/);
});

test('old reporting period keeps its explicit year, independent of a later correction date', () => {
  const api = service([]);
  assert.equal(api.parseQuarterPeriod('Financial Results for quarter ended June 30, 2025', Date.parse('2026-07-29T00:00:00Z')).quarterKey, 'FY26-Q1');
});

test('cancelled history reads never update a closed or different company view', async () => {
  const api = load('src/utils/resultHistoryClient.ts', () => ({}));
  const controller = new AbortController(); let updates = 0;
  await api.watchResultHistory({ symbol: 'BEL', scripCode: '500049' }, controller.signal, () => updates++, true,
    async () => { controller.abort(); return Response.json({ success: true, history: [{ id: 'old' }] }); }, async () => {});
  assert.equal(updates, 0);
});

test('the actual ledger distinguishes missing clocks and read failures, and never renders a meeting as a declared result', async () => {
  const React = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { QuarterlyResultsLedger } = await import('../../src/components/QuarterlyResultsLedger.js');
  const row = { id: 'result', quarterKey: 'FY27-Q1', symbol: 'BEL', periodOrMeeting: 'Q1 FY27', subject: 'Financial Results', isOutcome: true, status: 'Declared', meetingDate: '27 Jul 2026' };
  const render = (results: any[], extra: any = {}) => renderToStaticMarkup(React.createElement(QuarterlyResultsLedger, { results, ...extra }));
  assert.match(render([row]), /Time unavailable/);
  assert.doesNotMatch(render([row]), /Declared at:/);
  assert.match(render([{ ...row, declarationTime: '11:57:57' }]), /11:57:57 IST/);
  const meeting = { ...row, isOutcome: false, status: 'Past Meeting', subject: 'To consider and approve financial results' };
  assert.doesNotMatch(render([meeting]), /To consider and approve/);
  assert.match(render([], { errorMessage: 'Stored history unavailable', onRefresh() {} }), /Retry history/);
});

test('an automatic import without a worker receipt reports busy/retry instead of silently returning confirmed empty', async () => {
  const api = load('server/services/resultHistoryRead.ts', () => ({}));
  const result = await api.readResultHistory('BEL', '500049', '', true, {
    read: async () => [], start: async () => false, status: () => null,
  });
  assert.match(result.historyWarning, /Workers may be busy/); assert.equal(result.historySync, null);
});

test('a lost or different instance receipt cannot silently finish a running history read', async () => {
  const api = load('src/utils/resultHistoryClient.ts', () => ({})); let calls = 0;
  await assert.rejects(api.watchResultHistory({ symbol: 'BEL', scripCode: '500049' }, new AbortController().signal, () => {}, true,
    async () => Response.json({ success: true, history: [], historySync: ++calls === 1 ? { id: 'original', state: 'running' } : null }), async () => {}), /Archive status unavailable/);
});
