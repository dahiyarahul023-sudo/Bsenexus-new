import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

export const sql = fs.readFileSync('supabase/migrations/20261030114813_durable_faq_quota.sql', 'utf8');
const db = new PGlite();
const key = 'a'.repeat(64), other = 'b'.repeat(64);
before(async () => { await db.exec('create role anon; create role authenticated; create role service_role bypassrls;'); await db.exec(sql); await db.exec(sql); });
after(() => db.close());
const call = async (action: string, receipt = randomUUID(), identity = key) => (await db.query<any>('select manage_faq_quota($1,$2,$3) result', [identity, action, receipt])).rows[0].result;

test('atomic reservations admit exactly four, retry once, refuse fifth, and refund only once', async () => {
  const ids = Array.from({ length: 8 }, () => randomUUID());
  const results = await Promise.all(ids.map(id => call('reserve', id)));
  assert.equal(results.filter(r => r.allowed).length, 4);
  assert.equal((await call('status')).remaining, 0);
  assert.equal((await call('reserve', ids[0])).allowed, true);
  assert.equal((await call('status')).used, 4);
  await call('refund', ids[0]); await call('refund', ids[0]);
  assert.equal((await call('status')).used, 3);
  assert.equal((await call('reserve', ids[0])).allowed, false);
  await assert.rejects(call('reserve', ids[1], other), /owner mismatch/);
});
test('late refund is charged to original IST date; current-day allowance is unchanged', async () => {
  const receipt = randomUUID();
  await db.query("insert into faq_quota_days values($1,(now() at time zone 'Asia/Kolkata')::date - 1,1)", [other]);
  await db.query("insert into faq_quota_reservations values($1,$2,(now() at time zone 'Asia/Kolkata')::date - 1,false)", [receipt, other]);
  await call('reserve', randomUUID(), other);
  await call('refund', receipt, other);
  assert.equal((await call('status', randomUUID(), other)).used, 1);
  assert.equal((await db.query<any>('select used from faq_quota_days where identity_hash=$1 order by usage_day limit 1', [other])).rows[0].used, 0);
});
test('browser roles have no table/function privileges; invoker role works; status creates no rows', async () => {
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`);
    try {
      await assert.rejects(call('reserve'), /permission denied/);
      await assert.rejects(db.query('select * from faq_quota_days'), /permission denied/);
      await assert.rejects(db.query('select prune_faq_quota()'), /permission denied/);
    } finally { await db.exec('reset role'); }
  }
  await db.exec('set role service_role');
  try { assert.equal((await call('status', randomUUID(), 'c'.repeat(64))).remaining, 4); } finally { await db.exec('reset role'); }
  assert.equal((await db.query<any>("select count(*)::int n from faq_quota_days where identity_hash=$1", ['c'.repeat(64)])).rows[0].n, 0);
  const f = (await db.query<any>("select prosecdef,proconfig from pg_proc where proname='manage_faq_quota'")).rows[0];
  assert.equal(f.prosecdef, false); assert.ok(f.proconfig.includes('search_path=""'));
});
test('retention is bounded and cannot delete current-day counters/receipts', async () => {
  await db.query("insert into faq_quota_days values($1,(now() at time zone 'Asia/Kolkata')::date - 3,1),($2,(now() at time zone 'Asia/Kolkata')::date - 4,1)", ['d'.repeat(64), 'e'.repeat(64)]);
  assert.equal((await db.query<any>('select prune_faq_quota(1) n')).rows[0].n, 1);
  assert.ok((await call('status')).used > 0);
  await assert.rejects(db.query('select prune_faq_quota(1001)'), /Invalid/);
});
