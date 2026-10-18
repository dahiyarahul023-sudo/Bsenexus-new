# Change: readable, content-led market stories

- Starting remote commit: `bd35d7c848717082e36a0e172940b57104d8326a`.
- User objective: implement the approved clean mobile story plan; one idea and one visual per screen, content-dependent slide counts, concise copy, neutral FII/DII identity and accessible lightweight interactions. Define the rules separately for future work.
- Verified starting facts: `TodayMarketStoryModal` renders a hero, duplicate badges, structured cards and bullets; `storyData::fetchLiveStoryChapters` hydrates fixed slots and assigns HDFCBANK to institutional flows; `StoryCarouselBar` also uses that bank for FII/DII and indexes chapters positionally. Feed failures return hardcoded market examples.
- Scope: story frontend, existing `/api/story/feed` read contract only. No pricing, poller, Radar, database, company-logo assets or server business-policy changes.
- Impact: `npm run map:impact -- src/components/TodayMarketStoryModal.tsx src/components/story/storyData.ts src/components/story/StoryCarouselBar.tsx` executed before source edits; full output retained in task scratch. HomeForYou and Layout are the two viewer entry points; company actions use their existing callbacks.
- Expected changes: pure validated feed adapter, dynamic pages, typed layouts, native gradient charts and curated native illustrations, neutral aggregate identities, compact controls, shared scroll ownership, focus containment/return, separate loading/empty/error/stale states and pause-safe playback.
- Evidence status: specified and source-traced. Implementation/check/browser/delivery results will be recorded after execution; no deployment is claimed.

## Action and consumer record

| Action / consumer | Owner and required effects | Disposition |
|---|---|---|
| stories.open: Home carousel and Layout logo | Viewer reads public feed; opens selected available topic; marks viewed only when content is shown | Changed shared viewer; both callback contracts retained |
| stories.navigate / pause | Viewer owns cursor/progress; touch, keyboard and explicit controls agree; inspection, hidden document and reduced motion pause advance | Changed |
| stories.refresh | Shared public feed cache coalesces reads; viewer ignores late closed/superseded responses and retains usable content on error | Changed |
| stories.company.open | Only exact company subjects call existing Home/Layout callback; aggregate flow never supplies a company | Changed adapter/view; existing consumers reviewed-and-compatible |
| stories.source / share | Safe original source links; user-triggered native share or clipboard; no invented story route | Changed |
| /api/story/feed, jobs and persistence | Existing upstream read and freshness policy; no writes/migration | Reviewed-and-compatible; API fields inspected |
| CompanyBrandLogo / other company screens | Existing official-logo resolver and assets | Reviewed-and-compatible; no asset/resolver changes |
| HomeForYou / Layout | Existing mount/close/company-intel callbacks | Reviewed-and-compatible; no unrelated layout change |

## Verification to execute

Pure adapter cases: missing/malformed/zero data, correct signs and dates, no invented identities or defaults, freshness, dedupe, dynamic pages, long text and source safety. Render cases: aggregate logos absent, chart zero/common scale, concise layouts. Browser: 360/390 phone, 768 tablet, 1440 desktop, short viewport/zoom, touch navigation/hold, chart inspection, menu/keyboard, focus/scroll restoration, loading/empty/failure/retry, refresh and reduced motion. Run lint/build, map generation/check and map tests. Host-only compile_applet/lint_applet are unavailable unless discovered; report actual alternatives separately.

## Implemented result

- `storyTypes` defines separate topic/company subjects and five layout variants. `storyBuilder` validates the existing payload, derives variable pages, preserves zero/sign/decimal facts, rejects stale/future news and unsafe links, and keeps one news item per explanation. News progress is grouped by its own sequence, not every article in the chapter.
- `storyFeedClient` replaces example fallback data with a public, session-scoped, coalesced cache and newer-request precedence. `storyData` retains the existing IST/date helpers, exports the compatible loading functions, and lazily imports the API client with a bounded request deadline.
- The modal now renders one layout, a minimal header, secondary controls and a quiet source/company footer. Both existing Company Intelligence callbacks remain unchanged. FII/DII and all carousel topics are neutral; neither bank identity nor a company CTA is supplied by an aggregate.
- `StoryChart` renders proportional signed bars/direct labels and exact-value pointer/keyboard inspection. `StoryArtwork` supplies five reusable native vector scenes. The metric and future IPO/historical chart layouts are available, but the current feed does not provide those missing financial series; no figures were invented.
- The scoped stylesheet uses the approved clean dark reading canvas and restrained accents. The existing BseNexusLogo and official company-logo resolver/assets are preserved.
- Stable pending-topic selection avoids a first-load/refresh jump. The public shared request is bounded and allowed to finish for other readers, while viewer epochs ignore obsolete completion. Pause/hold/inspection/menu/hidden-document/reduced-motion states are distinct. The shared scroll lock, body portal, background inertness, focus trap/return and existing close/company callbacks are wired in source.

## Actual verification (2026-10-18)

- `node --test --import tsx server/tests/marketStories.test.ts server/tests/followupAudit.test.ts server/tests/apiCancellation.test.ts`: **32/32 passed** (15 new story cases, 17 related existing cases). Covers the formerly wrong aggregate identity, dynamic pages, exact financial copy, zero/missing/stale/malformed data, source URLs, cache/race/session behavior and stable topic/cursor selection; SSR verifies real slide markup. These are data/render tests, not executed browser interactions.
- `npm run lint`: **passed** using the current source and installed dependency set.
- `npm run build`: **passed** (TypeScript, Vite and server esbuild). The existing large-entry-chunk warning remains. The build's automatic version bump was restored so this bounded change does not change the release version merely from local verification.
- `npm run test:map`: **6/6 passed**. Generated map/check results are recorded after the final source revision below.
- `compile_applet` and `lint_applet`: **unavailable** in this host (`command -v` found neither); npm lint/build are recorded separately, not claimed as those host checks.
- Browser/device acceptance: **blocked, not passed**. The local browser runtime could not be downloaded (invalid/empty archive); the cloud browser could not reach `127.0.0.1:4173` (`ERR_CONNECTION_REFUSED`). A shared standalone fixture preview was prepared, but opening its `file:` URL was explicitly rejected by the browser URL policy. No bypass or alternate browser surface was used after that rejection. Therefore 360/390 phone, 768 tablet, 1440 desktop, zoom, real touch, rendered spacing, focus/scroll and interactive keyboard/gesture acceptance remain unexecuted. The prepared fixture is not a deployed page or live market-data verification.

## Completion and release boundaries

- Specified/source-traced/implemented/data-render-tested/build-tested: complete for this bounded story change. Browser verification remains blocked; this is not completion of the wider frontend program.
- HomeForYou, Layout, CompanyBrandLogo, existing company actions, the unchanged feed API and backend jobs/storage are reviewed-and-compatible by source; no migration or server-policy deployment is required.
- New `frontend-stories` semantic domain, `STORIES.md`, frontend map/strategy and prior-change supersession note are maintained with source. Graph generation/check is required after the last edit.
- Release recommendation: keep the change reviewable until a real phone/browser runs the outstanding matrix. Rollback is the single story change commit; no data rollback or schema migration is involved.
- Delivery: source prepared for a separate GitHub branch/draft PR. Merge, remote CI, deployment and live behavior are not claimed.

- Final generated-map results: `npm run map:generate` and `npm run map:check` passed for 389 source files, 1046 import edges and 24 semantic domains. `git diff --check` passed.
