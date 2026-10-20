-- Narrow replacement for the unsafe helper; does not change payment RPC bodies.
-- Do NOT apply 007_fix_lints_search_path_rls_rpc.sql: its signatures do not
-- match production and its empty search_path breaks unqualified relations.
begin;
create or replace function public.ensure_user_skeleton(p_uid text, p_now bigint)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.users (uid, tier, created_at, last_login_at)
    values (p_uid, 'free', p_now, p_now)
    on conflict (uid) do nothing;
end;
$$;
revoke all on function public.ensure_user_skeleton(text, bigint) from public, anon, authenticated;
grant execute on function public.ensure_user_skeleton(text, bigint) to service_role;
commit;
