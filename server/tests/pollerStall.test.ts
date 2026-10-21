import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness(hanging?: string, failing?: string) {
  let now = 1_000_000;
  const timers = new Map<object, { at: number; callback: () => void }>();
  const logs: string[] = [];
  const consoleEntries: { level: string; message: string }[] = [];
  const logLevels: { level: string; message: string }[] = [];
  const calls: string[] = [];
  let indexBatchBalance = 0;
  let release!: (value: any) => void;
  const pending = new Promise(resolve => { release = resolve; });
  let held = false;
  const processed = new Set<string>();
  const rows = [{ NEWSID: 'filing-1', SLONGNAME: 'Test', NEWSSUB: 'Results', DT_TM: 'today' }];
  const invoke = async (name: string, value: any) => {
    calls.push(name);
    if (failing === name) throw new Error('simulated provider failure');
    if (hanging === name && !held) { held = true; return pending; }
    return value;
  };
  class Clock extends Date { static now() { return now; } }
  const globals = {
    Date: Clock, AbortController, console: Object.fromEntries(['log', 'warn', 'error', 'debug'].map(level => [level, (message: string) => consoleEntries.push({ level, message })])),
    setTimeout(callback: () => void, ms: number) {
      const id = {}; timers.set(id, { at: now + ms, callback }); return id;
    },
    clearTimeout(id: object) { timers.delete(id); },
    setInterval: () => ({}), clearInterval() {},
  };
  function load(file: string, dependencies: any = {}) {
    const exports: any = {};
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(code, { ...globals, exports, require(path: string) { return dependencies[path] || {}; } });
    return exports;
  }
  const cycle = load('../utils/pollCycle.ts');
  const settings = { isRunning: true, telegramAlertsEnabled: false };
  const monitor = load('../services/monitor.ts', {
    './indexNow': { indexNowQueue: { beginBatch() { indexBatchBalance++; return () => { indexBatchBalance--; }; } } },
    '../utils/pollCycle.js': cycle,
    '../database/logDao.js': { addLog: async (_level: string, _module: string, message: string) => { logs.push(message); logLevels.push({ level: _level, message }); } },
    '../database/settingsDao.js': { getSettings: () => invoke('settings', settings) },
    './bse.js': { fetchBSEAnnouncements: () => invoke('fetch', rows) },
    '../database/announcementDao.js': {
      initAnnouncementCache: () => invoke('init', undefined),
      flushSupabaseWriteQueue: () => invoke('drain', undefined),
      flushLocalDiskSave() {},
      isAnnouncementProcessed: async (id: string) => processed.has(id),
      isAnnouncementSent: () => invoke('sent', false),
      saveAnnouncement: async (data: { newsId: string }) => { await invoke('save', undefined); processed.add(data.newsId); },
    },
    '../database/watchlistDao.js': { getActiveWatchlistSymbols: async () => ['Test'], getActiveWatchlistSymbolMap: async () => ({}) },
    '../database/usersDao.js': { getAllUserProfiles: async () => [{ uid: 'owner', muteInAppNotifications: false }] },
    '../database/notificationDao.js': { initNotificationsFromCloud: async () => {}, addNotification: () => invoke('inbox', undefined) },
    '../database/alertRulesDao.js': { initAlertRulesFromCloud: async () => [], evaluateAlertRulesForUser: () => ({ shouldSendInApp: true, shouldSendTelegram: false }) },
    '../utils/helpers.js': { escapeHTML: (s: string) => s, determinePriority: () => ({ level: 'HIGH', category: 'RESULTS' }), isSymbolMatch: () => true, parseBseDate: () => now, isMarketHoursIST: () => true },
    './timelineClassifier.js': { classifyMaterialEvent: () => null },
    '../utils/alertDecision.js': { doesAnnouncementMatchUserPrefs: () => true, personalAlertChannels: () => ({ inApp: true, telegram: false }) },
    './oneSignal.js': { isOneSignalConfigured: () => false },
  });
  const settle = async () => { for (let i = 0; i < 100; i++) await Promise.resolve(); };
  return {
    poll: () => monitor.processAnnouncements(), failures: () => monitor.getConsecutiveFailures(), indexBatches: () => indexBatchBalance, calls, logs, consoleEntries, logLevels, release, rows, settings, settle,
    async advance(ms: number) {
      now += ms;
      for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.callback(); }
      await settle();
    },
  };
}

for (const stage of ['init', 'fetch', 'settings', 'sent', 'save', 'inbox', 'drain']) {
  test(`a hung ${stage} releases the monitor; late completion cannot resume it`, async () => {
    const h = harness(stage);
    let done = false;
    const first = h.poll().then(() => { done = true; });
    await h.settle();
    assert.ok(h.calls.includes(stage));
    await h.poll(); // Admin/manual refresh cannot overlap the active cycle.
    assert.equal(h.indexBatches(), 1, 'overlapping poll cannot start a second IndexNow batch');
    assert.equal(h.calls.filter(x => x === stage).length, 1);
    assert.equal(done, false);
    await h.advance(stage === 'fetch' ? 60_000 : 30_000);
    await first;
    assert.equal(h.indexBatches(), 0, 'timeouts release the IndexNow batch');
    assert.equal(done, true);
    assert.equal(h.failures(), stage === 'fetch' ? 1 : 0, 'only exchange timeouts increase source backoff');
    assert.ok(h.logs.some(x => x.includes('outcome=timeout')));
    const before = [...h.calls];
    h.release(stage === 'settings' ? h.settings : stage === 'fetch' ? h.rows : undefined);
    await h.settle();
    assert.deepEqual(h.calls, before, 'abandoned monitor must not continue to later writes/alerts');
    await h.poll();
    assert.equal(h.calls.filter(x => x === 'fetch').length, stage === 'init' ? 1 : 2);
    assert.ok(h.logs.some(x => x.includes('outcome=success')));
  });
}

test('healthy monitor saves the filing and recipient inbox in order', async () => {
  const h = harness();
  await h.poll();
  assert.equal(h.indexBatches(), 0);
  assert.ok(h.calls.indexOf('fetch') < h.calls.indexOf('save'));
  assert.ok(h.calls.indexOf('save') < h.calls.indexOf('inbox'));
  assert.ok(h.logs.some(x => x.includes('outcome=success')));
  const summary = h.consoleEntries.find(x => x.message.startsWith('[POLLER_CYCLE] {'))!;
  assert.equal(summary.level, 'log');
  assert.doesNotMatch(summary.message, /error/i);
  assert.equal(h.logLevels.find(x => x.message.startsWith('{'))!.level, 'INFO');
});

test('all monitor attempts emit one numbered IST summary; overlapping attempts skip without a queue', async () => {
  const h = harness('fetch');
  const first = h.poll();
  await h.settle();
  const skipped = await h.poll();
  assert.equal(skipped.mode, 'busy');
  assert.equal(h.calls.filter(x => x === 'fetch').length, 1);
  await h.advance(60_000);
  await first;
  h.release(h.rows);
  await h.settle();
  assert.equal(h.calls.filter(x => x === 'fetch').length, 1, 'skipped attempt must never be queued');
  await h.poll();
  const summaries = h.logs.filter(line => line.startsWith('{')).map(line => JSON.parse(line));
  assert.equal(summaries.length, 3);
  assert.deepEqual(summaries.map(s => s.cycleNumber), [2, 1, 3]);
  assert.ok(summaries.every(s => s.timestampIST.endsWith('+05:30') && s.durationMs >= 0));
  assert.equal(summaries[0].reason, 'skipped: previous cycle running');
  assert.equal(summaries[0].skipped, true);
  assert.equal('error' in summaries[0], false);
  assert.equal(summaries[1].error, true);
  assert.equal(summaries[1].mode, 'timeout');
  assert.ok(h.consoleEntries.some(x => x.level === 'warn' && x.message.includes('\"mode\":\"timeout\"')));
  assert.ok(h.logLevels.some(x => x.level === 'WARNING' && x.message.includes('\"mode\":\"timeout\"')));
  assert.equal(summaries[2].mode, 'success');
  assert.equal(summaries[2].newFilingsCount, 1);
});

test('cycle budget expires between steps and clears heartbeat on finish', async () => {
  let now = 100;
  let cleared = false;
  const reports: string[] = [];
  const exports: any = {};
  class Clock extends Date { static now() { return now; } }
  const source = readFileSync(new URL('../utils/pollCycle.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { exports, Date: Clock, AbortController, setTimeout, clearTimeout, setInterval: () => ({}), clearInterval: () => { cleared = true; } });
  const cycle = new exports.PollCycle((event: string) => reports.push(event), 120);
  await cycle.step('first', async () => { now += 121; });
  let invoked = false;
  await assert.rejects(cycle.step('second', async () => { invoked = true; }), /timed out at second/);
  assert.equal(invoked, false);
  cycle.finish('timeout');
  assert.equal(cleared, true);
  assert.ok(reports.some(x => x.includes('stage=second')));
});

test('poller evidence survives 500 unrelated log entries, restart, and clears together', async () => {
  const disk = new Map<string, any[]>();
  const exports: any = {};
  const compile = () => {
    const source = readFileSync(new URL('../database/logDao.ts', import.meta.url), 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    vm.runInNewContext(code, { exports, console, setTimeout: () => ({}), clearTimeout() {}, require(path: string) {
      if (path.endsWith('localStore.js')) return { readLocalJson: (name: string, fallback: any[]) => structuredClone(disk.get(name) || fallback), writeLocalJson: (name: string, data: any[]) => disk.set(name, structuredClone(data)) };
      return { isSupabaseConfigured: () => false };
    } });
  };
  compile();
  await exports.addLog('INFO', 'POLLER_CYCLE', 'stage=fetch Bearer private-token');
  await exports.addLogsBatch(Array.from({ length: 700 }, () => ({ level: 'WARNING', module: 'GEMINI', message: 'noise' })));
  assert.equal((await exports.getLogs(2500)).length, 501);
  assert.ok((await exports.getLogs(2500)).some((x: any) => x.module === 'POLLER_CYCLE' && !x.message.includes('private-token')));
  exports.flushLogsDiskSave();
  compile(); // Fresh module uses saved history.
  assert.ok((await exports.getLogs(2500)).some((x: any) => x.module === 'POLLER_CYCLE'));
  await exports.clearLogs();
  assert.deepEqual(Array.from(await exports.getLogs(2500)), []);
});

test('replaying the same NEWSID does not save or alert again and reports zero new', async () => {
  const h = harness();
  const first = await h.poll();
  assert.equal(first.new, 1);
  const saved = h.calls.filter(x => x === 'save').length;
  const inbox = h.calls.filter(x => x === 'inbox').length;
  const second = await h.poll();
  assert.equal(second.fetched, 1);
  assert.equal(second.new, 0);
  assert.equal(h.calls.filter(x => x === 'save').length, saved);
  assert.equal(h.calls.filter(x => x === 'inbox').length, inbox);
});


test('actual poll failures retain ERROR severity and a failed summary', async () => {
  const h = harness(undefined, 'fetch');
  const result = await h.poll();
  assert.equal(result.mode, 'error');
  const summary = h.consoleEntries.find(x => x.message.startsWith('[POLLER_CYCLE] {'))!;
  assert.equal(summary.level, 'error');
  assert.equal(JSON.parse(summary.message.slice('[POLLER_CYCLE] '.length)).error, true);
  assert.equal(h.logLevels.find(x => x.message.startsWith('{'))!.level, 'ERROR');
});
