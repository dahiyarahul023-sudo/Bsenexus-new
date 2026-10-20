# PR #2 live verification and the four code-review questions

## Evidence boundary

Rahul forwarded Muse's live verification: PR #2 merged at `21f3ebc`, AI Studio pulled without conflicts, revision `untitled-00190-qdf` serving 100% from 13:46 IST, migration 005 applied in staging/production, rollback `untitled-00189-tl2` kept at 0%. Codex independently verified GitHub main `21f3ebc9400744f47b04603065421383bba280b2`, with unchanged code tree `14075448a8bbfa380fe6f6b19f248fd722b5a993`. The deployed revision/database checks are Muse's report, not a new console inspection by Codex.

Reported PASS: account-only Clear All, shared-row preservation, Delete List confirmation/busy/toast/Undo/refresh persistence, Escape behavior, one genuine charged synthesis with `ai_quota_days.used=1` across a fresh login, and duplicate delivery of one Cashfree order to both endpoints with one grant and correct expiry arithmetic. These improve the prior evidence. Fresh login is not a Cloud Run restart or simultaneous replica test. One duplicate order does not prove every concurrent payment/reconciliation path; the existing reconciliation read-merge-upsert race remains open.

## 1. Reservation with refunded=false after successful generation

Current code intentionally keeps the cloud reservation as a debit/refund receipt. `manage_ai_quota('reserve')` increments the day's `used` once and inserts the request ID. `refund` decrements that original day's counter once, only for the same UID. A successful generation must NOT be marked refunded: that would give its charged unit back. Quota status reads `ai_quota_days.used`, not the count of reservation rows. Neither the row nor its refunded flag is an active lock; the advisory transaction lock is released at commit.

`completeServerAiQuotaReservation` currently clears only the development process's local refund record. A clarifying comment has been added; no SQL behavior changed.

Real limitations: the schema has no durable completed/failed/unknown distinction, no retention job, and no crash/outcome reconciliation. Historical rows can accumulate. Without an explicit completion event, an unrefunded record alone cannot distinguish a completed generation from a crashed/unknown request. Do not auto-refund or delete these rows by age alone: deletion also erases reservation-ID idempotency evidence. A later additive lifecycle design must make completion/refund mutually exclusive, preserve charged usage and reset semantics, and define a retry/retention horizon. Existing ambiguous rows cannot be safely backfilled as consumed from refunded=false alone. This review does not claim to fix that lifecycle/retention debt.

## 2. Four payment RPCs with proconfig NULL

`NULL` means no function-local SET configuration. It is not proof that the inherited search path is safe, nor an explicit safe-path design. Migration 002 deliberately repaired execution grants and changed SECURITY DEFINER to SECURITY INVOKER, without rewriting unseen live function bodies or search-path references.

Preferred final state: explicit schema-qualified tables/called helper functions and a pinned empty search path, tested against the actual nine/six/two/one-argument live contracts and return values. Blindly setting the path empty can break bodies that currently use unqualified payment tables/functions. The old repository 001 contains a DIFFERENT five-argument payment function and is not the live body. Do not replace the working live RPCs with it.

Needed: the actual output of `pg_get_functiondef` for ALL overloads, current `proconfig`, owner/security flags, execution grants, and payment table grants. `docs/audit/schema-contract.sql` on main is the SELECT script that produces the export, not that export itself. The PDF/signature summary and latest text handoff do not include those bodies. No payment path or schema was altered in this batch.

Official guidance: https://supabase.com/docs/guides/database/functions and https://www.postgresql.org/docs/current/sql-createfunction.html — empty search paths require schema-qualified relations; privileged functions must exclude untrusted writable schemas from lookup.

## 3. User-visible quota counter

Implemented Settings > Subscription & Billing > AI summary usage: verified server `usedToday / dailyLimit`, remaining count, daily reset at 00:00 IST, explicit loading/unavailable/retry states, one-time demo label for Free, and no daily cap ONLY for a server-confirmed admin.

Results Calendar previously showed `Pro Unlimited` to Pro users. It now shows their actual remaining daily allowance; Free is described as a one-time demo rather than free-today.

The existing shared localStorage quota keys were date-only and could carry one account's remaining count into another account's display. They are now ignored: live hook state uses the authenticated server result and cancels/discards stale requests on identity change. Generation responses trigger a fresh quota read instead of writing shared browser counters. Refresh runs on focus/visibility, explicit retry, generation events and the IST day boundary. Malformed/inconsistent counters are treated as unavailable, never fabricated as zero-used/full allowance. The backend remains the enforcement authority. No quota/trial/price policy or database migration changed.

## 4. ensure_user_skeleton SECURITY DEFINER with anonymous execution

NOT confirmed safe/by-design. Neither the function body nor its CREATE definition is in this repository, and no application call to it was found. Firebase is this application's auth provider; it does not automatically make a Supabase anonymous caller a verified Firebase UID.

"Only inserts a free skeleton" does not establish caller-bound UID validation, overwrite prevention, invocation-rate control, safe defaults, or a safe search path. Possible impacts include arbitrary-UID row creation, account/trial-state pollution or storage spam; these are hypotheses until the body is inspected, not claims of a reproduced exploit.

Needed: actual function definition/signature/owner/proconfig and execute ACL, parameter handling, ON CONFLICT behavior, and any trigger/external caller using it. Check whether caller identity is cryptographically verified/bound to the requested UID; ensure callers cannot select Pro/expiry fields. If backend-only, prefer service-role-only invocation/SECURITY INVOKER. If a definer/trigger is genuinely required, constrain its scope and pin a safe schema-qualified path. No permission change is applied blindly in this review.

## Validation and next handoff

Configured Node tests: 219/219, 25 suites, zero failures. TypeScript lint and production build passed. Chromium 153: 15/15 scenes at 390/820/1920 px covering Pro counts, generation-event refresh, manual Refresh/reload, Free one-time labels, admin null/Infinity handling, 503 retry and malformed-response rejection; zero page errors. Legacy date-only browser counts were deliberately poisoned and ignored. Browser evidence: `quota-ui-browser-proof.json` (mock API, emulated viewports; not live accounts or real devices). Compile/lint applet tool names required by AGENTS are not exposed; repository lint/build were used.

Muse: no infra repair or migration is needed for this code batch. Merge the quota-display PR after review, pull its merged main into the correct AI Studio app, publish normally, then check the counter before/after one genuine charged synthesis, manual Refresh, Free demo/admin labels, and error feedback. Keep the current working revision as rollback reference. Separately return SANITIZED actual SQL export rows for the four payment RPCs and ensure_user_skeleton; do not write replacement SQL, alter permissions, refund the successful reservation, or reset usage. No live charge or secret values are needed.
