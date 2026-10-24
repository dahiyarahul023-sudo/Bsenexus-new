import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const migration = process.env.AUDIT_MIGRATION || fs.readdirSync('supabase/migrations').find(p => p.endsWith('_deep_audit_security.sql'))!;
const sql = fs.readFileSync(process.env.AUDIT_MIGRATION || `supabase/migrations/${migration}`, 'utf8');
before(async () => {
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create table users(uid text primary key,email text,display_name text,tier text default 'free',pro_expires_at bigint,trial_used boolean not null default false,created_at bigint,last_login_at bigint,pro_plan_id text,last_payment_at bigint,last_order_id text,max_watchlist_stocks integer,telegram_chat_id text,telegram_username text);
 create table payment_orders(order_id text primary key,uid text references users(uid),email text,plan_id text,amount_paise bigint,currency text,status text,created_at bigint,updated_at bigint,granted_at bigint,paid_at bigint,pro_expires_at bigint,grant_source text);
 create table payment_entitlements(uid text primary key references users(uid),pro_expires_at bigint,pro_plan_id text,last_payment_at bigint,last_order_id text,granted_order_ids jsonb,updated_at bigint,source text);
 create table auth_account_limits(id text primary key,data jsonb,updated_at timestamptz default now());
 create function ensure_user_skeleton(p_uid text,p_now bigint) returns void language sql as $$insert into public.users(uid,created_at,last_login_at) values(p_uid,p_now,p_now) on conflict do nothing$$;
 insert into users(uid) values('historical');`);
 await db.exec(fs.readFileSync('supabase/migrations/006_durable_referrals.sql','utf8'));
 await db.exec(sql);
 assert.equal((await db.query<{trial_used:boolean}>("select trial_used from users where uid='historical'")).rows[0].trial_used,true);
});
beforeEach(async () => { await db.exec('truncate users,payment_orders,payment_entitlements,auth_account_limits,telegram_link_challenges,telegram_verified_links cascade'); });
after(() => db.close());
const command = async (q: string, params: any[] = []) => (await db.query<any>(q, params)).rows[0];
const trial = (uid='buyer') => db.query('select claim_trial_atomic($1,$2,$3)',[uid,`${uid}@example.com`,uid]);
const pending = (id='order',uid='buyer',amount=29900) => db.query("select record_pending_order_atomic($1,$2,'buyer@example.com','pro_monthly',$3,'INR')",[id,uid,amount]);
const grant = (id='order',uid='buyer',amount=29900,days=30,currency='INR',plan='pro_monthly') => command("select grant_payment_atomic($1,$2,'buyer@example.com',$6,$4,$3,$5,100,'verify') result",[id,uid,amount,days,currency,plan]);
test('trial claim is first-use only across parallel requests and expiry loss',async()=>{
 await Promise.all([trial(),trial()]);const a=await command("select * from users where uid='buyer'");
 assert.equal(a.trial_used,true);assert.ok(Number(a.pro_expires_at)>Date.now()+6*86400000);
 await db.exec("alter table users disable trigger preserve_access_state;update users set pro_expires_at=null where uid='buyer';alter table users enable trigger preserve_access_state;");
 await trial();assert.equal(Number((await command("select pro_expires_at from users where uid='buyer'")).pro_expires_at),0);
});
test('recorded checkout ownership, amount, currency and plan are immutable',async()=>{
 await trial();await trial('other');await pending();
 await assert.rejects(pending('order','other'),/OWNERSHIP/);
 await assert.rejects(pending('order','buyer',1),/MISMATCH/);
 for(const args of [['missing','buyer',29900,30,'INR','pro_monthly'],['order','other',29900,30,'INR','pro_monthly'],['order','buyer',1,30,'INR','pro_monthly'],['order','buyer',29900,30,'USD','pro_monthly'],['order','buyer',29900,30,'INR','pro_yearly']] as const) await assert.rejects(grant(args[0] as string,args[1] as string,args[2] as number,args[3] as number,args[4] as string,args[5] as string),/MISSING|OWNERSHIP|MISMATCH|INPUT/);
 assert.equal((await command("select status from payment_orders where order_id='order'")).status,'pending');
});
test('different purchases extend cumulatively; duplicate callbacks and reconcile cannot shorten',async()=>{
 await trial();const start=Number((await command("select pro_expires_at from users where uid='buyer'")).pro_expires_at);
 await pending('one');await pending('two');await Promise.all([grant('one'),grant('two')]);
 const expiry=Number((await command("select pro_expires_at from payment_entitlements where uid='buyer'")).pro_expires_at);
 assert.equal(expiry,start+60*86400000);
 await Promise.all([grant('one'),db.query("select reconcile_payment_entitlement('buyer')")]);
 assert.equal(Number((await command("select pro_expires_at from payment_entitlements where uid='buyer'")).pro_expires_at),expiry);
 await db.query("update users set pro_expires_at=1,trial_used=false,pro_plan_id=null where uid='buyer'");
 const u=await command("select * from users where uid='buyer'");assert.equal(u.trial_used,true);assert.equal(Number(u.pro_expires_at),expiry);assert.equal(u.pro_plan_id,'pro_monthly');
});
test('profile plan strings do not create paid evidence; replay does not revive expired orders',async()=>{
 await trial();await db.exec("update users set pro_plan_id='pro_yearly',last_order_id='invented' where uid='buyer'");
 assert.equal((await command("select reconcile_payment_entitlement('buyer') result")).result,null);
 await pending();await grant();
 await db.exec("alter table users disable trigger preserve_access_state;update users set pro_expires_at=100;update payment_orders set pro_expires_at=100;update payment_entitlements set pro_expires_at=100;alter table users enable trigger preserve_access_state");
 assert.equal(Number((await grant()).result.pro_expires_at),100);
});
test('referral settlement fires once inside actual payment transaction',async()=>{
 await trial();await trial('referrer');await db.query("select referral_command('ensure','referrer','{\"code\":\"FRIEND\"}')");
 await pending('order','buyer',19900);
 await db.query("select referral_command('bind','buyer','{\"orderId\":\"order\",\"code\":\"FRIEND\",\"planId\":\"pro_monthly\",\"basePaise\":29900,\"paidPaise\":19900,\"currency\":\"INR\"}')");
 await grant('order','buyer',19900);await grant('order','buyer',19900);
 assert.equal(Number((await command("select conversions from referral_accounts_v2 where uid='referrer'")).conversions),1);
 assert.equal(Number((await command("select free_days from referral_accounts_v2 where uid='referrer'")).free_days),14);
});
test('Telegram nonce is short-lived, single-use, account-bound, and unlink revokes it',async()=>{
 await trial();await trial('other');
 const link = (action:string,uid:string,hash='',chat='') => command('select telegram_link_command($1,$2,$3,$4) result',[action,uid,hash,chat]);
 await link('start','buyer','first');await link('start','buyer','second');assert.equal((await link('consume','','first','123')).result,null);
 assert.equal((await link('consume','','second','123')).result.chatId,'123');
 assert.equal((await link('consume','','second','124')).result,null);
 await link('start','other','third');assert.equal((await link('consume','','third','123')).result,null);
 await db.query('update telegram_link_challenges set expires_at=1');assert.equal((await link('consume','','third','124')).result,null);
 await link('unlink','buyer');assert.equal((await link('status','buyer')).result.chatId,null);
});
test('shared login counters accumulate; checks never clear a live lock',async()=>{
 const call=(action:string)=>command("select auth_account_command($1,'key',5,1000,900000) result",[action]);
 await Promise.all(Array.from({length:5},()=>call('fail')));assert.equal((await call('check')).result.failedAttempts,5);assert.ok((await call('check')).result.remainingLockoutSec>0);
 await call('reset');assert.equal((await call('check')).result.failedAttempts,0);
});
test('browser roles cannot call privileged RPCs or read Telegram proofs',async()=>{
 for(const role of ['anon','authenticated']) {
  await db.exec(`set role ${role}`);
  try { await assert.rejects(trial(),/permission denied/);await assert.rejects(db.query("select reconcile_payment_entitlement('buyer')"),/permission denied/);await assert.rejects(db.query('select * from telegram_verified_links'),/permission denied/); }
  finally{await db.exec('reset role');}
 }
});

test('pending-order hardening preserves the staging jsonb return contract',async()=>{
 await db.exec(`drop function public.record_pending_order_atomic(text,text,text,text,bigint,text);
 create function public.record_pending_order_atomic(p_order_id text,p_uid text,p_email text,p_plan_id text,p_amount_paise bigint,p_currency text)
 returns jsonb language sql as $$select '{}'::jsonb$$;`);
 const start=sql.indexOf('do $pending_contract$');
 const end=sql.indexOf('end $pending_contract$;',start)+'end $pending_contract$;'.length;
 await db.exec(sql.slice(start,end));
 await trial();await pending();
 assert.equal((await command("select pg_get_function_result('public.record_pending_order_atomic(text,text,text,text,bigint,text)'::regprocedure) result")).result,'jsonb');
 await assert.rejects(pending('order','buyer',1),/MISMATCH/);
});
