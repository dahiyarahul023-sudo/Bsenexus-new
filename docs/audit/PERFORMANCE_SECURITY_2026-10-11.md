# Fresh performance and security audit — 2026-10-11

Starting main: `3d925b0b41841a4636fa8336adf41b0339a09760`. Re-read current source and earlier assistant changes, supplied screenshots, release trees, current HTTP response/public login journey, production/staging database catalogs/advisors, clean install, tests and production build. This is a bounded audit with explicit gaps, not security certification.

## Confirmed findings

| Priority | Evidence/problem | Fix/status |
|---|---|---|
| Critical availability | `221879e` removed 485 application files. Bun package.json failure matches its tree. | Exact parent files recovered in `3d925b0`; local build works. Never roll back to deletion commit. |
| High database | Production ensure_user_skeleton(text,bigint) is SECURITY DEFINER, mutable search_path, anon/authenticated execute allowed. Body allows arbitrary UID **free skeleton creation**, not demonstrated paid/admin elevation. Staging already restricted. | Narrow timestamped migration restricts execute to service_role, uses invoker and public.users. PostgreSQL test covers denial, retries and preserving paid users. **Production application pending; no database writes in audit.** |
| High rollout risk | 007_fix_lints_search_path_rls_rpc.sql uses nonexistent payment RPC signatures; actual production bodies use unqualified tables/helpers. | **Do not apply 007 as written.** Correct signatures alone do not prevent empty-search_path payment breakage. Preserve history; reconcile manual migrations before applying only the narrow replacement. Production migration-list API returns no recorded migrations. |
| Dependency risk | Fresh npm production audit: 22 advisories (1 critical, 11 high, 10 moderate), including proxy-addr/compression. Reachability not demonstrated for every advisory. | Updates within declared direct dependency ranges plus grpc-js ^1.14.6 override. Clean install/build/tests pass; repeated production scan reports **0 advisories**, not proof of zero vulnerabilities. No forced Firebase major downgrade. |
| Performance | App eagerly imports feed/home on landing. | Lazy feed/home with skeletons/error boundaries. Retained visited panels unchanged. Remaining bundle/modal code still substantial. |
| Input latency | Default CTA processingMs=400; layout-based shared tab/nav indicators; transition hook recursively reads styles/bounds before paint. | Immediate default action, explicit intervals preserved; CSS transform/opacity indicators; direct-child transition in rAF with lazy completion observer/cleanup. No full-screen blank fade. |
| Animation CPU | ParticleRibbons 10/20 ribbons, 48 segments, many particles at display refresh; hidden tabs still scheduled frames. | 4/8 ribbons, 24 segments, fewer particles, 30fps draws, hidden rAF cancelled. Static reduced motion preserved; device smoothness unverified. |
| Startup | Eager OneSignal, public reCAPTCHA/App Check startup, eager configured Sentry. | Idle push SDK plus immediate explicit-request load; auth assessment still on submission. App Check first interaction. Configured Sentry dynamically loaded; local error boundary captures after initialization, public config fetch bounded 8s. Persisted sign-in/App Check/push browser verification pending. |
| Document defense | Live HSTS/nosniff existed; CSP/frame/COOP absent. | Canonical production base-uri self/object-src none/frame-ancestors self, SAMEORIGIN, same-origin-allow-popups. Preview and /embed/ excluded. Actual HTTP tests cover preview/query/forged forwarded hostname. **No strict nonce/script-src CSP; incomplete XSS mitigation.** |
| Config risk | Server mail/push accepted VITE-prefixed private-key fallbacks; no actual leak proved. | Removed fallbacks. Configure RESEND_API_KEY and ONESIGNAL_REST_API_KEY or server ONESIGNAL_API_KEY. Public Firebase/reCAPTCHA site keys/app IDs remain public. |
| Delivery/cache | AI Studio redirect could escape preview iframe; late font discovery/one-day static caching. | Top-level-only redirect, font preloads, 30-day font/avatars cache without immutable on mutable font names. Infrastructure cache issue remains. |

## Measurements and live baseline

Supplied PageSpeed capture Oct 10 2026 15:44 IST: mobile performance 39, FCP 3.8s, LCP 5.6s, TBT 1780ms, CLS .001, Speed Index 6.8s, main-thread 9.5s, JS execution 3.9s, 20 long tasks. Desktop performance 58/TBT 1320ms. Cloudflare sample shows poor nav/button INP and long LCP tails. This is not a new Lighthouse run.

| Entry JavaScript, same local build | Restored baseline | Changed |
|---|---:|---:|
| Raw bytes | 1,692,008 | 1,464,208 |
| Gzip bytes via Node zlib | 447,053 | 379,109 |

Raw reduction 13.46%, gzip 15.20%. Feed/home/monitoring moved to deferred chunks; total later-session download does not fall by that amount. Deferred Sentry ~89.63KB raw; CSS still ~353KB raw. No modulepreload scripts in built HTML. Do not promise a 90+ score.

Oct 11 live HTTP 200, Cloudflare DYNAMIC, private cache with platform cookie although source sets public homepage cache. Infrastructure cookies can defeat shared caching; do not change private API caching or billing to disguise it. Browser baseline homepage rendered; Enter Live Terminal opened login dialog with reCAPTCHA Ready. This does not verify a signed-in feed journey. Extension console errors excluded.

## Other boundaries re-reviewed

- Session secret fails closed; Firebase identity/session verification, protected routes, owner/admin checks retained. Existing denial/ownership tests pass. LocalStorage ID tokens remain XSS exposure; strict CSP/session-storage redesign is a separate unresolved security task.
- Payment DAO/RPC signatures, ownership and existing grant/referral/quota tests reviewed. No prices, webhook/expiry/paid grant logic changed; no real payment performed.
- Existing BSE PDF allowlist/redirect bounds and bounded CRON_SECRET polling remain. Cron not invoked; Scheduler/heartbeat production verification still pending per ANNOUNCEMENT_SCHEDULER_2026-10-10.md.
- All 27 production application tables have RLS enabled. Missing policies default to denial, not demonstrated public table exposure. Avoid cosmetic policies merely to clear messages.
- Four production invoker payment/demo functions retain mutable search_path warnings; qualify/rehearse full bodies before changing configuration. Five referral FK indexing advisories and duplicate notification indexes need workload/query-plan review. No index dropped from usage counters alone.

## Validation and limits

- Clean isolated npm ci --ignore-scripts --no-audit --no-fund: 644 packages; actual Firebase patch applied.
- NODE_ENV=test, local-only JWT_SECRET, TEST_RUNNER=1 npm test: 340/340 pass, zero skipped. Includes mocks/source assertions/PostgreSQL WASM, not all production integration checks.
- New header and skeleton PostgreSQL tests rerun after corrections: 2/2 pass.
- Typecheck/production build pass; build --ignore-scripts avoids verification-only version bump. Map tests 6/6; generate/check pass.
- Initial tests lacked JWT_SECRET; header test caught Helmet's required default-src opt-out. Corrected and rerun. Build caught test result typing, also corrected. No failing check relabeled passing.
- compile_applet/lint_applet host tools unavailable; repository equivalents used.
- New-source browser/device/focus/reduced-motion/offline/lazy-failure/auth/push matrix **blocked**: no browser binary; official Chrome download invalid/truncated. Live baseline observed separately. No new-source browser pass claim.
- Main commit is not AI Studio republish, deployed SQL, CI pass or verified live speed. No new PageSpeed/INP result yet.

## Release and rollback

1. Import current main into AI Studio, keep package.json/src/server files, configure server-only mail/push key names, Republish and verify revision/login/terminal.
2. Reconcile manually applied Supabase history; do not blindly db push 001–007. Review/apply only 20261011031315_restrict_user_skeleton_rpc.sql. Re-query privileges and verify service-role idempotency/paid preservation in rollback transaction.
3. Check canonical headers, preview iframe, embed widget, Google popup, persisted session/App Check, explicit push and hidden-tab resume. Rerun mobile/desktop PageSpeed and real INP before declaring performance solved.
4. Verify Scheduler bearer secret and [POLLER] heartbeat separately, without printing secret values.
5. Application rollback target recovered 3d925b0. Do not re-enable public helper execute to fix unrelated deployment symptoms.
