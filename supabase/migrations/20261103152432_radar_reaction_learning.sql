-- Source-bound observations, not a prediction model. Prices and original evidence remain separate.
create table public.impact_radar_reactions (
 id text primary key, event_id text not null references public.impact_radar_events(id) on delete restrict,
 update_id text not null references public.impact_radar_updates(id) on delete restrict,
 scrip_code text not null check(scrip_code ~ '^[0-9]{6}$'), published_at timestamptz not null,
 checked_at timestamptz not null, state text not null check(state in ('observed','awaiting-session','awaiting-data','calendar-pending')),
 data jsonb not null check(jsonb_typeof(data)='object' and data->>'id'=id and data->>'eventId'=event_id and data->>'updateId'=update_id and data->>'scripCode'=scrip_code and data->>'state'=state and data->>'version'='1'),
 unique(update_id,scrip_code)
);
create index impact_reactions_history_idx on public.impact_radar_reactions(published_at desc,id);
create index impact_reactions_event_idx on public.impact_radar_reactions(event_id,published_at desc);
create index impact_reactions_pending_idx on public.impact_radar_reactions(checked_at,id) where state<>'observed';
create table public.impact_radar_reaction_progress (id text primary key check(id='history'), cursor_id text not null, checked_at timestamptz not null);
alter table public.impact_radar_reactions enable row level security;
alter table public.impact_radar_reaction_progress enable row level security;
revoke all on public.impact_radar_reactions,public.impact_radar_reaction_progress from public,anon,authenticated;
grant select,insert,update on public.impact_radar_reactions,public.impact_radar_reaction_progress to service_role;
create function public.save_radar_reactions(p_rows jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare r jsonb; u jsonb;
begin
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>120 then raise exception 'Invalid reaction batch'; end if;
 for r in select value from jsonb_array_elements(p_rows) loop
  select data into u from public.impact_radar_updates where id=r->>'updateId' and event_id=r->>'eventId';
  if u is null or u->'source' is distinct from r->'source' or (u->>'publishedAt')::timestamptz is distinct from (r->>'publishedAt')::timestamptz
   or r->>'id' is distinct from (r->>'updateId')||':'||(r->>'scripCode')
   or (r->>'checkedAt')::timestamptz > now()+interval '5 minutes'
   or (r->>'publishedAt')::timestamptz > (r->>'checkedAt')::timestamptz
   or not exists(select 1 from public.impact_radar_events e cross join lateral jsonb_array_elements(e.data->'companies') c where e.id=r->>'eventId' and c->>'scripCode'=r->>'scripCode')
   then raise exception 'Reaction source or company mismatch'; end if;
  if r->>'state'='observed' and not exists(select 1 from public.impact_price_sessions p where p.symbol=r#>>'{observation,session,symbol}' and p.session_date=(r->>'sessionDate')::date and p.data=r#>'{observation,session}') then raise exception 'Reaction needs a stored official price'; end if;
  insert into public.impact_radar_reactions(id,event_id,update_id,scrip_code,published_at,checked_at,state,data)
   values(r->>'id',r->>'eventId',r->>'updateId',r->>'scripCode',(r->>'publishedAt')::timestamptz,(r->>'checkedAt')::timestamptz,r->>'state',r)
   on conflict(id) do update set checked_at=excluded.checked_at,state=excluded.state,data=excluded.data
   where public.impact_radar_reactions.checked_at<excluded.checked_at
    and public.impact_radar_reactions.state<>'observed';
 end loop;
end; $$;
revoke all on function public.save_radar_reactions(jsonb) from public,anon,authenticated;
grant execute on function public.save_radar_reactions(jsonb) to service_role;
-- One independent security/session per feature/source type. Overlapping different proceedings are excluded.
create function public.radar_reaction_patterns(p_as_of timestamptz) returns jsonb language sql stable security invoker set search_path='' as $$
 with observed as (
  select *,data->>'sessionDate' session_day from public.impact_radar_reactions
  where state='observed' and published_at between p_as_of-interval '365 days' and p_as_of
   and (data->>'sessionDate')::date <= (p_as_of at time zone 'Asia/Kolkata')::date
   and published_at < (data->>'sessionDate')::date+time '09:15' at time zone 'Asia/Kolkata'
 ), clean as (
  select * from observed o where not exists(select 1 from observed x where x.scrip_code=o.scrip_code and x.session_day=o.session_day and x.event_id<>o.event_id)
 ), independent as (
  select distinct on(scrip_code,session_day,data->>'fact',data->>'scope',data#>>'{source,kind}') * from clean
  order by scrip_code,session_day,data->>'fact',data->>'scope',data#>>'{source,kind}',published_at,id
 ), stats as (
 select data->>'fact' fact,data->>'scope' scope,data#>>'{source,kind}' source_kind,w.days,count(*)::int samples,
  count(*) filter(where (data#>>'{observation,volatile}')::boolean)::int volatile,
  count(*) filter(where (data#>>'{observation,session,changePercent}')::numeric>0)::int up,
  count(*) filter(where (data#>>'{observation,session,changePercent}')::numeric<0)::int down,
  percentile_cont(0.5) within group(order by abs((data#>>'{observation,session,changePercent}')::double precision)) median_abs_move
 from independent cross join (values(30),(60),(365)) w(days)
 where published_at>=p_as_of-make_interval(days=>w.days)
 group by data->>'fact',data->>'scope',data#>>'{source,kind}',w.days
 ) select coalesce(jsonb_agg(jsonb_build_object('fact',fact,'scope',scope,'sourceKind',source_kind,'days',days,'samples',samples,'volatile',volatile,'up',up,'down',down,'medianAbsMove',median_abs_move)),'[]'::jsonb) from stats;
$$;
revoke all on function public.radar_reaction_patterns(timestamptz) from public,anon,authenticated;
grant execute on function public.radar_reaction_patterns(timestamptz) to service_role;
