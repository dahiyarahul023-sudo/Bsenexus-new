create table if not exists public.impact_radar_company_context (
  reaction_id text primary key references public.impact_radar_reactions(id) on delete restrict,
  scrip_code text not null check (scrip_code ~ '^\d{6}$'),
  captured_at timestamptz not null,
  data jsonb not null check (jsonb_typeof(data) = 'object' and data->'snapshot'->>'scripCode' = scrip_code)
);
alter table public.impact_radar_company_context enable row level security;
revoke all on table public.impact_radar_company_context from public, anon, authenticated;
grant select, insert, update, delete on table public.impact_radar_company_context to service_role;

create or replace function public.save_radar_company_context(p_reaction_id text, p_context jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r public.impact_radar_reactions%rowtype;
  v_scrip text := p_context->'snapshot'->>'scripCode';
  v_captured timestamptz := (p_context->'snapshot'->>'capturedAt')::timestamptz;
  v_quoted timestamptz := (p_context->'snapshot'->>'quotedAt')::timestamptz;
  v_published timestamptz;
  v_cutoff timestamptz;
begin
  select * into r from public.impact_radar_reactions where id = p_reaction_id;
  if not found then
    raise exception 'Reaction missing';
  end if;
  if v_scrip is distinct from r.scrip_code
     or (p_context->'snapshot'->>'currency') is distinct from 'INR'
     or (p_context->'snapshot'->>'sourceUrl') is distinct from ('https://finance.yahoo.com/quote/' || r.scrip_code || '.BO/') then
    raise exception 'Context identity mismatch';
  end if;
  if r.session_date is null then
    raise exception 'Context timing requires session date';
  end if;
  v_published := (r.data->>'publishedAt')::timestamptz;
  v_cutoff := (r.session_date::text || 'T03:45:00Z')::timestamptz;
  if v_captured > v_cutoff
     or v_quoted > v_captured
     or v_captured < v_published - interval '7 days'
     or v_captured - v_quoted > interval '7 days' then
    raise exception 'Context timing out of bounds';
  end if;
  insert into public.impact_radar_company_context (reaction_id, scrip_code, captured_at, data)
  values (p_reaction_id, v_scrip, v_captured, p_context)
  on conflict (reaction_id) do nothing;
end;
$$;

create or replace function public.radar_volatility_patterns(p_as_of timestamptz, p_keys jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if jsonb_typeof(p_keys) is distinct from 'array' or jsonb_array_length(p_keys) > 600 then
    raise exception 'Invalid pattern key batch';
  end if;
  if jsonb_array_length(p_keys) = 0 then
    return '[]'::jsonb;
  end if;

  with requested as (
    select distinct
      k->>'fact' as fact,
      k->>'scope' as scope,
      k->>'sourceKind' as source_kind,
      coalesce(k->>'sizeBand', 'unknown') as size_band,
      coalesce(k->>'exposureBand', 'unknown') as exposure_band
    from jsonb_array_elements(p_keys) k
  ),
  observed as (
    select
      r.id,
      r.event_id,
      r.scrip_code,
      r.session_date,
      r.data->>'fact' as fact,
      r.data->>'scope' as scope,
      r.data->'source'->>'kind' as source_kind,
      coalesce(c.data->>'sizeBand', 'unknown') as size_band,
      coalesce(c.data->>'exposureBand', 'unknown') as exposure_band,
      ((r.data->'observation'->'session'->>'changePercent')::numeric) as change_pct,
      abs(((r.data->'observation'->'session'->>'changePercent')::numeric)) as abs_move,
      case
        when jsonb_typeof(r.data->'observation'->'rangePercent') = 'number'
        then ((r.data->'observation'->>'rangePercent')::numeric)
        else null
      end as range_pct,
      ((r.data->'observation'->>'volatile')::boolean) as is_volatile
    from public.impact_radar_reactions r
    left join public.impact_radar_company_context c
      on c.reaction_id = r.id
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
      o.size_band,
      o.exposure_band,
      o.change_pct,
      o.abs_move,
      o.range_pct,
      o.is_volatile
    from observed o
    join clean_sessions cs
      on cs.scrip_code = o.scrip_code and cs.session_date = o.session_date
    join requested req
      on req.fact = o.fact
     and req.scope = o.scope
     and req.source_kind = o.source_kind
     and req.size_band = o.size_band
     and req.exposure_band = o.exposure_band
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
      d.size_band as "sizeBand",
      d.exposure_band as "exposureBand",
      w.days,
      count(*)::int as samples,
      count(*) filter (where d.is_volatile)::int as volatile,
      count(*) filter (where d.change_pct > 0)::int as up,
      count(*) filter (where d.change_pct < 0)::int as down,
      round((percentile_cont(0.5) within group (order by d.abs_move))::numeric, 4)::float8 as "medianAbsMove",
      case
        when count(d.range_pct) > 0
        then round((percentile_cont(0.5) within group (order by d.range_pct) filter (where d.range_pct is not null))::numeric, 4)::float8
        else null
      end as "medianRange",
      count(d.range_pct)::int as "rangeSamples"
    from windows w
    join deduped d
      on d.session_date >= ((p_as_of at time zone 'Asia/Kolkata')::date - w.days)
    group by d.fact, d.scope, d.source_kind, d.size_band, d.exposure_band, w.days
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'fact', g.fact,
        'scope', g.scope,
        'sourceKind', g."sourceKind",
        'sizeBand', g."sizeBand",
        'exposureBand', g."exposureBand",
        'days', g.days,
        'samples', g.samples,
        'volatile', g.volatile,
        'up', g.up,
        'down', g.down,
        'medianAbsMove', g."medianAbsMove",
        'medianRange', g."medianRange",
        'rangeSamples', g."rangeSamples"
      )
      order by g.fact, g.scope, g."sourceKind", g."sizeBand", g."exposureBand", g.days
    ),
    '[]'::jsonb
  )
  into v_result
  from grouped g;

  return v_result;
end;
$$;

revoke all on function public.save_radar_company_context(text, jsonb), public.radar_volatility_patterns(timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.save_radar_company_context(text, jsonb), public.radar_volatility_patterns(timestamptz, jsonb) to service_role;
