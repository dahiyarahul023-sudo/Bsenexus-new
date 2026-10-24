-- Requires the modern payment schema verified in schema-contract.sql.
-- Refuse a legacy-only install instead of guessing/converting historical payment data.
do $$ begin
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='payment_entitlements' and column_name='pro_expires_at') then
  raise exception 'PAYMENT_SCHEMA_REVIEW_REQUIRED: install/export modern payment contract before this migration';
 end if;
end $$;

-- Retire unused historical entry points, including the obsolete five-argument grant.
do $$ declare f record; begin
 for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('grant_payment_atomic','record_pending_order_atomic','claim_order_for_grant','claim_free_summary_demo') loop
  execute format('revoke all on function %s from public,anon,authenticated',f.sig);
  execute format('alter function %s set search_path = public, pg_temp',f.sig);
 end loop;
end $$;

-- Historical first claims were not flagged. Existing accounts must not get a new
-- trial because an expiry field disappeared. Only future accounts start unclaimed.
update public.users set trial_used=true where trial_used=false;

create or replace function public.claim_trial_atomic(p_uid text,p_email text,p_display_name text)
returns void language plpgsql security invoker set search_path='' as $$
declare u public.users%rowtype; n bigint := (extract(epoch from now())*1000)::bigint;
begin
 if nullif(btrim(p_uid),'') is null then raise exception 'INVALID_UID'; end if;
 insert into public.users(uid,email,display_name,tier,created_at,last_login_at)
 values(p_uid,p_email,left(p_display_name,100),'free',n,n) on conflict(uid) do nothing;
 select * into strict u from public.users where uid=p_uid for update;
 if not u.trial_used then
  update public.users set trial_used=true, max_watchlist_stocks=greatest(coalesce(max_watchlist_stocks,25),50),
   pro_expires_at=case when coalesce(u.pro_expires_at,0)=0
    and not exists(select 1 from public.payment_entitlements where uid=p_uid)
    and not exists(select 1 from public.payment_orders where uid=p_uid and status='granted')
    then n+604800000 else u.pro_expires_at end,
   tier=case when u.tier='admin' then 'admin' when coalesce(u.pro_expires_at,n+604800000)>n then 'pro' else u.tier end
  where uid=p_uid;
 end if;
 update public.users set email=p_email,display_name=coalesce(nullif(display_name,''),left(p_display_name,100)),last_login_at=n where uid=p_uid;
end $$;

create or replace function public.record_pending_order_atomic(p_order_id text,p_uid text,p_email text,p_plan_id text,p_amount_paise bigint,p_currency text)
returns void language plpgsql security invoker set search_path='' as $$
declare o public.payment_orders%rowtype; n bigint := (extract(epoch from now())*1000)::bigint;
begin
 if p_amount_paise is null or p_amount_paise<=0 or nullif(p_plan_id,'') is null or p_currency<>'INR' or nullif(p_order_id,'') is null then raise exception 'PAYMENT_INPUT'; end if;
 perform public.ensure_user_skeleton(p_uid,n);
 insert into public.payment_orders(order_id,uid,email,plan_id,amount_paise,currency,status,created_at,updated_at)
 values(p_order_id,p_uid,p_email,p_plan_id,p_amount_paise,p_currency,'pending',n,n) on conflict(order_id) do nothing;
 select * into strict o from public.payment_orders where order_id=p_order_id for update;
 if o.uid is distinct from p_uid then raise exception 'OWNERSHIP:%',p_order_id; end if;
 if o.plan_id is distinct from p_plan_id or o.amount_paise is distinct from p_amount_paise or o.currency is distinct from p_currency then raise exception 'PAYMENT_ORDER_MISMATCH'; end if;
end $$;

create or replace function public.grant_payment_atomic(p_order_id text,p_uid text,p_email text,p_plan_id text,p_validity_days integer,p_amount_paise bigint,p_currency text,p_paid_at bigint,p_grant_source text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare o public.payment_orders%rowtype; e public.payment_entitlements%rowtype; u public.users%rowtype;
 n bigint := (extract(epoch from now())*1000)::bigint; expiry bigint; paid bigint; ids jsonb; already boolean;
begin
 if p_amount_paise is null or p_amount_paise<=0 or p_currency is distinct from 'INR'
 or p_validity_days is distinct from (case p_plan_id when 'pro_weekly' then 7 when 'pro_monthly' then 30 when 'pro_halfyearly' then 180 when 'pro_yearly' then 365 else 0 end) or p_validity_days<=0
 or p_grant_source is null or p_grant_source not in ('webhook','verify','recover','claim') then raise exception 'PAYMENT_INPUT'; end if;
 -- Lock the user even when there is no entitlement row: different first orders
 -- must serialize too. Missing checkout rows cannot be manufactured here.
 select * into strict u from public.users where uid=p_uid for update;
 select * into o from public.payment_orders where order_id=p_order_id for update;
 if not found then raise exception 'PAYMENT_ORDER_MISSING'; end if;
 if o.uid is distinct from p_uid then raise exception 'OWNERSHIP:%',p_order_id; end if;
 if o.plan_id is distinct from p_plan_id or o.amount_paise is distinct from p_amount_paise or o.currency is distinct from p_currency then raise exception 'PAYMENT_ORDER_MISMATCH'; end if;
 select * into e from public.payment_entitlements where uid=p_uid for update;
 already := o.status='granted';
 ids := coalesce(e.granted_order_ids,'[]'::jsonb);
 if not (ids ? p_order_id) then ids:=ids||jsonb_build_array(p_order_id); end if;
 paid:=coalesce(nullif(p_paid_at,0),o.paid_at,n);
 if already then
  expiry:=greatest(coalesce(o.pro_expires_at,0),coalesce(e.pro_expires_at,0),coalesce(u.pro_expires_at,0));
 else
  expiry:=greatest(n,coalesce(e.pro_expires_at,0),coalesce(u.pro_expires_at,0))+(p_validity_days::bigint*86400000);
 end if;
 insert into public.payment_entitlements(uid,pro_expires_at,pro_plan_id,last_payment_at,last_order_id,granted_order_ids,updated_at,source)
 values(p_uid,expiry,case when already then coalesce(e.pro_plan_id,o.plan_id) else p_plan_id end,
 case when already then coalesce(e.last_payment_at,paid) else paid end,
 case when already then coalesce(e.last_order_id,p_order_id) else p_order_id end,ids,n,case when already then 'ledger-repair' else 'grant' end)
 on conflict(uid) do update set pro_expires_at=excluded.pro_expires_at,pro_plan_id=excluded.pro_plan_id,
 last_payment_at=excluded.last_payment_at,last_order_id=excluded.last_order_id,granted_order_ids=excluded.granted_order_ids,updated_at=n
 returning * into e;
 -- Write the entitlement before firing referral settlement. A self-referred or
 -- rejected reward rolls back everything; no later stale upsert can erase it.
 if not already then
  update public.payment_orders set status='granted',updated_at=n,granted_at=n,paid_at=paid,pro_expires_at=expiry,grant_source=p_grant_source where order_id=p_order_id;
 end if;
 update public.users set pro_expires_at=greatest(coalesce(pro_expires_at,0),e.pro_expires_at),pro_plan_id=e.pro_plan_id,
 last_payment_at=e.last_payment_at,last_order_id=e.last_order_id,max_watchlist_stocks=9999,
 tier=case when tier='admin' then 'admin' else 'pro' end where uid=p_uid;
 return jsonb_build_object('pro_expires_at',e.pro_expires_at,'already_granted',already,
 'entitlement',jsonb_build_object('uid',e.uid,'proExpiresAt',e.pro_expires_at,'proPlanId',e.pro_plan_id,'lastPaymentAt',e.last_payment_at,
 'lastOrderId',e.last_order_id,'grantedOrderIds',e.granted_order_ids,'updatedAt',e.updated_at,'source',e.source));
end $$;

create or replace function public.reconcile_payment_entitlement(p_uid text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare e public.payment_entitlements%rowtype; o public.payment_orders%rowtype;
 n bigint := (extract(epoch from now())*1000)::bigint; expiry bigint; ids jsonb;
begin
 perform 1 from public.users where uid=p_uid for update;
 if not found then return null; end if;
 select * into e from public.payment_entitlements where uid=p_uid for update;
 select * into o from public.payment_orders where uid=p_uid and status='granted' and pro_expires_at>0 order by coalesce(granted_at,updated_at) desc limit 1;
 if e.uid is null and o.order_id is null then return null; end if;
 select greatest(coalesce(e.pro_expires_at,0),coalesce(max(pro_expires_at),0)) into expiry from public.payment_orders where uid=p_uid and status='granted';
 select coalesce(jsonb_agg(distinct id),'[]'::jsonb) into ids from (
 select jsonb_array_elements_text(coalesce(e.granted_order_ids,'[]'::jsonb)) id
 union select order_id from public.payment_orders where uid=p_uid and status='granted') s;
 insert into public.payment_entitlements(uid,pro_expires_at,pro_plan_id,last_payment_at,last_order_id,granted_order_ids,updated_at,source)
 values(p_uid,expiry,coalesce(e.pro_plan_id,o.plan_id),coalesce(e.last_payment_at,o.paid_at,o.granted_at),coalesce(e.last_order_id,o.order_id),ids,n,'ledger-repair')
 on conflict(uid) do update set pro_expires_at=excluded.pro_expires_at,granted_order_ids=excluded.granted_order_ids returning * into e;
 update public.users set pro_expires_at=greatest(coalesce(pro_expires_at,0),e.pro_expires_at),pro_plan_id=e.pro_plan_id,
 last_payment_at=e.last_payment_at,last_order_id=e.last_order_id,tier=case when tier='admin' then 'admin' else 'pro' end,max_watchlist_stocks=9999 where uid=p_uid;
 return jsonb_build_object('uid',e.uid,'proExpiresAt',e.pro_expires_at,'proPlanId',e.pro_plan_id,'lastPaymentAt',e.last_payment_at,
 'lastOrderId',e.last_order_id,'grantedOrderIds',e.granted_order_ids,'updatedAt',e.updated_at,'source',e.source);
end $$;

-- Ordinary read/merge/save callers cannot erase a committed trial or payment.
create or replace function public.preserve_access_state() returns trigger
language plpgsql security invoker set search_path='' as $$
declare e public.payment_entitlements%rowtype;
begin
 new.trial_used:=old.trial_used or new.trial_used;
 new.pro_expires_at:=greatest(coalesce(old.pro_expires_at,0),coalesce(new.pro_expires_at,0));
 select * into e from public.payment_entitlements where uid=new.uid;
 if found then
  new.pro_expires_at:=greatest(new.pro_expires_at,e.pro_expires_at);
  new.pro_plan_id:=e.pro_plan_id;new.last_payment_at:=e.last_payment_at;new.last_order_id:=e.last_order_id;
 end if;
 return new;
end $$;
create trigger preserve_access_state before update on public.users for each row execute function public.preserve_access_state();

-- Production account protection is one transactional command, never memory-first.
create or replace function public.auth_account_command(p_action text,p_key text,p_max_attempts integer,p_window_ms bigint,p_lockout_ms bigint)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r jsonb; n bigint := (extract(epoch from now())*1000)::bigint; attempts integer; locked bigint;
begin
 if p_action not in ('check','fail','reset') or p_max_attempts<1 or p_window_ms<1 or p_lockout_ms<1 then raise exception 'AUTH_LIMIT_INPUT'; end if;
 insert into public.auth_account_limits(id,data) values(p_key,'{}') on conflict(id) do nothing;
 select data into r from public.auth_account_limits where id=p_key for update;
 if p_action='reset' or (coalesce((r->>'lastAttemptAt')::bigint,0)+p_window_ms<n and coalesce((r->>'lockedUntil')::bigint,0)<=n) or (coalesce((r->>'lockedUntil')::bigint,0)>0 and (r->>'lockedUntil')::bigint<=n) then r:='{}'; end if;
 attempts:=coalesce((r->>'failedAttempts')::integer,0);locked:=coalesce((r->>'lockedUntil')::bigint,0);
 if p_action='fail' then
  attempts:=attempts+1;
  if attempts>=p_max_attempts then locked:=greatest(locked,n+p_lockout_ms); end if;
  r:=jsonb_build_object('accountKey',p_key,'failedAttempts',attempts,'lastAttemptAt',n,'lockedUntil',locked,'updatedAt',n);
 end if;
 update public.auth_account_limits set data=r,updated_at=now() where id=p_key;
 return jsonb_build_object('failedAttempts',attempts,'lockedUntil',locked,'remainingLockoutSec',greatest(0,ceil((locked-n)/1000.0)));
end $$;

-- New and old privileged overloads stay inaccessible to browser database roles.
do $$ declare f record; begin
 for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('claim_trial_atomic','record_pending_order_atomic','grant_payment_atomic','reconcile_payment_entitlement','preserve_access_state','auth_account_command') loop
  execute format('revoke all on function %s from public,anon,authenticated',f.sig);
  execute format('grant execute on function %s to service_role',f.sig);
 end loop;
end $$;

create table public.telegram_link_challenges (
 uid text primary key references public.users(uid) on delete cascade,
 nonce_hash text not null unique, expires_at bigint not null, consumed_at bigint
);
create table public.telegram_verified_links (
 uid text primary key references public.users(uid) on delete cascade,
 chat_id text not null unique, verified_at bigint not null
);
alter table public.telegram_link_challenges enable row level security;
alter table public.telegram_verified_links enable row level security;
revoke all on public.telegram_link_challenges,public.telegram_verified_links from public,anon,authenticated;
grant all on public.telegram_link_challenges,public.telegram_verified_links to service_role;

create or replace function public.telegram_link_command(p_action text,p_uid text,p_hash text,p_chat_id text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.telegram_link_challenges%rowtype; l public.telegram_verified_links%rowtype;
 n bigint := (extract(epoch from now())*1000)::bigint;
begin
 if p_action='consume' then
  select * into c from public.telegram_link_challenges where nonce_hash=p_hash;
  if not found then return null; end if;
  p_uid:=c.uid;
 end if;
 -- Stable account lock serializes challenge rotation, consume, unlink and saves.
 perform 1 from public.users where uid=p_uid for update;
 if not found then return null; end if;
 if p_action='start' then
  insert into public.telegram_link_challenges(uid,nonce_hash,expires_at) values(p_uid,p_hash,n+600000)
  on conflict(uid) do update set nonce_hash=excluded.nonce_hash,expires_at=excluded.expires_at,consumed_at=null;
 elsif p_action='consume' then
  select * into c from public.telegram_link_challenges where uid=p_uid and nonce_hash=p_hash for update;
  if not found or c.expires_at<=n or c.consumed_at is not null or p_chat_id !~ '^[1-9][0-9]{0,15}$' then return null; end if;
  -- A Telegram identity already bound to another account is never stolen.
  if exists(select 1 from public.telegram_verified_links where chat_id=p_chat_id and uid<>p_uid) then return null; end if;
  insert into public.telegram_verified_links(uid,chat_id,verified_at) values(p_uid,p_chat_id,n)
  on conflict(uid) do update set chat_id=excluded.chat_id,verified_at=n;
  update public.telegram_link_challenges set consumed_at=n where uid=p_uid;
  update public.users set telegram_chat_id=p_chat_id where uid=p_uid;
 elsif p_action='unlink' then
  delete from public.telegram_verified_links where uid=p_uid;
  delete from public.telegram_link_challenges where uid=p_uid;
  update public.users set telegram_chat_id=null,telegram_username=null where uid=p_uid;
 elsif p_action<>'status' then raise exception 'TELEGRAM_ACTION';
 end if;
 select * into l from public.telegram_verified_links where uid=p_uid;
 return jsonb_build_object('chatId',l.chat_id,'verifiedAt',l.verified_at);
end $$;
revoke all on function public.telegram_link_command(text,text,text,text) from public,anon,authenticated;
grant execute on function public.telegram_link_command(text,text,text,text) to service_role;

-- Do not leave a service-callable obsolete overload or recordless grant claim.
do $$ declare f record; begin
 for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and ((p.proname='grant_payment_atomic' and p.pronargs=5) or p.proname='claim_order_for_grant') loop
  execute format('revoke all on function %s from service_role',f.sig);
 end loop;
end $$;
