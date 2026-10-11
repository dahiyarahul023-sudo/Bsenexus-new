-- ============================================================
-- Migration 007: Fix Supabase lints (search_path + RPC permissions + RLS policies)
-- Date: Oct 2026
-- Triggered by: Supabase Database Linter findings
--
-- Issues fixed:
-- 1. function_search_path_mutable — 5 SECURITY DEFINER functions had mutable search_path
--    (privilege escalation risk via search_path hijacking)
-- 2. anon_security_definer_function_executable — ensure_user_skeleton callable by anon
--    (ANY visitor could create user skeletons for arbitrary UIDs via REST API)
-- 3. authenticated_security_definer_function_executable — same function callable by
--    authenticated users (IDOR — create skeletons for OTHER users' UIDs)
-- 4. rls_enabled_no_policy — 26 tables with RLS enabled but no explicit policies
--    (safe by design since service_role bypasses RLS, but defense-in-depth)
-- ============================================================

begin;

-- ============================================================
-- FIX 1: Set search_path = '' on all 5 flagged functions.
-- This prevents search_path hijacking where an attacker creates
-- a malicious function with the same name in a schema that appears
-- earlier in search_path, causing the SECURITY DEFINER function to
-- execute attacker-controlled code with elevated privileges.
--
-- We use ALTER FUNCTION ... SET search_path = '' which is the
-- recommended fix per Supabase docs.
-- ============================================================

-- grant_payment_atomic — already has search_path in migration 001,
-- but lint still flags it. Force-set again to be certain.
alter function public.grant_payment_atomic(text, text, bigint, text, int)
  set search_path = '';

-- record_pending_order_atomic
alter function public.record_pending_order_atomic(text, text, bigint, text, int)
  set search_path = '';

-- claim_order_for_grant
alter function public.claim_order_for_grant(text, text, text)
  set search_path = '';

-- claim_free_summary_demo
alter function public.claim_free_summary_demo(text)
  set search_path = '';

-- ensure_user_skeleton — CRITICAL: this is the one callable by anon!
alter function public.ensure_user_skeleton(text, bigint)
  set search_path = '';

-- ============================================================
-- FIX 2: Lock down ensure_user_skeleton — was callable by anon + authenticated.
-- This is the most CRITICAL finding: any visitor to the site could call
-- POST /rest/v1/rpc/ensure_user_skeleton and create user skeleton records
-- for arbitrary UIDs. This is an IDOR + privilege escalation vector.
--
-- Fix: revoke execute from ALL roles, grant ONLY to service_role,
-- and convert to SECURITY INVOKER (matching the other 4 payment functions
-- that were already fixed in migration 002).
-- ============================================================

revoke all on function public.ensure_user_skeleton(text, bigint)
  from public, anon, authenticated;
grant execute on function public.ensure_user_skeleton(text, bigint)
  to service_role;
alter function public.ensure_user_skeleton(text, bigint)
  security invoker;

-- ============================================================
-- FIX 3: Defense-in-depth RLS policies on all 26 flagged tables.
-- RLS is already enabled (good — blocks anon/authenticated by default).
-- But Supabase best practice says: always have explicit policies even
-- if they're "deny all." This way if someone accidentally grants a role
-- or changes RLS config, the policy still blocks access.
--
-- Strategy: deny ALL access to anon and authenticated. Only service_role
-- (which bypasses RLS entirely) can read/write. This matches the existing
-- architecture where ALL data access goes through the server-side
-- service_role client.
-- ============================================================

-- Helper: apply "deny all to non-service" policy to a table
do $$
declare t text;
begin
  for t in select unnest(array[
    'admins', 'ai_quota_days', 'ai_quota_reservations', 'alert_rules',
    'announcements', 'auth_account_limits', 'feedback', 'logs',
    'notifications', 'payment_entitlements', 'payment_orders',
    'referral_accounts_v2', 'referral_aliases_v2', 'referral_bonus_access_v2',
    'referral_intents_v2', 'referral_orders_v2', 'referral_payouts_v2',
    'referral_rewards_v2', 'results_calendar', 'sent_news_alerts',
    'settings', 'system_config', 'user_notes',
    'user_notification_inbox_state', 'user_notification_receipts',
    'user_watchlists', 'users'
  ])
  loop
    begin
      -- Drop any existing policy with our name (idempotent)
      execute format('drop policy if exists deny_all_non_service on public.%I', t);
      -- Create explicit deny-all policy for anon + authenticated
      -- (service_role bypasses RLS so this doesn't affect server access)
      execute format(
        'create policy deny_all_non_service on public.%I
         for all to anon, authenticated
         using (false)
         with check (false)',
        t
      );
    exception when others then
      -- Table might not exist in this environment — skip silently
      raise notice 'Skipping %: %', t, sqlerrm;
    end;
  end loop;
end $$;

commit;
