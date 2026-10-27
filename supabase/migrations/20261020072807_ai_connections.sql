-- All OAuth records and quota operations are server-only. No frontend Supabase key can use them.
create table if not exists public.ai_connection_clients (
 id text primary key, metadata jsonb not null, created_at timestamptz not null default now()
);
create table if not exists public.ai_connection_grants (
 id uuid primary key default gen_random_uuid(), uid text not null references public.users(uid) on delete cascade,
 client_id text not null references public.ai_connection_clients(id), scopes text[] not null,
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '30 days', revoked_at timestamptz,
 constraint ai_grant_scopes check (scopes <@ array['market:read','account:read','watchlists:read','watchlists:write','profile:write','notes:read','notes:write','alerts:read','alerts:write','analysis:generate'])
);
create index if not exists ai_grants_uid on public.ai_connection_grants(uid);
create table if not exists public.ai_connection_requests (
 hash text primary key check(length(hash)=64), client_id text not null references public.ai_connection_clients(id),
 params jsonb not null, expires_at timestamptz not null default now()+interval '10 minutes', used_at timestamptz
);
create table if not exists public.ai_connection_secrets (
 hash text primary key check(length(hash)=64), grant_id uuid not null references public.ai_connection_grants(id) on delete cascade,
 kind text not null check(kind in ('code','access','refresh')), expires_at timestamptz not null,
 used_at timestamptz, redirect_uri text, challenge text, resource text not null
);
create index if not exists ai_secrets_grant on public.ai_connection_secrets(grant_id);
create table if not exists public.ai_connection_usage (
 uid text not null references public.users(uid) on delete cascade, bucket text not null, reads integer not null default 0,
 writes integer not null default 0, primary key(uid,bucket)
);
create table if not exists public.ai_connection_operations (
 uid text not null references public.users(uid) on delete cascade, request_id text not null,
 fingerprint text not null, tool text not null, result jsonb, created_at timestamptz not null default now(),
 primary key(uid,request_id)
);
-- Compare-and-swap is shared with ordinary website watchlist writers to prevent stale overwrites.
alter table public.user_watchlists add column if not exists revision bigint not null default 0;
create or replace function public.bump_watchlist_revision() returns trigger language plpgsql set search_path='' as $$
begin new.revision:=old.revision+1; return new; end; $$;
drop trigger if exists watchlist_revision_guard on public.user_watchlists;
create trigger watchlist_revision_guard before update on public.user_watchlists for each row execute function public.bump_watchlist_revision();

create or replace function public.approve_ai_connection(p_hash text,p_uid text,p_scopes text[],p_code_hash text,p_resource text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.ai_connection_requests; g uuid; requested text[];
begin
 select * into r from public.ai_connection_requests where hash=p_hash and used_at is null and expires_at>now() for update;
 if not found then return jsonb_build_object('error','request_expired'); end if;
 select array_agg(value) into requested from jsonb_array_elements_text(r.params->'scopes');
 if not p_scopes <@ coalesce(requested,'{}'::text[]) or not 'account:read'=any(p_scopes) then return jsonb_build_object('error','invalid_scope'); end if;
 perform 1 from public.users where uid=p_uid for update;
 if not found then return jsonb_build_object('error','account_missing'); end if;
 if (select count(*) from public.ai_connection_grants where uid=p_uid and revoked_at is null and expires_at>now())>=10 then return jsonb_build_object('error','connection_limit'); end if;
 insert into public.ai_connection_grants(uid,client_id,scopes) values(p_uid,r.client_id,p_scopes) returning id into g;
 insert into public.ai_connection_secrets(hash,grant_id,kind,expires_at,redirect_uri,challenge,resource)
 values(p_code_hash,g,'code',now()+interval '2 minutes',r.params->>'redirectUri',r.params->>'codeChallenge',p_resource);
 update public.ai_connection_requests set used_at=now() where hash=p_hash;
 return jsonb_build_object('grantId',g,'redirectUri',r.params->>'redirectUri','state',r.params->>'state');
end; $$;

create or replace function public.exchange_ai_connection(p_hash text,p_client text,p_kind text,p_redirect text,p_resource text,p_access text,p_refresh text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.ai_connection_secrets; g public.ai_connection_grants;
begin
 select * into s from public.ai_connection_secrets where hash=p_hash for update;
 if not found or s.kind<>p_kind or s.expires_at<=now() then return jsonb_build_object('error','invalid_grant'); end if;
 select * into g from public.ai_connection_grants where id=s.grant_id for update;
 if g.client_id<>p_client or g.revoked_at is not null or g.expires_at<=now() or s.resource<>p_resource then return jsonb_build_object('error','invalid_grant'); end if;
 if s.used_at is not null then
   if p_kind='refresh' then update public.ai_connection_grants set revoked_at=now() where id=g.id; end if;
   return jsonb_build_object('error','invalid_grant');
 end if;
 if p_kind='code' and (p_redirect is null or s.redirect_uri<>p_redirect) then return jsonb_build_object('error','invalid_grant'); end if;
 update public.ai_connection_secrets set used_at=now() where hash=p_hash;
 insert into public.ai_connection_secrets(hash,grant_id,kind,expires_at,resource) values
 (p_access,g.id,'access',least(g.expires_at,now()+interval '15 minutes'),p_resource),
 (p_refresh,g.id,'refresh',g.expires_at,p_resource);
 return jsonb_build_object('uid',g.uid,'scopes',g.scopes,'expiresIn',900);
end; $$;

-- Quotas cover ALL connections of an account. Serialisation and receipts are durable across instances.
create or replace function public.reserve_ai_connection(p_uid text,p_write boolean,p_daily integer,p_minute integer,p_write_limit integer,p_request text default null,p_fingerprint text default null,p_tool text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare d text:=to_char(now() at time zone 'Asia/Kolkata','YYYY-MM-DD'); m text:=to_char(now() at time zone 'UTC','YYYY-MM-DD HH24:MI'); u public.ai_connection_usage; n public.ai_connection_usage; op public.ai_connection_operations;
begin
 perform pg_advisory_xact_lock(hashtextextended('ai-account:'||p_uid,0));
 if p_request is not null then
   select * into op from public.ai_connection_operations where uid=p_uid and request_id=p_request;
   if found then
     if op.fingerprint<>p_fingerprint or op.tool<>p_tool then return jsonb_build_object('error','idempotency_conflict'); end if;
     if op.result is null then return jsonb_build_object('error','operation_pending'); end if;
     return jsonb_build_object('replay',true,'result',op.result);
   end if;
 end if;
 if p_tool='filing_summary' and exists(select 1 from public.ai_connection_operations where uid=p_uid and tool='filing_summary' and result is null and created_at>now()-interval '5 minutes') then return jsonb_build_object('error','analysis_busy'); end if;
 insert into public.ai_connection_usage(uid,bucket) values(p_uid,d),(p_uid,m) on conflict do nothing;
 select * into u from public.ai_connection_usage where uid=p_uid and bucket=d;
 select * into n from public.ai_connection_usage where uid=p_uid and bucket=m;
 if u.reads+u.writes>=p_daily or n.reads+n.writes>=p_minute or (p_write and u.writes>=p_write_limit) then return jsonb_build_object('error','quota_exceeded','resetAt',((now() at time zone 'Asia/Kolkata')::date+1)::timestamp at time zone 'Asia/Kolkata'); end if;
 update public.ai_connection_usage set reads=reads+case when p_write then 0 else 1 end,writes=writes+case when p_write then 1 else 0 end where uid=p_uid and bucket in(d,m);
 if p_request is not null then insert into public.ai_connection_operations(uid,request_id,fingerprint,tool) values(p_uid,p_request,p_fingerprint,p_tool); end if;
 -- Bounded retention cleanup for this user's old minute/day buckets; no grant/token evidence removed here.
 delete from public.ai_connection_usage where uid=p_uid and bucket<to_char(now()-interval '8 days','YYYY-MM-DD');
 return jsonb_build_object('remaining',p_daily-u.reads-u.writes-1);
end; $$;

-- Mutation and receipt commit together. No local success, unowned IDs or arbitrary profile patches.
create or replace function public.mutate_ai_account(p_uid text,p_request text,p_fingerprint text,p_tool text,p_args jsonb,p_grant uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare op public.ai_connection_operations; lists jsonb; target jsonb; updated jsonb; result jsonb; idx integer; stock jsonb; nid text; profile public.users; active_pro boolean; allowed_scopes text[]; required_scope text;
begin
 perform pg_advisory_xact_lock(hashtextextended('ai-account:'||p_uid,0));
 select scopes into allowed_scopes from public.ai_connection_grants where id=p_grant and uid=p_uid and revoked_at is null and expires_at>now() for share;
 if not found then return jsonb_build_object('error','invalid_token'); end if;
 required_scope:=case when p_tool like 'watchlist_%' then 'watchlists:write' when p_tool like 'note_%' then 'notes:write' when p_tool='alert_preferences_update' then 'alerts:write' else 'profile:write' end;
 if not required_scope=any(allowed_scopes) then return jsonb_build_object('error','scope_required'); end if;
 select * into op from public.ai_connection_operations where uid=p_uid and request_id=p_request for update;
 if not found or op.fingerprint<>p_fingerprint or op.tool<>p_tool then return jsonb_build_object('error','invalid_operation'); end if;
 if op.result is not null then return op.result; end if;
 select * into profile from public.users where uid=p_uid for update;
 if not found then return jsonb_build_object('error','account_missing'); end if;
 active_pro:=profile.tier='admin' or coalesce(profile.pro_expires_at,0)>extract(epoch from now())*1000 or exists(select 1 from public.payment_entitlements where uid=p_uid and pro_expires_at>extract(epoch from now())*1000);
 if p_tool like 'watchlist_%' then
   if not active_pro then return jsonb_build_object('error','pro_required'); end if;
   insert into public.user_watchlists(uid,lists) values(p_uid,'[]') on conflict do nothing;
   select w.lists into lists from public.user_watchlists w where uid=p_uid for update;
   if p_tool='watchlist_create' then
     if jsonb_array_length(lists)>=100 then return jsonb_build_object('error','safety_capacity'); end if;
     nid:=gen_random_uuid()::text;
     target:=jsonb_build_object('id',nid,'name',p_args->>'name','is_active',1,'items','[]'::jsonb);
     lists:=lists||jsonb_build_array(target);
   else
     select ordinality::integer-1,value into idx,target from jsonb_array_elements(lists) with ordinality where value->>'id'=p_args->>'watchlistId';
     if target is null then return jsonb_build_object('error','not_found'); end if;
     if p_tool='watchlist_rename' then target:=jsonb_set(target,'{name}',p_args->'name');
     elsif p_tool='watchlist_toggle' then target:=jsonb_set(target,'{is_active}',to_jsonb(case when (p_args->>'active')::boolean then 1 else 0 end));
     elsif p_tool in('watchlist_add_stock','watchlist_remove_stock','watchlist_priority') then
       stock:=p_args->'stock';
       if p_tool='watchlist_add_stock' and jsonb_array_length(coalesce(target->'items','[]'))>=1000 then return jsonb_build_object('error','safety_capacity'); end if;
       select coalesce(jsonb_agg(value),'[]'::jsonb) into updated from jsonb_array_elements(coalesce(target->'items','[]')) where coalesce(value->>'symbol',value#>>'{}')<>stock->>'symbol';
       if p_tool='watchlist_add_stock' then updated:=updated||jsonb_build_array(stock);
       elsif p_tool='watchlist_priority' then
         select value into stock from jsonb_array_elements(coalesce(target->'items','[]')) where value->>'symbol'=p_args->'stock'->>'symbol';
         if stock is null then return jsonb_build_object('error','not_found'); end if;
         updated:=updated||jsonb_build_array(jsonb_set(stock,'{priority}',p_args->'priority'));
       end if;
       target:=jsonb_set(target,'{items}',updated);
     else return jsonb_build_object('error','unknown_tool'); end if;
     lists:=jsonb_set(lists,array[idx::text],target);
   end if;
   update public.user_watchlists set lists=lists,updated_at=clock_timestamp() where uid=p_uid;
   result:=jsonb_build_object('success',true,'watchlist',(target-'items')||jsonb_build_object('stockCount',jsonb_array_length(coalesce(target->'items','[]'))));
 elsif p_tool='alert_preferences_update' then
   if not active_pro then return jsonb_build_object('error','pro_required'); end if;
   if exists(select 1 from jsonb_each(p_args) e where e.key not in ('resultsAndEarnings','orderWinsAndExpansion','dividendsAndBonus','acquisitionsAndMergers','creditRatings','muteRoutineFilings','boardMeetingsAndOutcomes','annualReportsAndAudits') or jsonb_typeof(e.value)<>'boolean') then return jsonb_build_object('error','invalid_fields'); end if;
   update public.users set notification_prefs=coalesce(notification_prefs,'{}'::jsonb)||p_args where uid=p_uid;
   result:=jsonb_build_object('success',true,'preferences',p_args);
 elsif p_tool='preferences_update' then
   -- No tier, email, role, Telegram destination or payment fields enter this operation.
   if exists(select 1 from jsonb_object_keys(p_args) k where k not in ('summaryLanguage','muteInAppNotifications')) then return jsonb_build_object('error','invalid_fields'); end if;
   update public.users set notification_prefs=coalesce(notification_prefs,'{}'::jsonb)||case when p_args ? 'summaryLanguage' then jsonb_build_object('aiSummaryLang',p_args->>'summaryLanguage') else '{}'::jsonb end,
     mute_in_app_notifications=case when p_args ? 'muteInAppNotifications' then (p_args->>'muteInAppNotifications')::boolean else mute_in_app_notifications end where uid=p_uid;
   result:=jsonb_build_object('success',true,'preferences',p_args);
 elsif p_tool='note_create' then
   if (select count(*) from public.user_notes where user_id=p_uid)>=200 then return jsonb_build_object('error','note_limit'); end if;
   nid:=gen_random_uuid()::text;
   target:=jsonb_build_object('id',nid,'userId',p_uid,'text',p_args->>'text','icon',0,'tags',coalesce(p_args->'tags','[]'),'link',null,'createdAt',floor(extract(epoch from now())*1000),'updatedAt',floor(extract(epoch from now())*1000));
   insert into public.user_notes(id,user_id,note) values(nid,p_uid,target);
   result:=jsonb_build_object('success',true,'note',target-'userId');
 elsif p_tool='note_update' then
   select note into target from public.user_notes where id=p_args->>'noteId' and user_id=p_uid for update;
   if not found then return jsonb_build_object('error','not_found'); end if;
   target:=target||jsonb_build_object('text',p_args->>'text','updatedAt',floor(extract(epoch from now())*1000));
   update public.user_notes set note=target,updated_at=clock_timestamp() where id=p_args->>'noteId' and user_id=p_uid;
   result:=jsonb_build_object('success',true,'note',target-'userId');
 else return jsonb_build_object('error','unknown_tool'); end if;
 update public.ai_connection_operations set result=result where uid=p_uid and request_id=p_request;
 return result;
end; $$;

-- Explicit privileges: neither anonymous nor signed-in browser clients can read tokens or invoke RPCs.
do $$ declare t text; f record; begin
 foreach t in array array['ai_connection_clients','ai_connection_grants','ai_connection_requests','ai_connection_secrets','ai_connection_usage','ai_connection_operations'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('approve_ai_connection','exchange_ai_connection','reserve_ai_connection','mutate_ai_account','bump_watchlist_revision') loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
create or replace function public.register_ai_connection_client(p_id text,p_metadata jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('ai-client-registration',0));
 if (select count(*) from public.ai_connection_clients)>=10000 then return jsonb_build_object('error','registration_capacity'); end if;
 insert into public.ai_connection_clients(id,metadata) values(p_id,p_metadata);
 return jsonb_build_object('success',true);
end; $$;
create or replace function public.begin_ai_connection_request(p_hash text,p_client text,p_params jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('ai-oauth-request',0));
 delete from public.ai_connection_requests where hash in(select hash from public.ai_connection_requests where expires_at<now() limit 100);
 if (select count(*) from public.ai_connection_requests)>=10000 or (select count(*) from public.ai_connection_requests where client_id=p_client and used_at is null)>=100 then return jsonb_build_object('error','authorization_capacity'); end if;
 insert into public.ai_connection_requests(hash,client_id,params) values(p_hash,p_client,p_params);
 return jsonb_build_object('success',true);
end; $$;
revoke all on function public.register_ai_connection_client(text,jsonb),public.begin_ai_connection_request(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.register_ai_connection_client(text,jsonb),public.begin_ai_connection_request(text,text,jsonb) to service_role;
