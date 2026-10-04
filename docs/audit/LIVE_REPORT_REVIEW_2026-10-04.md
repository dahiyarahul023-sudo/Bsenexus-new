# Review of Muse's 4 October console and schema reports

## Evidence and timeline

Inputs: `supabase-schema-inspection-2026-10-04.pdf` and `console-records-2026-10-04.pdf`, supplied by Rahul. The schema PDF is a PRE-migration snapshot (~11:25–11:30 IST). The console PDF combines earlier and later observations; its later migration/deployment sections supersede its earlier "no staging", "not published yet", and missing-table observations.

GitHub independently checked by Codex: main is merge commit `089eeffe51fb0298c7c335e065c13e0e347a24df`, tree `fd9d0fcab7464c7f118b3a76c6035f625ab7d685`, with parents `2094d1b` and `6163e25`. It exactly preserves the previous follow-up source tree. Codex has not independently accessed live Cloud Run/Supabase dashboards in this review.

Muse reports: migrations 002/003/004 applied to staging and production; 650 notification rows preserved; production revision `untitled-00189-tl2` Ready at 100%; rollback revision `untitled-00188-9p9` preserved. Source commit of the Cloud Run image remains unknown: Git sync and version display are evidence, not an embedded commit-SHA attestation.

## What the reports establish and do not establish

| Area | Evidence | Remaining verification |
| --- | --- | --- |
| Supabase contract | Existing notifications' 14 columns/types match migration 004; existing payment orders/entitlements and nine-argument grant RPC match the backend's field/signature expectations | RPC SQL bodies, output JSON, indexes/constraints, current table privileges, and transaction/idempotency behavior were not exported in the PDFs |
| RPC permissions | Muse reports 002 revoked anonymous/authenticated execution and retained service role | Re-export actual post-migration SECURITY INVOKER/search-path flags and payment table grants; inspect `ensure_user_skeleton` body/signature/permissions separately |
| Shared read receipt | User B read shared notification; C remained unread | Private notification isolation live test, restart/replica durability, receipts retention |
| AI quota | Saved summary persisted after refresh; labeled heuristic response observed | Saved digest is not a quota-counter test. Capture used/remaining, consume a genuine request, verify after a Cloud Run restart/revision change and another session; 100/day concurrency/reset/refund still needs live evidence |
| Payments | Dashboard delivery rows show HTTP 200; duplicate destination paths recorded | HTTP 200 alone does not prove a verified payment or exactly-once entitlement. Sandbox same-order duplicate/reconciliation tests still pending |
| UI | Desktop Chromium smoke, login/note/filter checks reported | Real iOS/Android/WebKit/Firefox and keyboard/device coverage remain incomplete |

## Fixes implemented from report failures

1. **Clear All:** old DAO deleted only strictly personal rows; shared/system records stayed visible. UI also relied on native `confirm()`. Now an in-app confirmation explains account-only clearing. The backend stores a per-user clear watermark, filters it before the 500-row inbox limit and unread counts, and does not delete shared/other-user rows. New alerts with a later timestamp remain visible. Pending notification loads cannot restore a pre-clear snapshot. Errors retain the inbox and display feedback; success displays confirmation.
2. **Delete List:** native `confirm()` replaced by the existing app confirmation dialog. Requests show busy state, prevent duplicate confirmation, check HTTP and response success before a success toast, and leave errors visible for retry. The DAO returns false for a missing/foreign list; the endpoint returns 404, and storage failures return 503. Deletion reads fresh cloud state and waits for its cloud write before changing local cache; it does not use the other watchlist mutations' best-effort persistence fallback. Other confirmation actions now check their responses too.
3. **Escape:** notifications dialog closes on Escape; Escape cancels its clear confirmation first. Watchlist confirmation also closes on Escape when no mutation is running.

## Deployment dependency

Apply NEW `supabase/migrations/005_user_notification_inbox_clear.sql` to staging then compatible production BEFORE merging/deploying this batch. It adds `user_notification_inbox_state` and service-role-only `clear_user_notification_inbox(text)`; no notification rows, receipts, or existing tables are deleted. Do not rerun old 001. Until migration 005 exists, deploying this backend would make inbox reads/clear fail closed with 503. This is why the proposed code is a draft PR.

The clear watermark uses the database's current millisecond clock and notification `timestamp`. Existing alerts at/before the cutoff are hidden for that user; future timestamps remain visible. Delayed arrivals carrying an older timestamp are also hidden. Concurrent calls never move the cutoff backwards. This is not a durable producer/outbox repair.

## Validation

- Configured Node suite: 215/215 tests, 25 suites, zero failures (includes owner/missing list deletion, account-only clear/new alert, and cloud failure propagation).
- TypeScript lint and production build passed. Main bundle remains ~1.63 MB/~420 KB gzip; this batch does not claim to fix performance.
- Migration 005 applied twice in isolated PGlite: caller-only hiding, shared/foreign rows retained, new alerts visible, monotonic cutoff, reserved identities rejected, anon/authenticated function/table access denied. One embedded connection; not a live multi-replica load test.
- Required AGENTS names `compile_applet` and `lint_applet` are not exposed by the environment. Actual repository lint/build were used.
- Chromium 153 mock-API interaction checks passed at 390, 820, and 1920 px: delete cancel/404/success, clear cancel/503/success/reopen, Escape cancels confirmation and closes dialogs; zero page errors. No Safari/Firefox/real-device claim. Browser evidence is recorded separately in `live-followup-browser-proof.json`; API fixtures establish UI behavior, not live identity, database durability, or real devices.

Payment reconciliation still has a read-merge-unconditional-upsert race; no claim of a payment concurrency fix is made here. No account policy, trial length, pricing, PIN, or App Check enforcement was changed. No live database migration or deployment was performed by Codex.

Cross-instance concurrent watchlist read/replace mutations are still not serialized; a row-lock/CAS design is pending. The durable delete change prevents false success on a cloud failure but does not claim to solve that race.
