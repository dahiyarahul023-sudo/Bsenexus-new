# Directory counts, navigation feedback and IndexNow

Starting remote main: `dee5e3dbe26faac89ad13b09ac6a9703fda0d276`. Scope and evidence dated 21 October 2026.

## Requested outcome and initial evidence

Settings Companies/AI clicks must immediately show existing skeletons and preserve Back/Forward. Keep the current 28 company/exchange entries in order, append Nexus Select Trust, and derive all displayed totals from the actual list (now 29). Notify IndexNow in one background batch after confirmed public filing storage, with a durable per-URL 24-hour cooldown and at most one later retry. Indexing failure must not block ingestion.

Initial source: Settings assigns location.href before UI feedback; standalone route Suspense uses a spinner. Directory/client/server/home lists are duplicated. The previous merge removed old count copy rather than exposing the live total. The old IndexNow submitter has a source-coded key, prefix-only URL checks, 30-second/20-URL eager submission, no durable cooldown and unbounded requeue; ingestion submits up to 50 items including skipped rows before storage confirmation. These are source findings, not a measurement of hosting latency.

Before editing, ran `npm run map:impact` across Settings/App/PageSkeleton/directory/config/server/indexNow/announcementDao/guideIndexNow/seoRoutes; output `/tmp/directory-indexnow-impact.log`. Read the navigation/public/feed/SEO/storage/operations domains and traced literal route/event/RPC consumers. No module was deleted or renamed; the old BSE_26_COMPANIES export remains an alias.

Nexus identity verified against [BSE](https://www.bseindia.com/stock-share-price/nexus-select-trust/nxst/543913) and [issuer](https://www.nexusselecttrust.com/): NXST, BSE 543913, ISIN INE0NDH25011, retail REIT. [IndexNow protocol](https://www.indexnow.org/documentation) supplies key proof, batch limit and acceptance semantics. Google does not support IndexNow; no crawl/ranking/snippet timing guarantee is made.

## Consumer dispositions and action ownership

| Consumer | Disposition and evidence |
|---|---|
| Settings tool rows/search | Changed: Companies & Exchanges subtitle derives total; Companies/AI actions call the existing onNavigate. Standalone Settings without that callback retains its href fallback. |
| App route/history owner | Changed: companies/plugin set history/currentRoute immediately, save the originating scroll and show the existing PageSkeleton during cold lazy imports. Existing popstate/URL synchronization reviewed and browser-checked for Back/Forward and reload. |
| Loading/styles/error recovery | Changed: existing PageSkeleton gains titles only; existing loading CSS, light/dark/reduced-motion tokens and TabErrorBoundary/lazy retry remain compatible. No new loading primitive or artificial production delay. |
| Directory/client/server/landing | Changed: companyDirectory owns membership/order, description and badge. CompaniesPage filters, meta/paragraph/badge, Settings subtitle, server directory/SPA metadata/schema and topCompanies consume it. Original 28 identities/order preserved; NXST appended. Historical counts in dated change records and marketCapRank values are not current UI counts. |
| Company identity and public discovery | Changed: curated NXST identity resolves even if absent from the separate stock master; shared sitemap generation, static sitemap and no-JS links include it. Existing exchange-specific profiles and independent-site disclaimer remain compatible. This does not expand filing intake/watchlists or assert affiliation with the issuer. |
| Filing writer | Changed: collect only new/public-content-changed rows after successful Supabase upsert; no submission for skipped/unconfirmed or delivery-flag-only changes. Background IndexNow queue receives company URLs plus announcements. Actual DAO test pauses storage to prove no pre-confirmation enqueue. |
| Monitor and worker lifetime | Changed: beginBatch holds the existing queue during poll collection, releases idempotently in finally, including source timeout; overlap skips without acquiring a hold. Existing raw delivery, result AI and recipient policy remain compatible; poller-stall regressions pass. |
| IndexNow primary/guide/admin consumers | Changed: existing notifySearchEnginesOfNewPages and guide caller feed one queue; public canonical paths only, max 10,000 distinct URLs per POST. Existing provider circuit remains active. Admin ping/stats retain guarded routes and now expose primary mode. Guide eligibility remains unchanged. |
| Durable ledger | Changed: service-only RLS table and invoker enqueue/claim/complete RPCs. Atomic SKIP LOCKED claims reserve 24 hours before HTTP across instances and restart; versions retain newer changes after stale receipts. Failed acceptance permits one retry after 24 hours. Indexing I/O is never awaited by ingestion. |
| Startup/key | Changed: server-only INDEXNOW_KEY env, validated public-key-file bootstrap when unset, dynamic root verification route, optional server/cloudflare/off mode. Directory content fingerprint queues one update per actual list/copy change; NXST queues its initial profile. Stable versions prevent startup resubmission. No literal key is embedded in client/server modules. |
| Cloudflare/hosting/search | Blocked external observation: Cloudflare account/config and hosting publish control are not exposed. Crawler Hints state is unknown; it was not changed/enabled. Existing server primary is replaced, not duplicated. Hosted key verification, real accepted filing POST and external snippet refresh remain publication gates. |

## Database rollout evidence

Created the additive migration through Supabase CLI: `supabase/migrations/20261021133613_indexnow_url_cooldown.sql`. Applied to staging `vjjdjzehecrdgtonzakv`, then production `ibldmiumivdspzhslsud`. Actual SQL assertions under service_role confirm one claim, blocked second claim, and a 24-hour reservation; transactions rolled back fixtures. Verified production RLS enabled, anon SELECT denied, authenticated RPC execution denied. No real IndexNow POST was generated by these checks.

Supabase advisor reports intentional INFO `rls_enabled_no_policy` on this service-only table. Browser roles have no table/RPC grants; server service_role owns access. See [advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). There is no task-specific warning/error requiring a policy that grants browser access.

## Verification evidence

- `npm run lint` and `npm run build --ignore-scripts`: pass (tsc, Vite, server bundle; skip version-bump lifecycle only).
- Full isolated suite: `NODE_ENV=test JWT_SECRET=calendar-test-only node --import ../offline-test-guard.mjs --test --import tsx server/tests/*.test.ts`: **616 passed, zero failed**, `/tmp/directory-indexnow-full-release.log`. External provider traffic blocked; loopback/fake responses allowed. SQL concurrency/cooldown/retry/stale-receipt/grants, actual ingestion confirmation, key HTTP route, count/order/future-entry and existing regressions pass. Accepted HTTP status remains observable even if receipt persistence fails; failed storage uses the background interval rather than a one-second retry loop. No real provider acceptance claimed.
- Delayed-chunk Chromium checks at 390, 768 and 1440 CSS pixels use actual App/SettingsTab/CompaniesPage/AiPluginPage/PageSkeleton/TabErrorBoundary and production CSS. Synthetic auth/API adapters and a thin Layout isolate this journey. Artificial 1.8-second lazy-chunk delay is fixture-only. Both skeletons appear within 700 ms; internal navigation retains document identity; directory badge/filter/meta show 29, exactly 29 links preserve order; no horizontal overflow or page errors. Back/Forward and direct reload pass. Light/dark themes covered; desktop entry uses keyboard Enter and reduced motion. Physical device gestures, real auth/OAuth and full Layout are not certified.
- Visually inspected phone companies skeleton, tablet dark AI skeleton and desktop full directory screenshots under `/workspace/scratch/9f6c59702e8b/directory-nav-qa/`; no clipping or unrelated filing fallback. Browser log: `/tmp/directory-browser.log`.
- Required host-only compile_applet/lint_applet tools are unavailable. Configured tsc/Vite/esbuild checks supply local compile/lint evidence; they are not relabelled host checks.
- Semantic domains, frontend map/strategy and generated maps are maintained in this change. map:generate/map:check and six test:map checks pass; git diff --check passes. GitHub CI and merge state belong to the associated PR.

## Publication and rollback

Schema applied independently; source/CI/merge are separate from deployment. After hosting republishes, verify /companies badge/filter/meta total, fetch the generated root key URL as text/plain 200, and observe one new confirmed filing batch accepted with HTTP 200/202 in server logs. This session cannot certify the external search snippet or trigger a genuine filing just for testing. INDEXNOW_SUBMITTER=off disables background submission; cloudflare selects that primary only after its settings are independently checked. Runtime rollback can leave the additive unused service-only table in place.

Delivery: implementation and local/browser/schema verification complete. GitHub records the associated PR checks and merge status. Hosting publication and real provider acceptance remain unverified.
