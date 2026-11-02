# Efficient filing reads for connected AI agents

Use the user's question to choose scope before fetching data. Tool descriptions and the MCP initialization instructions carry this policy; the server independently checks ownership, permissions, subscription and account quotas. Model instructions are guidance, not authorization or a guarantee that every client will obey.

## Recommended calls

| User intent | First action | Follow-up |
| --- | --- | --- |
| Latest filings for one known stock | `filings_search({company:"TCS",limit:5,detail:"brief"})` | Keep that company; request more detail only for relevant IDs. |
| Unclear stock name | `company_lookup({query:"..."})` once | Resolve candidates, then reuse the verified code or symbol. |
| Filings for an owned watchlist | `watchlists_read({})` once to choose an ID, then `filings_search({watchlistId:"...",limit:5,detail:"brief"})` | Requires market:read, watchlists:read and Pro/trial. Membership is read from the connected owner's row. |
| Check for updates | Reuse the same company/watchlist and inclusive `after` publication time | Keep seen IDs, use overlap for late arrivals and wait at least `recommendedPollIntervalSeconds` (60). |
| Requested historical research | Keep scope/category/after fixed and pass `nextBefore` with `nextBeforeId` | Stop at `hasMore:false`; same-timestamp cursors may equal the inclusive after boundary. |
| Analyze a particular document | Use its existing filing ID with `filing_summary` | Only when requested/relevant; generation uses the existing shared website allowance. |

A watchlist search filters the existing 500-record in-memory recent filing window by exact security codes before pagination. It does not query each stock's archive. An empty watchlist returns empty, an unknown/foreign ID returns not_found and a storage failure remains an error. It never silently widens to all stocks. It does not claim complete watchlist history.

One-company searches share a bounded public filing-body cache: 16 company entries, at most 400 records per entry and 30 seconds from load start. Concurrent reads for the same code coalesce; changing category, detail or pagination does not reload the same company body. Callers receive defensive copies. Failed durable reads are not cached as empty success. Queued/confirmed local writes and deletes invalidate affected cached data; remote writes are reconciled after the TTL. The cache is per process, so multiple Cloud Run instances and restarts each have their own cold reads. Private watchlist membership, account state, access tokens and quota reservations are not shared through this public cache.

## Limits and honest coverage

- Broad market reads and historical research remain available when the user asks. Do not enumerate all companies or all pages as a default setup step.
- `limit` bounds the response, not necessarily the database transfer. A cold company query still reads its existing bounded stored window. `after` currently filters that window in memory; it is not a database delta query.
- Recent market reads are already in memory. Their 500-row scan does not by itself mean 500 rows were downloaded from Supabase for that call.
- `newestPublishedAt` is an inclusive publication watermark. Keep IDs for deduplication; `generatedAt` is response-generation time, not ingestion freshness. This bounded, publication-ordered API is not a lossless change feed. Old/backdated documents can fall outside the window.
- Do not set up perpetual polling unless the host supports scheduling and the user requested it. Existing allowances remain Free 20 calls/day and Pro/trial 200 calls/day (normal accounts). One-minute polling for an entire day would require 1,440 calls, before other tools.
- A 429 means stop and respect the applicable allowance/reset. Do not rotate clients, accounts or connections to evade enforcement. Quotas remain durable and checked before cached market reads.
- HTTP cache headers or compression between the application and an AI client do not retroactively remove Supabase-to-backend database transfer. Supabase's separate cached-egress allowance principally concerns Storage CDN hits.

## What the traffic evidence establishes

A read-only production log aggregation for 1 November 2026, 00:00–24:00 IST recorded 120,156 gateway events. The backend client accounted for 44,907 announcement GETs and 33,673 watchlist GETs. Query projections included 30,577 watchlist `lists,revision` reads, 24,065 announcement `select=*` reads without an explicit URL limit and 15,027 announcement `id,data` reads. These include background services and read-before-write operations; the common backend client label does not identify which originating product feature made each request. No explicit URL limit does not prove every row was returned.

These are request counts, not byte measurements. Available gateway logs do not establish billed bytes per MCP tool. Connector daily rows for the prior day were not available in the inspected usage result, so MCP cannot be named as the sole cause. The prior 1 November dashboard brief reported 6.29 GB against a 5 GB allowance; that is historical evidence, not a newly verified billing total.

The earlier main-branch watchlist inventory and filing-ID cache optimization is preserved. A high request count alone does not show whether the deployed Cloud Run revision contains those fixes. Deployment identity and post-release measurements remain necessary.

## Next optimization gates

Measure before widening this change: Cloud Run logs should aggregate tool/route, safe cache outcome, actual upstream query count and response sizes without tokens, document contents or private IDs. Correlate with the organization usage page and compare equivalent traffic windows. Backend-to-client JSON bytes alone are not Supabase egress bytes.

If cold company windows remain costly, design a dedicated ingestion-ordered delta endpoint with a validated cursor over `(fetched_at,id)`, server-side company filtering, stable high-water bounds, tied-ID pagination and an explicit late/backdated policy. Verify whether existing ingestion timestamps are immutable before using them as cursors. Do not substitute publication time or silently truncate a backlog. Any schema/RPC/index change needs its own migration and isolated verification. This change adds no tables or migrations and makes no paid-plan/pricing changes.

Sources: https://supabase.com/docs/guides/platform/manage-your-usage/egress and https://supabase.com/docs/guides/storage/serving/bandwidth .
