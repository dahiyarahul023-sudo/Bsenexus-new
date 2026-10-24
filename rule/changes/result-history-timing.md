# Historical result timings and archive recovery

- Starting remote main: ccbf1dfc93caaf4916cc657b2223b2ff1ef03158; rechecked unchanged before final verification.
- Request: diagnose missing old-quarter times in KPIT/BEL, empty Supreme Industries history, compare with Godrej Consumer/Info Edge examples; fix the shared cause and merge after checks.
- Live reproduction: guest public Calendar -> search 509930 -> Details finished with Declared (0), All Quarters (0), and “No quarterly results indexed yet”. The screenshots establish date-only KPIT/BEL cards without PDF versus clock/PDF-backed Godrej/Info Edge cards. No source timestamp is inferred from those screenshots.

## Verified causes and contracts

1. resultsCalendarService.getStockResultsHistory marks every elapsed NSE scheduled meeting isOutcome=true/status=Declared, synthesizing a date-only declaredAtFormatted without filing evidence. These are notices, not historical result declarations.
2. The same reader calls getResultsCalendarData('all') with the default watchlist scope and no user. Non-watchlist calendar evidence can disappear. It now reads the public snapshot before applying exact-code matching.
3. isIntimationOrNoticeFiling previously let the words “financial results” override a “to consider and approve” notice. Both declaration enrichment and quarter history now reject these notices unless they actually describe approved results.
4. Calendar.handleFetchDeepHistory treats the POST's queued worker receipt as completion, immediately rereads history, then stops. The initial history effect also does a single read, swallows errors into [], and has no stale-selection guard. Both paths now follow the actual running receipt, preserve partial rows/errors, reread after completion, and cancel obsolete selection/account reads.
5. History used ingestion timestamps and could overwrite a first filing with a later correction in the same quarter. Raw BSE publication time takes precedence, fetch time is excluded, date-only evidence keeps an unavailable clock, explicit historical period years are retained, and the first verified filing remains canonical.
6. A numeric symbol supplied alongside its code prevented resolved company-symbol adoption. Numeric input now adopts the resolver's symbol.

## Behavior and acceptance

- Declared means a genuine matching financial result filing. An old meeting remains Past Meeting; neither a meeting date nor generic board outcome fabricates a release time.
- The existing bounded automatic one-year import covers missing/partial recent quarters, not just a literally empty array. Running/complete/failed receipts are exposed with no-store responses; polls use autoSync=0 and cannot restart work. Terminal receipts suppress repeated read-triggered walks for one hour. Source, identity, worker concurrency and durable archive confirmation remain unchanged.
- Manual history selection defaults to one year. Changing the ledger dropdown only selects; its explicit Sync button starts the operation. Existing 1–5 year options remain.
- Ledger shows verified results only under Declared, “Time unavailable” when the actual clock is absent, an explicit history-read error and retry, and understandable stored-history wording instead of a generic indexing message. No fabricated metrics/progress copy.

## Impact and dispositions

Impact executed before repository source edits: npm run map:impact -- server/services/resultsCalendarService.ts src/components/ResultsCalendar.tsx src/components/QuarterlyResultsLedger.tsx. Relevant domains: market-data, feed-alerts, frontend-feed, plus public-contract and AI result readers.

| Consumer | Disposition |
|---|---|
| History service, calendar enrichment | Changed: strict stored read, exact-code public evidence, genuine outcome classification, earliest publication and consistent clock formatting. |
| History API | Changed: readResultHistory returns history plus actual historySync; no-store; initial automatic recovery is bounded. Polls only read. |
| Calendar Details/ledger | Changed: initial auto receipt polling, manual receipt completion, cancellation/retry and honest empty/missing-clock text. Existing body scroll, themes, action and motion owners remain. |
| Stock 360 | Reviewed-and-compatible: existing start/status receipt polling and company-filings-changed event remain; it reads the same corrected canonical history and shared ledger. |
| Company filing counts and general calendar | Reviewed-and-compatible: manual completion dispatches existing company-filings-changed and refreshes the calendar. No category/membership, alert/notification, ingestion cadence or stored-row policy changes. |
| Public company HTML / AI results | Reviewed-and-compatible: their existing genuine-outcome/PDF/evidence filters consume the stricter reader; unknown meetings no longer appear as declared results. Publication remains distinct from meeting date. |
| Archive worker/DAO | Reviewed-and-compatible: existing bounded jobs, exact identity, duplicate-safe saves, durable confirmation and Pro-gated manual status route are retained. No schema migration. |
| Auth, subscriptions, Telegram, Radar/Stories | Reviewed-and-compatible: no authorization, money, delivery or notification behavior changed. No live sends performed. |

## Frontend action/state record

calendar.result-history.read: Calendar Details open/retry -> owner-keyed history read -> partial content + running receipt -> status-only reads -> final saved rows. Errors are visible; closing/changing stock/account aborts and invalidates revisions. No unmounted late response can resurrect the old selection.
calendar.result-history.sync: both Calendar Sync entry points -> existing protected POST receipt -> pending progress -> protected status reads -> confirmed completion -> read saved rows -> refresh calendar and company-filings-changed. Failed starts, denied access and failed status do not show success. Stock 360 retains the same effect sequence in its existing owner.
Existing CustomDropdown/ActionButton/Helios text/motion/body lock are retained; no layout/theme redesign or new global state. Code/SSR tests are separate from browser/device evidence.

## Verification and delivery

- New behavior tests cover meeting-only declarations, strict durable failure, earliest matching BSE clock/PDF, ignored ingestion/wrong-stock timestamps, numeric identity, public snapshot membership, explicit older reporting year, automatic/manual receipts, errors, cancellation and actual ledger rendering.
- Local typecheck passed. Full tests/build/map results are appended after final execution.
- Live pre-change Supreme reproduction completed in cloud Chromium as a guest. Post-change browser/mobile/keyboard/reduced-motion checks have not been claimed.
- Host compile_applet/lint_applet are unavailable; npm typecheck/build are their available repository checks, recorded separately.
- No live migration, production backfill, deployment or notification send has been performed. This change is a code repair, not a claim that every old filing was imported. Exchange availability, routing across process-local worker instances, and release verification remain explicit.
- Preserve the already-merged deep-audit migration prerequisite from rule/README.md before deploying main. Rollback this bounded application change; existing saved filing records remain untouched.
- Commit/PR/CI/merge/deployment statuses are reported separately.

### Final local results

- `NODE_ENV=test JWT_SECRET=<test-only> npm test`: 750 passed, zero failed/skipped (30.5 seconds); includes 11 new result-history cases.
- `npm run lint`: passed. `npm run build --ignore-scripts`: passed, including startup budget; skipped only the unrelated version-bump lifecycle script.
- `npm run map:generate`, `npm run map:check`, `npm run test:map`: passed; six map tests. `git diff --check`: passed.
- An earlier focused run failed only because the initially reconstructed source checkout omitted existing PNG assets; restoring the original assets resolved that fixture limitation. Final full suite has no failures.
- Final review also covers an import start with no worker receipt, a receipt lost across instances, and stock-code filtering before rendering a newly selected company. No production backfill or post-deployment result-time verification is claimed.
