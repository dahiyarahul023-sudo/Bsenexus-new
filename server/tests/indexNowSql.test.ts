import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { contentVersion } from '../services/indexNowQueue';
const db = new PGlite();
const sql = fs.readFileSync('supabase/migrations/20261021133613_indexnow_url_cooldown.sql','utf8');
const enqueue = (url: string, version='one') => db.query('select public.indexnow_enqueue($1::jsonb)', [JSON.stringify([{url,version:contentVersion(version)}])]);
const claim = async () => (await db.query<any>('select * from public.indexnow_claim(10000)')).rows;
const complete = (claims: any[], status: number) => db.query('select public.indexnow_complete($1::jsonb,$2)',[JSON.stringify(claims),status]);
before(async()=>{await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');await db.exec(sql);});
after(()=>db.close());
test('durable claims dedupe workers and reserve 24 hours before HTTP, including a process crash',async()=>{
  const url='https://bsenexus.in/company/RELIANCE';await enqueue(url);
  const groups=await Promise.all(Array.from({length:5},()=>claim()));
  assert.equal(groups.flat().length,1);assert.equal((await claim()).length,0);
  await enqueue(url,'new filing');assert.equal((await claim()).length,0,'new content cannot bypass cooldown');
  const row=(await db.query<any>('select * from public.indexnow_urls where url=$1',[url])).rows[0];
  assert.ok(new Date(row.next_attempt_at).getTime()-new Date(row.last_attempt_at).getTime()>=24*60*60*1000);
  await complete(groups.flat(),200);
  assert.equal((await db.query<any>('select pending from public.indexnow_urls where url=$1',[url])).rows[0].pending,true,'late receipt must retain the newer filing');
});
test('accepted content is not requeued on every boot; failure has at most one later retry',async()=>{
  const url='https://bsenexus.in/companies';await enqueue(url);const first=await claim();await complete(first,202);
  await enqueue(url);assert.equal((await claim()).length,0);
  const failed='https://bsenexus.in/company/TCS';await enqueue(failed);const c=await claim();await complete(c,500);assert.equal((await claim()).length,0);
  await db.query("update public.indexnow_urls set next_attempt_at=now()-interval '1 second' where url=$1",[failed]);
  const retry=await claim();assert.equal(retry.length,1);await complete(retry,0);
  await db.query("update public.indexnow_urls set next_attempt_at=now()-interval '1 second' where url=$1",[failed]);
  assert.equal((await claim()).length,0,'third autonomous attempt is forbidden');
});
test('private ledger and invoker RPCs deny browser roles',async()=>{
  const result=await db.query<any>(`select relrowsecurity from pg_class where oid='public.indexnow_urls'::regclass`);assert.equal(result.rows[0].relrowsecurity,true);
  for(const role of ['anon','authenticated']){
    assert.equal((await db.query<any>("select has_table_privilege($1,'public.indexnow_urls','SELECT') as allowed",[role])).rows[0].allowed,false);
    for(const fn of ['indexnow_enqueue(jsonb)','indexnow_claim(integer)','indexnow_complete(jsonb,integer)']) assert.equal((await db.query<any>('select has_function_privilege($1,$2,\'EXECUTE\') as allowed',[role,'public.'+fn])).rows[0].allowed,false);
  }
  assert.equal((await db.query<any>("select count(*)::integer as n from pg_proc where proname like 'indexnow_%' and prosecdef")).rows[0].n,0);
});
