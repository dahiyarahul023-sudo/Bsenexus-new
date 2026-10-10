import { createHash } from 'node:crypto';
import { withHttpDeadline } from '../utils/httpDeadline.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the actual BSE module with isolated storage/network and a virtual clock.
// No exchange requests, database writes or notifications leave this harness.
function harness(pages: Record<number, any[] | null>, processed = new Set<string>(), options: { backup?: any[] | null; yesterday?: any[] | null; sample?: boolean; market?: boolean; failureStatus?: number } = {}) {
  let now = options.sample ? 61_000 : 1000; // Keep the unrelated periodic backup sample outside its 60s window.
  const calls: { page: number; at: number }[] = [];
  const delays: number[] = [];
  const logs: string[] = [];
  class Clock extends Date { static now() { return now; } }
  const exports: Record<string, any> = {};
  const context = vm.createContext({
    exports, Date: Clock, URL, AbortController, AbortSignal, console,
    setTimeout(callback: () => void, ms: number) {
      const timer = { cancelled: false };
      // Request abort timers stay pending; successful mock responses clear them.
      if (ms <= 2500) {
        delays.push(ms);
        queueMicrotask(() => { if (!timer.cancelled) { now += ms; callback(); } });
      }
      return timer;
    },
    clearTimeout(timer: { cancelled: boolean }) { timer.cancelled = true; },
    fetch: async (url: string) => {
      if (new URL(url).hostname === 'www.nseindia.com') {
        return { ok: true, status: 200, headers: { getSetCookie: () => [] }, json: async () => [] };
      }
      const page = Number(new URL(url).searchParams.get('pageno'));
      calls.push({ page, at: now });
      const params = new URL(url).searchParams;
      const rows = params.get('strSearch') === 'P' && 'backup' in options ? options.backup
        : params.get('strPrevDate') !== '19700101' && 'yesterday' in options ? options.yesterday : pages[page];
      return { ok: rows !== null, status: rows === null ? (options.failureStatus || 503) : 200,
        text: async () => JSON.stringify({ Table: rows ?? [] }) };
    },
    require(path: string) {
      if (path === 'node:crypto') return { createHash };
      if (path.endsWith('/httpDeadline.js')) return { withHttpDeadline };
      if (path.endsWith('/logDao.js')) return { addLog: async (_level: string, _area: string, message: string) => { logs.push(message); } };
      if (path.endsWith('/announcementDao.js')) return { isAnnouncementProcessed: async (id: string) => processed.has(id) };
      if (path.endsWith('/helpers.js')) return { isMarketHoursIST: () => options.market || false };
      if (path.endsWith('/circuitBreaker.js')) return { bseCircuitBreaker: { execute: async (action: () => Promise<any>) => action() } };
      return {};
    },
  });
  const source = readFileSync(new URL('../services/bse.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  vm.runInContext(compiled, context, { filename: 'bse.cjs' });
  return { poll: () => exports.fetchBSEAnnouncements(), calls, delays, logs, pages, processed, state: () => exports.getBseFeedStaleness() };
}

function rows(page: number, count = 50) {
  return Array.from({ length: count }, (_, i) => ({ NEWSID: `page-${page}-${i}` }));
}

test('boot walk caps at three pages and spaces requests by 2.5s; normal walk has the same pacing', async () => {
  const h = harness(Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i + 1, rows(i + 1)])));
  const boot = await h.poll();
  assert.equal(boot.length, 150);
  assert.deepEqual(h.calls, [{ page: 1, at: 1000 }, { page: 2, at: 3500 }, { page: 3, at: 6000 }]);
  assert.deepEqual(h.delays, [2500, 2500]);
  assert.match(h.logs[0], /Boot backfill walked 3 BSE pages/);
  h.calls.length = 0; h.delays.length = 0; h.logs.length = 0;
  const normal = await h.poll();
  assert.equal(normal.length, 150);
  assert.deepEqual(h.calls, [{ page: 1, at: 6000 }, { page: 2, at: 8500 }, { page: 3, at: 11000 }]);
  assert.deepEqual(h.delays, [2500, 2500]);
  assert.equal(h.logs.length, 0);
});

test('processed or missing ID on page one stops without waiting or requesting page two', async () => {
  for (const missingId of [false, true]) {
    const first = rows(1);
    if (missingId) first[0] = {} as any;
    const h = harness({ 1: first, 2: rows(2) }, new Set(['page-1-0']));
    const result = await h.poll();
    assert.equal(result.length, missingId ? 49 : 50);
    assert.deepEqual(h.calls, [{ page: 1, at: 1000 }]);
    assert.deepEqual(h.delays, []);
  }
});

test('processed, short or empty page two stops before page three and preserves collected rows', async () => {
  for (const count of [50, 10, 0]) {
    const h = harness({ 1: rows(1), 2: rows(2, count), 3: rows(3) }, new Set(['page-2-0']));
    const result = await h.poll();
    assert.equal(result.length, 50 + count);
    assert.deepEqual(h.calls, [{ page: 1, at: 1000 }, { page: 2, at: 3500 }]);
    assert.deepEqual(h.delays, [2500]);
  }
});

test('failed deeper page retains page one and the existing retry delay', async () => {
  const h = harness({ 1: rows(1), 2: null, 3: rows(3) });
  const result = await h.poll();
  assert.equal(result.length, 50);
  assert.deepEqual(h.calls, [{ page: 1, at: 1000 }, { page: 2, at: 3500 }, { page: 2, at: 3900 }]);
  assert.deepEqual(h.delays, [2500, 400]);
});


test('empty primary recovers today through alternate search and returns those filings', async () => {
  const h = harness({ 1: [] }, new Set(), { backup: [{ NEWSID: 'new-today' }], yesterday: [] });
  assert.ok((await h.poll()).some((row: any) => row.NEWSID === 'new-today'));
});

test('periodic alternate source rows join ingestion instead of remaining diagnostic-only', async () => {
  const first = rows(1);
  const h = harness({ 1: first }, new Set(['page-1-0']), { backup: [{ NEWSID: 'newer-backup' }, { NEWSID: 'page-1-0' }], sample: true });
  const result = await h.poll();
  assert.ok(result.some((row: any) => row.NEWSID === 'newer-backup'));
  assert.equal(result.filter((row: any) => row.NEWSID === 'page-1-0').length, 1);
  assert.equal(result.find((row: any) => row.NEWSID === 'newer-backup')._source, 'PARALLEL_BACKUP_SEARCH_P');
});

test('yesterday-only fallback cannot advance today freshness or clear its failed source', async () => {
  const h = harness({ 1: null }, new Set(), { backup: null, yesterday: rows(9) });
  assert.equal((await h.poll()).length, 50);
  assert.equal(h.state().lastSuccessfulFetchMs, 0);
});


test('yesterday recovery keeps a today-source block and never certifies freshness', async () => {
  const h = harness({ 1: null }, new Set(), { backup: null, yesterday: rows(9), failureStatus: 403 });
  assert.equal((await h.poll()).length, 50);
  assert.equal(h.state().blocked, true);
  assert.equal(h.state().lastSuccessfulFetchMs, 0);
});

test('failed optional backup preserves the current primary feed', async () => {
  const first = rows(1);
  const h = harness({ 1: first }, new Set(['page-1-0']), { backup: null, sample: true });
  assert.equal((await h.poll()).length, 50);
});

test('empty market-hours responses do not refresh a source marked delayed', async () => {
  const h = harness({ 1: [] }, new Set(), { backup: [], yesterday: [], market: true });
  assert.equal((await h.poll()).length, 0);
  assert.equal(h.state().blocked, true);
  assert.equal(h.state().lastSuccessfulFetchMs, 0);
});

test('a response whose body hangs stays under the request abort deadline', async () => {
  const exports: any = {};
  const source = readFileSync(new URL('../services/bse.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  let aborted = false;
  vm.runInNewContext(code, { exports, Date, URL, AbortController, AbortSignal, console, setTimeout, clearTimeout,
    fetch: async (_url: string, options: { signal: AbortSignal }) => ({ ok: true, text: () => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => { aborted = true; reject(Object.assign(new Error('aborted body'), { name: 'AbortError' })); }, { once: true });
    }) }),
    require(path: string) {
      if (path === 'node:crypto') return { createHash };
      if (path.endsWith('/httpDeadline.js')) return { withHttpDeadline };
      if (path.endsWith('/logDao.js')) return { addLog: async () => {} };
      if (path.endsWith('/circuitBreaker.js')) return { bseCircuitBreaker: { execute: async (action: () => Promise<any>) => action() } };
      return {};
    },
  });
  let guard: ReturnType<typeof setTimeout>;
  const result = await Promise.race([exports.fetchSingleBsePage(1, '', 'AnnSubCategoryGetData', 20, '20261009', 0),
    new Promise(resolve => { guard = setTimeout(() => resolve('body deadline missed'), 250); })]);
  clearTimeout(guard!);
  assert.equal(result, null);
  assert.equal(aborted, true);
});
