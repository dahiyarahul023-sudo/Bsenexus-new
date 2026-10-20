import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

// Executes the actual migration/functions in PostgreSQL WASM. PGlite serializes
// connections; these tests establish SQL behavior, not multi-host load performance.
const db=new PGlite();
const migration=fs.readFileSync('supabase/migrations/006_durable_referrals.sql','utf8');
before(async()=>{
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create table users(uid text primary key,pro_expires_at bigint,tier text default 'free');
 create table payment_orders(order_id text primary key,uid text,plan_id text,amount_paise bigint,currency text,status text);
 create table payment_entitlements(uid text primary key,pro_expires_at bigint,pro_plan_id text,last_payment_at bigint,last_order_id text);`);
 await db.exec(migration);
});
beforeEach(async()=>{
 await db.exec(`truncate users,payment_orders,payment_entitlements,referral_payouts_v2,referral_rewards_v2,referral_orders_v2,referral_intents_v2,referral_aliases_v2,referral_accounts_v2,referral_bonus_access_v2 cascade;
 insert into users(uid) values('alice'),('bob'),('buyer'),('other-buyer');`);
});
after(()=>db.close());
async function command(action:string,uid:string,data:Record<string,unknown>={}) {
 const r=await db.query<{result:any}>('select referral_command($1,$2,$3::jsonb) result',[action,uid,JSON.stringify(data)]);return r.rows[0].result;
}
async function snapshot(uid:string){return (await db.query<{result:any}>('select referral_snapshot($1) result',[uid])).rows[0].result;}
async function order(id='order-1',buyer='buyer',code='ALICE') {
 await db.query("insert into payment_orders values($1,$2,'pro_monthly',19900,'INR','pending')",[id,buyer]);
 await command('bind',buyer,{orderId:id,code,planId:'pro_monthly',basePaise:29900,paidPaise:19900,currency:'INR'});
}
async function pay(id='order-1'){await db.query("update payment_orders set status='granted' where order_id=$1",[id]);}
test('normalized code collisions cannot replace ownership, including competing requests',async()=>{
 const results=await Promise.allSettled([command('ensure','alice',{code:'SAME'}),command('ensure','bob',{code:'same'})]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.match(String((results.find(r=>r.status==='rejected') as PromiseRejectedResult).reason),/REFERRAL_CODE_TAKEN/);
 const winner=await command('lookup','',{code:'same'});assert.equal(winner.uid,'alice');
 assert.equal((await db.query('select * from referral_accounts_v2')).rows.length,1);
});
test('old aliases remain owned, links survive rename, failed rename is atomic',async()=>{
 await command('ensure','alice',{code:'ALICE'});await command('ensure','bob',{code:'BOB'});
 await command('rename','alice',{code:'NEWALICE'});
 assert.equal((await command('lookup','',{code:'ALICE'})).uid,'alice');
 await assert.rejects(command('rename','bob',{code:'alice'}),/REFERRAL_CODE_TAKEN/);
 assert.equal((await snapshot('bob')).account.current_code,'BOB');
});
test('applying a code is immediately pending, idempotent and does not create rewards',async()=>{
 await command('ensure','alice',{code:'ALICE'});
 await command('apply','buyer',{code:'ALICE'});await command('apply','buyer',{code:'alice'});
 const s=await snapshot('alice');assert.equal(s.pending,1);assert.equal(s.account.conversions,0);assert.deepEqual(s.rewards,[]);
 await assert.rejects(command('apply','alice',{code:'ALICE'}),/REFERRAL_SELF/);
 await command('unapply','buyer');assert.equal((await snapshot('alice')).pending,0);
});
test('only an owned pending order with matching amount can bind attribution',async()=>{
 await command('ensure','alice',{code:'ALICE'});await order();
 await assert.rejects(command('bind','other-buyer',{orderId:'order-1',code:'ALICE',planId:'pro_monthly',basePaise:29900,paidPaise:19900,currency:'INR'}),/REFERRAL_ORDER_MISMATCH/);
 await assert.rejects(db.query("select referral_settle_order('order-1')"),/REFERRAL_PAYMENT_NOT_GRANTED/);
 assert.equal((await snapshot('alice')).account.conversions,0);
});
test('verified grant and reward commit together; duplicate verify/webhook never add extra days',async()=>{
 await command('ensure','alice',{code:'ALICE'});await order();await pay();
 const expiry=(await db.query<{pro_expires_at:string}>('select pro_expires_at from users where uid=$1',['alice'])).rows[0].pro_expires_at;
 await Promise.all([pay(),db.query("select referral_settle_order('order-1')"),db.query("select referral_settle_order('order-1')")]);
 const s=await snapshot('alice');assert.equal(s.account.free_days,14);assert.equal(s.account.conversions,1);assert.equal(s.pending,0);assert.equal(s.rewards.length,1);
 assert.equal((await db.query<{pro_expires_at:string}>('select pro_expires_at from users where uid=$1',['alice'])).rows[0].pro_expires_at,expiry);
});
test('reward failure rolls back paid-grant transition, and retry succeeds',async()=>{
 await command('ensure','alice',{code:'ALICE'});await order();
 await db.exec("create function reject_reward() returns trigger language plpgsql as $$begin raise exception 'simulated outage';end$$;create trigger reject_reward before insert on referral_rewards_v2 for each row execute function reject_reward();");
 try{await assert.rejects(pay(),/simulated outage/);assert.equal((await db.query<{status:string}>("select status from payment_orders where order_id='order-1'")).rows[0].status,'pending');assert.equal((await snapshot('alice')).account.free_days,0);}
 finally{await db.exec('drop trigger reject_reward on referral_rewards_v2;drop function reject_reward();');}
 await pay();assert.equal((await snapshot('alice')).account.free_days,14);
});
test('type changes after checkout do not reinterpret a promised reward; bonuses preserve admin and paid history',async()=>{
 await command('ensure','alice',{code:'ALICE'});await order();await command('type','alice',{type:'creator'});
 const expiry=Date.now()+30*86400000;
 await db.query("update users set tier='admin',pro_expires_at=$1 where uid='alice'",[expiry]);
 await db.query("insert into payment_entitlements values('alice',$1,'pro_monthly',123,'original')",[expiry]);
 await pay();const s=await snapshot('alice');assert.equal(s.account.free_days,14);assert.equal(s.account.earnings_paise,0);
 const profile=(await db.query<{tier:string;pro_expires_at:number}>("select * from users where uid='alice'")).rows[0];assert.equal(profile.tier,'admin');assert.equal(Number(profile.pro_expires_at),expiry+14*86400000);
 const entitlement=(await db.query<{last_order_id:string;pro_expires_at:number}>("select * from payment_entitlements where uid='alice'")).rows[0];assert.equal(entitlement.last_order_id,'original');assert.equal(Number(entitlement.pro_expires_at),Number(profile.pro_expires_at));
});
test('creator commission and payout are exact-once, positive and balance bounded',async()=>{
 await command('ensure','alice',{code:'ALICE'});await command('type','alice',{type:'creator'});await order();await pay();
 assert.equal((await snapshot('alice')).account.pending_paise,2985);
 await command('payout','alice',{amountPaise:1000,reference:'bank-txn-1'});await command('payout','alice',{amountPaise:1000,reference:'bank-txn-1'});
 assert.equal((await snapshot('alice')).account.pending_paise,1985);
 await assert.rejects(command('payout','alice',{amountPaise:-1,reference:'negative'}),/REFERRAL_INVALID_PAYOUT/);
 await assert.rejects(command('payout','alice',{amountPaise:1001,reference:'bank-txn-1'}),/REFERRAL_PAYOUT_CONFLICT/);
 await assert.rejects(command('payout','alice',{amountPaise:5000,reference:'too-large'}),/REFERRAL_PAYOUT_EXCEEDS_BALANCE/);
});
test('private snapshots never include another referrer history; browser roles cannot access tables/RPC',async()=>{
 await command('ensure','alice',{code:'ALICE'});await command('ensure','bob',{code:'BOB'});await order();await pay();
 assert.equal((await snapshot('bob')).rewards.length,0);
 await db.exec('set role authenticated');
 try{await assert.rejects(db.query('select * from referral_accounts_v2'),/permission denied/);await assert.rejects(db.query("select referral_snapshot('alice')"),/permission denied/);await assert.rejects(db.query("select referral_settle_order('order-1')"),/permission denied/);}
 finally{await db.exec('reset role');}
});
test('migration refuses to silently replace legacy referral data',async()=>{
 await db.exec("create table referral_codes(code text);insert into referral_codes values('LEGACY');");
 try{await assert.rejects(db.exec(migration),/REFERRAL_LEGACY_REVIEW/);await db.exec('rollback');}
 finally{await db.exec('drop table if exists referral_codes');}
});

test('a later stale profile save cannot erase credited community bonus access',async()=>{
 await command('ensure','alice',{code:'ALICE'});await order();await pay();
 const before=(await db.query<{pro_expires_at:number}>("select pro_expires_at from users where uid='alice'")).rows[0].pro_expires_at;
 await db.exec("update users set pro_expires_at=1,tier='free' where uid='alice'");
 const after=(await db.query<{pro_expires_at:number;tier:string}>("select pro_expires_at,tier from users where uid='alice'")).rows[0];
 assert.equal(after.pro_expires_at,before);assert.equal(after.tier,'pro');
});
