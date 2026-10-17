-- Forward-only correction; do not rewrite the already applied Radar migration.
create table public.impact_categories (
  id text primary key check (id ~ '^[a-z][a-z0-9_-]{0,63}$'),
  label text not null check (length(label) between 1 and 100),
  sort_order integer not null,
  active boolean not null default true
);
alter table public.impact_categories enable row level security;
revoke all on public.impact_categories from public, anon, authenticated;
grant select, insert, update, delete on public.impact_categories to service_role;
insert into public.impact_categories(id,label,sort_order) values
  ('restriction','Business restrictions',10), ('rules','Rules & business model',20),
  ('liability','Financial liabilities',30), ('governance','Governance & enforcement',40),
  ('deals','Deals & insolvency',50), ('operations','Licences & operations',60),
  ('legal','Legal & regulatory matters',70);

-- Preserve reviewed facts, immutable evidence and monotonic timestamps, including older payloads.
create or replace function public.publish_impact_radar_records(p_records jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare record jsonb; e jsonb; u jsonb; incoming_editorial boolean; incoming_fact_time timestamptz; effective_time timestamptz;
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
    incoming_fact_time := (e->>'updatedAt')::timestamptz;
    effective_time := greatest(incoming_fact_time, (u->>'publishedAt')::timestamptz,
      (select max(published_at) from public.impact_radar_updates where event_id=e->>'id'));
    if effective_time > incoming_fact_time then
      e := jsonb_set(e,'{updatedAt}',to_jsonb(to_char(effective_time at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
    end if;
    insert into public.impact_radar_events(id,status,scheduled_date,updated_at,editorial,data)
      values(e->>'id', e->>'status', (e->>'scheduledDate')::date, (e->>'updatedAt')::timestamptz, incoming_editorial, e)
    on conflict(id) do update set
      status=case when (public.impact_radar_events.editorial and not incoming_editorial) or public.impact_radar_events.updated_at > incoming_fact_time then public.impact_radar_events.status else excluded.status end,
      scheduled_date=case when (public.impact_radar_events.editorial and not incoming_editorial) or public.impact_radar_events.updated_at > incoming_fact_time then public.impact_radar_events.scheduled_date else excluded.scheduled_date end,
      editorial=public.impact_radar_events.editorial or incoming_editorial,
      updated_at=greatest(public.impact_radar_events.updated_at,excluded.updated_at),
      data=jsonb_set(
        case when (public.impact_radar_events.editorial and not incoming_editorial) or public.impact_radar_events.updated_at > incoming_fact_time
          then public.impact_radar_events.data else excluded.data end,
        '{updatedAt}',case when public.impact_radar_events.updated_at >= excluded.updated_at
          then public.impact_radar_events.data->'updatedAt' else excluded.data->'updatedAt' end)
    where public.impact_radar_events.updated_at <= excluded.updated_at;
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
