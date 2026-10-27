# Calendar result evidence and duplicate history controls

- Starting upstream commit: 31ce1d56b3a8e2c7a9eb52ef5e381da51faa7a26 (PR23).
- Request: investigate missing HUL/KPIT/Cholafin result history, check other companies, and establish whether the two history controls do different work.
- Verified production read: 25 October 2026 IST. HUL has three stored 'Results For The Quarter...' disclosures rejected by the classifier. KPIT has four explicit '... - Results' / 'Results for Q1...' disclosures rejected. Cholafin has two recognized result titles and generic board outcomes for 30 January and 28 July; title alone cannot establish their financial contents. Full source data was read only; no database changes or notifications.
- Broad read: 57 similar title records across 38 companies, before classification. This is a candidate sample, not a claim that all 57 are missing results.
- Live cloud Chromium: HUL calendar Details reproduced DECLARED (0) despite stored results. Both upper Fetch and lower Sync call handleFetchDeepHistory and the same protected POST endpoint. The upper dropdown also starts work on selection. '4 Qtrs' describes a rolling one-year window inaccurately.
- Impact run before edits: npm run map:impact -- server/services/resultsCalendarService.ts server/services/historicalFilings.ts src/components/ResultsCalendar.tsx src/components/QuarterlyResultsLedger.tsx. Domains: market-data, feed-alerts, frontend-feed; public company/AI readers, archive storage and calendar notification consumers traced.
- Plan: shared evidence classifier with bounded additional result title formats, existing notice/reproduction exclusions; ambiguous outcome verification during archive import using only official BSE PDFs, identity-bound minimal proof metadata, no AI or persisted PDF. Failed document access stays unverified. One lower sync control, truthful range/completion text, shared warnings across consumers.
- Exact BSE PDF/API requests from this environment returned 403. No live PDF contents or historical backfill is claimed. Source metadata, deterministic fixtures and local behavioral checks are separate from post-release evidence.
- Existing main contains the independent deep-audit migration release prerequisite. No deployment before satisfying it. No schema change is needed for additive metadata in existing announcement JSON.
- Host compile_applet/lint_applet are unavailable. Repository checks and browser evidence will be recorded individually.
- Implementation, checks, consumer dispositions and delivery status: pending below.

## Implemented behavior and consumer review

| Consumer | Disposition and evidence |
|---|---|
| Result-history service | Changed: shared exact-title/evidence predicates recognize Results For Quarter/Q1 and Outcome - Results. Existing original clock, exact security, one-quarter canonical key and first release logic retained. Verified generic proof supplies period text without rewriting the headline/details. |
| Calendar enrichment and automatic notification eligibility | Changed shared predicate: the same financial filing proof decides declaration status. Existing security/date window, recipient and durable delivery claims unchanged. No live sends performed. Successful import invalidates enrichment before completing its receipt. |
| Archive worker | Changed: only ambiguous board outcomes get an official BSE PDF read, capped at 8 MB, first five pages, 80,000 text characters, download/extraction deadlines and 16 checks per requested year inside the existing ten-minute/two-worker envelope. Exact BSE code and approval/reporting-period text are required. No AI, OCR service or stored PDF. |
| Durable filing JSON | Changed: additive resultDocumentCheck metadata binds filing ID, code, original URL, document hash, checked time and bounded approval excerpt. Reimport reuses valid proof. A metadata-only update is no longer skipped; final storage confirmation checks proof fields, not just an old ID. |
| Calendar Details | Changed: removed the duplicate upper Fetch panel/dropdown and its auto-on-selection trigger. One existing lower Sync control remains. Last-N-year labels describe the actual period and do not promise exactly four quarters. Existing modal scroll/style/motion and owner cancellation remain. |
| Manual completion | Changed: post-import saved-history read ignores a different old automatic one-year receipt. Shared success/warning text distinguishes filing storage from unresolved PDFs. Company-filings-changed and calendar refresh remain. |
| Stock 360 | Changed completion copy only; existing start/status/read/event owner retained. Uses the same canonical results and ledger. |
| Automatic history client | Changed: a completed archive with unresolved PDFs exposes that limitation and retains actual verified cards; polling never restarts the import. Existing abort/selection protections retained. |
| Public company / AI results | Reviewed-and-compatible: companyIntelService and AI market reader consume isOutcome and official original PDF from the canonical reader; no new external provider or summary path. |
| Bulk archive, filings counts, Radar, Stories, auth and subscriptions | Reviewed-and-compatible: all-category stored filing count is separate from result verification; existing receipt guards, Pro/admin authorization, broadcasts and membership remain. No schema or money policy changed. |

calendar.result-history.sync: selected company/account -> choose range (no mutation) -> one Sync button -> protected job receipt -> poll -> confirmed filing/proof storage -> read canonical rows -> refresh company counts/calendar. Unknown documents remain unverified and retryable. No async result from a closed/different company is applied.

## Evidence and checks

- Public stored-row comparison against original classifier: HUL 0 -> 3 recognized result filings; KPIT 0 -> 4; Cholafin 2 -> 2 from titles alone. Generic Cholafin PDF contents have NOT been live verified here. Regression fixtures demonstrate that valid exact-company approval evidence recovers the original 17:31:21 clock and FY26-Q3, while wrong identity, changed URL, notices, investor reproductions and missing storage proof cannot be promoted.
- Broader production read-only candidate sample: 57 title records across 38 companies; new classifier admits 30 previously rejected financial-result disclosures across 20 companies. These are filing counts, not a claim of 30 distinct quarters or full-market coverage.
- Before-fix regression failed on the first HUL title as expected; after-fix tests pass. One new test harness initially lacked its actual identity helper; corrected without relaxing the assertion.
- Local full application suite: 776 passed, zero failed/skipped, about 30 seconds. Latest exact-source focused checks, typecheck, production build, budget, map and diff results are appended when completed.
- Actual Calendar Details SSR regression verifies one lower Sync action, no duplicate panel and last-year copy. It is not a browser/device claim.
- Six spider-map tests passed. Required host compile_applet/lint_applet are not exposed; repository TypeScript/build checks are reported separately.
- Browser: live pre-change HUL missing-history reproduction completed. Post-change cloud browser/device/keyboard/reduced-motion checks remain unverified: this environment exposes no supported forwarding from the local checkout to the remote browser. No deployment is inferred from SSR or tests.
- Document access from this environment returned HTTP 403 for an exact BSE PDF and archive request. No request evasion, production backfill, database mutation, notification or paid provider call was performed.

## Delivery boundary and rollback

No new migration is needed for JSON proof metadata. Existing main's independent deep-audit migration release prerequisite remains; publication must not be inferred from a GitHub merge. Reverting the bounded application change restores prior classification/UI; saved original filings remain intact and additive proof can be ignored. Multi-instance worker receipts and source availability retain the existing explicit limitations. Final commit/PR/CI/merge states will be reported individually.

Final local source checks: latest focused result/history/actual-render tests 25/25 passed; full suite 776/776 passed; TypeScript passed; production build and startup budget passed (969008 raw / 260934 gzip startup bytes); map generation/freshness and six map tests passed; git diff --check passed. Only local reconstruction restored original binary assets for validation; those originals are not part of the change. Browser/device and live PDF-source limitations above remain.
