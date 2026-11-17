create table if not exists public.auth_account_limits (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.auth_account_limits enable row level security;
revoke all on table public.auth_account_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.auth_account_limits to service_role;
