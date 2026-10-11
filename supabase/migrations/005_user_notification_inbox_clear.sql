-- Per-user inbox clear watermark. Does not delete notifications or read receipts.
-- Apply to staging, then production BEFORE deploying the consuming backend.
BEGIN;
CREATE TABLE IF NOT EXISTS public.user_notification_inbox_state (
  user_id text PRIMARY KEY,
  cleared_before bigint NOT NULL DEFAULT 0 CHECK (cleared_before >= 0)
);
ALTER TABLE public.user_notification_inbox_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_notification_inbox_state FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_notification_inbox_state TO service_role;
CREATE OR REPLACE FUNCTION public.clear_user_notification_inbox(p_uid text)
RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE cutoff bigint;
BEGIN
  IF p_uid IS NULL OR pg_catalog.btrim(p_uid) = '' OR p_uid IN ('guest','system','all') THEN
    RAISE EXCEPTION 'A personal account is required' USING ERRCODE = '22023';
  END IF;
  cutoff := pg_catalog.floor(EXTRACT(epoch FROM pg_catalog.clock_timestamp()) * 1000)::bigint;
  INSERT INTO public.user_notification_inbox_state(user_id,cleared_before)
  VALUES(p_uid,cutoff)
  ON CONFLICT(user_id) DO UPDATE
    SET cleared_before = GREATEST(public.user_notification_inbox_state.cleared_before,EXCLUDED.cleared_before)
  RETURNING cleared_before INTO cutoff;
  RETURN cutoff;
END;
$$;
REVOKE ALL ON FUNCTION public.clear_user_notification_inbox(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clear_user_notification_inbox(text) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
