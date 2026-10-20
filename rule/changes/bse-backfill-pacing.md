# Change: bounded, paced BSE boot and normal deep walks

- Starting commit: `fecbcfe0f55154710bd861688993b6e0929c3a97` (GitHub main, 8 Oct 2026).
- User objective: execute `CODEX-TASK-bse-backfill-fix-2026-10-08.md` from Bsenexus-Codex-Muse. Cap boot and normal polling at three pages; wait 2.5 seconds before each deeper request; preserve early-stop, retries, headers, timeouts, fallback and backoff.
- Verified facts: `server/services/bse.ts::fetchBSEAnnouncements` previously permitted ten boot pages and fetched deeper pages without pacing. Offline behavior regression returned 500 rows instead of 150 and page two at the same timestamp as page one. `monitor.ts::processAnnouncements` guards overlapping polls with `isPolling` and resets it in finally. `server.ts` awaits the poll before scheduling its next timeout.
- Hypothesis/unknown: Muse's task reports live Akamai 403 and attributes it to bursts. This checkout does not independently establish the live WAF cause or guarantee recovery after deployment.
- Scope/source of truth: bounded backend polling change in `bse.ts`; no API contract or database change.
- Impact: ran `npm run map:impact -- server/services/bse.ts`; reviewed feed-alerts and operations directly. Other selected domains are reached through general routes/server imports; their policy and payloads do not change.

| Consumer | Disposition and evidence |
| --- | --- |
| BSE announcement poll | Changed: maximum three pages in both cycles; 2500ms wait immediately before page 2/3 requests |
| Monitor ingestion, deduplication and alert delivery | Reviewed-and-compatible: same returned rows/NEWSID metadata; existing `isPolling` prevents overlapping monitor runs. Smaller boot window intentionally limits recovery depth |
| Server scheduler, source backoff and diagnostics | Reviewed-and-compatible: scheduler awaits poll; 20/60/300-second backoff untouched. Total latency includes intentional pacing and can show degraded health after a full walk |
| Announcement DAO and UI feed/inbox | Reviewed-and-compatible: no storage/payload/cache/recipient changes; collected rows survive a failed deeper page |
| routes/FAQ/company intelligence/Gemini/results calendar/story feed | Reviewed-and-compatible: exported single-page helpers, date helper, sync routines and diagnostics signatures unchanged; function search confirms monitor is the only caller of the changed poll function |
| Retry/circuit breaker/backup sampling | Reviewed-and-compatible: existing request retries, headers, timeout, fallback chain and periodic backup logic unchanged. No global request-rate limiter is introduced |
| Production WAF/runtime | Blocked for verification here: requires post-Pull/Republish logs and source revision evidence |

- Acceptance: page one has no new delay; all-new boot/normal walks return at most 150 rows; processed/missing IDs stop walking; short/empty pages stop; a failed deeper page retains collected rows and existing 400ms retry.
- Regression: actual TypeScript module executed in a VM with isolated storage/transport and virtual time; no real exchange requests, writes, charges or notifications.
- Verification: `npx tsc --noEmit` passed; `NODE_ENV=test JWT_SECRET=<test-only> npm test` passed 282/282 tests (30 suites); `npm run build` passed; `npm run test:map` passed 6/6; map generation/check passed; full diff reviewed. Existing Vite large-chunk warning only. Cached workspace dependencies were reused, not a fresh npm ci. Build-only version bump restored. The main branch already had stale fingerprints for several calendar/UI files; regenerating updates those fingerprints without changing their source.
- Required host checks: `compile_applet` and `lint_applet` tools are unavailable; local TypeScript/build checks will be recorded separately.
- Deployment: user performs AI Studio Pull + Republish after code delivery. No DB migration. No local result proves deployment.
- Rollback: revert this bounded change; no storage rollback required.
- Risks: three pages cover at most 150 returned rows, not guaranteed downtime duration; other BSE request paths, concurrent instances and cloud IP restrictions can still cause 403. Live observation is the next bounded step.
- Delivery status: implemented and locally verified. GitHub commit/ref and deployment are reported in the accompanying status handoff; local verification does not prove CI or live deployment.
