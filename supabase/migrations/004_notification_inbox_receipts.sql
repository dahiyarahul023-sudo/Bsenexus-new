-- Preserve existing notifications; create missing compatible inbox and per-user receipts.
-- Apply to staging first. Existing incompatible column types need schema inspection.
BEGIN;
CREATE TABLE IF NOT EXISTS public.notifications (
 id text PRIMARY KEY, user_id text NOT NULL DEFAULT 'system', title text NOT NULL,
 message text NOT NULL, type text NOT NULL, priority text NOT NULL,
 symbol text, scrip_code text, news_id text, pdf_link text, timestamp bigint NOT NULL,
 is_read boolean NOT NULL DEFAULT false, is_watchlist boolean NOT NULL DEFAULT false,
 metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS public.user_notification_receipts (
 user_id text NOT NULL, notification_id text NOT NULL, read_at bigint NOT NULL,
 PRIMARY KEY(user_id,notification_id)
);
CREATE INDEX IF NOT EXISTS notifications_user_timestamp ON public.notifications(user_id,timestamp DESC);
CREATE INDEX IF NOT EXISTS notification_receipts_user_time ON public.user_notification_receipts(user_id,read_at DESC);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notification_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notifications, public.user_notification_receipts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications, public.user_notification_receipts TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
