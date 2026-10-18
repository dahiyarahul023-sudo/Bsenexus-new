# Change: one bounded company-news chapter with relevant visual variety

- Starting main: `1c5a88035bf41eac9dd94ea2ff563f3add1fdf2a`.
- User correction: retain the approved design, but make Company news one finite chapter (roughly six/seven screens), keep each company's one/two screens together, stop resetting progress for every item, and avoid repeating the same illustration on every screen.
- Verified source: `storyBuilder::appendNews` admits up to 25 disclosures and 15 reports, each with up to three or unbounded unlinked pages. `TodayMarketStoryModal::progressSlides` filters on `sequenceId`, so the strip resets for each item even though the actual chapter ID is already constant. `StorySlideView` always renders `StoryArtwork` for every news page, including generic fallback artwork and continuations.
- Reproduction: add behavior regressions for the uncapped full feed, dominant company and compulsory generic illustration before implementation. Record the run below.
- Intended result: at most seven company-news screens, at most two per company, complete related pages kept adjacent and one chapter-wide progress/count. Prefer recent distinct company explanations; do not pad a sparse feed. Generic updates/continuations can be clean text, rare source-backed order figures can use a metric, and meaningful sector art is a restrained option.
- Scope: frontend story adapter/types/view/progress, scoped styles, regression coverage and the maintained story contract/map. Existing company actions, source links, FII/DII, market/calendar layouts, cache and server feed policy remain compatible; no API or database changes.
- Impact: `npm run map:impact -- src/components/story/storyBuilder.ts src/components/TodayMarketStoryModal.tsx src/components/story/StorySlideView.tsx` run before edits; HomeForYou and Layout retain the shared viewer callbacks.
- Browser evidence: the previously observed local-preview connectivity and browser URL-policy blocks remain unresolved. Do not claim new browser/device verification or attempt to bypass that block.
- Verification/delivery: implementation and local checks in progress. User's prior instruction to merge this story work remains in scope; merge after required checks pass and report deployment separately.


## Implemented behavior and consumers

| Consumer/action | Result |
|---|---|
| `storyBuilder` / company-news selection | Changed: seven-screen chapter ceiling, two-screen company ceiling, newest distinct complete explanations first, adjacent company groups, sparse feeds unpadded. Linked long reports stop at two pages with original source available; oversized unlinked reports are omitted. |
| Chapter progress / shared modal | Changed: pure `StoryChapterProgress` reads the whole chapter, renders all segments and a current/total count. `sequenceId` no longer resets progress. Existing final next/auto-next closes the viewer. |
| News presentation | Changed: illustration optional, continuations/generic updates render clean text; sector art at most three screens, at most once per category and never adjacent. Single unambiguous awarded-order amounts use a metric, retaining exact qualifiers/units/decimals. |
| Identity / CompanyBrandLogo / Company Intelligence | Reviewed-and-compatible: validated identities and source/company actions unchanged. Exact unambiguous company names can share a screen budget but publisher-only subjects never inherit a logo/action. |
| HomeForYou / Layout | Reviewed-and-compatible: both entry points keep the same shared modal/topic/close/company callbacks. No app-shell restyle. |
| FII/DII, market, calendar, cache and `/api/story/feed` | Reviewed-and-compatible: retained tests cover source/sign/identity/session/race behavior; no API, backend policy, storage or job change. |
| Browser/device interaction | Blocked by previously observed connectivity/URL-policy constraints; no workaround attempted and no device pass claimed. |

## Actual verification

- Before implementation, the three new user-behavior regressions failed: 25 screens instead of seven; one company exceeded two screens; every generic news item was forced to have artwork.
- After implementation, `node --test --import tsx server/tests/companyStoryBudget.test.ts server/tests/marketStories.test.ts server/tests/followupAudit.test.ts server/tests/apiCancellation.test.ts`: **44/44 passed**. Includes finite chapter, company adjacency/priority, atomic two-page allocation, no padding, source fallback, restrained art, actual text/whole-chapter progress SSR and conservative exact-amount rules.
- `npm run lint` and `npm run build`: **passed** (TypeScript, Vite and server esbuild). Existing large-chunk warning remains. The local build version bump was restored.
- `npm run test:map`: **6/6 passed**. `npm run map:generate`, `npm run map:check` and `git diff --check`: **passed**, 391 source files, 1051 import edges and 24 semantic domains. Both generated map outputs are included.
- The first lint run found an indexed-union narrowing error in the new test; using a local previous-slide variable fixed it. The final checks above ran after that correction.
- Required host `compile_applet`/`lint_applet` remain unavailable; npm lint/build are separate checks, not substitutes claimed as those tools.
- Delivery at commit time: prepared for the authorized correction branch and non-draft PR; remote CI/merge will be verified on its exact head. No live deployment or browser pass is claimed. Existing merge authorization applies to this follow-up; deployment is a separate evidence state.
