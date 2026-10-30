-- Forward-only, additive; rehearse on staging BEFORE runtime rollout.
-- Rollback: revert/disable runtime first; retain counters/receipts to prevent
-- quota resets. Drop isolated objects only in a separately reviewed migration.
BEGIN;
CREATE TABLE IF NOT EXISTS public.faq_quota_days (
  identity_hash text NOT NULL CHECK (identity_hash ~ '^[a-f0-9]{64}$'),
  usage_day date NOT NULL,
  used integer NOT NULL DEFAULT 0 CHECK (used BETWEEN 0 AND 4),
  PRIMARY KEY (identity_hash, usage_day)
);
CREATE TABLE IF NOT EXISTS public.faq_quota_reservations (
  id uuid PRIMARY KEY,
  identity_hash text NOT NULL,
  usage_day date NOT NULL,
  refunded boolean NOT NULL DEFAULT false,
  FOREIGN KEY (identity_hash, usage_day) REFERENCES public.faq_quota_days ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS faq_quota_days_retention ON public.faq_quota_days(usage_day);
CREATE INDEX IF NOT EXISTS faq_quota_reservations_day ON public.faq_quota_reservations(identity_hash, usage_day);
ALTER TABLE public.faq_quota_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faq_quota_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.faq_quota_days, public.faq_quota_reservations FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.faq_quota_days, public.faq_quota_reservations TO service_role;

CREATE OR REPLACE FUNCTION public.manage_faq_quota(p_identity_hash text, p_action text, p_reservation_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_day date := (pg_catalog.now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_used integer := 0;
  v_allowed boolean := true;
  v_res public.faq_quota_reservations%ROWTYPE;
BEGIN
  IF p_identity_hash IS NULL OR p_identity_hash !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid FAQ identity'; END IF;
  IF p_action IS NULL OR p_action NOT IN ('status','reserve','refund') THEN RAISE EXCEPTION 'Invalid FAQ operation'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('faq:' || p_identity_hash, 0));
  IF p_action = 'reserve' THEN
    IF p_reservation_id IS NULL THEN RAISE EXCEPTION 'FAQ receipt required'; END IF;
    SELECT * INTO v_res FROM public.faq_quota_reservations WHERE id = p_reservation_id;
    IF FOUND THEN
      IF v_res.identity_hash <> p_identity_hash THEN RAISE EXCEPTION 'FAQ receipt owner mismatch'; END IF;
      v_allowed := NOT v_res.refunded AND v_res.usage_day = v_day;
    ELSE
      INSERT INTO public.faq_quota_days(identity_hash,usage_day) VALUES(p_identity_hash,v_day) ON CONFLICT DO NOTHING;
      UPDATE public.faq_quota_days SET used = used + 1 WHERE identity_hash = p_identity_hash AND usage_day = v_day AND used < 4;
      v_allowed := FOUND;
      IF v_allowed THEN INSERT INTO public.faq_quota_reservations(id,identity_hash,usage_day) VALUES(p_reservation_id,p_identity_hash,v_day); END IF;
    END IF;
  ELSIF p_action = 'refund' THEN
    IF p_reservation_id IS NULL THEN RAISE EXCEPTION 'FAQ receipt required'; END IF;
    SELECT * INTO v_res FROM public.faq_quota_reservations WHERE id = p_reservation_id AND identity_hash = p_identity_hash;
    IF FOUND AND NOT v_res.refunded THEN
      UPDATE public.faq_quota_days SET used = GREATEST(0,used-1) WHERE identity_hash=p_identity_hash AND usage_day=v_res.usage_day;
      UPDATE public.faq_quota_reservations SET refunded=true WHERE id=v_res.id;
    END IF;
  END IF;
  SELECT COALESCE((SELECT used FROM public.faq_quota_days WHERE identity_hash=p_identity_hash AND usage_day=v_day),0) INTO v_used;
  IF p_action = 'status' THEN v_allowed := v_used < 4; END IF;
  RETURN pg_catalog.jsonb_build_object('allowed',v_allowed,'used',v_used,'remaining',4-v_used,'dailyLimit',4,'reservationId',p_reservation_id);
END;
$$;
-- Run periodically as service_role, in batches until result = 0. Never removes
-- today/yesterday's counters, even if a caller passes a future date.
CREATE OR REPLACE FUNCTION public.prune_faq_quota(p_batch integer DEFAULT 1000)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_deleted integer;
BEGIN
  IF p_batch IS NULL OR p_batch NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Invalid FAQ prune batch'; END IF;
  DELETE FROM public.faq_quota_days WHERE (identity_hash,usage_day) IN
    (SELECT identity_hash,usage_day FROM public.faq_quota_days WHERE usage_day < (pg_catalog.now() AT TIME ZONE 'Asia/Kolkata')::date - 2 ORDER BY usage_day LIMIT p_batch FOR UPDATE SKIP LOCKED);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;
REVOKE ALL ON FUNCTION public.manage_faq_quota(text,text,uuid),public.prune_faq_quota(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.manage_faq_quota(text,text,uuid),public.prune_faq_quota(integer) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
