# Market stories: content, identity and interaction contract

This contract implements Rahul's 18 October 2026 mobile-story direction. It supersedes the **logo/metric-only** presentation decision in `changes/groww-style-market-story.md`. It applies to the Home carousel and the shared viewer launched from Home or Layout. It does not redesign the rest of BSE Nexus.

## Editorial rules

One slide answers one question and contains at most one primary visual. A short update may need one slide; a longer company explanation can use two. Company news is one chapter with at most seven screens total and at most two screens per company. Select recent distinct company explanations before extra updates, keep each company together, and admit complete explanations only when they fit the remaining budget. Do not pad a sparse feed to seven screens. Other chapter counts continue to derive from actual data. Do not fill an absent section with examples, zeroes, generic assurance copy or another company's identity. Zero is valid only when explicitly supplied as a numeric fact.

Aim for 6–10 headline words (roughly two lines) and 20–35 explanation words. The current adapter uses a 13-word/95-character threshold for source-derived news headings and a 38-word body-page budget. These are copy targets, not CSS clipping rules. Preserve financial decimals, periods, signs and source meaning. Break long copy at sentences first; retain all unshown detail through the original source. Up to two news screens are used when that link exists; an unlinked explanation exceeding that budget is omitted rather than silently cut. A complete explanation can leave the chapter at six screens instead of inserting half of another two-screen explanation. Never solve overflow by `line-clamp`, ellipsis or reducing body text to dashboard-caption size.

Avoid repeating the same fact in the heading, hero, chart and bullets. Template headings and legends are allowed; predictions, causal explanations, financial figures and company associations must come from source data. If a future generator creates additional prose, it must preserve this contract and disclose the original source.

## Typed layouts

`storyTypes.ts` owns the discriminated `StorySlide` union. The adapter creates a layout appropriate to the available facts; `StorySlideView` renders exactly that layout.

| Layout | Use | Required content |
|---|---|---|
| news | Company development or source report | Source-derived heading, optional distinct summary and optional relevant topic illustration |
| metric | A single verified amount | Label, value, optional explanation; never add an invented amount |
| comparison | Two short facts or allocations | Two labelled information bubbles; these are not proportional circles |
| chart | Comparable numeric observations | Labelled periods/groups, numeric values, units, series and source |
| list | Movers or calendar | At most three readable rows per page; additional records create more pages |

The current feed supplies indices, movers, FII/DII, calendar, disclosures and news. It does **not** supply IPO allocations or historical revenue/profit series. Do not synthesize those from the screenshot. The reusable comparison/chart views support those future use cases once a verified data adapter exists. Gross FII/DII activity creates a second chart only when all gross fields are present; it adds different information from net flow.

## Identity is a separate contract

`StorySubject` is either a `company` with a validated six-digit BSE code and real name, or a neutral `topic`. Every aggregate FII/DII, calendar overview, market overview and multi-company list uses a topic. `StoryTopicMark` uses a globe, calendar, news or activity symbol; it is not an institutional organisation's official logo. FII/DII must never default to HDFC Bank, SBI or any other company. Its footer points to the NSE report and its actual report date, with no company CTA.

A row can open Company Intelligence only with its own exact company identity. Publisher-only news remains a topic; it cannot inherit an adjacent announcement's identity. `CompanyBrandLogo` and its official asset resolution remain unchanged for real company subjects. Neither colour nor an unrelated company is a fallback identity.

## Curated visuals and chart rules

`StoryArtwork` is a small native-vector collection: banking, industry, energy, healthcare and markets. Illustrations have no embedded brand name or numerical claim. In Company news, selection follows explicit sector subject words; generic markets artwork is not an automatic fallback. A generic order/contract alone does not imply an industrial scene. Use at most three illustrations per chapter, never repeat an illustration category in that chapter, and never illustrate adjacent screens or continuation pages. Clean text is a complete layout; there is no empty hero placeholder. A single explicitly awarded order amount can use the metric layout only when the headline unambiguously connects one rupee amount to that order. Preserve qualifiers, currency, decimals and units; ambiguous/multiple amounts or speculative targets remain ordinary news. Never fabricate financial history or a decorative data chart for variation. No random remote photo URL, third-party image hotlink, scraping or per-story image generation is required. If curated photos are later added, keep them in a reviewed local registry with rights, crop and meaningful category; do not change the identity contract.

Chart geometry uses a single zero baseline and proportional shared scale. Negative values extend below zero. Explicit zero is a line, not a fake-height bar. Direct labels and units are always readable; tap, Enter or keyboard focus reveals exact values. Inspection pauses playback. Colour is reinforced by signs, text and legends. Purple/blue or emerald positive bars fade towards the baseline; negative bars use rose. Do not distort a small loss to match a much larger revenue bar: use another screen when necessary. Keep at most three groups/two series on a phone; paginate future larger series at the adapter boundary.

## Presentation and controls

`styles/market-stories.css` is scoped to stories. The deliberately dark reading canvas (`#222536`) works independently of the surrounding app theme. Text is `#f4f5fa`, supporting text `#c0c4d2`; semantic accents are emerald `#62e2c2`, blue `#7377ff` and rose `#fa6383`. Headlines are 27–35px, body 15px with 1.65 line height. Topic artwork and information bubbles add one restrained surface; do not nest a card inside every section. Company assets are never recoloured.

The header contains thin progress, a quiet topic label, Share, secondary controls and Close. Progress always belongs to the entire active chapter. Company news has one strip of at most seven segments with a visible current/total count (for example 3 / 7); moving between companies or related sequences never resets it. `sequenceId` only groups related explanation pages, never defines a new chapter. The final screen reaches the existing end-of-viewer close behavior. Exact named reports may share a company screen budget with an unambiguous validated name, but this never grants them a guessed company logo or action. Chapter discovery stays in the outer carousel. The secondary panel exposes Pause/Resume, Previous, Next and Refresh. The footer has a quiet company link only when appropriate, followed by source/date. There are no repeated badges, chapter capsules inside the viewer, chapter toasts or compulsory hero/bullet sections. Reuse the existing `BseNexusLogo` for the header brand.

Tap left/right or swipe horizontally to navigate. Hold pauses without causing a subsequent tap navigation. The custom pull-down dismiss gesture applies when the story does not need native scrolling; overflow/zoom content keeps native vertical scroll. Chart/list/source/menu interactions must never also advance the story. The dialog uses a body portal, shared scroll lock, background inertness, focus containment, Escape and focus return. It cooperates with existing Company Intelligence callbacks.

Reading duration depends on text, including list/metric/comparison copy, and visual complexity (7–18 seconds). Explicit pause, long press, chart inspection, hidden document, open controls and sharing pause the clock without losing progress. Reduced-motion mode removes animations and auto-advance, retaining explicit navigation. Overflow/zoom content also stays in manual advance so scrolling cannot race the clock; a quiet Next story control remains reachable in the footer. A forced refresh preserves the active stable slide ID where possible. Request completion after close cannot update the closed viewer. Show loading, empty, error/retry and a saved-snapshot refresh-failure status distinctly.

## Data ownership and maintenance

`storyFeedClient` coalesces public reads, gives newer forced requests precedence, and caches by market-session ID. A snapshot may initialize the UI for three minutes; the normal read TTL is one minute. It is revalidated through the pure adapter, including the 18-hour news cutoff. The request has a 20-second deadline. A shared public request may finish after an individual viewer closes; its result cannot update that closed viewer. No private data is stored in this cache. The existing `getISTMarketSession` policy is retained; templates cannot reintroduce previous-session movers during the morning gate.

Feed check time, publication time, quote time and institutional report date are distinct. Do not label check time as trade time or claim every available snapshot is live. Source links allow credential-free HTTPS only. Generated content is rendered as React text, never injected HTML. This change adds no backend write, job, database migration or authorization policy.

Maintain this contract, the `frontend-stories` domain, generated map and the current `changes/bounded-company-stories.md` evidence together (`changes/clean-market-stories.md` records the earlier implementation). Tests are `server/tests/marketStories.test.ts` and `server/tests/companyStoryBudget.test.ts`; they cover data behavior and render output. Browser/device observations, fixture data, local build, commit, merge, CI and live deployment are separate evidence states. Do not mark an unexecuted device or production check as passed.


## Overnight ADR (22 October 2026)

The existing Market pulse chapter can lead with one three-company ADR list, from the same validated snapshot as Home/company intelligence. Exact quote-source dates and USD regular-session context are included. Unconfirmed/stale snapshots omit the ADR Story. There is no new chapter or change to the seven-screen Company news ceiling. ADR.md owns identities, source/session/price rules and morning alert boundaries.
