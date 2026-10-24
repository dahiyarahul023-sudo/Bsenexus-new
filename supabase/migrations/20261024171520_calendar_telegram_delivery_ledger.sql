-- Automatic calendar Telegram delivery is a separate durable fact from a mutable
-- meeting cache. A duplicate or uncertain attempt is never replayed on restart.
create table public.calendar_telegram_deliveries (
  scrip_code text not null check (scrip_code ~ '^[0-9]{6}$'),
  meeting_day bigint not null check (meeting_day > 0),
  state text not null check (state in ('suppressed', 'reserved', 'sent', 'uncertain')),
  claim_token uuid,
  reserved_at timestamptz not null default now(),
  finished_at timestamptz,
  telegram_message_id bigint,
  primary key (scrip_code, meeting_day)
);
alter table public.calendar_telegram_deliveries enable row level security;
revoke all on public.calendar_telegram_deliveries from public, anon, authenticated;
grant select, insert, update on public.calendar_telegram_deliveries to service_role;
comment on table public.calendar_telegram_deliveries is
  'Server-only global calendar alert claims. Uncertain delivery requires explicit admin review; never auto-retry.';

-- Cut over all already known meetings, not just the few mutable JSON flags that
-- survived older syncs. Historical evidence stays untouched; no messages sent.
with candidates as (
  select scrip_code, case when jsonb_typeof(data->'meetingTimestamp') = 'number'
    then (data->>'meetingTimestamp')::numeric else null end as meeting_timestamp
  from public.results_calendar
)
insert into public.calendar_telegram_deliveries (scrip_code, meeting_day, state, finished_at)
select distinct scrip_code,
  (floor((meeting_timestamp + 19800000) / 86400000) * 86400000 - 19800000)::bigint,
  'suppressed', now()
from candidates
where scrip_code ~ '^[0-9]{6}$'
  and meeting_timestamp between 86400000 and 8640000000000000
on conflict (scrip_code, meeting_day) do nothing;
