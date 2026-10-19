-- Private, durable company/period generation and per-chat delivery claims.
create table if not exists public.telegram_result_state (
  state_key text primary key check (length(state_key) between 10 and 240),
  kind text not null check (kind in ('summary','delivery')),
  status text not null check (status in ('processing','ready','sent','failed','uncertain','suppressed')),
  source_news_id text not null,
  claim_token uuid not null,
  lease_until timestamptz not null,
  attempts integer not null default 1 check (attempts between 1 and 2),
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.telegram_result_state enable row level security;
revoke all on public.telegram_result_state from public, anon, authenticated;
grant select, insert, update on public.telegram_result_state to service_role;

create or replace function public.claim_telegram_result(p_key text, p_kind text, p_source text, p_token uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare claimed public.telegram_result_state; acquired boolean;
begin
  if p_kind not in ('summary','delivery') or p_source is null or length(p_source) not between 1 and 200 then
    raise exception 'Invalid result claim';
  end if;
  insert into public.telegram_result_state(state_key,kind,status,source_news_id,claim_token,lease_until)
  values(p_key,p_kind,'processing',p_source,p_token,now()+interval '3 minutes')
  on conflict(state_key) do update set
    status='processing', source_news_id=p_source, claim_token=p_token,
    lease_until=now()+interval '3 minutes', attempts=telegram_result_state.attempts+1, updated_at=now()
  where telegram_result_state.kind=p_kind and telegram_result_state.attempts<2 and (
    (telegram_result_state.status='failed' and telegram_result_state.source_news_id<>p_source)
    or (p_kind='summary' and telegram_result_state.status='processing' and telegram_result_state.lease_until<now())
  ) returning * into claimed;
  acquired := found;
  if not acquired then select * into claimed from public.telegram_result_state where state_key=p_key; end if;
  return jsonb_build_object('acquired',acquired,'row',to_jsonb(claimed));
end; $$;

create or replace function public.finish_telegram_result(p_key text,p_token uuid,p_status text,p_value jsonb default '{}'::jsonb)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  if p_status not in ('ready','sent','failed','uncertain','suppressed') or octet_length(p_value::text)>30000 then
    raise exception 'Invalid result completion';
  end if;
  update public.telegram_result_state set status=p_status,value=p_value,updated_at=now()
  where state_key=p_key and claim_token=p_token and status='processing'
    and ((kind='summary' and p_status in ('ready','failed'))
      or (kind='delivery' and p_status in ('sent','failed','uncertain','suppressed')));
  return found;
end; $$;
revoke all on function public.claim_telegram_result(text,text,text,uuid) from public, anon, authenticated;
revoke all on function public.finish_telegram_result(text,uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.claim_telegram_result(text,text,text,uuid) to service_role;
grant execute on function public.finish_telegram_result(text,uuid,text,jsonb) to service_role;

-- Keep acceptance timestamps beyond a container restart. No message text,
-- recipient identity, bot credentials or documents are retained here.
create table if not exists public.filing_delivery_timings (
  news_id text not null,
  telegram_message_id bigint not null,
  source text not null,
  exchange_at bigint,
  observed_at bigint,
  processed_at bigint not null,
  accepted_at bigint not null,
  primary key(news_id,telegram_message_id)
);
create index if not exists filing_delivery_timings_recent on public.filing_delivery_timings(accepted_at desc);
alter table public.filing_delivery_timings enable row level security;
revoke all on public.filing_delivery_timings from public,anon,authenticated;
grant select,insert on public.filing_delivery_timings to service_role;

-- Incident cutover: screenshots confirm this result already reached the admin
-- chat before this policy. Suppress replay without inventing a sent receipt.
insert into public.telegram_result_state(state_key,kind,status,source_news_id,claim_token,lease_until,value)
select 'results:532477:2026-09-30:delivery:' || encode(sha256(convert_to(trim(value->>'chatId'),'UTF8')),'hex'),
 'delivery','suppressed','incident-20261019-unionbank',
 '00000000-0000-0000-0000-000000000001'::uuid, now(),
 '{"reason":"pre-policy admin summary confirmed by user screenshots"}'::jsonb
from public.settings where key='global' and coalesce(trim(value->>'chatId'),'')<>''
on conflict do nothing;
