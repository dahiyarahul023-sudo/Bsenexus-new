# Change: reduce repeated Supabase background reads

- Starting commit: bbd4867bfb672195fa8156ff105e10c321c8100c.
- User objective: reduce avoidable database transfer toward a 4 GB/month operating budget while preserving existing features and polling cadence. Actual monthly savings require deployed measurement.
- Acceptance cases: global readers share a complete paged watchlist inventory; unchanged list bodies are not downloaded again; changed, empty and removed owners reconcile within the existing 60-second freshness window. Mutations retain fresh revision checks. Failed reads cannot become fresh successful empties. Filing lookup caching remains bounded and invalidates around writes and deletes.
- Verified source: watchlistDao global symbol/calendar readers selected full lists repeatedly; monitor subsequently requested individual owner lists; the global map separately enumerated local owners. getAnnouncementById did not retain cloud-only results. The new regression tests reproduce these source behaviors without live data.
- Assumptions and unknowns: the runtime must have the existing watchlist revision/update-time columns. Traffic mix, process churn and actual billed bytes determine the savings. This source change does not certify a monthly total or deployment state. Detailed production measurements are intentionally excluded from this repository note.
- Changed source of truth: watchlistDao read inventory and announcementDao cloud-only lookup cache. No API or schema contract changes.
- Impact command, before editing: npm run map:impact -- server/database/watchlistDao.ts server/database/announcementDao.ts. Import consumers and reached semantic domains reviewed. New helpers/tests are included in feed-alerts; regenerated map artifacts committed together.
- Cache contract: complete keyset metadata pagination; bounded changed-owner batches; original check timestamps retained when seeding owner read caches; local invalidation and existing TTL govern refreshes. Cloud-only filing lookups coalesce concurrent reads, use bounded positive/negative TTLs and return defensive copies. Errors are not cached. Pending and confirmed writes/deletes invalidate affected IDs.
- Consumer dispositions:
  - Monitor, BSE intake, retention and calendar readers: changed through their shared DAO; same list fields and freshness window. Numeric-zero inactive lists consistently stay excluded. Calendar retains supplied security codes.
  - Website/AI watchlist mutation consumers: reviewed-and-compatible; fresh-read conflict checks remain in place. Snapshot reads are not substituted for mutation reads.
  - Filing detail, renderers and summary readers: reviewed-and-compatible; response fields and existing HTTP policies unchanged. Partial-document merge writes retain their stored-base reads.
  - Company history: reviewed-and-compatible; existing full-history pagination remains unchanged. Its VM fixture receives the real new helper; assertions unchanged.
  - Impact Radar, AI Guide, gifts, billing and admin flows: reviewed-and-compatible; no business policy, route, query contract or write behavior changed.
- Assignment: backend cache behavior. Frontend action/state/style contracts unchanged; browser/device verification is not claimed.
- Failure/concurrency evidence: tests cover changed/empty/deleted owners, more than one metadata page, mixed-case database ordering, original freshness clocks, concurrent reads, invalidation during loads, read failures, eviction, negative caching, caller mutation isolation and reads racing queued/confirmed partial writes.
- Local validation:
  - npm ci --ignore-scripts --no-audit --no-fund: passed; dependencies/lockfile unchanged.
  - Original watchlist regression run before DAO edits: four failed, one passed.
  - Focused cache/DAO and company-history run: 25/25 passed, including 16 new tests.
  - Final NODE_ENV=test npm test with local test-only JWT configuration: 914/914 passed, zero skipped.
  - npm run lint (tsc --noEmit): passed.
  - npm run build --ignore-scripts: passed TypeScript, Vite, performance budget and server bundle. The flag skips only the unrelated prebuild version bump.
  - npm run map:generate; npm run map:check; npm run test:map: passed; map tests 6/6.
  - git diff --check: passed. Reconstructed source and restored original test image assets were verified against their Git blob hashes.
- Required checks unavailable: compile_applet and lint_applet are not exposed by this host; they are not marked passed. The actual available build/type-check commands are recorded above.
- Deployment/migration/rollback: runtime deployment required; no migration or dependency change. Revert the change to roll back; caches reset on process restart. Existing consumed transfer cannot be undone.
- Remaining verification: deployed usage observation and confirmation of the monthly operating budget. Publication and passing local tests do not establish live behavior.
- Delivery status: code/test note prepared for the dedicated performance branch; GitHub CI, merge and deployment are reported from their actual results separately.

## Public documentation clarification

Supabase distinguishes database egress from Storage CDN cached egress. HTTP response headers alone do not convert PostgREST requests into the cached Storage allowance. Existing public response caching and pagination were reviewed; the fix reduces upstream reads before they incur database transfer.

References: https://supabase.com/docs/guides/platform/manage-your-usage/egress and https://supabase.com/docs/guides/platform/billing-faq .
