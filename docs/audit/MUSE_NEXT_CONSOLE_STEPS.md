# Muse: next browser/console steps after report review

Rahul ke coding changes Codex karega. Tum browser/console verification aur prepared migration application karo; code, function bodies, ya new SQL mat likho.

## 1. Preserve current live deployment

Correct AI Studio app: Bse, app ID acde2ea5-12b1-4320-9997-062cfa57ce61; GitHub dahiyarahul023-sudo/Bsenexus-new. Cloud project groovy-coda-l9v0l, service untitled, us-west1. Reports ke mutabik current revision untitled-00189-tl2 @100%; old untitled-00188-9p9 rollback reference hai. Fresh console se confirm karo. Working revision ko delete/unpublish/reset mat karna.

## 2. Apply prepared migration before new code rollout

New draft PR's branch: fix/live-inbox-watchlist-controls. Read its PR description and docs/audit/LIVE_REPORT_REVIEW_2026-10-04.md. Apply only prepared supabase/migrations/005_user_notification_inbox_clear.sql:

- Staging Bsenexus-staging (vjjdjzehecrdgtonzakv) first. Confirm table user_notification_inbox_state, RPC clear_user_notification_inbox(text), RLS enabled, SECURITY INVOKER, EXECUTE service_role only, anon/authenticated zero table access.
- Then production Bsenexus (ibldmiumivdspzhslsud), compatible schema verified. Record before/after notifications count; this migration does not delete notification rows.
- Keep the result/evidence private and sanitized. Do not copy any secret/token or personal row values into a report.
- If migration errors, stop dependent merge/publish and report the exact sanitized error. Do not invent replacement SQL or rerun 001. 002/003/004 were already applied; this batch needs 005.

## 3. Merge, sync, publish only after migration success

Complete migration checks, mark new draft PR ready/merge, record merge SHA. AI Studio Pull latest main. If both sides have edits/conflicts, record affected filenames and ask Codex to reconcile; do not overwrite blindly. Ensure sync completed, publish once, wait for readiness, record revision and traffic. Preserve previous working revision. Two unchanged failing retries maximum; after that inspect fresh logs and report. Any rollback must restore prior working traffic, not delete data.

## 4. Retest exact bugs

- Clear All opens visible app confirmation. Cancel sends no clear request. Confirm shows Clearing, then success, and all old shared/personal notifications disappear for A across reopen/full refresh. B must still see shared records. A must still receive a NEW notification. Check badge/unread counts.
- Test simulated/outage failure only safely in staging: Clear fails with visible error and does not pretend success.
- Delete List opens visible confirmation. Cancel leaves it unchanged. Confirm deletes an owned test list with a success toast and persists across refresh. Repeat a stale/deleted ID through the normal safe test flow: honest not-found error, not fake success. Check retry feedback on failure. Do not delete real user lists.
- Escape cancels the clear confirmation first, then closes inbox; Escape closes watchlist confirmation when idle. Check narrow screen controls and scrolling. Do not describe desktop emulation as real iPhone/iPad testing.

## 5. Complete missing evidence

- Genuine AI quota test: record usedToday/remainingQuota before and after one real charged generation (not cached summary/heuristic alone), then a controlled restart/revision change and a second session. Verify the same counter remains. Do not perform 100 costly live calls; cap/concurrency tests in staging only.
- Run updated Codex-prepared READ-ONLY docs/audit/schema-contract.sql in actual production. Return FULL sanitized payment RPC definitions, including their JSON return fields, post-002 security flags/search paths, indexes/constraints and table grants available from the prepared script. Include ensure_user_skeleton definition/signature/grants. If export tooling cannot provide these, say exactly what is missing; do not summarize signatures as proof of idempotency.
- Cashfree TEST/sandbox only: genuine successful test order plus repeat delivery/verification of the SAME order. Record stable entitlement expiry and one grant; then test an independent new order. Check the two production destination paths without changing them or making a live charge. A 200 delivery alone is not proof of correct subscription extension.
- Check staging private A notification is invisible to B. Admin Inspect needs Rahul's admin handoff. Personal Telegram linking requires Rahul's bot/chat ownership confirmation; do not fabricate a chat ID.
- Real Android/iPhone/iPad, Safari/Firefox, on-screen keyboard, touchscreen, and feed freshness/latency remain separate pending checks.

Final report: PASS/FAIL/NOT TESTED for each item; migration filenames; exact Git SHA; revision/traffic; sanitized timestamps and evidence. No invented tests or policy decisions.
