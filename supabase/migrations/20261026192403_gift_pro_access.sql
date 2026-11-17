create table if not exists public.gift_access_invites (
  id uuid primary key,
  owner_uid text not null,
  email text not null,
  token_hash text not null unique check (length(token_hash) = 64),
  validity_days integer not null check (validity_days between 1 and 3650),
  claim_days integer not null check (claim_days between 1 and 30),
  claim_until bigint not null,
  created_at bigint not null,
  activated_at bigint,
  expires_at bigint,
  revoked_at bigint,
  bound_uid text,
  delivery text not null default 'pending' check (delivery in ('pending', 'accepted', 'failed', 'unknown')),
  last_send_at bigint not null default 0,
  last_request_id text,
  note text not null default ''
);
create index if not exists gift_access_invites_bound_idx on public.gift_access_invites (bound_uid, expires_at desc) where revoked_at is null;
create index if not exists gift_access_invites_owner_idx on public.gift_access_invites (owner_uid, created_at desc);

create table if not exists public.gift_access_events (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.gift_access_invites(id) on delete restrict,
  actor text not null,
  action text not null,
  request_id text,
  created_at bigint not null
);
create index if not exists gift_access_events_invite_idx on public.gift_access_events (invite_id, created_at asc);

alter table public.gift_access_invites enable row level security;
alter table public.gift_access_events enable row level security;
revoke all on table public.gift_access_invites, public.gift_access_events from public, anon, authenticated;
grant select, insert, update, delete on table public.gift_access_invites, public.gift_access_events to service_role;
create policy gift_access_invites_service_role on public.gift_access_invites for all to service_role using (true) with check (true);
create policy gift_access_events_service_role on public.gift_access_events for all to service_role using (true) with check (true);

create or replace function public.gift_invite_json(r public.gift_access_invites, include_note boolean, now_ms bigint)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select
    jsonb_build_object(
      'id', r.id,
      'email', r.email,
      'validityDays', r.validity_days,
      'claimUntil', r.claim_until,
      'createdAt', r.created_at,
      'activatedAt', r.activated_at,
      'expiresAt', r.expires_at,
      'status', case
        when r.revoked_at is not null then 'revoked'
        when r.activated_at is not null and r.expires_at <= now_ms then 'expired'
        when r.activated_at is not null then 'activated'
        when r.claim_until <= now_ms then 'expired'
        else 'pending'
      end,
      'delivery', r.delivery
    ) || case when include_note then jsonb_build_object('note', r.note) else '{}'::jsonb end;
$$;

create or replace function public.gift_access_command(p_action text, p_actor text, p_data jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now bigint := (extract(epoch from pg_catalog.now()) * 1000)::bigint;
  v_inv public.gift_access_invites%rowtype;
  v_id uuid;
  v_email text;
  v_hash text;
  v_validity integer;
  v_claim_days integer;
  v_note text;
  v_req text;
  v_offset integer;
  v_items jsonb;
begin
  if p_actor is null or pg_catalog.btrim(p_actor) = '' then
    raise exception 'Actor required';
  end if;

  if p_action = 'create' then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('gift-owner:' || p_actor, 0));
    v_id := (p_data->>'id')::uuid;
    v_email := pg_catalog.lower(pg_catalog.btrim(coalesce(p_data->>'email', '')));
    v_hash := p_data->>'hash';
    v_validity := (p_data->>'validityDays')::integer;
    v_claim_days := coalesce((p_data->>'claimDays')::integer, 7);
    v_note := coalesce(p_data->>'note', '');

    select * into v_inv from public.gift_access_invites where id = v_id for update;
    if found then
      if v_inv.owner_uid <> p_actor
         or v_inv.email <> v_email
         or v_inv.validity_days <> v_validity
         or v_inv.claim_days <> v_claim_days
         or v_inv.note <> v_note then
        raise exception 'gift create conflict';
      end if;
      return pg_catalog.jsonb_build_object(
        'invite', public.gift_invite_json(v_inv, true, v_now),
        'shouldSend', false
      );
    end if;

    if (
      select count(*) from public.gift_access_invites
       where owner_uid = p_actor and created_at > v_now - 86400000
    ) >= 50 then
      return pg_catalog.jsonb_build_object('error', 'daily_limit');
    end if;

    insert into public.gift_access_invites (
      id, owner_uid, email, token_hash, validity_days, claim_days,
      claim_until, created_at, delivery, last_send_at, note
    ) values (
      v_id, p_actor, v_email, v_hash, v_validity, v_claim_days,
      v_now + (v_claim_days::bigint * 86400000), v_now, 'pending', v_now, v_note
    ) returning * into v_inv;

    insert into public.gift_access_events (invite_id, actor, action, request_id, created_at)
    values (v_inv.id, p_actor, 'created', v_id::text, v_now);

    return pg_catalog.jsonb_build_object(
      'invite', public.gift_invite_json(v_inv, true, v_now),
      'shouldSend', true
    );

  elsif p_action = 'preview' then
    v_hash := p_data->>'hash';
    v_email := pg_catalog.lower(pg_catalog.btrim(coalesce(p_data->>'email', '')));
    select * into v_inv from public.gift_access_invites where token_hash = v_hash;
    if not found
       or v_inv.email <> v_email
       or v_inv.revoked_at is not null
       or (v_inv.activated_at is null and v_inv.claim_until <= v_now)
       or (v_inv.activated_at is not null and (v_inv.bound_uid <> p_actor or v_inv.expires_at <= v_now)) then
      return pg_catalog.jsonb_build_object('error', 'unavailable');
    end if;
    return pg_catalog.jsonb_build_object(
      'invite', public.gift_invite_json(v_inv, false, v_now),
      'alreadyActivated', v_inv.activated_at is not null
    );

  elsif p_action = 'claim' then
    v_hash := p_data->>'hash';
    v_email := pg_catalog.lower(pg_catalog.btrim(coalesce(p_data->>'email', '')));
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('gift-token:' || coalesce(v_hash, ''), 0));
    select * into v_inv from public.gift_access_invites where token_hash = v_hash for update;
    if not found
       or v_inv.email <> v_email
       or v_inv.revoked_at is not null then
      return pg_catalog.jsonb_build_object('error', 'unavailable');
    end if;
    if v_inv.activated_at is not null then
      if v_inv.bound_uid <> p_actor or v_inv.expires_at <= v_now then
        return pg_catalog.jsonb_build_object('error', 'unavailable');
      end if;
      return pg_catalog.jsonb_build_object(
        'invite', public.gift_invite_json(v_inv, false, v_now),
        'alreadyActivated', true
      );
    end if;
    if v_inv.claim_until <= v_now then
      return pg_catalog.jsonb_build_object('error', 'unavailable');
    end if;
    update public.gift_access_invites
       set activated_at = v_now,
           expires_at = v_now + (validity_days::bigint * 86400000),
           bound_uid = p_actor
     where id = v_inv.id
     returning * into v_inv;

    insert into public.gift_access_events (invite_id, actor, action, created_at)
    values (v_inv.id, p_actor, 'activated', v_now);

    return pg_catalog.jsonb_build_object(
      'invite', public.gift_invite_json(v_inv, false, v_now),
      'alreadyActivated', false
    );

  elsif p_action = 'resend' then
    v_id := (p_data->>'id')::uuid;
    v_req := p_data->>'requestId';
    v_hash := p_data->>'hash';
    select * into v_inv from public.gift_access_invites where id = v_id for update;
    if not found or v_inv.owner_uid <> p_actor or v_inv.revoked_at is not null or v_inv.activated_at is not null or v_inv.claim_until <= v_now then
      return pg_catalog.jsonb_build_object('error', 'unavailable');
    end if;
    if v_inv.last_request_id = v_req then
      return pg_catalog.jsonb_build_object(
        'invite', public.gift_invite_json(v_inv, true, v_now),
        'shouldSend', false
      );
    end if;
    if v_inv.last_send_at > v_now - 60000 then
      return pg_catalog.jsonb_build_object('error', 'wait');
    end if;
    update public.gift_access_invites
       set token_hash = v_hash,
           delivery = 'pending',
           last_send_at = v_now,
           last_request_id = v_req
     where id = v_inv.id
     returning * into v_inv;

    insert into public.gift_access_events (invite_id, actor, action, request_id, created_at)
    values (v_inv.id, p_actor, 'resent', v_req, v_now);

    return pg_catalog.jsonb_build_object(
      'invite', public.gift_invite_json(v_inv, true, v_now),
      'shouldSend', true
    );

  elsif p_action = 'revoke' then
    v_id := (p_data->>'id')::uuid;
    v_req := p_data->>'requestId';
    select * into v_inv from public.gift_access_invites where id = v_id for update;
    if not found or v_inv.owner_uid <> p_actor then
      return pg_catalog.jsonb_build_object('error', 'unavailable');
    end if;
    if v_inv.revoked_at is not null then
      if v_inv.last_request_id = v_req then
        return pg_catalog.jsonb_build_object('invite', public.gift_invite_json(v_inv, true, v_now));
      end if;
      return pg_catalog.jsonb_build_object('error', 'unavailable');
    end if;
    update public.gift_access_invites
       set revoked_at = v_now,
           last_request_id = v_req
     where id = v_inv.id
     returning * into v_inv;

    insert into public.gift_access_events (invite_id, actor, action, request_id, created_at)
    values (v_inv.id, p_actor, 'revoked', v_req, v_now);

    return pg_catalog.jsonb_build_object('invite', public.gift_invite_json(v_inv, true, v_now));

  elsif p_action = 'delivery' then
    v_id := (p_data->>'id')::uuid;
    v_hash := p_data->>'hash';
    select * into v_inv from public.gift_access_invites where id = v_id for update;
    if not found or v_inv.owner_uid <> p_actor then
      return pg_catalog.jsonb_build_object('error', 'unavailable');
    end if;
    if v_inv.token_hash = v_hash then
      update public.gift_access_invites
         set delivery = coalesce(p_data->>'delivery', 'unknown')
       where id = v_inv.id
       returning * into v_inv;
    end if;
    return pg_catalog.jsonb_build_object('invite', public.gift_invite_json(v_inv, true, v_now));

  elsif p_action = 'list' then
    v_offset := coalesce((p_data->>'offset')::integer, 0);
    select coalesce(pg_catalog.jsonb_agg(public.gift_invite_json(i, true, v_now)), '[]'::jsonb)
      into v_items
      from (
        select * from public.gift_access_invites
         where owner_uid = p_actor
         order by created_at desc
         offset v_offset
         limit 21
      ) i;
    return pg_catalog.jsonb_build_object('items', v_items);

  else
    raise exception 'Unknown gift action: %', p_action;
  end if;
end;
$$;

do $$
declare
  v_def text;
  v_target text := 'exists(select 1 from public.payment_entitlements where uid=p_uid and pro_expires_at>extract(epoch from now())*1000)';
  v_replacement text := 'exists(select 1 from public.payment_entitlements where uid=p_uid and pro_expires_at>extract(epoch from now())*1000) or exists(select 1 from public.gift_access_invites where bound_uid=p_uid and revoked_at is null and expires_at>extract(epoch from now())*1000)';
begin
  if to_regprocedure('public.mutate_ai_account(text,text,text,text,jsonb,uuid)') is not null then
    select pg_get_functiondef('public.mutate_ai_account(text,text,text,text,jsonb,uuid)'::regprocedure) into v_def;
    if position('gift_access_invites' in v_def) = 0 then
      if position(v_target in v_def) = 0 then
        raise exception 'Unexpected mutate_ai_account contract';
      end if;
      execute replace(v_def, v_target, v_replacement);
    end if;
  end if;
end $$;

revoke all on function public.gift_invite_json(public.gift_access_invites, boolean, bigint) from public, anon, authenticated;
revoke all on function public.gift_access_command(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.gift_invite_json(public.gift_access_invites, boolean, bigint) to service_role;
grant execute on function public.gift_access_command(text, text, jsonb) to service_role;
