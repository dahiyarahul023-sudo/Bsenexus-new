import { before, after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const path = fs.readdirSync('supabase/migrations').find(p => p.endsWith('_gift_pro_access.sql'))!;
const hash = (c='a') => c.repeat(64);
const call = async (action: string, actor: string, data: object) => (await db.query<any>('select gift_access_command($1,$2,$3::jsonb) result', [action, actor, JSON.stringify(data)])).rows[0].result;
const make = (extra: object = {}) => ({ id: randomUUID(), email: 'recipient@example.com', validityDays: 30, claimDays: 7, note: 'internal', hash: hash(), ...extra });
const claim = (actor='recipient', email='recipient@example.com', tokenHash=hash()) => call('claim',actor,{email,hash:tokenHash});
before(async () => {
 await db.exec(`create role anon; create role authenticated; create role service_role;
 create table users(uid text primary key,tier text,pro_expires_at bigint);
 create table payment_entitlements(uid text primary key,pro_expires_at bigint);
 create table payment_orders(id text primary key,amount integer);
 insert into users values('recipient','free',0);insert into payment_entitlements values('recipient',9999999999999);
 create function mutate_ai_account(p_uid text,p_request text,p_fingerprint text,p_tool text,p_args jsonb,p_grant uuid) returns jsonb language plpgsql set search_path='' as $$
 declare profile public.users%rowtype;active_pro boolean;
 begin
 select * into profile from public.users where uid=p_uid;
 active_pro:=profile.tier='admin' or coalesce(profile.pro_expires_at,0)>extract(epoch from now())*1000 or exists(select 1 from public.payment_entitlements where uid=p_uid and pro_expires_at>extract(epoch from now())*1000);
 return jsonb_build_object('pro',active_pro);
 end $$;`);
 await db.exec(fs.readFileSync('supabase/migrations/'+path,'utf8'));
});
beforeEach(async () => { await db.exec('truncate gift_access_events,gift_access_invites;'); });
after(() => db.close());
test('invite starts at explicit claim, is email-bound, and duplicate/concurrent retries do not add time',async()=>{
 const input=make();const created=await call('create','owner',input);
 assert.equal(created.invite.activatedAt,null);assert.equal(created.shouldSend,true);
 assert.ok(created.invite.claimUntil>=Date.now()+6*86400000);
 assert.equal((await claim('wrong','wrong@example.com')).error,'unavailable');
 const preview=await call('preview','recipient',{email:input.email,hash:input.hash});
 assert.equal(preview.invite.activatedAt,null);assert.equal(preview.invite.note,undefined);
 const [a,b]=await Promise.all([claim(),claim()]);
 assert.equal(a.invite.expiresAt-a.invite.activatedAt,30*86400000);assert.equal(a.invite.expiresAt,b.invite.expiresAt);
 assert.equal(b.alreadyActivated,true);assert.equal(b.invite.note,undefined);
 assert.equal((await claim('recreated')).error,'unavailable');
 const events=(await db.query<any>('select action from gift_access_events order by created_at')).rows.map(r=>r.action);
 assert.deepEqual(events,['created','activated']);
});
test('creation is idempotent with immutable inputs and never writes paid/referral/user facts',async()=>{
 const input=make();await call('create','owner',input);
 assert.equal((await call('create','owner',{...input,hash:hash('b')})).shouldSend,false);
 await assert.rejects(call('create','owner',{...input,validityDays:365}),/conflict/);
 await assert.rejects(call('create','other',input),/conflict/);
 await claim();
 assert.equal(Number((await db.query<any>("select pro_expires_at from users where uid='recipient'")).rows[0].pro_expires_at),0);
 assert.equal(Number((await db.query<any>("select pro_expires_at from payment_entitlements where uid='recipient'")).rows[0].pro_expires_at),9999999999999);
 assert.equal((await db.query<any>('select count(*) count from payment_orders')).rows[0].count,0);
});
test('resend rotates only a pending link, keeps original deadline and does not create another invite',async()=>{
 const input=make();const a=await call('create','owner',input);
 assert.equal((await call('resend','owner',{id:input.id,requestId:randomUUID(),hash:hash('b')})).error,'wait');
 await db.exec('update gift_access_invites set last_send_at=0');
 const operation=randomUUID();const b=await call('resend','owner',{id:input.id,requestId:operation,hash:hash('b')});
 assert.equal(b.shouldSend,true);assert.equal(a.invite.claimUntil,b.invite.claimUntil);
 assert.equal((await claim()).error,'unavailable');
 assert.equal((await call('resend','owner',{id:input.id,requestId:operation,hash:hash('c')})).shouldSend,false);
 assert.equal((await claim('recipient',input.email,hash('b'))).invite.status,'activated');
 assert.equal((await call('resend','owner',{id:input.id,requestId:randomUUID(),hash:hash('c')})).error,'unavailable');
});
test('expiry/revoke reject redemption and never revive through replay or a newly created account',async()=>{
 const input=make();await call('create','owner',input);await db.exec('update gift_access_invites set claim_until=0');assert.equal((await claim()).error,'unavailable');
 await db.exec('update gift_access_invites set claim_until=9999999999999');await claim();
 assert.equal((await call('revoke','wrong',{id:input.id,requestId:randomUUID()})).error,'unavailable');
 const op=randomUUID();await call('revoke','owner',{id:input.id,requestId:op});await call('revoke','owner',{id:input.id,requestId:op});assert.equal((await claim()).error,'unavailable');
 assert.equal((await claim('new-id')).error,'unavailable');
 assert.equal((await db.query<any>('select count(*) n from gift_access_events')).rows[0].n,3);
});
test('late delivery callbacks cannot overwrite the status of a newer resend',async()=>{
 const input=make();await call('create','owner',input);await db.exec('update gift_access_invites set last_send_at=0');await call('resend','owner',{id:input.id,requestId:randomUUID(),hash:hash('b')});
 await call('delivery','owner',{id:input.id,hash:hash(),delivery:'accepted'});
 assert.equal((await call('list','owner',{})).items[0].delivery,'pending');
 assert.deepEqual((await call('list','other',{})).items,[]);
});
test('browser roles cannot read tables or invoke any privileged gift helper',async()=>{
 for(const role of ['anon','authenticated']) {
  await db.exec('set role '+role);
  try { await assert.rejects(db.query('select * from gift_access_invites'),/permission denied/);await assert.rejects(call('create','owner',make()),/permission denied/); }
  finally {await db.exec('reset role');}
 }
 await db.exec('set role service_role');try {await call('create','owner',make());} finally {await db.exec('reset role');}
});
test('database enforces duration limits and the owner daily email budget',async()=>{
 await assert.rejects(call('create','owner',make({validityDays:0})),/check constraint/);
 await assert.rejects(call('create','owner',make({validityDays:3651})),/check constraint/);
 for(let i=0;i<50;i++) await call('create','owner',make({hash:i.toString(16).padStart(64,'0')}));
 assert.equal((await call('create','owner',make({hash:hash('f')}))).error,'daily_limit');
});
test('connector database write gate accepts an active gift and denies it immediately after revocation',async()=>{
 await db.exec("delete from payment_entitlements where uid='recipient'");await call('create','owner',make());await claim();
 const gate=async()=> (await db.query<any>("select mutate_ai_account('recipient','','','','{}',null) value")).rows[0].value.pro;
 assert.equal(await gate(),true);
 const rows=await call('list','owner',{});await call('revoke','owner',{id:rows.items[0].id,requestId:randomUUID()});assert.equal(await gate(),false);
});
test('forward migration integrates with the real connector mutation contract',async()=>{
 const actual = new PGlite();
 try {
  await actual.exec(`create role anon;create role authenticated;create role service_role bypassrls;
   create table users(uid text primary key,tier text,pro_expires_at bigint,display_name text,notification_prefs jsonb default '{}',mute_in_app_notifications boolean);
   create table payment_entitlements(uid text primary key,pro_expires_at bigint);
   create table user_watchlists(uid text primary key,lists jsonb,updated_at timestamptz default now());
   create table user_notes(id text primary key,user_id text,note jsonb,updated_at timestamptz default now());
   insert into users(uid,tier,pro_expires_at) values('recipient','free',0);`);
  await actual.exec(fs.readFileSync('supabase/migrations/20261020072807_ai_connections.sql','utf8'));
  await actual.exec(fs.readFileSync('supabase/migrations/'+path,'utf8'));
  const invite=make(),grant=randomUUID();
  const command=async(a:string,d:object,actor='owner')=>(await actual.query<any>('select gift_access_command($1,$2,$3) r',[a,actor,JSON.stringify(d)])).rows[0].r;
  await command('create',invite);await command('claim',{hash:invite.hash,email:invite.email},'recipient');
  await actual.query("insert into ai_connection_clients(id,metadata) values('fixture','{}');");
  await actual.query("insert into ai_connection_grants(id,uid,client_id,scopes) values($1,'recipient','fixture',array['watchlists:write'])",[grant]);
  const mutate=async(request:string)=>{
   await actual.query("insert into ai_connection_operations(uid,request_id,fingerprint,tool) values('recipient',$1,'fp','watchlist_create')",[request]);
   return (await actual.query<any>("select mutate_ai_account('recipient',$1,'fp','watchlist_create','{\"name\":\"Gift list\"}',$2) r",[request,grant])).rows[0].r;
  };
  assert.equal((await mutate('before-revoke')).success,true);
  await command('revoke',{id:invite.id,requestId:randomUUID()});
  assert.equal((await mutate('after-revoke')).error,'pro_required');
 }finally{await actual.close();}
});
