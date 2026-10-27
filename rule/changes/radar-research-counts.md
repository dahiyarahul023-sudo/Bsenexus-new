# Radar, company filing counts and historical research repair

Starting remote main: 5c9815c32fa8381bcb8757d418de3961b215a108. Local snapshot file hashes match the remote generated graph.

User objective: repair Radar See more and source-check status; show the same stored 30-day filing count on company cards and intelligence; remove the total-25 filing cap in favor of pages; make Research Tools archive synchronization observable and truthful. Preserve unrelated ADR work and the migration-blocked PR #11.

Verified: CompanyIntelService slices all filings to 25; watchlist counts a seven-day memory slice. The archive uses fixed 180-day Result-only requests regardless of selected years, aliases an unbounded function as the documented bounded helper, swallows HTTP failures, and the UI reads nonexistent counts as success. CompanyIntelligenceModal returns before two useMemo hooks. Results history reads only the global memory pool. Radar source staleness is snapshotted at response time while displayed age uses a different timestamp.

Production read-only observation at 2026-10-22T17:47:43Z: GodrejCP 83 stored records, 16 within 30 days; latest Radar scan 17:46:44Z, filings/news available. No schema change or production write is planned.

Impact: map:impact run on CompanyIntelligenceModal, WatchlistManager, CompanyIntelService, ResultsCalendarService and ImpactRadar; manually review APIs, DAO, calendar/history, SSR, shared controls, background jobs and source ledger. Frontend/backend rules and completion guide read. Maintain exact security identity and existing paid archive authorization. Unknown/error is never rendered as zero or successful archive completion.

Actions: company.filings.open -> complete stored per-company snapshot -> 25-per-page UI; company.filing-count.read -> same public source snapshot -> explicit stored 30-day count; research.archive.sync -> authorized start -> bounded worker -> status polling -> confirmed storage -> refresh both detail and watchlist; radar.open -> existing dialog with stable heading action; radar.status -> last actual source scan, separate from browser refresh.

Validation and delivery evidence will be appended after implementation. Browser/device checks, host compile_applet/lint_applet and deployment are separate gates. Rollback restores application code; no stored evidence is removed.


## Final consumer review and evidence

Changed: company exact-code DAO (including operator identity), shared stored-count projection, lightweight card count read/hook, company modal pages/hook order/selection cancellation, paid archive start/status and paced metadata-only importer, durable result-history reader, Radar header wrapping and source timestamp display. Existing public company SSR and AI overview receive complete stored recentFilings compatibly; their own short summary selections remain intentional. Result quarter classification, auth/paid gates, calendar scope, poller cadence, Radar source ledger, event identity/follows, ADR, referrals and payments were reviewed and retained.

Counts are stored-data counts, not a claim that the exchange archive is complete. Failure/timeout leaves unknown or partial state and retry. The server reads keyset pages under an overall 12-second storage deadline, rather than silently stopping at 25 or 400 records. Filings and Material Actions show 25 records per numbered page; a short Home preview or AI prompt limit is not a history-access cap. The seven-day Updates feed retains its global 2,500-record response budget, with no per-stock 25 minimum/maximum policy. All stored per-company pages are available from the card/company destination.

Archive operations are limited to two workers per server process and a ten-minute walk budget, with exact source codes, real publication timestamps, six-month date windows, all categories, 2.5-second pacing, explicit malformed/403/storage failure, stable disclosure IDs, and post-write storage ID confirmation. Partial pages remain saved and retry deduplicates them. Worker receipts are process-local for at most an hour; restart/multi-instance status loss is an explicit 404/retry, never inferred completion. Hosting CPU lifetime, shared durable orchestration and source availability are not certified by this code. No migration is added, and blocked draft PR #11 is untouched.

Validation: final full application run 681/681 passed in 31 suites, no skips. New tests cover 1,103 durable rows over three DAO pages, 83 records over four UI pages, independent 16-record 30-day count, real five-year/all-category request parameters, paging/deduplication/identity, storage confirmation, malformed/403/unknown-date failure and actual modal hook-order stability across close/open/reopen. An additional focused run after UI message/timeout review passed all nine history tests. Six map tests, TypeScript and production build passed; final refreshed map check is recorded after the last code review. Existing large-entry-bundle warning remains.

A read-only direct archive request from this environment returned HTTP 403. No live import/storage write is claimed and no source block was bypassed. Local browser launch is blocked by the missing Playwright browser executable; no phone/tablet/desktop visual or interactive certification. Required host compile_applet/lint_applet tools are unavailable, so their status remains unexecuted. The actual repo rules and maps, not this test count, define the remaining browser checks.

Rollback: restore the prior application version; retain original and imported disclosure records. Code committed/PR/CI/merge/deployment are reported separately. No production data, schema, notification, payment or source policy mutation was performed for testing.

Final build without prebuild version mutation passed; original src/version.ts retained. Refreshed map check and all six map tests passed. Retained original calendar-adapter request headers in the extracted archive worker.
