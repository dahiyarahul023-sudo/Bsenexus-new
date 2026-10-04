-- Additive quota storage. Apply before deploying code that requires this RPC.
-- Does not alter existing payment/profile tables or grant users Pro access.
BEGIN;
CREATE TABLE IF NOT EXISTS public.ai_quota_days (
  user_id text NOT NULL,
  usage_day date NOT NULL,
  used integer NOT NULL DEFAULT 0 CHECK (used BETWEEN 0 AND 100),
  PRIMARY KEY (user_id, usage_day)
);
CREATE TABLE IF NOT EXISTS public.ai_quota_reservations (
  id uuid PRIMARY KEY,
  user_id text NOT NULL,
  usage_day date NOT NULL,
  refunded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_quota_reservations_user_day ON public.ai_quota_reservations (user_id, usage_day);
ALTER TABLE public.ai_quota_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_quota_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_quota_days, public.ai_quota_reservations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_quota_days, public.ai_quota_reservations TO service_role;

CREATE OR REPLACE FUNCTION public.manage_ai_quota(p_uid text, p_action text, p_reservation_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_day date := (pg_catalog.now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_used integer;
  v_res public.ai_quota_reservations%ROWTYPE;
  v_allowed boolean := true;
BEGIN
  IF p_uid IS NULL OR pg_catalog.btrim(p_uid) = '' OR p_uid = 'guest' THEN
    RAISE EXCEPTION 'Verified user ID required';
  END IF;
  IF p_action IS NULL OR p_action NOT IN ('status','reserve','refund','reset') THEN RAISE EXCEPTION 'Invalid quota action'; END IF;
  -- Same lock for every operation, across replicas. Hash collisions only serialize extra users.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('bsenexus-ai:' || p_uid, 0));
  INSERT INTO public.ai_quota_days(user_id, usage_day) VALUES (p_uid, v_day) ON CONFLICT DO NOTHING;
  IF p_action = 'refund' THEN
    IF p_reservation_id IS NULL THEN RAISE EXCEPTION 'Reservation ID required'; END IF;
    SELECT * INTO v_res FROM public.ai_quota_reservations WHERE id = p_reservation_id AND user_id = p_uid;
    IF FOUND AND NOT v_res.refunded THEN
      UPDATE public.ai_quota_days SET used = GREATEST(0, used - 1) WHERE user_id = p_uid AND usage_day = v_res.usage_day;
      UPDATE public.ai_quota_reservations SET refunded = true WHERE id = v_res.id;
    END IF;
  ELSIF p_action = 'reset' THEN
    UPDATE public.ai_quota_reservations SET refunded = true WHERE user_id = p_uid AND usage_day = v_day;
    UPDATE public.ai_quota_days SET used = 0 WHERE user_id = p_uid AND usage_day = v_day;
  ELSIF p_action = 'reserve' THEN
    IF p_reservation_id IS NULL THEN RAISE EXCEPTION 'Reservation ID required'; END IF;
    SELECT * INTO v_res FROM public.ai_quota_reservations WHERE id = p_reservation_id;
    IF FOUND THEN
      IF v_res.user_id <> p_uid THEN RAISE EXCEPTION 'Reservation owner mismatch'; END IF;
      v_allowed := NOT v_res.refunded AND v_res.usage_day = v_day;
    ELSE
      SELECT used INTO v_used FROM public.ai_quota_days WHERE user_id = p_uid AND usage_day = v_day;
      v_allowed := v_used < 100;
      IF v_allowed THEN
        INSERT INTO public.ai_quota_reservations(id, user_id, usage_day) VALUES (p_reservation_id, p_uid, v_day);
        UPDATE public.ai_quota_days SET used = used + 1 WHERE user_id = p_uid AND usage_day = v_day;
      END IF;
    END IF;
  END IF;
  SELECT used INTO v_used FROM public.ai_quota_days WHERE user_id = p_uid AND usage_day = v_day;
  IF p_action = 'status' THEN v_allowed := v_used < 100; END IF;
  RETURN pg_catalog.jsonb_build_object('allowed', v_allowed, 'used', v_used, 'remaining', GREATEST(0,100-v_used), 'dailyLimit',100, 'reservationId',p_reservation_id);
END;
$$;
REVOKE ALL ON FUNCTION public.manage_ai_quota(text,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.manage_ai_quota(text,text,uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
