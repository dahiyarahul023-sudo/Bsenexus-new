-- Run only in staging. Synthetic fixtures are uncommitted and always rolled back.
begin;
set local role service_role;
do $$
declare
  a text := 'mcp-reviewer-'||gen_random_uuid()::text;
  b text := 'mcp-reviewer-'||gen_random_uuid()::text;
  c text := gen_random_uuid()::text;
  ga uuid; gb uuid; outcome jsonb; operation text; args jsonb;
begin
  insert into public.users(uid,tier,pro_expires_at,created_at,last_login_at) values
    (a,'pro',floor(extract(epoch from now()+interval '1 day')*1000),0,0),
    (b,'pro',floor(extract(epoch from now()+interval '1 day')*1000),0,0);
  insert into public.ai_connection_clients(id,metadata) values(c,'{}');
  insert into public.ai_connection_grants(uid,client_id,scopes) values(a,c,array['watchlists:write','notes:write','alerts:write','profile:write']) returning id into ga;
  insert into public.ai_connection_grants(uid,client_id,scopes) values(b,c,array['watchlists:write','notes:write']) returning id into gb;
  insert into public.user_watchlists(uid,lists) values(a,'[{"id":"1700000000000","name":"A private","items":[]}]'),(b,'[{"id":"1700000000001","name":"B private","items":[{"symbol":"TCS","scripCode":"532540"}]}]');
  insert into public.user_notes(id,user_id,note) values('fixture-note-'||b,b,jsonb_build_object('id','fixture-note-'||b,'userId',b,'text','B private'));
  foreach operation in array array['watchlist_rename','watchlist_toggle','watchlist_add_stock','watchlist_remove_stock','watchlist_priority','note_update'] loop
    args:=case when operation='note_update' then jsonb_build_object('noteId','fixture-note-'||b,'text','Attempted overwrite')
      else jsonb_build_object('watchlistId','1700000000001','name','Attempted overwrite','active',false,'priority','LOW','stock',jsonb_build_object('symbol','TCS','scripCode','532540')) end;
    perform public.reserve_ai_connection(a,true,200,100,50,'directory-test-'||operation,repeat('a',64),operation);
    outcome:=public.mutate_ai_account(a,'directory-test-'||operation,repeat('a',64),operation,args,ga);
    if outcome->>'error' is distinct from 'not_found' then raise exception 'Foreign object isolation failed for %',operation; end if;
  end loop;
  if (select lists->0->>'name' from public.user_watchlists where uid=b) <> 'B private' then raise exception 'Foreign list changed'; end if;
  if (select note->>'text' from public.user_notes where user_id=b) <> 'B private' then raise exception 'Foreign note changed'; end if;
  perform public.reserve_ai_connection(a,true,200,100,50,'directory-scope',repeat('b',64),'watchlist_create');
  outcome:=public.mutate_ai_account(a,'directory-scope',repeat('b',64),'watchlist_create','{"name":"wrong grant"}',gb);
  if outcome->>'error' is distinct from 'invalid_token' then raise exception 'Foreign grant accepted'; end if;
  if has_function_privilege('authenticated','public.mutate_ai_account(text,text,text,text,jsonb,uuid)','execute') then raise exception 'Browser RPC privilege exposed'; end if;
  if has_table_privilege('anon','public.ai_connection_operations','select') then raise exception 'Browser receipt access exposed'; end if;
end $$;
rollback;
select 'PASS: staging foreign IDs and grants denied, fixtures rolled back, no browser RPC/receipt grants' as result;
