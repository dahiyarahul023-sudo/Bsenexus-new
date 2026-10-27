-- Service-only complimentary access. Apply before GIFT_ACCESS_ENABLED=true.
-- Gift rows never touch users/payment_orders/payment_entitlements/referral rewards.
begin;
create table public.gift_access_invites (
 id uuid primary key, email text not null check(email=lower(btrim(email)) and length(email) between 3 and 254),
 validity_days integer not null check(validity_days between 1 and 3650),
 claim_days integer not null check(claim_days between 1 and 30),
 note text not null default '' check(length(note)<=500), created_by text not null,
 created_at bigint not null, claim_until bigint not null, token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
 bound_uid text, activated_at bigint, expires_at bigint, revoked_at bigint,
 last_send_at bigint not null, delivery text not null default 'pending' check(delivery in ('pending','accepted','failed','unknown')),
 check ((bound_uid is null and activated_at is null and expires_at is null) or
        (bound_uid is not null and activated_at is not null and expires_at=activated_at+validity_days::bigint*86400000))
);
create index gift_access_owner_created on public.gift_access_invites(created_by,created_at);
create index gift_access_uid_expiry on public.gift_access_invites(bound_uid,expires_at) where revoked_at is null;
create table public.gift_access_events (
 id uuid primary key, invite_id uuid not null references public.gift_access_invites(id), actor_uid text not null,
 action text not null, created_at bigint not null
);
alter table public.gift_access_invites enable row level security;
alter table public.gift_access_events enable row level security;
revoke all on public.gift_access_invites,public.gift_access_events from public,anon,authenticated;
grant select,insert,update on public.gift_access_invites to service_role;
grant select,insert on public.gift_access_events to service_role;
create policy gift_invites_service on public.gift_access_invites for all to service_role using(true) with check(true);
create policy gift_events_service_read on public.gift_access_events for select to service_role using(true);
create policy gift_events_service_insert on public.gift_access_events for insert to service_role with check(true);

create function public.gift_access_public(i public.gift_access_invites) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',i.id,'email',i.email,'validityDays',i.validity_days,'claimUntil',i.claim_until,
 'createdAt',i.created_at,'activatedAt',i.activated_at,'expiresAt',i.expires_at,'note',i.note,'delivery',i.delivery,
 'status',case when i.revoked_at is not null then 'revoked' when coalesce(i.expires_at,i.claim_until)<=(extract(epoch from now())*1000)::bigint then 'expired' when i.activated_at is not null then 'activated' else 'pending' end)
$$;

create function public.gift_access_command(p_action text,p_actor text,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
 n bigint:=(extract(epoch from clock_timestamp())*1000)::bigint; i public.gift_access_invites%rowtype;
 ident uuid; operation uuid; inserted boolean:=false; days integer; claims integer;
begin
 if nullif(btrim(p_actor),'') is null or p_actor='guest' then raise exception 'Verified actor required'; end if;
 if p_action='list' then
  return jsonb_build_object('items',coalesce((select jsonb_agg(public.gift_access_public(t)) from
    (select * from public.gift_access_invites where created_by=p_actor order by created_at desc,id desc limit 21 offset least(greatest(coalesce((p_data->>'offset')::integer,0),0),10000)) t),'[]'::jsonb));
 end if;
 if p_action='create' then
  ident:=(p_data->>'id')::uuid;days:=(p_data->>'validityDays')::integer;claims:=(p_data->>'claimDays')::integer;
  perform pg_advisory_xact_lock(hashtextextended('gift-owner:'||p_actor,0));
  perform pg_advisory_xact_lock(hashtextextended('gift:'||ident::text,0));
  select * into i from public.gift_access_invites where id=ident for update;
  if found then
   if i.created_by<>p_actor or i.email is distinct from (p_data->>'email') or i.validity_days is distinct from days or i.claim_days is distinct from claims or i.note<>coalesce(p_data->>'note','') then raise exception 'Gift request conflict';end if;
  else
   if (select count(*) from public.gift_access_invites where created_by=p_actor and created_at>n-86400000)>=50 then return jsonb_build_object('error','daily_limit');end if;
   insert into public.gift_access_invites(id,email,validity_days,claim_days,note,created_by,created_at,claim_until,token_hash,last_send_at)
   values(ident,p_data->>'email',days,claims,coalesce(p_data->>'note',''),p_actor,n,n+claims::bigint*86400000,p_data->>'hash',n) returning * into i;
   insert into public.gift_access_events values(ident,ident,p_actor,'created',n);inserted:=true;
  end if;
  return jsonb_build_object('invite',public.gift_access_public(i),'shouldSend',inserted);
 end if;
 if p_action in ('preview','claim') then
  -- Both lookup and identity come from the server's freshly verified Firebase token.
  select * into i from public.gift_access_invites where token_hash=p_data->>'hash' for update;
  n:=(extract(epoch from clock_timestamp())*1000)::bigint;
  if not found or i.revoked_at is not null or i.email is distinct from (p_data->>'email') then return jsonb_build_object('error','unavailable');end if;
  if i.activated_at is not null then
   if i.bound_uid<>p_actor then return jsonb_build_object('error','unavailable');end if;
   return jsonb_build_object('invite',public.gift_access_public(i)-'note'-'delivery','alreadyActivated',true);
  end if;
  if i.claim_until<=n then return jsonb_build_object('error','unavailable');end if;
  if p_action='claim' then
   update public.gift_access_invites set bound_uid=p_actor,activated_at=n,expires_at=n+validity_days::bigint*86400000 where id=i.id returning * into i;
   insert into public.gift_access_events values(gen_random_uuid(),i.id,p_actor,'activated',n);
  end if;
  -- Never disclose internal notes or owner history to a recipient.
  return jsonb_build_object('invite',public.gift_access_public(i)-'note'-'delivery','alreadyActivated',false);
 end if;
 ident:=(p_data->>'id')::uuid;
 select * into i from public.gift_access_invites where id=ident and created_by=p_actor for update;
 n:=(extract(epoch from clock_timestamp())*1000)::bigint;
 if not found then return jsonb_build_object('error','unavailable');end if;
 if p_action='delivery' then
  if i.token_hash=p_data->>'hash' then update public.gift_access_invites set delivery=p_data->>'delivery' where id=ident;end if;
  return jsonb_build_object('ok',true);
 end if;
 operation:=(p_data->>'requestId')::uuid;
 if exists(select 1 from public.gift_access_events where id=operation) then
  if not exists(select 1 from public.gift_access_events where id=operation and invite_id=ident and actor_uid=p_actor and action=p_action) then raise exception 'Gift request conflict';end if;
  return jsonb_build_object('invite',public.gift_access_public(i),'shouldSend',false);
 end if;
 if p_action='resend' then
  if i.activated_at is not null or i.revoked_at is not null or i.claim_until<=n then return jsonb_build_object('error','unavailable');end if;
  if i.last_send_at>n-60000 then return jsonb_build_object('error','wait');end if;
  update public.gift_access_invites set token_hash=p_data->>'hash',delivery='pending',last_send_at=n where id=ident returning * into i;
 elsif p_action='revoke' then
  update public.gift_access_invites set revoked_at=coalesce(revoked_at,n) where id=ident returning * into i;
 else raise exception 'Unknown gift action';end if;
 insert into public.gift_access_events values(operation,ident,p_actor,p_action,n);
 return jsonb_build_object('invite',public.gift_access_public(i),'shouldSend',p_action='resend');
end $$;

-- The account connector's transactional write gate must see gift access as well.
-- Preserve its existing function and body except for the explicit access predicate.
do $connector$
declare definition text; predicate text:=$predicate$active_pro:=profile.tier='admin' or coalesce(profile.pro_expires_at,0)>extract(epoch from now())*1000 or exists(select 1 from public.payment_entitlements where uid=p_uid and pro_expires_at>extract(epoch from now())*1000);$predicate$;
begin
 if to_regprocedure('public.mutate_ai_account(text,text,text,text,jsonb,uuid)') is not null then
  select pg_get_functiondef('public.mutate_ai_account(text,text,text,text,jsonb,uuid)'::regprocedure) into definition;
  -- Fail migration on an unknown contract; never silently omit this gate.
  if position(predicate in definition)=0 then raise exception 'Review current connector Pro gate before gift migration';end if;
  definition:=replace(definition,predicate,replace(predicate,';',' or exists(select 1 from public.gift_access_invites where bound_uid=p_uid and revoked_at is null and expires_at>extract(epoch from now())*1000);'));
  execute definition;
 end if;
end $connector$;
revoke all on function public.gift_access_command(text,text,jsonb),public.gift_access_public(public.gift_access_invites) from public,anon,authenticated;
grant execute on function public.gift_access_command(text,text,jsonb),public.gift_access_public(public.gift_access_invites) to service_role;
notify pgrst,'reload schema';
commit;
