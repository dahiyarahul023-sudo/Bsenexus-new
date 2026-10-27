import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

async function withWatchlistStore(t: any, initial: any, run: (w: any, state: any) => Promise<void>, collision = false) {
  const names = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'AI_CONNECTIONS_ENABLED'];
  const saved = names.map(n => process.env[n]);
  process.env.SUPABASE_URL = 'https://synthetic-fixture.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-test-key';
  process.env.AI_CONNECTIONS_ENABLED = 'true';
  const storage = await import('../database/supabase.js'); storage.resetSupabaseClient();
  const w = await import('../database/watchlistDao.js');
  const state = { row: initial, inserts: 0, updates: 0, reads: 0 };
  t.mock.method(storage.getSupabase(), 'from', () => {
    let patch: any, expected: number | undefined, insert = false;
    const query: any = {
      select() { return query; },
      eq(key: string, value: any) { if (key === 'revision') expected = value; return query; },
      insert(value: any) { insert = true; patch = JSON.parse(JSON.stringify(value)); return query; },
      update(value: any) { patch = JSON.parse(JSON.stringify(value)); return query; },
      upsert() { throw Error('Blind upsert is forbidden'); },
      async maybeSingle() { state.reads++; return { data: structuredClone(state.row), error: null }; },
      then(resolve: any, reject: any) {
        let result: any;
        if (insert) {
          state.inserts++;
          if (collision && !state.row) state.row = { uid: patch.uid, revision: 7, lists: [{ id: 'concurrent', name: 'AI saved', is_active: 1, items: [] }] };
          if (state.row) result = { data: null, error: { code: '23505' } };
          else { state.row = { ...structuredClone(patch), revision: 0 }; result = { data: [{ revision: 0 }], error: null }; }
        } else {
          state.updates++;
          if (expected !== state.row?.revision) result = { data: [], error: null };
          else { state.row = { ...state.row, ...structuredClone(patch), revision: expected! + 1 }; result = { data: [{ revision: state.row.revision }], error: null }; }
        }
        return Promise.resolve(result).then(resolve, reject);
      },
    };
    return query;
  });
  try { await run(w, state); }
  finally { names.forEach((n, i) => saved[i] === undefined ? delete process.env[n] : process.env[n] = saved[i]); storage.resetSupabaseClient(); }
}

test('starter lists are durable before display and noCreate scans never create them', async t => {
  const uid = 'migration-default-owner';
  await withWatchlistStore(t, null, async (w, state) => {
    assert.deepEqual(await w.getAllWatchlists(uid, { noCreate: true }), []);
    assert.equal(state.inserts, 0);
    const lists = await w.getAllWatchlists(uid);
    assert.equal(state.inserts, 1);
    assert.deepEqual(state.row.lists, lists);
    w.invalidateUserWatchlistCache(uid);
    assert.deepEqual(await w.getAllWatchlists(uid, { noCreate: true }), lists);
  });
});

test('starter initialization loses an insert race without overwriting a concurrent saved list', async t => {
  await withWatchlistStore(t, null, async (w, state) => {
    const lists = await w.getAllWatchlists('migration-default-race');
    assert.equal(state.inserts, 1);
    assert.equal(state.updates, 0);
    assert.equal(lists[0].id, 'concurrent');
    assert.equal(state.row.revision, 7);
  }, true);
});

test('reset defaults reads the current revision before its guarded update', async t => {
  await withWatchlistStore(t, { uid: 'migration-reset-owner', revision: 5, lists: [] }, async (w, state) => {
    const lists = await w.resetUserWatchlistsToDefault('migration-reset-owner');
    assert.equal(state.reads, 1);
    assert.equal(state.updates, 1);
    assert.equal(state.row.revision, 6);
    assert.deepEqual(state.row.lists, lists);
  });
});

test('missing payment reconciliation RPC fails closed without an unlocked table repair', async t => {
  const before = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
  process.env.SUPABASE_URL = 'https://synthetic-fixture.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-test-key';
  const storage = await import('../database/supabase.js');
  storage.resetSupabaseClient();
  const dao = await import('../database/paymentEntitlementsDao.js');
  let reads = 0;
  t.mock.method(storage.getSupabase(), 'rpc', async () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } }) as any);
  t.mock.method(storage.getSupabase(), 'from', () => { reads++; throw Error('Table repair must not run without the transaction lock'); });
  try {
    await assert.rejects(dao.reconcilePaymentEntitlement('owner'), { code: 'PAYMENT_STORE_UNAVAILABLE' });
    assert.equal(reads, 0);
  } finally {
    if (before.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = before.url;
    if (before.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = before.key;
    storage.resetSupabaseClient();
  }
});

test('an unverified Telegram recipient cannot stop later verified news recipients', async () => {
  // Execute the actual worker with provider/storage boundaries stubbed, never
  // sending a real Telegram message or fetching an external feed.
  const source = fs.readFileSync('server/services/stockNewsService.ts', 'utf8');
  const parsed = ts.createSourceFile('stockNewsService.ts', source, ts.ScriptTarget.Latest, true);
  const fn = parsed.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'processAutomatedNewsAlerts')!;
  const compiled = ts.transpileModule(fn.getText(parsed), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const news = { id: 'one-news', publishedAt: new Date().toISOString(), source: 'Fixture', category: 'corporate' };
  const verified: string[] = [], sent: string[] = [], marked: string[] = [];
  const users = ['legacy', 'verified'].map(uid => ({ uid, tier: 'pro', proExpiresAt: Date.now() + 60_000, telegramChatId: uid, notificationPreferences: { telegramNewsAlerts: true } }));
  const boundaries = {
    getSettings: async () => ({ botToken: 'synthetic-test-token' }),
    getAllUserProfiles: async () => users,
    fetchAllMultiSourceNewsFeeds: async () => [news],
    giftsEnabled: () => false,
    getAccessProfile: async () => null,
    getWatchlistNews: async () => ({ items: [news] }),
    isNewsAlertSentToTarget: () => false,
    requireVerifiedTelegramTarget: async (uid: string) => { verified.push(uid); if (uid === 'legacy') throw Object.assign(Error('Denied'), { status: 403 }); },
    sendNewsToTelegram: async (_news: any, chat: string) => { sent.push(chat); return { success: true }; },
    markNewsAlertSentToTarget: async (target: string) => { marked.push(target); },
    addLog: async () => {},
    console: { error() {}, warn() {}, debug() {} },
    process: { env: {} },
  };
  const run = new Function(...Object.keys(boundaries), `const exports={}; let isNewsWorkerRunning=false; ${compiled}; return processAutomatedNewsAlerts;`)(...Object.values(boundaries));
  assert.deepEqual(await run(), { checked: 1, dispatched: 1 });
  assert.deepEqual(verified, ['legacy', 'verified']);
  assert.deepEqual(sent, ['verified']);
  assert.deepEqual(marked, ['user_verified_verified']);
});
