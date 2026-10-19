import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const sql = fs.readFileSync('supabase/migrations/20261019065115_telegram_result_delivery.sql', 'utf8');
const token = (n: number) => '00000000-0000-0000-0000-' + String(n).padStart(12,'0');
const claim = async (key: string, kind='summary', source='a', n=1) => (await db.query<any>('select public.claim_telegram_result($1,$2,$3,$4::uuid) as result', [key,kind,source,token(n)])).rows[0].result;
const finish = async (key: string, n: number, status: string, value={}) => (await db.query<any>('select public.finish_telegram_result($1,$2::uuid,$3,$4::jsonb) as result', [key,token(n),status,JSON.stringify(value)])).rows[0].result;
before(async () => {
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls; create table public.settings(key text primary key,value jsonb); insert into settings values ('global','{\"chatId\":\"test-only-chat\"}');");
  await db.exec(sql);
});
after(() => db.close());
test('concurrent claims admit one worker, completed summaries remain reusable and stale tokens cannot finish', async () => {
  const key='results:532477:2026-09-30:summary:english';
  const claims = await Promise.all(Array.from({length:8},(_,i)=>claim(key,'summary','a',i+1)));
  assert.equal(claims.filter(x=>x.acquired).length,1);
  assert.equal(await finish(key,99,'ready',{text:'wrong worker'}),false);
  assert.equal(await finish(key,1,'ready',{text:'verified result'}),true);
  const next=await claim(key,'summary','new-bse-copy',20);
  assert.equal(next.acquired,false); assert.equal(next.row.value.text,'verified result');
});
test('same failed source does not retry but a newer attachment may recover once', async () => {
  const key='results:500001:2026-09-30:summary:english';
  assert.equal((await claim(key)).acquired,true); await finish(key,1,'failed');
  assert.equal((await claim(key)).acquired,false);
  assert.equal((await claim(key,'summary','b',2)).acquired,true); await finish(key,2,'failed');
  assert.equal((await claim(key,'summary','c',3)).acquired,false,'provider retry budget is bounded');
});
test('an expired generation can recover, but delivery reservations never expire into a duplicate send', async () => {
  for(const kind of ['summary','delivery']) {
    const key='results:500002:2026-09-30:'+kind+':test'; await claim(key,kind);
    await db.query("update telegram_result_state set lease_until=now()-interval '1 second' where state_key=$1",[key]);
    assert.equal((await claim(key,kind,'b',2)).acquired,kind==='summary');
  }
});
test('incident cutover suppresses the already-observed admin result without claiming new delivery', async () => {
  const rows=(await db.query<any>("select * from telegram_result_state where source_news_id='incident-20261019-unionbank'")).rows;
  assert.equal(rows.length,1); assert.equal(rows[0].status,'suppressed');
  assert.ok(!rows[0].state_key.includes('test-only-chat'));
});
test('state and RPCs are private to server service role; invalid completions cannot change kind', async () => {
  assert.equal((await db.query<any>("select relrowsecurity from pg_class where relname='telegram_result_state'")).rows[0].relrowsecurity,true);
  for(const role of ['anon','authenticated']) {
    await db.exec('set role '+role);
    try { await assert.rejects(db.query('select * from telegram_result_state'),/permission denied/); await assert.rejects(claim('unauthorized-key'),/permission denied/); }
    finally { await db.exec('reset role'); }
  }
  const key='results:500003:2026-09-30:delivery:test'; await claim(key,'delivery');
  assert.equal(await finish(key,1,'ready',{text:'not permitted'}),false);
  assert.equal(await finish(key,1,'uncertain'),true);
  assert.equal((await claim(key,'delivery','another-source',2)).acquired,false);
});
test('migration replay preserves ready/suppressed receipts and protects delivery timing rows', async () => {
  await db.exec(sql);
  assert.equal((await db.query<any>("select count(*)::int n from telegram_result_state where source_news_id='incident-20261019-unionbank'")).rows[0].n,1);
  assert.equal((await db.query<any>("select relrowsecurity from pg_class where relname='filing_delivery_timings'")).rows[0].relrowsecurity,true);
  await db.exec('set role anon');
  try { await assert.rejects(db.query('select * from filing_delivery_timings'),/permission denied/); }
  finally { await db.exec('reset role'); }
});
