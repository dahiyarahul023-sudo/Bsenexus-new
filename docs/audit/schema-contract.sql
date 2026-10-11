-- READ ONLY. Run as DB owner in the actual Supabase project and export results privately.
select table_name,column_name,data_type,is_nullable,column_default
from information_schema.columns where table_schema='public'
and table_name in ('users','user_watchlists','announcements','results_calendar','payment_orders','payment_entitlements','notifications','user_notification_receipts','user_notification_inbox_state','ai_quota_days','ai_quota_reservations','auth_account_limits','user_notes')
order by table_name,ordinal_position;
select p.oid::regprocedure as signature,p.prosecdef as security_definer,p.proconfig,
       has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
       has_function_privilege('service_role',p.oid,'EXECUTE') as service_execute,
       pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('grant_payment_atomic','record_pending_order_atomic','claim_order_for_grant','claim_free_summary_demo','manage_ai_quota','clear_user_notification_inbox','ensure_user_skeleton');
select schemaname,tablename,policyname,roles,cmd,qual,with_check
from pg_policies where schemaname='public' order by tablename,policyname;
select relname,relrowsecurity,relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' order by relname;

-- Table grants matter in addition to function EXECUTE and RLS.
select table_name,grantee,privilege_type from information_schema.role_table_grants
where table_schema='public' and table_name in ('notifications','user_notification_receipts','user_notification_inbox_state','ai_quota_days','ai_quota_reservations')
order by table_name,grantee,privilege_type;

-- Keys/checks/FKs and indexes needed to assess payment idempotency and inbox storage.
select c.relname as table_name, con.conname, con.contype,
       pg_get_constraintdef(con.oid) as definition
from pg_constraint con join pg_class c on c.oid=con.conrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('payment_orders','payment_entitlements','notifications','user_notification_receipts','user_notification_inbox_state','ai_quota_days','ai_quota_reservations')
order by c.relname,con.conname;
select tablename,indexname,indexdef from pg_indexes
where schemaname='public' and tablename in ('payment_orders','payment_entitlements','notifications','user_notification_receipts','user_notification_inbox_state','ai_quota_days','ai_quota_reservations')
order by tablename,indexname;
select table_name,grantee,privilege_type from information_schema.role_table_grants
where table_schema='public' and table_name in ('users','auth_account_limits','payment_orders','payment_entitlements')
order by table_name,grantee,privilege_type;
