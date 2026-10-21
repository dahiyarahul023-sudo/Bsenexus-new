-- Public URL delivery metadata only. No account data or credentials.
create table if not exists public.indexnow_urls (
  url text primary key check (url ~ '^https://bsenexus[.]in/' and length(url) <= 2048),
  content_version text not null check (content_version ~ '^[a-f0-9]{64}$'),
  pending boolean not null default true,
  changed_at timestamptz not null default now(),
  next_attempt_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  attempts integer not null default 0 check (attempts between 0 and 2),
  claim_token uuid,
  claim_version text,
  last_status integer
);
alter table public.indexnow_urls enable row level security;
revoke all on public.indexnow_urls from public, anon, authenticated;
grant select, insert, update, delete on public.indexnow_urls to service_role;
create index if not exists indexnow_urls_due on public.indexnow_urls(next_attempt_at, url) where pending;

create or replace function public.indexnow_enqueue(p_pages jsonb)
returns integer language plpgsql security invoker set search_path = '' as $$
declare count_changed integer;
begin
  if pg_catalog.jsonb_typeof(p_pages) <> 'array' or pg_catalog.jsonb_array_length(p_pages) > 10000 then
    raise exception 'Invalid IndexNow batch';
  end if;
  insert into public.indexnow_urls as current (url, content_version)
  select distinct on (item->>'url') item->>'url', item->>'version'
  from pg_catalog.jsonb_array_elements(p_pages) as item
  where item->>'url' ~ '^https://bsenexus[.]in/[^?#]*$' and length(item->>'url') <= 2048
    and item->>'version' ~ '^[a-f0-9]{64}$'
  on conflict (url) do update set
    content_version = excluded.content_version, pending = true, changed_at = now(), attempts = 0,
    next_attempt_at = greatest(now(), coalesce(current.last_attempt_at + interval '24 hours', now()))
  where current.content_version is distinct from excluded.content_version;
  get diagnostics count_changed = row_count;
  return count_changed;
end $$;

create or replace function public.indexnow_claim(p_limit integer default 10000)
returns table(url text, token uuid, version text) language sql security invoker set search_path = '' as $$
  with due as (
    select q.url from public.indexnow_urls q
    where q.pending and q.attempts < 2 and q.next_attempt_at <= now()
    order by q.next_attempt_at, q.url limit greatest(1, least(p_limit,10000)) for update skip locked
  )
  update public.indexnow_urls q set
    last_attempt_at = now(), next_attempt_at = now() + interval '24 hours',
    attempts = q.attempts + 1, pending = q.attempts = 0,
    claim_token = gen_random_uuid(), claim_version = q.content_version
  from due where q.url = due.url
  returning q.url, q.claim_token, q.claim_version;
$$;

create or replace function public.indexnow_complete(p_claims jsonb, p_status integer)
returns integer language plpgsql security invoker set search_path = '' as $$
declare count_changed integer;
begin
  if pg_catalog.jsonb_typeof(p_claims) <> 'array' or pg_catalog.jsonb_array_length(p_claims) > 10000 then
    raise exception 'Invalid IndexNow receipts';
  end if;
  update public.indexnow_urls q set
    last_status = p_status,
    pending = q.content_version is distinct from q.claim_version or (p_status not in (200,202) and q.attempts < 2),
    claim_token = null
  from pg_catalog.jsonb_array_elements(p_claims) item
  where q.url = item->>'url' and q.claim_token::text = item->>'token';
  get diagnostics count_changed = row_count;
  return count_changed;
end $$;

revoke all on function public.indexnow_enqueue(jsonb), public.indexnow_claim(integer), public.indexnow_complete(jsonb, integer) from public, anon, authenticated;
grant execute on function public.indexnow_enqueue(jsonb), public.indexnow_claim(integer), public.indexnow_complete(jsonb, integer) to service_role;
