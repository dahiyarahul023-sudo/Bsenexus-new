-- Rehearse on a copy before deployment. Does not modify historical payment RPCs.
-- Legacy local JSON/cloud referrals must be reconciled before cutover; never discard them.
begin;
do $$
declare t text; n bigint;
begin
  foreach t in array array['referral_codes','referral_conversions'] loop
    if to_regclass('public.'||t) is not null then
      execute format('select count(*) from public.%I',t) into n;
      if n > 0 then raise exception 'REFERRAL_LEGACY_REVIEW: nonempty % must be reconciled before v2 cutover; see rule/REFERRALS.md',t; end if;
    end if;
  end loop;
end $$;

create table if not exists public.referral_accounts_v2 (
 uid text primary key references public.users(uid), current_code text not null,
 email text not null default '', display_name text not null default '',
 reward_type text not null default 'user' check(reward_type in ('user','creator')),
 active boolean not null default true, clicks bigint not null default 0 check(clicks>=0),
 conversions bigint not null default 0 check(conversions>=0),
 earnings_paise bigint not null default 0 check(earnings_paise>=0),
 pending_paise bigint not null default 0 check(pending_paise>=0),
 paid_paise bigint not null default 0 check(paid_paise>=0),
 free_days bigint not null default 0 check(free_days>=0),
 upi text not null default '', bank_info text not null default '',
 updated_at timestamptz not null default now(), created_at timestamptz not null default now()
);
create table if not exists public.referral_aliases_v2 (
 code text primary key check(code ~ '^[A-Z0-9_-]{3,20}$'),
 uid text not null references public.referral_accounts_v2(uid),
 created_at timestamptz not null default now()
);
create table if not exists public.referral_intents_v2 (
 referred_uid text primary key references public.users(uid),
 referrer_uid text not null references public.referral_accounts_v2(uid),
 code text not null references public.referral_aliases_v2(code),
 confirmed boolean not null default false, updated_at timestamptz not null default now(),
 check(referred_uid<>referrer_uid)
);
create index if not exists referral_intents_owner on public.referral_intents_v2(referrer_uid);
create table if not exists public.referral_orders_v2 (
 order_id text primary key, referred_uid text not null references public.users(uid),
 referrer_uid text not null references public.referral_accounts_v2(uid),
 code text not null references public.referral_aliases_v2(code),
 reward_type text not null check(reward_type in ('user','creator')),
 plan_id text not null, base_paise bigint not null check(base_paise>0),
 paid_paise bigint not null check(paid_paise>0 and paid_paise<=base_paise),
 currency text not null check(currency='INR'), created_at timestamptz not null default now(),
 check(referred_uid<>referrer_uid)
);
create index if not exists referral_orders_owner on public.referral_orders_v2(referrer_uid);
create table if not exists public.referral_rewards_v2 (
 order_id text primary key references public.referral_orders_v2(order_id),
 referrer_uid text not null references public.referral_accounts_v2(uid),
 reward_type text not null check(reward_type in ('user','creator')),
 commission_paise bigint not null check(commission_paise>=0),
 free_days integer not null check(free_days in (0,14)),
 status text not null default 'confirmed' check(status in ('confirmed','refunded')),
 created_at timestamptz not null default now()
);
create index if not exists referral_rewards_owner on public.referral_rewards_v2(referrer_uid,created_at desc);
-- Separate floor prevents a stale profile save/login mirror from erasing earned days.
create table if not exists public.referral_bonus_access_v2 (
 uid text primary key references public.users(uid), expires_at bigint not null check(expires_at>0)
);
create table if not exists public.referral_payouts_v2 (
 reference text primary key check(length(reference) between 3 and 120),
 uid text not null references public.referral_accounts_v2(uid),
 amount_paise bigint not null check(amount_paise>0), created_at timestamptz not null default now()
);

-- Must only be called by the trusted payment path after provider verification.
-- The order ledger is additionally checked here. Unique reward order_id is durable deduplication.
create or replace function public.referral_settle_order(p_order_id text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare o public.referral_orders_v2%rowtype; a public.referral_accounts_v2%rowtype;
 r public.referral_rewards_v2%rowtype; payment jsonb; entitlement jsonb;
 percent integer; commission bigint:=0; days integer:=0; expiry bigint; current_expiry bigint;
begin
 select * into o from public.referral_orders_v2 where order_id=p_order_id for update;
 if not found then return jsonb_build_object('success',true,'attributed',false); end if;
 select to_jsonb(p) into payment from public.payment_orders p where p.order_id=p_order_id;
 if payment is null or payment->>'status' is distinct from 'granted' or payment->>'uid' is distinct from o.referred_uid
    or (payment->>'amount_paise')::bigint is distinct from o.paid_paise or payment->>'currency' is distinct from o.currency
    or payment->>'plan_id' is distinct from o.plan_id then
   raise exception 'REFERRAL_PAYMENT_NOT_GRANTED';
 end if;
 select * into r from public.referral_rewards_v2 where order_id=p_order_id;
 if found then return to_jsonb(r)||jsonb_build_object('success',true,'alreadyGranted',true); end if;
 select * into a from public.referral_accounts_v2 where uid=o.referrer_uid for update;
 if o.reward_type='creator' then
   percent:=case when a.conversions+1>=50 then 30 when a.conversions+1>=20 then 25 when a.conversions+1>=5 then 20 else 15 end;
   commission:=round(o.paid_paise*percent/100.0);
 else
   days:=14;
   select coalesce(pro_expires_at,0) into current_expiry from public.users where uid=o.referrer_uid for update;
   if not found then raise exception 'REFERRAL_PROFILE_MISSING'; end if;
   select to_jsonb(e) into entitlement from public.payment_entitlements e where e.uid=o.referrer_uid for update;
   expiry:=greatest(current_expiry,coalesce((entitlement->>'pro_expires_at')::bigint,0),coalesce((entitlement->>'expires_at')::bigint,0),(extract(epoch from now())*1000)::bigint)+days*86400000::bigint;
   insert into public.referral_bonus_access_v2(uid,expires_at) values(o.referrer_uid,expiry)
   on conflict(uid) do update set expires_at=greatest(referral_bonus_access_v2.expires_at,excluded.expires_at);
   update public.users set pro_expires_at=expiry,tier=case when tier='admin' then tier else 'pro' end where uid=o.referrer_uid;
   -- Preserve paid provenance while extending an existing entitlement, so login reconciliation cannot erase bonus days.
   if entitlement ? 'pro_expires_at' then
     execute 'update public.payment_entitlements set pro_expires_at=$1 where uid=$2' using expiry,o.referrer_uid;
   elsif entitlement ? 'expires_at' then
     execute 'update public.payment_entitlements set expires_at=$1 where uid=$2' using expiry,o.referrer_uid;
   end if;
 end if;
 insert into public.referral_rewards_v2(order_id,referrer_uid,reward_type,commission_paise,free_days)
 values(o.order_id,o.referrer_uid,o.reward_type,commission,days) returning * into r;
 update public.referral_accounts_v2 set conversions=conversions+1,earnings_paise=earnings_paise+commission,
 pending_paise=pending_paise+commission,free_days=free_days+days,updated_at=clock_timestamp() where uid=o.referrer_uid;
 update public.referral_intents_v2 set confirmed=true,updated_at=clock_timestamp() where referred_uid=o.referred_uid and referrer_uid=o.referrer_uid;
 return to_jsonb(r)||jsonb_build_object('success',true,'alreadyGranted',false);
end $$;

create or replace function public.referral_command(p_action text,p_uid text,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare a public.referral_accounts_v2%rowtype; owner_uid text; code text:=upper(trim(coalesce(p_data->>'code','')));
 o public.referral_orders_v2%rowtype; pay jsonb; amount bigint; paid public.referral_payouts_v2%rowtype;
begin
 if p_action in ('lookup','click','apply','rename','bind') and code !~ '^[A-Z0-9_-]{3,20}$' then raise exception 'REFERRAL_INVALID_CODE'; end if;
 if p_action='ensure' then
   select * into a from public.referral_accounts_v2 where uid=p_uid;
   if found then return to_jsonb(a); end if;
   insert into public.referral_accounts_v2(uid,current_code,email,display_name)
   values(p_uid,code,coalesce(p_data->>'email',''),coalesce(p_data->>'displayName','')) on conflict(uid) do nothing;
   select * into a from public.referral_accounts_v2 where uid=p_uid for update;
   insert into public.referral_aliases_v2(code,uid) values(a.current_code,p_uid) on conflict on constraint referral_aliases_v2_pkey do nothing;
   select uid into owner_uid from public.referral_aliases_v2 where referral_aliases_v2.code=a.current_code;
   if owner_uid<>p_uid then raise exception 'REFERRAL_CODE_TAKEN'; end if;
   return to_jsonb(a);
 elsif p_action='lookup' then
   select r.* into a from public.referral_accounts_v2 r join public.referral_aliases_v2 c on c.uid=r.uid where c.code=code and r.active;
   if not found then return null; end if;
   return to_jsonb(a)||jsonb_build_object('current_code',code);
 elsif p_action='click' then
   update public.referral_accounts_v2 set clicks=clicks+1,updated_at=clock_timestamp() where uid=(select uid from public.referral_aliases_v2 c where c.code=code) and active;
   return jsonb_build_object('success',found);
 elsif p_action='apply' then
   select r.* into a from public.referral_accounts_v2 r join public.referral_aliases_v2 c on c.uid=r.uid where c.code=code and r.active;
   if not found then raise exception 'REFERRAL_INVALID_CODE'; end if;
   if a.uid=p_uid then raise exception 'REFERRAL_SELF'; end if;
   insert into public.referral_intents_v2(referred_uid,referrer_uid,code) values(p_uid,a.uid,code)
   on conflict(referred_uid) do update set referrer_uid=excluded.referrer_uid,code=excluded.code,
   confirmed=case when referral_intents_v2.referrer_uid=excluded.referrer_uid then referral_intents_v2.confirmed else false end,updated_at=clock_timestamp();
   update public.referral_accounts_v2 set updated_at=clock_timestamp() where uid=a.uid;
   return jsonb_build_object('success',true,'code',code,'status','pending');
 elsif p_action='unapply' then
   delete from public.referral_intents_v2 where referred_uid=p_uid and not confirmed;
   return jsonb_build_object('success',true);
 elsif p_action='bind' then
   select to_jsonb(p) into pay from public.payment_orders p where p.order_id=p_data->>'orderId';
   if pay is null or pay->>'uid' is distinct from p_uid or pay->>'status' is distinct from 'pending'
     or (pay->>'amount_paise')::bigint is distinct from (p_data->>'paidPaise')::bigint
     or pay->>'currency' is distinct from p_data->>'currency' or pay->>'plan_id' is distinct from p_data->>'planId' then raise exception 'REFERRAL_ORDER_MISMATCH'; end if;
   select r.* into a from public.referral_accounts_v2 r join public.referral_aliases_v2 c on c.uid=r.uid where c.code=code and r.active;
   if not found then raise exception 'REFERRAL_INVALID_CODE'; end if;
   if a.uid=p_uid then raise exception 'REFERRAL_SELF'; end if;
   insert into public.referral_orders_v2(order_id,referred_uid,referrer_uid,code,reward_type,plan_id,base_paise,paid_paise,currency)
   values(p_data->>'orderId',p_uid,a.uid,code,a.reward_type,p_data->>'planId',(p_data->>'basePaise')::bigint,(p_data->>'paidPaise')::bigint,p_data->>'currency') on conflict(order_id) do nothing;
   select * into o from public.referral_orders_v2 where order_id=p_data->>'orderId';
   if o.referred_uid<>p_uid or o.referrer_uid<>a.uid or o.paid_paise<>(p_data->>'paidPaise')::bigint or o.base_paise<>(p_data->>'basePaise')::bigint or o.plan_id<>p_data->>'planId' then raise exception 'REFERRAL_ORDER_MISMATCH'; end if;
   perform public.referral_command('apply',p_uid,jsonb_build_object('code',code));
   return jsonb_build_object('success',true);
 elsif p_action='rename' then
   select * into a from public.referral_accounts_v2 where uid=p_uid for update;
   if not found then raise exception 'REFERRAL_ACCOUNT_MISSING'; end if;
   insert into public.referral_aliases_v2(code,uid) values(code,p_uid) on conflict on constraint referral_aliases_v2_pkey do nothing;
   select c.uid into owner_uid from public.referral_aliases_v2 c where c.code=code;
   if owner_uid<>p_uid then raise exception 'REFERRAL_CODE_TAKEN'; end if;
   update public.referral_accounts_v2 set current_code=code,updated_at=clock_timestamp() where uid=p_uid;
   return jsonb_build_object('success',true,'code',code);
 elsif p_action='payout-info' then
   if length(coalesce(p_data->>'upi',''))>120 or length(coalesce(p_data->>'bank',''))>500 then raise exception 'REFERRAL_INVALID_PAYOUT'; end if;
   update public.referral_accounts_v2 set upi=coalesce(p_data->>'upi',''),bank_info=coalesce(p_data->>'bank',''),updated_at=clock_timestamp() where uid=p_uid;
   if not found then raise exception 'REFERRAL_ACCOUNT_MISSING'; end if;
   return jsonb_build_object('success',true);
 elsif p_action='type' then
   if p_data->>'type' not in ('creator','user') then raise exception 'REFERRAL_INVALID_TYPE'; end if;
   update public.referral_accounts_v2 set reward_type=p_data->>'type',updated_at=clock_timestamp() where uid=p_uid;
   if not found then raise exception 'REFERRAL_ACCOUNT_MISSING'; end if;
   return jsonb_build_object('success',true,'type',p_data->>'type');
 elsif p_action='payout' then
   amount:=(p_data->>'amountPaise')::bigint;
   if amount is null or amount<=0 or length(coalesce(p_data->>'reference','')) not between 3 and 120 then raise exception 'REFERRAL_INVALID_PAYOUT'; end if;
   select * into a from public.referral_accounts_v2 where uid=p_uid for update;
   if not found then raise exception 'REFERRAL_ACCOUNT_MISSING'; end if;
   select * into paid from public.referral_payouts_v2 where reference=p_data->>'reference';
   if found then
     if paid.uid<>p_uid or paid.amount_paise<>amount then raise exception 'REFERRAL_PAYOUT_CONFLICT'; end if;
     return jsonb_build_object('success',true,'alreadyRecorded',true);
   end if;
   if amount>a.pending_paise then raise exception 'REFERRAL_PAYOUT_EXCEEDS_BALANCE'; end if;
   insert into public.referral_payouts_v2(reference,uid,amount_paise) values(p_data->>'reference',p_uid,amount);
   update public.referral_accounts_v2 set pending_paise=pending_paise-amount,paid_paise=paid_paise+amount,updated_at=clock_timestamp() where uid=p_uid;
   return jsonb_build_object('success',true);
 end if;
 raise exception 'REFERRAL_UNKNOWN_ACTION';
end $$;

-- Tie reward settlement to the same database transaction as the paid grant.
create or replace function public.referral_payment_granted_trigger() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.status='granted' then perform public.referral_settle_order(new.order_id); end if;
 return new;
end $$;
drop trigger if exists referral_payment_granted on public.payment_orders;
create trigger referral_payment_granted after insert or update of status on public.payment_orders
for each row execute function public.referral_payment_granted_trigger();

do $$
declare t text;
begin
 foreach t in array array['referral_accounts_v2','referral_aliases_v2','referral_intents_v2','referral_orders_v2','referral_rewards_v2','referral_payouts_v2','referral_bonus_access_v2'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select,insert,update,delete on public.%I to service_role',t);
 end loop;
 -- Optional fast wakeup; polling reconciliation still works if Realtime is not enabled.
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='referral_accounts_v2') then
  alter publication supabase_realtime add table public.referral_accounts_v2;
 end if;
end $$;
revoke all on function public.referral_command(text,text,jsonb),public.referral_settle_order(text),public.referral_payment_granted_trigger() from public,anon,authenticated;
grant execute on function public.referral_command(text,text,jsonb),public.referral_settle_order(text),public.referral_payment_granted_trigger() to service_role;
create or replace function public.referral_snapshot(p_uid text) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('account',to_jsonb(a),
 'pending',(select count(*) from public.referral_intents_v2 i where i.referrer_uid=p_uid and not i.confirmed),
 'rewards',coalesce((select jsonb_agg(to_jsonb(x)) from (
   select r.*,o.plan_id,o.paid_paise,o.base_paise from public.referral_rewards_v2 r
   join public.referral_orders_v2 o using(order_id) where r.referrer_uid=p_uid order by r.created_at desc,r.order_id limit 100
 ) x),'[]'::jsonb)) from public.referral_accounts_v2 a where a.uid=p_uid;
$$;
create or replace function public.referral_admin_accounts() returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select * from public.referral_accounts_v2 order by conversions desc,uid limit 1000) x;
$$;
revoke all on function public.referral_snapshot(text),public.referral_admin_accounts() from public,anon,authenticated;
grant execute on function public.referral_snapshot(text),public.referral_admin_accounts() to service_role;
create or replace function public.preserve_referral_bonus_access() returns trigger
language plpgsql security invoker set search_path='' as $$
declare bonus bigint;
begin
 select expires_at into bonus from public.referral_bonus_access_v2 where uid=new.uid;
 if bonus is not null then
  new.pro_expires_at:=greatest(coalesce(new.pro_expires_at,0),bonus);
  if bonus>(extract(epoch from now())*1000)::bigint and new.tier<>'admin' then new.tier:='pro'; end if;
 end if;
 return new;
end $$;
drop trigger if exists preserve_referral_bonus_access on public.users;
create trigger preserve_referral_bonus_access before update on public.users for each row execute function public.preserve_referral_bonus_access();
revoke all on function public.preserve_referral_bonus_access() from public,anon,authenticated;
grant execute on function public.preserve_referral_bonus_access() to service_role;
commit;
