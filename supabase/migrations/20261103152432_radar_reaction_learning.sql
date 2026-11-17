create table if not exists public.impact_radar_reactions (
  id text primary key check (length(id) between 1 and 200),
  event_id text not null references public.impact_radar_events(id) on delete restrict,
  update_id text not null references public.impact_radar_updates(id) on delete restrict,
  scrip_code text not null check (scrip_code ~ '^\d{6}$'),
  symbol text not null check (length(symbol) between 1 and 30),
  session_date date,
  state text not null check (state in ('awaiting-session', 'awaiting-data', 'observed', 'calendar-pending')),
  checked_at timestamptz not null,
  data jsonb not null check (jsonb_typeof(data) = 'object' and data->>'id' = id and data->>'eventId' = event_id and data->>'updateId' = update_id and data->>'scripCode' = scrip_code and data->>'state' = state)
);
create index if not exists impact_radar_reactions_event_idx on public.impact_radar_reactions (event_id);
create index if not exists impact_radar_reactions_checked_idx on public.impact_radar_reactions (checked_at desc, id);

alter table public.impact_radar_reactions enable row level security;
revoke all on table public.impact_radar_reactions from public, anon, authenticated;
grant select, insert, update, delete on table public.impact_radar_reactions to service_role;

create or replace function public.save_radar_reactions(p_rows jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r jsonb;
  u jsonb;
  p jsonb;
  v_state text;
  v_session date;
begin
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) > 80 then
    raise exception 'Invalid radar reaction batch';
  end if;
  for r in select value from jsonb_array_elements(p_rows) loop
    v_state := r->>'state';
    v_session := (r->>'sessionDate')::date;
    select data into u from public.impact_radar_updates where id = r->>'updateId' and event_id = r->>'eventId';
    if not found then
      raise exception 'Source update missing';
    end if;
    if (u->'source'->>'url') is distinct from (r->'source'->>'url')
       or (u->'source'->>'kind') is distinct from (r->'source'->>'kind') then
      raise exception 'Source mismatch';
    end if;
    if v_state = 'observed' then
      select data into p
        from public.impact_price_sessions
       where symbol in (r->>'symbol', r->>'scripCode')
         and session_date = v_session
         and data = (r->'observation'->'session')
       limit 1;
      if not found then
        raise exception 'Observation requires stored official price';
      end if;
    end if;
    insert into public.impact_radar_reactions (
      id, event_id, update_id, scrip_code, symbol, session_date, state, checked_at, data
    ) values (
      r->>'id', r->>'eventId', r->>'updateId', r->>'scripCode', r->>'symbol',
      v_session, v_state, (r->>'checkedAt')::timestamptz, r
    )
    on conflict (id) do update set
      session_date = case when public.impact_radar_reactions.state = 'observed' then public.impact_radar_reactions.session_date else excluded.session_date end,
      state = case when public.impact_radar_reactions.state = 'observed' then public.impact_radar_reactions.state else excluded.state end,
      checked_at = case when public.impact_radar_reactions.state = 'observed' and excluded.state <> 'observed' then public.impact_radar_reactions.checked_at else excluded.checked_at end,
      data = case when public.impact_radar_reactions.state = 'observed' and excluded.state <> 'observed' then public.impact_radar_reactions.data else excluded.data end;
  end loop;
end;
$$;

create or replace function public.radar_reaction_patterns(p_as_of timestamptz default now())
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  with observed as (
    select
      r.event_id,
      r.scrip_code,
      r.session_date,
      r.data->>'fact' as fact,
      r.data->>'scope' as scope,
      r.data->'source'->>'kind' as source_kind,
      ((r.data->'observation'->'session'->>'changePercent')::numeric) as change_pct,
      abs(((r.data->'observation'->'session'->>'changePercent')::numeric)) as abs_move,
      ((r.data->'observation'->>'volatile')::boolean) as is_volatile
    from public.impact_radar_reactions r
    where r.state = 'observed'
      and r.session_date is not null
      and r.session_date <= (p_as_of at time zone 'Asia/Kolkata')::date
  ),
  clean_sessions as (
    select scrip_code, session_date
    from observed
    group by scrip_code, session_date
    having count(distinct event_id) = 1
  ),
  deduped as (
    select distinct on (o.scrip_code, o.session_date, o.fact, o.scope, o.source_kind)
      o.scrip_code,
      o.session_date,
      o.fact,
      o.scope,
      o.source_kind,
      o.change_pct,
      o.abs_move,
      o.is_volatile
    from observed o
    join clean_sessions c
      on c.scrip_code = o.scrip_code and c.session_date = o.session_date
    order by o.scrip_code, o.session_date, o.fact, o.scope, o.source_kind
  ),
  windows(days) as (
    values (30), (60), (365)
  ),
  grouped as (
    select
      d.fact,
      d.scope,
      d.source_kind as "sourceKind",
      w.days,
      count(*)::int as samples,
      count(*) filter (where d.is_volatile)::int as volatile,
      count(*) filter (where d.change_pct > 0)::int as up,
      count(*) filter (where d.change_pct < 0)::int as down,
      round((percentile_cont(0.5) within group (order by d.abs_move))::numeric, 4)::float8 as "medianAbsMove"
    from windows w
    join deduped d
      on d.session_date >= ((p_as_of at time zone 'Asia/Kolkata')::date - w.days)
    group by d.fact, d.scope, d.source_kind, w.days
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'fact', g.fact,
        'scope', g.scope,
        'sourceKind', g."sourceKind",
        'days', g.days,
        'samples', g.samples,
        'volatile', g.volatile,
        'up', g.up,
        'down', g.down,
        'medianAbsMove', g."medianAbsMove"
      )
      order by g.fact, g.scope, g."sourceKind", g.days
    ),
    '[]'::jsonb
  )
  from grouped g;
$$;

revoke all on function public.save_radar_reactions(jsonb), public.radar_reaction_patterns(timestamptz) from public, anon, authenticated;
grant execute on function public.save_radar_reactions(jsonb), public.radar_reaction_patterns(timestamptz) to service_role;
