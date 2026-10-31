-- Forward-only: exact columns/defaults observed read-only on Bsenexus-staging
-- on 2026-10-30. Existing relations/counters are never rewritten.
-- Rollback: retain protection data; do not drop while runtime/RPCs depend on it.
BEGIN;
CREATE TABLE IF NOT EXISTS public.auth_account_limits (
  id text PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.auth_account_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auth_account_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.auth_account_limits TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
