-- Verified rollback-only integration smoke test. Run against staging, never production.
-- Requires an administrative connection able to SET ROLE service_role.
-- Do not remove ROLLBACK. No external services, models or notifications are called.
begin;
set local role service_role;
do $smoke$
declare
 v_uid text:='bnx_ai_stage_'||replace(gen_random_uuid()::text,'-',''); v_other text; v_quota text;
 v_client text:=gen_random_uuid()::text; v_grant uuid; v_other_grant uuid; v_list text;
 r jsonb; first_result jsonb; v_revision bigint; affected integer; i integer;
begin
 assert current_user='service_role','Smoke must exercise service role';
 v_other:=v_uid||'_other';v_quota:=v_uid||'_quota';
 insert into public.users(uid,tier,pro_expires_at,created_at,last_login_at)
 values(v_uid,'pro',(extract(epoch from now())*1000)::bigint+86400000,0,0),
 (v_other,'pro',(extract(epoch from now())*1000)::bigint+86400000,0,0),(v_quota,'free',0,0,0);
 r:=public.register_ai_connection_client(v_client,jsonb_build_object('client_id',v_client,'client_name','Rollback-only staging verification','redirect_uris',jsonb_build_array('https://client.example.org/callback')));
 assert not(r?'error'),'Registration failed';
 r:=public.begin_ai_connection_request(repeat('1',64),v_client,jsonb_build_object('scopes',jsonb_build_array('account:read','watchlists:write','profile:write','notes:write'),'redirectUri','https://client.example.org/callback','state','staging-only','codeChallenge',repeat('c',43)));
 assert not(r?'error'),'Authorization request failed';
 r:=public.approve_ai_connection(repeat('1',64),v_uid,array['account:read','watchlists:write','profile:write','notes:write'],repeat('2',64),'https://bsenexus.in/mcp');
 assert not(r?'error'),'Consent failed';v_grant:=(r->>'grantId')::uuid;
 r:=public.approve_ai_connection(repeat('1',64),v_uid,array['account:read'],repeat('3',64),'https://bsenexus.in/mcp');
 assert r->>'error'='request_expired','Consent reused';
 r:=public.exchange_ai_connection(repeat('2',64),'wrong-client','code','https://client.example.org/callback','https://bsenexus.in/mcp',repeat('4',64),repeat('5',64));
 assert r->>'error'='invalid_grant','Wrong client accepted';
 r:=public.exchange_ai_connection(repeat('2',64),v_client,'code','https://client.example.org/wrong','https://bsenexus.in/mcp',repeat('4',64),repeat('5',64));
 assert r->>'error'='invalid_grant','Wrong callback accepted';
 r:=public.exchange_ai_connection(repeat('2',64),v_client,'code','https://client.example.org/callback','https://bsenexus.in/mcp',repeat('4',64),repeat('5',64));
 assert not(r?'error'),'Code exchange failed';
 r:=public.exchange_ai_connection(repeat('2',64),v_client,'code','https://client.example.org/callback','https://bsenexus.in/mcp',repeat('6',64),repeat('7',64));
 assert r->>'error'='invalid_grant','Code replay accepted';
 r:=public.reserve_ai_connection(v_uid,true,200,20,50,'staging_create_01',repeat('a',64),'watchlist_create');
 assert not(r?'error'),'Write reservation failed';
 first_result:=public.mutate_ai_account(v_uid,'staging_create_01',repeat('a',64),'watchlist_create','{"name":"Rollback-only list"}',v_grant);
 assert first_result->>'success'='true','Watchlist creation failed';
 v_list:=first_result#>>'{watchlist,id}';
 r:=public.reserve_ai_connection(v_uid,true,200,20,50,'staging_create_01',repeat('a',64),'watchlist_create');
 assert (r->>'replay')::boolean and r->'result'=first_result,'Retry not deduplicated';
 r:=public.reserve_ai_connection(v_uid,true,200,20,50,'staging_create_01',repeat('b',64),'watchlist_create');
 assert r->>'error'='idempotency_conflict','Changed retry accepted';
 select revision into v_revision from public.user_watchlists where uid=v_uid;
 r:=public.reserve_ai_connection(v_uid,true,200,20,50,'staging_stock_001',repeat('b',64),'watchlist_add_stock');
 r:=public.mutate_ai_account(v_uid,'staging_stock_001',repeat('b',64),'watchlist_add_stock',jsonb_build_object('watchlistId',v_list,'stock',jsonb_build_object('symbol','TCS','scripCode','532540','companyName','Tata Consultancy Services','priority','HIGH')),v_grant);
 assert r->>'success'='true','Stock addition failed';
 update public.user_watchlists set lists='[]' where uid=v_uid and revision=v_revision;
 get diagnostics affected=row_count;assert affected=0,'Stale website write overwrote AI data';
 insert into public.ai_connection_grants(uid,client_id,scopes) values(v_other,v_client,array['watchlists:write']) returning id into v_other_grant;
 r:=public.reserve_ai_connection(v_other,true,200,20,50,'staging_foreign01',repeat('c',64),'watchlist_rename');
 r:=public.mutate_ai_account(v_other,'staging_foreign01',repeat('c',64),'watchlist_rename',jsonb_build_object('watchlistId',v_list,'name','Not allowed'),v_other_grant);
 assert r->>'error'='not_found','Foreign account edit accepted';
 r:=public.reserve_ai_connection(v_uid,true,200,20,50,'staging_profile01',repeat('d',64),'preferences_update');
 r:=public.mutate_ai_account(v_uid,'staging_profile01',repeat('d',64),'preferences_update','{"tier":"admin"}',v_grant);
 assert r->>'error'='invalid_fields','Role escalation accepted';
 update public.users set tier='free',pro_expires_at=0 where uid=v_other;
 r:=public.reserve_ai_connection(v_other,true,200,20,50,'staging_expired01',repeat('e',64),'watchlist_create');
 r:=public.mutate_ai_account(v_other,'staging_expired01',repeat('e',64),'watchlist_create','{"name":"Denied"}',v_other_grant);
 assert r->>'error'='pro_required','Expired Pro accepted';
 for i in 1..3 loop
 r:=public.reserve_ai_connection(v_quota,false,3,100,5,null,null,null);
 assert not(r?'error'),'Quota denied too early';
 end loop;
 r:=public.reserve_ai_connection(v_quota,false,3,100,5,null,null,null);
 assert r->>'error'='quota_exceeded','Account budget bypassed';
 r:=public.exchange_ai_connection(repeat('5',64),v_client,'refresh',null,'https://bsenexus.in/mcp',repeat('8',64),repeat('9',64));
 assert not(r?'error'),'Refresh failed';
 r:=public.exchange_ai_connection(repeat('5',64),v_client,'refresh',null,'https://bsenexus.in/mcp',repeat('a',64),repeat('b',64));
 assert r->>'error'='invalid_grant','Refresh replay accepted';
 assert (select revoked_at is not null from public.ai_connection_grants where id=v_grant),'Refresh replay did not revoke';
 r:=public.reserve_ai_connection(v_uid,true,200,20,50,'staging_revoked01',repeat('f',64),'watchlist_create');
 r:=public.mutate_ai_account(v_uid,'staging_revoked01',repeat('f',64),'watchlist_create','{"name":"Denied"}',v_grant);
 assert r->>'error'='invalid_token','Revoked mutation accepted';
end $smoke$;
rollback;
select jsonb_build_object('result','passed','role','service_role','test_data','rolled_back','checks',array['registration','single-use consent','client/callback binding','code exchange/replay','watchlist mutation','idempotency','revision CAS','cross-account denial','role-field rejection','Pro expiry','account quota','refresh rotation/replay revocation','revoked mutation']) staging_smoke;

