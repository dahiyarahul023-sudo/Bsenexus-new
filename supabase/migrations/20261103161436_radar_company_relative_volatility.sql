-- Freeze company-size context before the reaction session. Never backfill old incidents with today's market cap.
create table public.impact_radar_company_context (
 reaction_id text primary key references public.impact_radar_reactions(id) on delete restrict,
 scrip_code text not null check(scrip_code ~ '^[0-9]{6}$'), captured_at timestamptz not null,
 data jsonb not null check(jsonb_typeof(data)='object')
);
alter table public.impact_radar_company_context enable row level security;
revoke all on public.impact_radar_company_context from public,anon,authenticated;
grant select,insert on public.impact_radar_company_context to service_role;
create function public.save_radar_company_context(p_reaction_id text,p_data jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare r jsonb; s jsonb; cap double precision; amount double precision; pct double precision; sb text; eb text;
begin
 select data into r from public.impact_radar_reactions where id=p_reaction_id;
 s:=p_data->'snapshot'; cap:=(s->>'marketCapInr')::double precision; amount:=(p_data->>'amountInr')::double precision;
 if r is null or jsonb_typeof(s) is distinct from 'object' or s->>'capturedAt' is null or s->>'quotedAt' is null
  or s->>'scripCode' is distinct from r->>'scripCode' or s->>'currency' is distinct from 'INR'
  or cap is null or not (cap>0 and cap<'Infinity'::double precision)
  or s->>'sourceUrl' is distinct from 'https://finance.yahoo.com/quote/'||(r->>'scripCode')||'.BO/'
  or (s->>'capturedAt')::timestamptz > now()+interval '5 minutes'
  or (s->>'quotedAt')::timestamptz > (s->>'capturedAt')::timestamptz
  or (s->>'quotedAt')::timestamptz < (s->>'capturedAt')::timestamptz-interval '7 days'
  or (s->>'capturedAt')::timestamptz < (r->>'publishedAt')::timestamptz-interval '7 days'
  or r->>'sessionDate' is null or (s->>'capturedAt')::timestamptz > ((r->>'sessionDate')::date+time '09:15') at time zone 'Asia/Kolkata'
  then raise exception 'Company context identity or timing invalid'; end if;
 sb:=case when cap<50000000000 then 'under-5000cr' when cap<200000000000 then '5000-20000cr' else 'over-20000cr' end;
 if amount is not null then
  if not(amount>0 and amount<'Infinity'::double precision) then raise exception 'Invalid amount';end if;
  pct:=amount/cap*100;
 end if;
 eb:=case when pct is null then 'unknown' when pct<0.1 then 'under-0.1pct' when pct<1 then '0.1-1pct' else 'over-1pct' end;
 if p_data->>'sizeBand' is distinct from sb or p_data->>'exposureBand' is distinct from eb
  or (pct is null) is distinct from (p_data->>'amountToCapPercent' is null)
  or abs((p_data->>'amountToCapPercent')::double precision-pct)>0.000000001 then raise exception 'Company-relative bands invalid';end if;
 insert into public.impact_radar_company_context values(p_reaction_id,r->>'scripCode',(s->>'capturedAt')::timestamptz,p_data) on conflict(reaction_id) do nothing;
end; $$;
revoke all on function public.save_radar_company_context(text,jsonb) from public,anon,authenticated;
grant execute on function public.save_radar_company_context(text,jsonb) to service_role;
create function public.radar_volatility_patterns(p_as_of timestamptz,p_keys jsonb) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare answer jsonb;
begin
 if jsonb_typeof(p_keys)<>'array' or jsonb_array_length(p_keys)>600 then raise exception 'Invalid research keys';end if;
 with observed as (
  select r.*,r.data->>'sessionDate' session_day,coalesce(c.data->>'sizeBand','unknown') size_band,coalesce(c.data->>'exposureBand','unknown') exposure_band
  from public.impact_radar_reactions r left join public.impact_radar_company_context c on c.reaction_id=r.id and c.captured_at<=p_as_of
  where r.state='observed' and r.published_at between p_as_of-interval '365 days' and p_as_of
   and ((r.data->>'sessionDate')::date+time '16:30') at time zone 'Asia/Kolkata' <= p_as_of
 ), clean as (
  select * from observed o where not exists(select 1 from observed x where x.scrip_code=o.scrip_code and x.session_day=o.session_day and x.event_id<>o.event_id)
 ), independent as (
  select distinct on(scrip_code,session_day,data->>'fact',data->>'scope',data#>>'{source,kind}') * from clean
  order by scrip_code,session_day,data->>'fact',data->>'scope',data#>>'{source,kind}',published_at,id
 ), stats as (
  select data->>'fact' fact,data->>'scope' scope,data#>>'{source,kind}' source_kind,size_band,exposure_band,w.days,
   count(*)::int samples,count(*) filter(where(data#>>'{observation,volatile}')::boolean)::int volatile,
   count(*) filter(where(data#>>'{observation,session,changePercent}')::double precision>0)::int up,
   count(*) filter(where(data#>>'{observation,session,changePercent}')::double precision<0)::int down,
   percentile_cont(0.5) within group(order by abs((data#>>'{observation,session,changePercent}')::double precision)) median_move,
   percentile_cont(0.5) within group(order by (data#>>'{observation,rangePercent}')::double precision) median_range,
   count(data#>>'{observation,rangePercent}')::int range_samples
  from independent cross join(values(30),(60),(365)) w(days)
  where published_at>=p_as_of-make_interval(days=>w.days) and exists(
   select 1 from jsonb_array_elements(p_keys) k where k->>'fact'=data->>'fact' and k->>'scope'=data->>'scope'
    and k->>'sourceKind'=data#>>'{source,kind}' and k->>'sizeBand'=size_band and k->>'exposureBand'=exposure_band)
  group by data->>'fact',data->>'scope',data#>>'{source,kind}',size_band,exposure_band,w.days
 ) select coalesce(jsonb_agg(jsonb_build_object('fact',fact,'scope',scope,'sourceKind',source_kind,'sizeBand',size_band,'exposureBand',exposure_band,'days',days,'samples',samples,'volatile',volatile,'up',up,'down',down,'medianAbsMove',median_move,'medianRange',median_range,'rangeSamples',range_samples)),'[]') into answer from stats;
 return answer;
end; $$;
revoke all on function public.radar_volatility_patterns(timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.radar_volatility_patterns(timestamptz,jsonb) to service_role;
