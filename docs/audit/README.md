> Latest: [Muse report review and live-control fixes](LIVE_REPORT_REVIEW_2026-10-04.md). [Next console steps](MUSE_NEXT_CONSOLE_STEPS.md). Migration 005 must precede rollout; inventories below describe the earlier audit snapshot.

> Latest follow-up: [FOLLOWUP_2026-10-04.md](FOLLOWUP_2026-10-04.md), [Muse console-only instructions](MUSE_CONSOLE_ONLY.md). Register now has 45 findings; original audit counts/evidence below are historical. Follow-up is staged on a migration-dependent PR.

# Bsenexus audit — repository map and verified findings

Audit baseline: `dahiyarahul023-sudo/Bsenexus-new`, main `55d35a16a0a0b09017f685af4f4170acc2d30b3e`. All 284 baseline blobs were materialized and matched their Git blob SHA. Latest storageMonitor numeric-scrip fix is preserved. This report covers this repository, not every repository in the account.

There are **44 finding records**: 2 critical, 18 high, 23 medium, 1 low. These are identified baseline issues, design risks and pending checks; they are **not 44 remaining confirmed exploitable vulnerabilities**. Read each status and evidence. Urgent source fixes are included in the accompanying commit. Live database permissions, production deployment and actual payment success have not been verified.

## Start here

| Register | What it contains |
|---|---|
| [findings.csv](findings.csv) / [findings.json](findings.json) | Severity, channel, evidence, changed/open status, source and next action for all 44 records |
| [file-register.csv](file-register.csv) | Every source-tree file, line/byte counts, direct imports and reverse imports |
| [route-register.csv](route-register.csv) | Route registrations and explicit middleware; see mount inheritance below |
| [control-register.csv](control-register.csv) | JSX controls with source locations, labels, handlers, disabled expressions and destinations |
| [SYSTEM_MAP.md](SYSTEM_MAP.md) | Components, authentication/payment/feed request flows, credentials and storage ownership |
| [validation.md](validation.md) | Tests, SQL proof, browser coverage and limits |
| [schema-contract.sql](schema-contract.sql) | Read-only deployed Supabase introspection; no data mutation |
| [HANDOFF_HINGLISH.md](HANDOFF_HINGLISH.md) | Morning questions and detailed browser-agent deployment investigation |

Run `AUDIT_BASE_SHA=<actual-head> node scripts/audit-map.mjs docs/audit` to regenerate the inventory/CSVs. Pass a file as the third argument to inspect transitive import impact: `node scripts/audit-map.mjs docs/audit server/services/aiQuotaService.ts`. Do this on the actual checkout, and inspect HTTP/storage/runtime links separately. Generated counts describe that snapshot, not an invariant feature count. Control IDs depend on traversal order and can change after edits.

## Counted scope

At the final source-map checkpoint, before audit documentation: 293 files, 228 JS/TS-family files, 93 TSX files, about 83,552 production/script code lines, 696 local import edges, 183 route registrations (182 outside tests), 24 middleware mounts (18 outside tests), 1,069 JSX control occurrences, 210 recognized fetch call sites, 212 recognized storage-reference occurrences, 77 distinct environment variable names, 0 unresolved literal local imports. Total text lines include locks, data and docs and should not be called production LOC. API arrays register several paths in one occurrence; these counts are not distinct endpoint counts.

The static map visits all files and parses all JS/TS source. Type checking covers compiled sources. Security-critical modules and selected functional flows received targeted manual inspection. **Every source line has not received a completed manual semantic review, and every visible button has not been individually clicked.** Registers mark remaining coverage explicitly. A clean type check is not proof of business correctness.

## Audit boxes / channels

1. **Security:** identities, owner/admin gates, tokens, SSRF, quota abuse, secret boundaries, RPC permissions, dependencies.
2. **Payments:** server plan catalogue, order ownership, Cashfree signature/status checks, durable grants, expiry/repair races, trial eligibility.
3. **Data integrity:** genuine source vs fixture data, stale cache, story/summary provenance, delivery bookkeeping, notification persistence.
4. **Routing and controls:** each extracted control/handler, deep links, checkout, Save Note, missing actions and false success messages.
5. **Devices and accessibility:** viewport geometry, fixed elements, dialogs, touch targets, safe areas, keyboard and assistive technology.
6. **Performance:** initial bundle, source polling, cache freshness, backoff, cold start, stage-to-stage filing latency.
7. **Deployment:** current revision, project/service, database migration state, build/republish logs and rollback.
8. **Validation:** reproducible tests, isolated attack probes, real-browser coverage and production unknowns.

## First fixes to verify in production

* SQL `002_restrict_privileged_rpcs.sql` restricts privileged RPC execution, including deployed overloads, to service role and removes definer elevation. This is a repair for existing functions, **not** a missing-function/schema installer. Review actual deployed function definitions and service-role table grants before applying it. Do not rerun the initial schema over an existing deployment.
* SEO API now requires admin and rate limiting; URL scraping restricts public IPv4, pins DNS, validates redirects and caps the body. Legitimate IPv6-only hosts cannot be scraped.
* PDF proxy and Gemini attachment downloader share strict HTTPS BSE-host/redirect validation and streaming size limits.
* Shared Telegram broadcasts/global history and priority mutations require admin. Personal news delivery cannot fall back to the shared channel. Telegram ownership binding is still incomplete.
* Local AI budget consumption is serialized; only verified admin role bypasses quotas. Exception cleanup refunds once. Configured cloud failure cannot reissue a one-time demo through local fallback. A distributed quota remains required.
* Fake initial filing/index/fund-flow/story values and fabricated security success metrics were removed from audited runtime outputs.
* Deep filing URLs, malformed path handling, /settings refresh, dedicated pricing/selected checkout and standalone Save Note login hosts were repaired. Username suffix truncation and send-before-mark bookkeeping were repaired.

## Subscription deployment blocker

The backend and migration in Git do not describe the same database. `grant_payment_atomic` expects 9 named arguments and a durable entitlement return shape; initial SQL defines 5 arguments and `{ok:true}`. `record_pending_order_atomic`, `claim_order_for_grant`, `claim_free_summary_demo` are absent. Payment ledger status/timestamp fields and entitlement columns differ. `notifications` and `auth_account_limits` are absent; users/announcements also need contract reconciliation. This can yield missing-function errors, failed writes, ephemeral fallbacks and payment access not appearing.

An actual live database may contain manual additions absent from Git. Do not assume it is empty or broken from the repository alone. Export read-only introspection with `schema-contract.sql`; produce an additive migration and backfill plan from actual state; verify on a copy. Paid grants must atomically lock the order and UID entitlement, enforce order owner/amount/currency/plan, grant once on server-verified paid status, extend correctly and return the already-granted expiry on retries. Confirm user-profile mirror and authoritative entitlement survive restart. Do not turn payment failure into a silent local success.

## Security levels comparison

Use OWASP ASVS 5 as a requirements/evidence checklist, not a badge or numeric assurance score. Basic anonymous/admin route denial is a subset of verification. A serious authenticated application target also needs tenant isolation, session revocation, fresh admin step-up, atomic payment/quota controls, source integrity, controlled egress, logging and tested deployment configuration. Higher-assurance review adds independent verification, stronger key/session lifecycle, attack modeling and full traceability. This audit does not certify any ASVS level.

Authorized attack work was restricted to isolated local apps/PostgreSQL and mock redirect/DNS destinations. No real customer entitlement was modified, no live metadata service contacted, no charge/refund sent, and no production load/abuse campaign run. Next use a staging copy with synthetic accounts and sandbox payment credentials; a real production probe needs its own exact scope and rate/window.

## Performance and browser limits

Build output has an approximately 1.63 MB initial JS chunk (~419 kB gzip), despite route-level lazy loading. Backend market feed polls at 20 seconds, off-hours at 5 minutes; source blocking can back off to 20/60/300 seconds. Client announcement poll is 30 seconds, server announcement cache 15 seconds, with browser max-age/SWR; quotes poll at 60 seconds on client. These overlapping layers explain possible delay but do not constitute a measured end-to-end bound. Add stage timestamps and measure p50/p95/p99 before promising instant/fastest filings.

243 fixture UI scenes cover guest/Pro/admin, 9 routes, and 9 widths from 320 to 1920 px in Chromium 153. They had no horizontal document overflow and no page JavaScript exceptions. 24 further scenes operated pricing/Save Note and checked bottom-scroll overlap. Intentional notification prompts can occlude the background. These are synthetic UI states, not proof of real authentication, billing, live market access or durable cloud writes. Safari/Firefox/WebKit, actual iPhone/iPad, keyboard/focus/screen-reader behavior, zoom, landscape and poor-network performance remain pending. Installing the usual Chromium download failed repeatedly; an isolated alternative Chromium binary was used, without changing app dependencies.

## Primary references

* [Supabase database functions](https://supabase.com/docs/guides/database/functions): security invoker/definer and explicit function EXECUTE restriction.
* [OWASP ASVS](https://owasp.org/projects/asvs): verification requirements and versioned evidence.
* [Cashfree webhook idempotency](https://www.cashfree.com/docs/payments/online/webhooks/webhook-idempotency): final paid event and deduplication principles.
* [Cloud Run service resource](https://docs.cloud.google.com/run/docs/reference/rest/v2/projects.locations.services): etag conflicts and reconciliation state.

Supabase and Cloud Run production status remains pending. A source push by itself does not update SQL permissions or prove successful republish.
