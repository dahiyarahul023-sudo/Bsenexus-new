# Change: guide scoped MCP reads and reuse company filing bodies

- Starting upstream commit: 39bbd52d36bb151f3930e9e4fb826811cff90f02.
- User objective: direct external agents toward the stocks/watchlists relevant to their question, reduce avoidable Supabase transfer and preserve useful wider research with server-side authorization and quotas.
- Verified facts: market.ts/filingsData used a 400-record company history read for every company call, while the 500-record market read comes from announcementDao/getRecentAnnouncements's memory cache. Filtering/response limits run after the source read. tools.ts/createAiToolRunner reserves durable per-account usage after checking access. Request-count evidence and its attribution limits are recorded in docs/MCP_EFFICIENT_READS.md; it does not prove per-tool billed bytes or deployed revision identity.
- Assumptions/unknowns: effective savings depend on company reuse, writes, process lifetime and Cloud Run instance count. Current billing total, live deployment and lossless delta delivery are not established by these changes.
- Changed source of truth: bounded public company read cache in announcementDao; filings_search schema/runner supports one owned watchlistId. market.ts filters exact server-derived codes before page selection. No schema, entitlement, price or quota change.
- Impact before editing: npm run map:impact -- server/ai/market.ts server/ai/policy.ts server/ai/tools.ts server/ai/http.ts server/database/announcementDao.ts server/utils/readCache.ts server/api/aiPlugin.ts. Imported consumers and reached semantic domains reviewed. Initial invocation from the workspace parent failed (no package.json); rerun from repository root succeeded before edits.
- Consumer dispositions:
  - MCP initialization, tool descriptions and /ai-docs: changed; scope-first guidance, small brief responses, inclusive watermarks/ID deduplication, restrained polling/history and quota-error recovery agree.
  - REST/OpenAPI/Gemini: changed guidance; registered compatibility routes and existing arguments remain compatible. Watchlist filing selection is an optional MCP-only argument; REST continues to reject unknown parameters.
  - Owner watchlist readers: changed only inside filings_search. Fresh owner-scoped aiDb membership read; missing/foreign list is not_found; scope/Pro checks precede reservation; empty membership cannot widen scope. Website mutation/CAS/invalidation paths remain compatible.
  - Announcement writes/deletes: changed cache invalidation before and after persistence. Existing partial-document merges, receipt/log behavior, filing-ID cache and index notification paths retained.
  - Existing complete company history, results calendar, company modal and background feed/monitor readers: reviewed-and-compatible; they retain getAnnouncementsForScrip and its archive behavior. Only connector company searches use getCachedCompanyFilings.
  - ReadCache consumers: reviewed-and-compatible; new clear() invalidates ready/pending entries; existing get/invalidate semantics unchanged.
  - Billing, gifts, referrals, quota, profile, notes and alerts: reviewed-and-compatible; no policies/writes/scopes broadened and no private values enter the shared body cache.
- Assignment: backend and connector contract/guidance; no frontend action/state/style changes. Public documentation adds text in the existing semantic section layout. Browser/device verification is not claimed.
- Expected effect: one watchlist query reads a recent in-memory scoped feed instead of fanning out company history calls. Repeated company reads share a 30-second, 16-entry public cache and coalesce concurrent loads. Failures remain visible; credentials, ownership, current access and durable quotas are not cached by this layer.
- Cache contract: fixed 400-row maximum per company, TTL from load start, defensive copies, no cached failure, invalidation around queued/confirmed writes and deletes. Partial updates without identity clear the small cache. Per-process cache only; it does not claim cross-instance sharing or CDN allowance conversion.
- Pagination correction: an inclusive after bound can equal before when beforeId is supplied, allowing tied-timestamp continuation without widening the original range. Equal boundaries without an ID and reversed ranges remain invalid.
- Regression evidence: focused tests cover owner predicates, foreign/empty lists, no company-history fan-out, permission/plan rejection before reads, visible database failures, tied pagination, public coalescing, TTL, caller isolation, failures, write/delete invalidation and clearing while an older load is pending.
- Validation: see final validation entry below. Original source snapshot was reconstructed and verified against upstream Git blob hashes for source files; unrelated imported image/audio assets are unavailable locally. Existing verified dependency installation is reused without lockfile/dependency changes.
- Required host checks unavailable: compile_applet and lint_applet are not exposed. Do not describe them as passed.
- Deployment/migration/rollback: no migration or paid infrastructure. Runtime deployment is required. Revert this bounded commit to roll back; existing consumed bandwidth cannot be undone.
- Remaining risks: bounded recent/publication windows can miss older/backdated records; response limits and after are not database-side deltas. Full release measurement is required before asserting a monthly saving. Broader read optimization needs a separately verified cursor contract.
- Map/domain/documentation: ai-connections domain includes the cache/DAO and new regression test; generated maps refreshed by the map command, never hand-edited.
- Delivery status: commit / PR / merge / CI / deployment reported separately from actual evidence.

## Validation on 2 November 2026

- Focused offline connector/DAO/cache/SDK/SQL tests: 45/45 passed, zero skipped. Includes 6 added regressions across the new scoped-read tests and existing DAO harness.
- Type check (`npm run lint`, tsc --noEmit): passed before final release check; final repetition recorded in the PR handoff.
- `npm run build --ignore-scripts`: passed TypeScript, Vite, startup performance budget and server bundle. The option skips only the unrelated version-bump prebuild hook. No deployment artifact is published from this local reconstructed snapshot.
- `npm run map:generate`, `npm run map:check`, `npm run test:map`: passed, 6/6 map tests.
- `git diff --check`: passed.
- Full `npm test` attempt is not green: the company-navigation fixture lacks the newly imported cleanBseSubject function, and four PDF-open assertions disagree with upstream behavior (admission retry interval, sanitized filename, additional allowlisted candidate URLs and limiter configuration). The same five failures reproduce in the untouched upstream source worktree with the same dependencies. They are recorded as pre-existing blockers, not weakened or changed in this performance PR. A second full TAP invocation ended without a complete suite summary; no complete passing suite count is claimed.
- No production writes, migrations, live notification sends or paid model calls were used for verification. Browser/live-client validation and deployed bandwidth savings remain unverified.

## Publication boundary

The local implementation commit is e416ab6. Final focused tests passed 45/45, final type check passed and final build passed. GitHub branch codex/mcp-efficient-scoped-reads was created at the starting upstream revision. Upload of the first generated-map blob was rejected by automatic approval review: it requires explicit authorization to publish the large repository-derived map payload, including source metadata and environment-variable references, to dahiyarahul023-sudo/Bsenexus-new. No implementation commit was pushed, no PR was opened, and no merge or deployment occurred. The tested implementation and generated maps remain available locally for review; publication awaits that explicit authorization. The rejected upload was not retried through another route.

Explicit user approval to publish these changes and generated maps to dahiyarahul023-sudo/Bsenexus-new was received on 2 November 2026. The earlier rejection above records the prior state; publication is being retried using that authorization.
