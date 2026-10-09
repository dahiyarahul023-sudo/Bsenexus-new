import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness(hanging?: string) {
  let now = 1_000_000;
  const timers = new Map<object, { at: number; callback: () => void }>();
  const logs: string[] = [];
  const calls: string[] = [];
  let release!: (value: any) => void;
  const pending = new Promise(resolve => { release = resolve; });
  let held = false;
  const rows = [{ NEWSID: 'filing-1', SLONGNAME: 'Test', NEWSSUB: 'Results', DT_TM: 'today' }];
  const invoke = async (name: string, value: any) => {
    calls.push(name);
    if (hanging === name && !held) { held = true; return pending; }
    return value;
  };
  class Clock extends Date { static now() { return now; } }
  const globals = {
    Date: Clock, console: { log() {}, warn() {}, error() {}, debug() {} },
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
    '../utils/pollCycle.js': cycle,
    '../database/logDao.js': { addLog: async (_level: string, _module: string, message: string) => { logs.push(message); } },
    '../database/settingsDao.js': { getSettings: () => invoke('settings', settings) },
    './bse.js': { fetchBSEAnnouncements: () => invoke('fetch', rows) },
    '../database/announcementDao.js': {
      initAnnouncementCache: () => invoke('init', undefined),
      isAnnouncementProcessed: async () => false,
      isAnnouncementSent: () => invoke('sent', false),
      saveAnnouncement: () => invoke('save', undefined),
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
    poll: () => monitor.processAnnouncements(), failures: () => monitor.getConsecutiveFailures(), calls, logs, release, rows, settings, settle,
    async advance(ms: number) {
      now += ms;
      for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.callback(); }
      await settle();
    },
  };
}

for (const stage of ['init', 'fetch', 'settings', 'sent', 'save', 'inbox']) {
  test(`a hung ${stage} releases the monitor; late completion cannot resume it`, async () => {
    const h = harness(stage);
    let done = false;
    const first = h.poll().then(() => { done = true; });
    await h.settle();
    assert.ok(h.calls.includes(stage));
    await h.poll(); // Admin/manual refresh cannot overlap the active cycle.
    assert.equal(h.calls.filter(x => x === stage).length, 1);
    assert.equal(done, false);
    await h.advance(stage === 'fetch' ? 60_000 : 15_000);
    await first;
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
  assert.ok(h.calls.indexOf('fetch') < h.calls.indexOf('save'));
  assert.ok(h.calls.indexOf('save') < h.calls.indexOf('inbox'));
  assert.ok(h.logs.some(x => x.includes('outcome=success')));
});

test('cycle budget expires between steps and clears heartbeat on finish', async () => {
  let now = 100;
  let cleared = false;
  const reports: string[] = [];
  const exports: any = {};
  class Clock extends Date { static now() { return now; } }
  const source = readFileSync(new URL('../utils/pollCycle.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { exports, Date: Clock, setTimeout, clearTimeout, setInterval: () => ({}), clearInterval: () => { cleared = true; } });
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
