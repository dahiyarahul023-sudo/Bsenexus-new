# Announcements: HTTP-driven polling deployment and audit

Baseline main: b22ea90dcad7b33832d25c269099835c14771428.

## Owner setup in Google Cloud Console

1. Set server-only `CRON_SECRET` on the Cloud Run service to a strong random value. Do not use a `VITE_` prefix or put the secret in a URL. Do not paste the value into this document or logs.
2. Pull/sync this commit into AI Studio and Republish. This change does not deploy the service, alter CPU allocation/billing, or create a scheduler job.
3. Enable Cloud Scheduler API in the same project. Create `bse-nexus-poll`, cron `* * * * *`, timezone `Asia/Kolkata`, HTTP GET target `https://bsenexus.in/api/cron/poll-announcements`.
4. Add header `Authorization: Bearer <same CRON_SECRET value>`. Enable retries with bounded retry backoff; set the attempt deadline to at least 180 seconds (the application cycle budget is 120 seconds). No user login or Firebase ID token is used by this endpoint.
5. Remove/disable any older announcement-triggering scheduler/pinger. `/api/cron/poll` now returns 410 and never starts ingestion. Uptime checks may keep using `/api/health` without triggering a poll.
6. Run the job once and inspect both Scheduler's response and Cloud Run logs. Keep the existing request-based billing and instance settings. Scheduler supplies the minute cadence even outside market hours; failed/blocked exchange calls retain existing backoff, so some invocations return `mode: backoff` without fetching.

## Observable contract

- Missing, wrong or unconfigured bearer secret: 401; no fetch/write. Query tokens are intentionally unsupported to avoid access-log leaks.
- Completed cycle: 200 with `success`, `mode`, `fetched`, `new`, `durationMs`.
- Source unavailable, timed-out stage, failed item or unexpected error: 503; no cached data is relabeled as a successful poll. `new` is the count accepted by the existing save DAO; it is not a promise of exactly-once notification delivery or independently confirmed durable rows.
- Concurrent invocation: 409, `Retry-After: 60`, no second worker. Source backoff: 200 with `mode: backoff` and `retryAfterMs`, no second fetch. Retry after a failure must respect this gate.
- One summary line per request: `[POLLER] Cycle | Duration: Xms | New: N | Mode: ... | Timestamp IST: ...`. Existing stage-level diagnostics remain for pinpointing a stall; the summary also appears for denied/busy/backoff requests.
- Exchange requests have explicit header/body deadlines and receive cycle cancellation. The monitor bounds awaited stages and the total cycle. A late non-cancellable DAO write remains an unknown outcome; NEWSID upsert/dedupe stays authoritative. No unconditional lock reset starts a second monitor continuation.
- Existing BSE endpoints, alternate source, history window, NSE merge, DAO write targets, read API and alert filtering are retained. The actual repository stores announcements through the Supabase DAO with a local queue/cache fallback, not a new Firestore write path.
- The request awaits the existing announcement write queue within a bounded stage, and flushes the local disk cache. A timeout is a retryable failure and cannot prove that a write did not commit. The queue's existing fallback/drop behavior is unchanged; durable outages still need investigation.
- NSE records lacking `seq_id` and `dt` get a deterministic hash fallback ID instead of `Date.now()`, preventing duplicate records on repeated requests. BSE and NSE IDs remain distinct; cross-exchange event dedupe is not introduced.
- Yesterday-only BSE recovery does not certify today's source freshness; the existing regression assertion is retained after the NSE merge. OneSignal's poll-triggered request now has an explicit eight-second abort deadline.

## Muse live verification (requires deployment and owner setup)

Record deployed revision/commit, instance, invocation time, request mode, source NEWSID and evidence.

1. Incorrect/missing secret returns 401, with no new records and no secret in logs.
2. Healthy job performs one bounded cycle and has a summary heartbeat. Repeating it does not create a second row or notification for the same NEWSID.
3. Stop browsing the site for at least 45 minutes during an active filing period. Scheduler heartbeat must continue independently of browser traffic. Compare an actual BSE/NSE NEWSID across exchange, durable store, RAM/API, and screen. Zero new rows alone does not prove failure during a quiet period.
4. Verify failures/timeouts give retryable responses, preserve existing feed data, and never leave a monitor continuation adding later alerts after timeout. Simulated 403/slow-body/DB failures belong in staging, not destructive production tests.
5. Inspect both Cloud Run revisions during a rollout; in-process exclusion assumes the currently configured single instance. NEWSID uniqueness protects records, but rolling multi-revision notification delivery is not a distributed exactly-once guarantee.
6. Confirm normal `/api/announcements` payload/filter/cache behavior, watchlist alerts, inbox and other scheduled jobs remain compatible.

## Delivery and rollback

Local tests/build evidence is recorded in `rule/changes/announcement-http-polling.md`. Live Cloud Run logs, idle-period continuity, Scheduler configuration and real durable-write verification remain unverified here. Required host `compile_applet`/`lint_applet` tools are unavailable; repository typecheck/build are the available equivalents.

Before rolling back to a version with an internal timer, disable the Scheduler job to prevent overlapping trigger paths. A rollback restores the known idle-CPU limitation; it is not a recovery strategy for that limitation.
