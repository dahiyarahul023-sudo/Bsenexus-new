-- Small server-only check history shared by every hosting instance.
create table if not exists public.impact_radar_source_checks (
  checked_at timestamptz primary key,
  available boolean not null,
  news_available boolean not null
);
alter table public.impact_radar_source_checks enable row level security;
revoke all on table public.impact_radar_source_checks from public, anon, authenticated;
grant select, insert, update, delete on table public.impact_radar_source_checks to service_role;
