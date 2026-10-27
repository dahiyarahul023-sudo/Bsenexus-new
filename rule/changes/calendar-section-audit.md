# Calendar section audit and lifecycle repair

- Starting remote main: 732aa7ee7f126e1064e2a2c76b2b9e710160477b (25 October 2026 IST).
- Objective: audit calendar end to end after the user confirmed recovery; repair reproduced gaps without changing result evidence or server permissions.
- Review inventory: public/legacy entry, All/F&O/Watchlist ownership/cache, date tabs/search/sort/pagination, IST rollover, company Details, result receipts and canonical release times, pre-result windows, AI language/selection, shared admin priority, calendar export/share and Telegram entry points.
- Initial source findings: 10→20 day switch calls the same close-toggle and closes instead of reloading; runup request failures become confirmed empty and late responses have no selection guard; AI callback patches whichever modal is currently open; English-only summaries do not enter AI counts/filter/card; background calendar shrink can strand a later page; wrapped HTML 200 with success:false/items:[] can erase saved cards.
- Impact: npm run map:impact -- src/components/ResultsCalendar.tsx (output kept outside repository). Frontend feed/session and market-data/public contracts inspected. Existing keyed owner wrapper protects account remounts; do not duplicate that state owner.
- Acceptance: latest company/window wins; collapse cancels; errors have retry instead of empty; AI late completion cannot patch another company; English summaries use same counters/cards; shrinking data clamps pagination; explicit failure cannot replace cards.
- Consumers: ResultsCalendar handlers/render/counts/cache changed; QuarterlyResultsLedger, Stock 360/history client, canonical filing classification and proof, source polling, server auth/quota/admin guards reviewed-and-compatible. No change to notification audience, import bounds, quota or SQL.
- Evidence pending: before/after regression execution, full tests/typecheck/build/map checks, browser availability. Source-level review is not production acceptance.
- Deployment: no schema changes from this patch. Existing release prerequisites remain separate. Rollback: revert this patch as one unit.
- Host compile_applet/lint_applet tools are not exposed. npm lint/build are available, not substitutes for claiming host checks.

## Findings repaired and cross-feature disposition

| Action / owner | Before | Repair and consumers |
|---|---|---|
| calendar.runup.read | Changing 10→20 closed the drawer; no request identity or cancellation; errors became zero filings | Separate reload from close; latest company/date/window/controller wins; collapse/unmount abort; loading/error/retry/empty have distinct labels. Priority response uses same window identity. |
| calendar.results.ai | Old completion could patch a different selected declaration; repeated input could duplicate work | Synchronous pending controller, selection cleanup and matching declaration ID; no automatic mutation retries; quota auth remains server-owned. |
| calendar.results.language | English-only results missing from filter/count/card and server projection | Both variants survive calendar/history response, with consistent display fallback and counters. Canonical release identity and evidence matching unchanged. |
| calendar.refresh | success:false/items:[] could erase cache; request-time tab could replace newer choice | Failure envelope rejected before state/cache write; response reconciles current tab; counts use projected returned rows. |
| calendar.page | Shrinking response could strand page 8 of 1 with no visible cards | Clamp rendered page immediately, reconcile state, use clamped next/previous. |
| calendar.telegram | Pro controls called admin routes; menu claimed sent before response; bulk counted HTTP success without delivery proof | Gate shared-channel controls/handlers to existing admin display; explicit PIN denial opens existing modal; require success+messageId; duplicate and obsolete requests suppressed; stop bulk on denial/uncertainty; no real sends in verification. Existing server guards/audience unchanged. |
| calendar.archive.watchlist | Import errors/unresolved stocks were swallowed into all-success | completedCount/failedCount and partial error response; compatibility fields retained; successful portions trigger refresh. Import limits and receipt storage unchanged. |
| calendar.dialog | Escape did not close Details; no dialog name/focus cycle | useCalendarDialog for Details and filters: initial focus, Tab loop, Escape and restored focus; listener is local, preserving independent PIN/Intel dialogs; existing body-scroll owner retained. |
| calendar.meetings.copy | Historical meetings labelled upcoming, empty history manufactured count 1; declared past meeting could be called upcoming | Board Meetings & History with real count; past-date classification independent of declaration. |
| calendar.share/copy | Shared scrip query ignored; clipboard UI claimed success before permission result | Validate six-digit deep link, initialize company search across dates; await clipboard result and recover on denial. |
| calendar.pdf | Footer bypassed the resolver used by the rest of Details | Footer uses existing safe BSE PDF resolver. No change to PDF fetching/verification policy. |

Reviewed-and-compatible: App/legacy public entry; keyed account remount and account/scope/list caches; server scope membership; F&O universe; search/sort/date grouping and IST day projection; QuarterlyResultsLedger and Stock 360 history receipt semantics; canonical first release clock and result-title/PDF proof; import pacing/storage confirmation/cache invalidation; server admin/Pro/quota guards; export utility and source URL ownership; automatic Telegram delivery ledger. Existing tests cover these contracts; this is not independent verification of every exchange filing.

## Actual live browser observations, 25 October 2026, approximately 12:52–13:00 IST

Cloud Chromium at https://bsenexus.in/results-calendar loaded 95 upcoming rows, page 1/4; search 511243 returned the 28 October Cholafin entry. Details eventually showed two verified quarters. The public runtime still rendered the earlier duplicate upper Fetch/lower Sync controls, the old four-quarter label and shared priority control for a guest. Switching its open 10-day window to 20 days closed the drawer; Escape on Financial Results left Details open. These establish pre-change defects and older public behavior, not the exact deployed SHA. A guest-scope transition attempt had no confirmed final state; it is not marked passed.

The local Playwright package exists but Chromium is absent. Official Chromium installation failed with a truncated/non-ZIP download; no local revised-UI phone/tablet/desktop, light/dark, touch or screen-reader acceptance is claimed. The remote browser cannot load this local checkout through an exposed forwarding mechanism. Authenticated production operations, real PIN entry, paid AI, archive writes, Telegram sends, SQL migrations and deployment were not executed.

## Remaining boundaries

- Public revision must be reconciled with merged code and then repeat the device/theme/keyboard/slow-request matrix. The public site still having old controls is a release issue, not evidence that the new source tests verified deployment.
- Existing deep-security production migration/release prerequisite remains independent; no production database state was changed or re-certified here.
- BSE document availability, generic PDFs awaiting proof, the process-local archive receipt limit across restarts/instances and the bounded document budget remain existing external/architectural limits. Do not promise every quarter or every source PDF is verified.
- Pre-result window helpers still read/boost the existing process filing cache; this audit does not certify complete durable-archive precursor coverage or make shared priority writes a new transactional contract.
- Dialog source and handler tests do not certify complete accessibility, background isolation across every global overlay, physical devices or reduced-motion usability.

## Verification result

- Pre-change regression runs: all four initial runup cases failed; global watchlist partial-failure test reproduced true instead of false. Live window toggle/Escape defects independently reproduced.
- Final focused handler/render/history/PIN client checks passed; full offline suite with explicit non-production JWT_SECRET (matching CI's configured-secret setup): 802 tests, 31 suites, 802 passed, zero failed/cancelled/skipped. First unconfigured local full run had two existing auth-cookie fixture failures because auth loaded its ephemeral key before the test set JWT_SECRET; independently rerunning with the explicit test secret passed all five auth tests. No auth assertion or server protection was relaxed.
- npm run lint: passed. npm run build: passed, startup closure 968942 raw bytes / 260914 gzip bytes, below the existing budget. Prebuild's generated version change is restored and not shipped as an unrelated edit.
- npm run map:generate, npm run map:check and npm run test:map: passed (six map tests). git diff --check passed.
- Required host compile_applet/lint_applet unavailable; revised UI browser/device matrix remains blocked as detailed above.
- Source fixes and automated checks complete. Commit/merge/CI recorded by the delivery PR; deployment and post-deployment acceptance remain separate.
