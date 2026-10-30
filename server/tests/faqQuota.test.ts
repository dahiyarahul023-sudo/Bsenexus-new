import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { PGlite } from '@electric-sql/pglite';
import express from 'express';
import { createFaqRouter, faqIdentity } from '../api/faq.js';
import { operateFaqQuota } from '../database/faqQuotaDao.js';
import { createFaqQuestionLog } from '../services/faqQuestionLog.js';
import { findBankAnswer, faqBankSize } from '../services/faqBank.js';
import { getSupabase, resetSupabaseClient } from '../database/supabase.js';

// Optional immutable old-source fixture lets the same HTTP assertions reproduce
// the original outage/race behavior without real Gemini requests or disk writes.
function routerFor(deps: Parameters<typeof createFaqRouter>[0]) {
  if (!process.env.FAQ_ROUTER_SOURCE) return createFaqRouter(deps);
  const local: Record<string, any> = {};
  const module = { exports: {} as any };
  const mocks: Record<string, any> = {
    'node:crypto': crypto, express, 'express-rate-limit': rateLimit,
    '../services/faqBank.js': { findBankAnswer, faqBankSize },
    '../services/gemini.js': { askPublicFaq: deps!.ask },
    '../security/accountRateLimiter.js': { getSanitizedClientIp: (req: any) => req.ip },
    '../database/localStore.js': { readLocalJson: (name: string, fallback: any) => local[name] || fallback, writeLocalJson: (name: string, value: any) => { local[name] = value; } },
  };
  const js = ts.transpileModule(fs.readFileSync(process.env.FAQ_ROUTER_SOURCE, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  vm.runInNewContext(js, { module, exports: module.exports, require: (name: string) => { if (!(name in mocks)) throw new Error('Unexpected fixture import ' + name); return mocks[name]; }, console, process, setTimeout });
  return module.exports.faqRouter as express.Router;
}

async function serve(router: express.Router, run: (ask: (q?: string, xff?: string) => Promise<any>) => Promise<void>) {
  const app = express(); app.set('trust proxy', 1); app.use(express.json()); app.use('/faq', router);
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(r => server.once('listening', r));
  const ask = (q = 'xylophone quasar puzzle', xff = '1.2.3.4, 198.51.100.20') => new Promise<any>((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: (server.address() as any).port, path: '/faq/ask', method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': xff } }, res => {
      let body = ''; res.on('data', chunk => body += chunk); res.on('end', () => resolve({ status: res.statusCode, ...JSON.parse(body) }));
    }); req.on('error', reject); req.end(JSON.stringify({ question: q }));
  });
  try { await run(ask); } finally { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); }
}
test('five concurrent anonymous AI questions share a durable four-question limit across router instances and spoofed XFF', async () => {
  const db = new PGlite(); let calls = 0; const keys: string[] = [];
  await db.exec('create role anon; create role authenticated; create role service_role;');
  await db.exec(fs.readFileSync('supabase/migrations/20261030114813_durable_faq_quota.sql', 'utf8'));
  const quota: typeof operateFaqQuota = async (key, action, id) => {
    keys.push(key); return (await db.query<any>('select manage_faq_quota($1,$2,$3) r', [key, action, id || null])).rows[0].r;
  };
  const deps = { quota, ask: async () => { calls++; await new Promise(r => setTimeout(r, 10)); return 'Fixture answer'; }, log: () => {} };
  try {
    await serve(routerFor(deps), async first => serve(routerFor(deps), async second => {
      const results = await Promise.all([first(), second(), first(undefined, 'evil, 198.51.100.20'), second(), first()]);
      assert.equal(results.filter(r => r.status === 200).length, 4); assert.equal(results.filter(r => r.status === 429).length, 1); assert.equal(calls, 4);
      assert.equal(new Set(keys).size, 1); assert.match(keys[0], /^[a-f0-9]{64}$/);
      assert.equal((await second()).status, 429); // new router/process cannot reset the store
    }));
  } finally { await db.close(); }
});
test('store outage never calls Gemini; bank answers bypass unavailable storage', async () => {
  let calls = 0, reads = 0;
  await serve(routerFor({ quota: async () => { reads++; throw new Error('store down'); }, ask: async () => { calls++; return 'must not run'; }, log: () => {} }), async ask => {
    assert.equal((await ask()).status, 503); assert.equal(calls, 0);
    const bank = await ask('What is Bsenexus?'); assert.equal(bank.status, 200); assert.equal(bank.source, 'bank'); assert.equal(reads, 1);
  });
});
test('identity never uses XFF directly; verified UID and anonymous IP namespaces differ', () => {
  const req = { ip: '198.51.100.20', headers: { 'x-forwarded-for': 'evil' } } as any;
  const a = faqIdentity(req); req.headers['x-forwarded-for'] = 'other'; assert.equal(faqIdentity(req).key, a.key);
  req.user = { uid: req.ip }; assert.notEqual(faqIdentity(req).key, a.key); assert.equal(faqIdentity(req).kind, 'uid');
});
test('question logging caps memory and performs one asynchronous batch instead of per-request writes', async () => {
  const batches: any[] = []; const log = createFaqQuestionLog(async entries => { batches.push(entries); });
  for (let i = 0; i < 800; i++) log.log('q'.repeat(500), 'bank');
  assert.equal(log.size(), 500); assert.equal(batches.length, 0);
  await log.flush(); assert.equal(batches.length, 1); assert.equal(batches[0].length, 500); assert.equal(batches[0][0].q.length, 200);
});
test('default durable DAO fails closed without configuration', async () => {
  await assert.rejects(operateFaqQuota('a'.repeat(64), 'reserve', crypto.randomUUID()));
});
test('a malformed durable reservation receipt never authorizes a provider call', async t => {
  const oldUrl = process.env.SUPABASE_URL, oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = 'https://faq-fixture.invalid'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
  let calls = 0;
  t.mock.method(getSupabase(), 'rpc', () => ({ abortSignal: async () => ({ data: { allowed: true, used: 0, remaining: 4, dailyLimit: 4, reservationId: 'wrong-receipt' }, error: null }) }));
  try { await serve(createFaqRouter({ quota: operateFaqQuota, ask: async () => { calls++; return 'must not run'; }, log: () => {} }), async ask => {
    assert.equal((await ask()).status, 503); assert.equal(calls, 0);
  }); } finally {
    if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
    resetSupabaseClient();
  }
});
