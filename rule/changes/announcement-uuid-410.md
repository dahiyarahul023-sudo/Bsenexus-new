# Change: 410 Gone for dead legacy UUID announcement IDs

- Starting commit: 2fafd9fa14c7c2ee1bdcd4ab907b59a1cd7a6b7e (main HEAD 2026-10-19)
- User objective and acceptance cases: weekly autonomous code-health scan (2026-10-24). Bing Webmaster (checked 2026-10-18) reports 3 announcement URLs returning 404 on crawls of 7/14/15 Oct — all old UUID-style IDs from a retired URL scheme. Acceptance: (1) a UUID-shaped `:newsId` that misses the DB lookup now returns 410 Gone instead of 404 on both `/announcement/:newsId` and `/filing/:symbol/:newsId`; (2) all currently-valid announcement/filing URLs keep resolving exactly as before (200); (3) non-UUID unknown IDs still return 404; (4) `batch_test_` behavior unchanged (already 410); (5) routeResolution/seoPrehydration/searchEngineDiscovery tests still pass.
- Verified facts (file + symbol):
  - server.ts `/announcement/:newsId` handler (~line 5620) and `/filing/:symbol/:newsId` handler (~line 5544) both resolve via `getAnnouncementById()` (server/database/announcementDao.ts:181) and 404 when it returns null.
  - `getAnnouncementById` checks the in-memory cache (`a.id === newsId || a.newsId === newsId`) then Supabase `.eq('id', newsId)`; write path (`saveAnnouncementsBatch`, announcementDao.ts:529) always uses `docId = data.newsId`, and every poller input inspected (bse.ts, monitor.ts:355, resultsCalendarService.ts) carries `newsId` (BSE `NEWSID` or `corp_nse_*`) and no `id` field — UUIDs are never minted as newsIds by the current write path.
  - Existing precedent: `batch_test_` IDs already get 410 with the comment "Confirmed-dead test URLs can never become real content: 410 Gone so Google drops them from the index faster instead of retrying them as 404."
  - Sitemap (`/sitemap-filings-hot.xml`, last 7 days) and route contract verified airtight for current data: sitemap emits `ann.id || ann.newsId` from memory items shaped `{id: data.newsId, ...safeData}`; row `id` = newsId. No `id`-field override exists on any save path.
- Assumptions/unknowns and how they will be resolved: the exact 3 Bing URLs are not visible from here (no Bing access in this run); "old UUID-style IDs" per the 2026-10-18 deep-dive note. The fix does not depend on their exact values — any UUID-shaped miss is permanent under the current scheme. Verified by unit test on the regex + handler-level reasoning; no prod DB access needed (and none used).
- Changed source of truth: server.ts only — new module-level `LEGACY_UUID_ID_RE` const + extended 410 condition in the two `!announcement` branches.
- Impact command and affected semantic domains: `npm run map:impact -- server.ts` — domains: public-contract (SSR routes, SEO), faq-search-seo, seo-prerender consumers. Candidate tests: routeResolution, seoPrehydration, searchEngineDiscovery.
- Related consumers: API, UI, storage/RPC, jobs, caches, manual copy: pageRenderCache — 410 responses are not cached (only successful renders are cached via `pageRenderCache.set` on the 200 path); no storage/RPC/API contract change; no UI change (React app never links UUID URLs — sitemap/RSS/related-cards all emit newsId URLs).
- For each relevant consumer: changed / reviewed-and-compatible / blocked, with evidence:
  - `/announcement/:newsId` + `/filing/:symbol/:newsId` dead-UUID branch: changed — 404 → 410.
  - Crawlers (Googlebot/Bingbot): reviewed-and-compatible — 410 is the standard "permanently gone" signal; drops dead URLs from the index faster than 404 retries.
  - Sitemap/RSS/related filing cards: reviewed-and-compatible — untouched; they never emit UUID URLs.
  - In-app navigation: reviewed-and-compatible — no UUID links exist in src/.
- Assignment scope: backend / SEO metadata; no visual or behavior change for users or valid URLs.
- Frontend: n/a.
- UI state/device matrix: n/a (no visual change; error page markup unchanged, only status code).
- Expected user-visible effect: none. Crawler-visible: dead legacy UUID URLs deindex faster.
- Failure/security/concurrency cases relevant to this change: the 410 fires only AFTER `getAnnouncementById` (memory + Supabase) returns null, so a UUID that actually resolves (legacy row with UUID primary key) still serves 200 — no false 410s. Regex is strict 8-4-4-4-12 hex; non-UUID unknown IDs keep 404. No injection surface (regex test on already-validated route param; page HTML unchanged).
- Implementation and coordinated updates: see files; map regenerated in same push.
- Commands actually run and results:
  - `npm run map:impact -- server.ts` — domains: public-contract, faq-search-seo; candidate tests: routeResolution, seoPrehydration, searchEngineDiscovery.
  - `npm run lint` (tsc --noEmit) — clean.
  - `node --test --import tsx server/tests/routeResolution.test.ts` — 8/8 pass (7 existing + 1 new UUID-410 regression test).
  - `node --test --import tsx server/tests/seoPrehydration.test.ts` — 10/10 pass.
  - `node --test --import tsx server/tests/searchEngineDiscovery.test.ts` — 1 pre-existing failure (index.html title starts with "BSE…" not "Bsenexus" — deliberate 2026-10-18 CTR-overhaul decision; test assertion stale; NOT touched by this change, reported as proposal).
  - `npm run map:generate` + `npm run map:check` — 423 files, 1122 import edges, 24 semantic domains verified; `npm run test:map` 6/6 pass.
  - `npm run build` — ok (12.70s; pre-existing chunk-size warning, untouched).
- Required checks unavailable (reason; do not mark passed): live Bing/GSC re-crawl verification (needs his Republish + crawler revisit); no browser check in detached run.
- Deployment/migration requirements and rollback: revert commit; needs Rahul's AI Studio sync + Republish to go live. No migration.
- Remaining risks and next bounded step: none identified; Bing/GSC should drop the 3 dead URLs on next recrawl after deploy.
- Graph/domain/documentation refreshed: `npm run map:generate` in same push.

- Delivery status: commit / merge / CI / deployment, reported separately.

## Frontend action and consistency record (when applicable)

n/a — no frontend action.
