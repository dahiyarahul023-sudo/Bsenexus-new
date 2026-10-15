# Change: groww-style-market-story

- User objective and acceptance cases:
  1. Transform the Market Story section into a Groww / Instagram-style experience with clean cards, company logos, and live BSE metrics.
  2. Eliminate out-of-place stock photography (factory chimneys, handshake photos, generic Unsplash images).
  3. Feature a prominent top carousel bar on the dashboard / home screen (`HomeForYou.tsx`) showing live capsules (Market Pulse, Top Movers, Order Wins, Results Radar, FII/DII flow).
  4. Ensure fluid Apple Design interaction: 1:1 touch tracking, pull-down to dismiss with rubber-banding, tap left/right to navigate, hold to pause.
  5. Backed by live backend feed `/api/story/feed` with verified BSE indices, movers, results, and regulatory announcements.

- Verified facts (file + symbol):
  - `src/components/story/StoryCarouselBar.tsx`: Created top horizontal carousel bar with active gradient rings, live stat peeks, and chapter targeting.
  - `src/components/story/StoryVisuals.tsx`: Removed Unsplash photo dependencies, created `GrowwStoryCardHero`, maintained official Groww CDN `CompanyBrandLogo`.
  - `src/components/TodayMarketStoryModal.tsx`: Updated with Groww-style brand hero cards, support for `initialChapterId`, segmented progress bars, and Apple fluid drag-to-dismiss gesture handling.
  - `src/components/HomeForYou.tsx`: Integrated `StoryCarouselBar` at top of home view with modal launch wiring.
  - `src/components/story/storyData.ts`: Stripped out stock photo URLs, added `forceRefresh` support to `fetchLiveStoryChapters`.
  - `server/api/routes.ts`: Verified `/api/story/feed` returns live BSE & NSE indices and bluechip movers.

- Changed source of truth:
  - Frontend story rendering now derives purely from structured financial data, official brand logos, and live price/percentage statistics.
  - Top story discovery promoted from a buried header button to an interactive dashboard carousel bar.

- Impact command and affected semantic domains:
  - `npm run map:impact -- src/components/TodayMarketStoryModal.tsx`
  - Domains affected: dashboard, market stories, layout, news.

- Related consumers: API, UI, storage/RPC, jobs, caches, manual copy:
  - UI: `HomeForYou.tsx` (renders top carousel bar), `Layout.tsx` (compatible with updated modal).
  - API: `/api/story/feed` delivers verified market data with 30s cache.
  - Storage: `localStorage.getItem('bse_story_viewed_...')` tracks session viewed state.

- Commands actually run and results:
  - `npm run map:impact -- src/components/TodayMarketStoryModal.tsx`: Succeeded.
  - `compile_applet`: Build succeeded (exit 0).
  - `lint_applet`: 0 errors.
  - `npm run map:generate`: Generated 345 files, 921 import edges, 22 semantic domains.
  - `npm run map:check`: Verified 345 files, 921 import edges, 22 semantic domains (exit 0).

- Delivery status:
  - Specified, implemented, compiled, linted, and spider-map verified.
