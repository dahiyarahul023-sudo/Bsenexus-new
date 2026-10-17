# Change: weekly code-health scan fixes (2026-10-17)

1. /announcements JSON-LD ItemList now uses real latest filings instead of 4 hardcoded fictional entries.
2. Two LandingPage guide hrefs retargeted from 404 slugs to existing server guide slugs.
3. clipboard.writeText unhandled rejection guarded; per-load OneSignal console.log removed.
4. Deleted two verified-dead files (legacy src/sentry.ts, unreferenced SlidingTabList.tsx).

- Starting commit: f7011b30ee05e8a92149cf74f2457ee682edfa87 (main HEAD 2026-10-17)
- User objective and acceptance cases: weekly autonomous code-health scan. Google structured-data policy requires markup to reflect actual page content. Acceptance: (1) no hardcoded company names in /announcements CollectionPage JSON-LD; (2) ItemList entries, when present, match the same real filings rendered as pre-rendered cards; (3) numberOfItems equals the actual item count; (4) empty feed degrades to a neutral CollectionPage without ItemList; (5) all existing seoPrehydration/route tests still pass.
- Verified facts (file + symbol):
  - server.ts `injectTabSeoMetadata` (announcements/live branch) injects a CollectionPage with hardcoded `itemListElement` of 4 entries: "RELIANCE INDUSTRIES LTD. - Financial Results (SEBI LODR 33)", "TATA CONSULTANCY SERVICES LTD. - Audited Results & Dividend Declaration", "LARSEN & TOUBRO LTD. - Order Win Disclosure under Regulation 30", "INFOSYS LTD. - Schedule of Earnings Conference Call", `numberOfItems: 4`.
  - server/services/seoPrerender.ts `buildAnnouncementsFeedCards()` already renders up to 24 REAL filing cards (same `getRecentAnnouncements(30)` source, all dynamic HTML escaped) into /announcements server HTML.
  - The hardcoded names are not derived from any data source; the pre-rendered cards are. Mismatch = misleading structured data risk.
- Assumptions/unknowns and how they will be resolved: none material; `getRecentAnnouncements` is the same DAO already used by cards, sitemap-filings-hot and RSS.
- Changed source of truth: server/services/seoPrerender.ts (new exported `buildAnnouncementsCollectionJsonLd()`, internal `getAnnouncementsFeedItems()` shared by cards + JSON-LD); server.ts (`injectTabSeoMetadata` announcements/live branch becomes neutral CollectionPage with marker comments; dedicated `/announcements` handler swaps the neutral block for the dynamic JSON-LD when items exist); src/components/LandingPage.tsx (2 guide hrefs retargeted from 404 slugs to existing server slugs); src/components/NewsPortal.tsx (clipboard.writeText .catch); src/utils/oneSignal.ts (removed per-load console.log); deleted dead files src/sentry.ts (legacy duplicate of src/lib/sentry.ts) and src/components/ui/motion/SlidingTabList.tsx (zero references) via contents API.
- Impact command and affected semantic domains: `npm run map:impact -- server/services/seoPrerender.ts server.ts` — domains: seo-prerender / spa-shell-rendering; consumers: /announcements route, ?tab=announcements, ?tab=live.
- Related consumers: API, UI, storage/RPC, jobs, caches, manual copy: pageRenderCache (5-min TTL) caches the combined HTML+JSON-LD — consistent. No storage/RPC/API contract change. No UI change for users (React replaces cards on mount; JSON-LD invisible).
- For each relevant consumer: changed / reviewed-and-compatible / blocked, with evidence:
  - /announcements server HTML: changed — neutral JSON-LD replaced by dynamic one built from the same items as cards.
  - ?tab=announcements / ?tab=live on other routes: changed — fictional items removed; neutral CollectionPage remains (sync path cannot fetch).
  - Googlebot/crawlers: reviewed-and-compatible — markup now matches visible content; bot and user get the same content (no cloaking).
  - Sitemap/RSS: reviewed-and-compatible — untouched.
- Assignment scope: backend / SEO metadata; no visual or behavior change for users.
- Frontend: n/a.
- UI state/device matrix: n/a (no visual change).
- Expected user-visible effect: none. Crawler-visible: accurate structured data.
- Failure/security/concurrency cases relevant to this change: DAO failure → cards empty → JSON-LD falls back to neutral CollectionPage (no ItemList), same as cards' '' fallback. All dynamic strings escaped via existing escapeHtmlText/escapeHtmlAttr; JSON built with JSON.stringify then embedded — no injection. Marker replacement failure → neutral block remains (safe default).
- Implementation and coordinated updates: see files; map regenerated in same push.
- Commands actually run and results:
  - `npm install` — ok.
  - `npm run map:impact -- server/services/seoPrerender.ts` and `-- src/components/LandingPage.tsx src/components/NewsPortal.tsx` — consumers: server.ts, routeResolution.test.ts, seoPrehydration.test.ts, src/App.tsx, src/main.tsx.
  - `npx tsc --noEmit -p tsconfig.json` (repo `npm run lint`) — clean (one self-introduced brace typo caught and fixed during the run).
  - `node --test --import tsx server/tests/seoPrehydration.test.ts server/tests/routeResolution.test.ts` — 17/17 pass.
  - Functional sanity script (temp, deleted after): seeded 3 filings → JSON-LD parses, numberOfItems=3, real /filing + /announcement URLs, no hardcoded names, marker swap works, empty feed → '' (neutral fallback). Card HTML escaping unchanged.
  - `npm run map:generate` + `npm run map:check` — 365 files, 966 import edges, 23 semantic domains verified.
  - `npm run build` — ok (12.55s; pre-existing >1200kB chunk warning, untouched).
  - Dead-file deletions (src/sentry.ts, SlidingTabList.tsx) via contents API — HTTP 200, commits 725c82fb7ca2 / fcb0e6b36fa3. NOTE: these landed as 2 separate direct-to-main commits before the main push.
- Required checks unavailable (reason; do not mark passed): (to be filled)
- Deployment/migration requirements and rollback: revert commit; pageRenderCache TTL 5 min means rollback takes effect within 5 min of deploy. No migration.
- Remaining risks and next bounded step: Rahul must still sync + Republish for the fix to go live. GSC soft-404 entry for /announcements should clear on next recrawl after deploy.
- Graph/domain/documentation refreshed: `npm run map:generate` in same push.

- Delivery status: commit / merge / CI / deployment, reported separately: pushed via gh_push.py to main (commit SHA recorded in final report); NOT deployed — needs Rahul's AI Studio sync + Republish.

## Frontend action and consistency record (when applicable)

n/a — no frontend action.
