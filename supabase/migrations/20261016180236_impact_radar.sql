-- Server-only data API. Existing Firebase UID text is authoritative, not auth.uid().
create table public.impact_radar_events (
  id text primary key check (length(id) between 1 and 160),
  status text not null check (status in ('scheduled','active','monitoring','closed')),
  scheduled_date date,
  updated_at timestamptz not null,
  editorial boolean not null default false,
  data jsonb not null check (jsonb_typeof(data) = 'object' and data ?& array['id','status','publishedAt','updatedAt'] and data->>'id' = id and data->>'status' = status)
);
create index impact_radar_open_updated_idx on public.impact_radar_events(updated_at desc, id) where status <> 'closed';
create index impact_radar_schedule_idx on public.impact_radar_events(scheduled_date) where scheduled_date is not null;
create table public.impact_radar_updates (
  id text primary key,
  event_id text not null references public.impact_radar_events(id) on delete restrict,
  published_at timestamptz not null,
  data jsonb not null check (jsonb_typeof(data) = 'object' and data ?& array['id','eventId','publishedAt'] and data->>'eventId' = event_id and data->>'id' = id)
);
create index impact_radar_timeline_idx on public.impact_radar_updates(event_id, published_at desc, id);
create table public.impact_radar_follows (
  user_id text not null check (length(user_id) between 1 and 128),
  event_id text not null references public.impact_radar_events(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key(user_id, event_id)
);
create index impact_radar_follows_event_idx on public.impact_radar_follows(event_id);
create index impact_radar_follows_owner_idx on public.impact_radar_follows(user_id, created_at desc);
alter table public.impact_radar_events enable row level security;
alter table public.impact_radar_updates enable row level security;
alter table public.impact_radar_follows enable row level security;
revoke all on public.impact_radar_events, public.impact_radar_updates, public.impact_radar_follows from public, anon, authenticated;
grant select, insert, update, delete on public.impact_radar_events, public.impact_radar_updates, public.impact_radar_follows to service_role;

-- Atomic case update + append-only evidence. Duplicate intake is safe across instances.
create function public.publish_impact_radar_records(p_records jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare record jsonb; e jsonb; u jsonb; incoming_editorial boolean;
begin
  if jsonb_typeof(p_records) is distinct from 'array' or jsonb_array_length(p_records) > 60 then
    raise exception 'Invalid radar batch';
  end if;
  for record in select value from jsonb_array_elements(p_records) loop
    e := record->'event'; u := record->'update';
    incoming_editorial := coalesce(record->>'origin','editorial') = 'editorial';
    if e->>'id' is null or u->>'id' is null or u->>'eventId' is distinct from e->>'id'
      or e->>'publishedAt' is null or e->>'updatedAt' is null or u->>'publishedAt' is null then
      raise exception 'Invalid radar identity';
    end if;
    if exists(select 1 from public.impact_radar_updates where id=u->>'id') then
      if exists(select 1 from public.impact_radar_updates where id=u->>'id' and (event_id<>e->>'id' or data<>u)) then
        raise exception 'An existing source update is immutable';
      end if;
      continue;
    end if;
    insert into public.impact_radar_events(id,status,scheduled_date,updated_at,editorial,data)
      values(e->>'id', e->>'status', (e->>'scheduledDate')::date, (e->>'updatedAt')::timestamptz, incoming_editorial, e)
    on conflict(id) do update set
      status=case when public.impact_radar_events.editorial and not incoming_editorial then public.impact_radar_events.status else excluded.status end,
      scheduled_date=case when public.impact_radar_events.editorial and not incoming_editorial then public.impact_radar_events.scheduled_date else excluded.scheduled_date end,
      editorial=public.impact_radar_events.editorial or incoming_editorial,
      updated_at=excluded.updated_at,
      data=case when public.impact_radar_events.editorial and not incoming_editorial
        then jsonb_set(public.impact_radar_events.data,'{updatedAt}',excluded.data->'updatedAt')
        else excluded.data end
    where public.impact_radar_events.updated_at < excluded.updated_at;
    insert into public.impact_radar_updates(id,event_id,published_at,data)
      values(u->>'id', e->>'id', (u->>'publishedAt')::timestamptz, u)
    on conflict(id) do nothing;
    if exists(select 1 from public.impact_radar_updates where id=u->>'id' and (event_id<>e->>'id' or data<>u)) then
      raise exception 'An existing source update is immutable';
    end if;
  end loop;
end;
$$;
revoke all on function public.publish_impact_radar_records(jsonb) from public, anon, authenticated;
grant execute on function public.publish_impact_radar_records(jsonb) to service_role;
