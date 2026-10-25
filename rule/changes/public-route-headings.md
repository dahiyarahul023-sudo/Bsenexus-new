# Check-first public route H1 repair

Starting remote main: a1a918e282b338eeacf28aa6759b778fab6b507d. The supplied sweep reports raw H1 absence on /, /announcements, /plugin, /watchlist. Explicit instruction: verify before applying a prompt or editing. Original named checklist was not found by exact-title and simplified Library title searches; no unseen prompt was applied.

## Verified before edits

- Actual unauthenticated HTTP GET returned 200 and zero H1 elements on all four URLs. /privacy-policy returned 200 with one Privacy Policy H1 and self-consistent canonical https://bsenexus.in/privacy-policy. No privacy edits made.
- Cloud Chromium fresh document: Home renders one visible H1 after JS (“Every BSE filing, decoded in seconds.”). Plugin renders one visible H1 (“Use BSE Nexus in your AI”). Announcements has visible Filings H1 plus a retained hidden For You H1. Watchlist guest has no visible H1: its Pro-access title is H2, with only hidden For You H1 remaining.
- Source: index.html neutral app-boot contains no H1, and its noscript copy is H2. injectTabSeoMetadata changes only head metadata. React createRoot replaces #root; it does not hydrate a persistent server heading. Existing announcements feed cards are inserted at a separate marker without a heading owner.
- This is an initial-document omission plus retained-screen/guest heading consistency issue, not proof that every ready client page has no heading. Historical “3 H1 to 0” report was not used to blindly remove/add headings.

## Scope, ownership and acceptance

- server/utils/routeHeading owns four public route heading strings and a marked replacement. index.html has a visible default Home H1 inside the compact startup surface; injectTabSeoMetadata applies route-specific headings in both existing development and production paths, including announcements success/fallback and cache entries. Repeated injection is idempotent. Standalone renderers without the marker remain untouched; calendar keeps its own source-backed root replacement.
- React mounting removes the initial heading with #root. PageHeading renders H1 for the active Home/Filings/Watchlist screen and H2 for retained inactive screens. The existing active flags/visibility owner selects the heading; no DOM mutation observer, unmount/remount or duplicate SEO-only heading is introduced.
- Watchlist's guest title becomes H1; its Pro manager gets an actual descriptive Watchlist heading. Access rules, paid eligibility, list reads/writes and controls remain unchanged. Existing Home/Filings title classes are preserved.
- Privacy canonical, sitemap, robots, schema, financial facts, auth and other business policy are outside this fix. No ranking improvement or Google indexing result is promised.

## Impact and consumer dispositions

map:impact executed for server.ts, index.html, App, HomeForYou, Announcements and WatchlistManager before edits. Relevant public-contract, faq-search-seo, frontend-public, frontend-navigation and frontend-feed domains updated.

| Consumer | Disposition |
|---|---|
| Initial public HTML | Changed: one route-specific visible H1 through the existing metadata owner and template marker. Boot title wraps on narrow screens. |
| Announcements cards/JSON-LD/cache | Reviewed-compatible: cards still use their own marker; heading is independent of upstream/empty/error data and enters cached response content/ETag. No source/network work added. |
| React root and retained pages | Changed: original boot/root replaced normally; active flag travels through Dashboard to Announcements and into WatchlistManager. Inactive Home/Filings/Watchlist headings demote without changing retained state. Home data activity semantics remain unchanged. |
| Watchlist guest/Pro states | Changed headings only; same Pro guard and upgrade button, same authenticated manager. No account-specific list content enters public HTML. |
| Plugin, Landing hero | Reviewed-compatible: already have correct ready-client headings; initial public document adds their semantic counterpart and is replaced on mount. |
| Privacy/standalone public company/calendar renderers | Reviewed-compatible: no canonical or route modifications; standalone documents without marker are unchanged and source-backed renderers replace #root. |
| Styles/performance | Existing component classes retained, scoped app-boot copy wraps. Shared heading helper loads with existing lazy pages; no new eager feature/dependency. |

## Verification and evidence limits

- Regression tests execute the actual metadata function from server.ts against the actual template; verify every target/alias H1, idempotence, announcements cards, standalone ownership and canonical preservation.
- React rendering tests exercise active/retained headings and guest/Pro title semantics. Existing canonical test fixture now supplies the real newly imported heading dependency; its assertion is unchanged.
- Pre-change live browser and raw HTML checks completed. First managed preview attempt failed because its environment could not resolve tsx through the checkout-external dependency symlink. No browser pass is inferred from that failure; subsequent fixture/browser checks, if successful, are recorded below separately.
- Full checks/build/map and publication statuses are appended after execution. compile_applet/lint_applet unavailable; repository typecheck/build are recorded separately. No production deployment or canonical change is claimed.
- Rollback: revert this bounded application change; no data migration or persisted user state changes.

## Final local and browser verification

- `npm test` with offline test guard: 811 passed, zero failed/skipped (34.4 seconds). Focused heading/canonical/performance checks: 38 passed. Nine new route-heading cases execute the real template/metadata owner and shared heading primitive.
- TypeScript and production build passed; startup budget 969043 raw / 260929 gzip bytes passed. Map generation/check and all six map tests passed; diff whitespace check passed.
- Managed static preview of the built application succeeded after the dev preview's missing-tsx limitation. The fixture applied the actual server metadata function to built HTML for the four routes, without production APIs or private data. Cloud Chromium confirmed exactly one H1 after JS on Home, Announcements, Plugin and guest Watchlist. Retained Watchlist -> Filings navigation kept exactly one H1. Guest For You correctly returned to the landing page, which also kept one H1; no signed-in Home flow is claimed from that guest navigation.
- Pro manager heading covered by React rendering/retained-heading contract tests; authenticated Pro browser flow, physical devices, keyboard/zoom and final live release remain unverified. No real credentials, provider transaction or production notification was submitted.
- Source repair is reviewable independently of deployment. The pre-existing production migration prerequisite in main still applies; no live rollout is included in these checks.
