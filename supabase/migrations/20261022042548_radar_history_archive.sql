-- Permanent compact index. Evidence may move to verified private files, never expire.
alter table public.impact_radar_events add column first_public_at timestamptz;
update public.impact_radar_events e set first_public_at = least((e.data->>'publishedAt')::timestamptz,
  coalesce((select min(u.published_at) from public.impact_radar_updates u where u.event_id=e.id),(e.data->>'publishedAt')::timestamptz));
alter table public.impact_radar_events alter column first_public_at set not null;
alter table public.impact_radar_events add column search_document tsvector generated always as
 (to_tsvector('simple'::regconfig, coalesce(data->>'title','') || ' ' || coalesce(data->>'information','') || ' ' || coalesce(data->>'authority','') || ' ' || coalesce((data->'companies')::text,''))) stored;
create index impact_radar_history_order on public.impact_radar_events(first_public_at desc,id desc);
create index impact_radar_history_search on public.impact_radar_events using gin(search_document);
create index impact_radar_history_companies on public.impact_radar_events using gin((data->'companies') jsonb_path_ops);
create index impact_radar_timeline_order on public.impact_radar_updates(event_id,published_at desc,id desc);

create function public.radar_first_public_time() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='INSERT' then new.first_public_at := (new.data->>'publishedAt')::timestamptz;
  else new.first_public_at := least(old.first_public_at,new.first_public_at,(new.data->>'publishedAt')::timestamptz); end if;
  return new;
end $$;
create trigger radar_first_public before insert or update on public.impact_radar_events for each row execute function public.radar_first_public_time();

-- Small immutable tombstones survive compaction. Replayed evidence cannot change a case.
create table public.impact_radar_update_keys (
 id text primary key, event_id text not null references public.impact_radar_events(id) on delete restrict,
 published_at timestamptz not null, content_md5 text not null check(content_md5 ~ '^[0-9a-f]{32}$')
);
create index impact_radar_update_keys_event on public.impact_radar_update_keys(event_id,published_at,id);
insert into public.impact_radar_update_keys select id,event_id,published_at,md5(data::text) from public.impact_radar_updates;
create function public.radar_update_identity() returns trigger language plpgsql set search_path='' as $$
begin
  if exists(select 1 from public.impact_radar_update_keys where id=new.id and (event_id<>new.event_id or content_md5<>md5(new.data::text))) then raise exception 'An existing source update is immutable'; end if;
  insert into public.impact_radar_update_keys values(new.id,new.event_id,new.published_at,md5(new.data::text)) on conflict do nothing;
  update public.impact_radar_events set first_public_at=least(first_public_at,new.published_at) where id=new.event_id;
  return new;
end $$;
create trigger radar_update_key before insert on public.impact_radar_updates for each row execute function public.radar_update_identity();

create table public.impact_radar_archives (
 event_id text not null references public.impact_radar_events(id) on delete restrict,
 sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'), object_path text not null,
 event_version timestamptz not null, update_count integer not null check(update_count between 1 and 5000),
 update_digest text not null, compressed_bytes integer not null check(compressed_bytes between 1 and 8388608),
 first_update jsonb not null, primary_verified_at timestamptz not null,
 backup_file_id text, backup_verified_at timestamptz, compacted_at timestamptz,
 primary key(event_id,sha256), unique(object_path)
);
create index impact_radar_archives_latest on public.impact_radar_archives(event_id,primary_verified_at desc);
create unique index impact_radar_one_compacted_archive on public.impact_radar_archives(event_id) where compacted_at is not null;

create table public.impact_market_days (
 session_date date not null, exchange text not null check(exchange in ('NSE','BSE')),
 is_open boolean not null, source_url text not null, primary key(exchange,session_date)
);
create table public.impact_radar_research (
 event_id text primary key references public.impact_radar_events(id) on delete restrict,
 first_public_at timestamptz not null, policy_version integer not null check(policy_version=1),
 checked_at timestamptz not null default now(), data jsonb not null
);
create index impact_radar_research_check on public.impact_radar_research(checked_at,event_id);
create table public.impact_radar_archive_jobs (
 event_id text primary key references public.impact_radar_events(id) on delete restrict,
 lease_token uuid not null,lease_until timestamptz not null
);

do $$ declare t text; begin
 foreach t in array array['impact_radar_update_keys','impact_radar_archives','impact_market_days','impact_radar_research','impact_radar_archive_jobs'] loop
   execute format('alter table public.%I enable row level security',t);
   execute format('revoke all on public.%I from public,anon,authenticated',t);
 end loop;
end $$;
grant select,insert on public.impact_radar_update_keys to service_role;
grant select,insert,update on public.impact_radar_archives,public.impact_market_days,public.impact_radar_research to service_role;
grant select,insert,update on public.impact_radar_archive_jobs to service_role;
-- No browser bucket policies, signed URLs or public file endpoints.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('radar-history','radar-history',false,8388608,array['application/gzip']) on conflict(id) do nothing;
do $$ begin
 if exists(select 1 from storage.buckets where id='radar-history' and (public or file_size_limit is null or file_size_limit>8388608)) then
   raise exception 'Private bounded radar-history bucket required; review existing configuration';
 end if;
end $$;

-- Stable keyset paging; no 200-record feed cap and no OFFSET scan.
create function public.search_radar_history(p_query text default '',p_from date default null,p_to date default null,
 p_before_time timestamptz default null,p_before_id text default null,p_limit integer default 25)
returns table(id text,first_public_at timestamptz,data jsonb) language sql stable security invoker set search_path='' as $$
 select e.id,e.first_public_at,e.data from public.impact_radar_events e
 where length(p_query)<=120 and (p_query='' or e.search_document @@ plainto_tsquery('simple'::regconfig,p_query))
 and (p_from is null or e.first_public_at >= (p_from::timestamp at time zone 'Asia/Kolkata'))
 and (p_to is null or e.first_public_at < ((p_to+1)::timestamp at time zone 'Asia/Kolkata'))
 and (p_before_time is null or (e.first_public_at,e.id)<(p_before_time,p_before_id))
 order by e.first_public_at desc,e.id desc limit least(greatest(p_limit,1),51)
$$;

create function public.radar_archive_snapshot(p_event_id text) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare e public.impact_radar_events; payload jsonb; n integer;
begin
 select * into e from public.impact_radar_events where id=p_event_id;
 if not found then return null; end if;
 select count(*) into n from public.impact_radar_updates where event_id=p_event_id;
 if n>5000 then raise exception 'Archive too large; partition before archiving'; end if;
 select jsonb_build_object('version',1,'event',e.data,'firstPublicAt',e.first_public_at,
 'eventVersion',e.updated_at,'updates',coalesce(jsonb_agg(u.data order by u.published_at,u.id),'[]'::jsonb),
 'updateDigest',md5(coalesce(string_agg(u.id||':'||md5(u.data::text),'|' order by u.id),'')),
 'research',(select r.data from public.impact_radar_research r where r.event_id=p_event_id and r.first_public_at=e.first_public_at)) into payload
 from public.impact_radar_updates u where u.event_id=p_event_id;
 return payload;
end $$;

-- Optional final step, only after BOTH full readbacks/restore checks. Never called on primary-only success.
create function public.compact_radar_archive(p_event_id text,p_sha256 text) returns integer language plpgsql security invoker set search_path='' as $$
declare e public.impact_radar_events; a public.impact_radar_archives; n integer; d text; removed integer;
begin
 select * into e from public.impact_radar_events where id=p_event_id for update;
 select * into a from public.impact_radar_archives where event_id=p_event_id and sha256=p_sha256 for update;
 if e.id is null or a.event_id is null or e.status<>'closed' or e.updated_at >= now()-interval '24 months'
 or e.updated_at<>a.event_version or a.backup_verified_at is null or a.backup_file_id is null then raise exception 'Archive compaction not eligible'; end if;
 if a.compacted_at is not null then return 0; end if;
 select count(*),md5(coalesce(string_agg(id||':'||md5(data::text),'|' order by id),'')) into n,d from public.impact_radar_updates where event_id=p_event_id;
 if n<>a.update_count or d<>a.update_digest then raise exception 'Archive changed; take a new snapshot'; end if;
 delete from public.impact_radar_updates where event_id=p_event_id;
 get diagnostics removed=row_count;
 update public.impact_radar_archives set compacted_at=now() where event_id=p_event_id and sha256=p_sha256;
 return removed;
end $$;
-- Needed only by the guarded compaction RPC; no browser roles receive delete rights.
grant delete on public.impact_radar_updates to service_role;
revoke all on function public.radar_first_public_time(),public.radar_update_identity(),public.search_radar_history(text,date,date,timestamptz,text,integer),public.radar_archive_snapshot(text),public.compact_radar_archive(text,text) from public,anon,authenticated;
grant execute on function public.search_radar_history(text,date,date,timestamptz,text,integer),public.radar_archive_snapshot(text),public.compact_radar_archive(text,text) to service_role;

create function public.radar_research_candidates() returns table(data jsonb,first_public_at timestamptz)
language sql stable security invoker set search_path='' as $$
 select e.data,e.first_public_at from public.impact_radar_events e left join public.impact_radar_research r on r.event_id=e.id
 where r.checked_at is null or r.checked_at<now()-interval '24 hours' or r.first_public_at<>e.first_public_at
 order by r.checked_at asc nulls first,e.first_public_at desc,e.id desc limit 4
$$;
revoke all on function public.radar_research_candidates() from public,anon,authenticated;
grant execute on function public.radar_research_candidates() to service_role;
create function public.radar_archive_candidates() returns table(id text) language sql stable security invoker set search_path='' as $$
 select e.id from public.impact_radar_events e left join lateral
 (select max(a.primary_verified_at) verified from public.impact_radar_archives a where a.event_id=e.id) latest on true
 where e.status='closed' and e.updated_at<now()-interval '24 months'
 and (latest.verified is null or latest.verified<now()-interval '24 hours')
 and not exists(select 1 from public.impact_radar_archives a where a.event_id=e.id and a.compacted_at is not null)
 order by latest.verified asc nulls first,e.updated_at,e.id limit 2
$$;
revoke all on function public.radar_archive_candidates() from public,anon,authenticated;
grant execute on function public.radar_archive_candidates() to service_role;

create function public.claim_radar_archive(p_event_id text,p_token uuid) returns boolean language plpgsql security invoker set search_path='' as $$
declare claimed text;begin
 insert into public.impact_radar_archive_jobs values(p_event_id,p_token,now()+interval '10 minutes')
 on conflict(event_id) do update set lease_token=excluded.lease_token,lease_until=excluded.lease_until
 where public.impact_radar_archive_jobs.lease_until<=now() returning event_id into claimed;
 return claimed is not null;
end $$;
create function public.release_radar_archive(p_event_id text,p_token uuid) returns void language sql security invoker set search_path='' as $$
 update public.impact_radar_archive_jobs set lease_until=now() where event_id=p_event_id and lease_token=p_token
$$;
create function public.radar_storage_usage() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('databaseBytes',pg_database_size(current_database()),
 'radarDatabaseBytes',(select sum(pg_total_relation_size(c.oid)) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname like 'impact_%'),
 'allStorageBytes',(select coalesce(sum(case when metadata->>'size' ~ '^[0-9]{1,18}$' then (metadata->>'size')::bigint else 0 end),0) from storage.objects),
 'unknownStorageSizes',(select count(*) from storage.objects where metadata->>'size' is null or metadata->>'size' !~ '^[0-9]{1,18}$'),
 'archiveFiles',(select count(*) from public.impact_radar_archives),
 'cases',(select count(*) from public.impact_radar_events),
 'updates',(select count(*) from public.impact_radar_update_keys))
$$;
revoke all on function public.claim_radar_archive(text,uuid),public.release_radar_archive(text,uuid),public.radar_storage_usage() from public,anon,authenticated;
grant execute on function public.claim_radar_archive(text,uuid),public.release_radar_archive(text,uuid),public.radar_storage_usage() to service_role;

-- Preserve the publishing function and its editorial/monotonic safeguards; consult permanent keys
-- before touching event facts, even when that source body has moved into an archive.
do $$ declare definition text; begin
 select pg_get_functiondef('public.publish_impact_radar_records(jsonb)'::regprocedure) into definition;
 definition := replace(definition,
  'if exists(select 1 from public.impact_radar_updates where id=u->>''id'') then',
  'if exists(select 1 from public.impact_radar_update_keys where id=u->>''id'') then');
 definition := replace(definition,
  'if exists(select 1 from public.impact_radar_updates where id=u->>''id'' and (event_id<>e->>''id'' or data<>u)) then',
  'if exists(select 1 from public.impact_radar_update_keys where id=u->>''id'' and (event_id<>e->>''id'' or content_md5<>md5(u::text))) then');
 execute definition;
end $$;
