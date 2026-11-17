create table if not exists public.faq_quota_days (
  identity_hash text not null check (length(identity_hash) = 64),
  usage_day date not null,
  used integer not null default 0 check (used between 0 and 4),
  primary key (identity_hash, usage_day)
);
create table if not exists public.faq_quota_reservations (
  id uuid primary key,
  identity_hash text not null check (length(identity_hash) = 64),
  usage_day date not null,
  refunded boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists faq_quota_days_usage_day_idx on public.faq_quota_days (usage_day);
create index if not exists faq_quota_reservations_day_idx on public.faq_quota_reservations (usage_day);
alter table public.faq_quota_days enable row level security;
alter table public.faq_quota_reservations enable row level security;
revoke all on table public.faq_quota_days, public.faq_quota_reservations from public, anon, authenticated;
grant select, insert, update, delete on table public.faq_quota_days, public.faq_quota_reservations to service_role;

create or replace function public.manage_faq_quota(
  p_identity_hash text,
  p_action text,
  p_reservation_id uuid default null
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_day date := (pg_catalog.now() at time zone 'Asia/Kolkata')::date;
  v_used integer := 0;
  v_res public.faq_quota_reservations%rowtype;
  v_allowed boolean := true;
begin
  if p_identity_hash is null or pg_catalog.length(p_identity_hash) <> 64 then
    raise exception 'Invalid FAQ identity hash';
  end if;
  if p_action is null or p_action not in ('status', 'reserve', 'refund') then
    raise exception 'Invalid FAQ quota action';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('bsenexus-faq:' || p_identity_hash, 0));

  if p_action = 'refund' then
    if p_reservation_id is null then
      raise exception 'Reservation ID required';
    end if;
    select * into v_res from public.faq_quota_reservations where id = p_reservation_id;
    if found then
      if v_res.identity_hash <> p_identity_hash then
        raise exception 'FAQ reservation owner mismatch';
      end if;
      if not v_res.refunded then
        update public.faq_quota_days
           set used = greatest(0, used - 1)
         where identity_hash = p_identity_hash and usage_day = v_res.usage_day;
        update public.faq_quota_reservations
           set refunded = true
         where id = v_res.id;
      end if;
    end if;
  elsif p_action = 'reserve' then
    if p_reservation_id is null then
      raise exception 'Reservation ID required';
    end if;
    select * into v_res from public.faq_quota_reservations where id = p_reservation_id;
    if found then
      if v_res.identity_hash <> p_identity_hash then
        raise exception 'FAQ reservation owner mismatch';
      end if;
      v_allowed := (not v_res.refunded) and (v_res.usage_day = v_day);
    else
      insert into public.faq_quota_days (identity_hash, usage_day, used)
      values (p_identity_hash, v_day, 0)
      on conflict (identity_hash, usage_day) do nothing;
      select used into v_used
        from public.faq_quota_days
       where identity_hash = p_identity_hash and usage_day = v_day
         for update;
      v_allowed := coalesce(v_used, 0) < 4;
      if v_allowed then
        insert into public.faq_quota_reservations (id, identity_hash, usage_day, refunded)
        values (p_reservation_id, p_identity_hash, v_day, false);
        update public.faq_quota_days
           set used = used + 1
         where identity_hash = p_identity_hash and usage_day = v_day;
      end if;
    end if;
  end if;

  select coalesce(used, 0) into v_used
    from public.faq_quota_days
   where identity_hash = p_identity_hash and usage_day = v_day;
  v_used := coalesce(v_used, 0);
  if p_action = 'status' then
    v_allowed := v_used < 4;
  end if;

  return pg_catalog.jsonb_build_object(
    'allowed', v_allowed,
    'used', v_used,
    'remaining', greatest(0, 4 - v_used),
    'dailyLimit', 4,
    'reservationId', p_reservation_id
  );
end;
$$;

create or replace function public.prune_faq_quota(p_limit integer default 200)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_cutoff date := (pg_catalog.now() at time zone 'Asia/Kolkata')::date - 1;
  v_deleted integer := 0;
begin
  if p_limit is null or p_limit < 1 or p_limit > 1000 then
    raise exception 'Invalid prune limit';
  end if;
  delete from public.faq_quota_reservations
   where id in (
     select id from public.faq_quota_reservations
      where usage_day < v_cutoff
      order by usage_day asc
      limit p_limit
   );

  with deleted as (
    delete from public.faq_quota_days
     where (identity_hash, usage_day) in (
       select identity_hash, usage_day from public.faq_quota_days
        where usage_day < v_cutoff
        order by usage_day asc
        limit p_limit
     )
     returning 1
  )
  select count(*)::integer into v_deleted from deleted;

  return v_deleted;
end;
$$;

revoke all on function public.manage_faq_quota(text, text, uuid) from public, anon, authenticated;
revoke all on function public.prune_faq_quota(integer) from public, anon, authenticated;
grant execute on function public.manage_faq_quota(text, text, uuid) to service_role;
grant execute on function public.prune_faq_quota(integer) to service_role;
