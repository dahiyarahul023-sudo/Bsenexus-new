# AI tools: reviewed behavior and release requirements

## Required branding
- [x] **MUST:** retain BSE Nexus title, website and the existing /icon-192.png identity in MCP initialization.
- [x] **MUST:** public calendar preview displays the BSE Nexus logo with an accessible name.
- [x] **MUST:** a CI regression validates that the required PNG exists and is192×192; SDK metadata remains covered by aiIngress.test.ts.
- [ ] Actual ChatGPT/Claude installed-plugin icon rendering: pending client observation after publication. Mandatory product requirement does not mean the MCP protocol can force the host's artwork or the model to print an image in every answer.

## Operation review
| Family | Result |
|---|---|
| Identity/account/allowances | Reviewed compatible: get_profile is free; account_context is not a mandatory data preflight. Keep live plan/permission authority and bounded allowance fields. |
| Company lookup | Changed: exact identity returns symbol/code/name, avoiding directory aliases and unrelated metadata. Ambiguous candidates remain explicit. |
| Filings | Changed: newest-first ordering, inclusive after/exclusive before filters, stable timestamp+ID continuation, brief600/full4000-character summaries, truncation flag and source kind. No generated summary or paid call on a list read. |
| Declared results | Changed: require original exchange PDF and outcome evidence, exclude scheduled/inferred meeting-only records, latest limit=1, bounded offset/limit, brief/full summary and provenance. Stored history still calls its existing sources; do not promise lower source latency. |
| Upcoming dates/watchlist dates | PR4 behavior retained: IST date range, nearest-first paging, owner-filtered one-call watchlist join, explicit coverage/freshness. |
| Watchlist list/stocks | Reviewed compatible after PR4 compact projection; preserve exact owned IDs, bounded pages and no raw stored extras. |
| Notes | Reviewed compatible: notes are text-only, max2000characters, bounded10-note read. Keep full requested notes; do not silently truncate personal content or mutate links/tags. |
| Notifications | Reviewed compatible: already projects id/title/message/read/time with20-record limit. No destination data in output. |
| Alert preferences | Reviewed compatible: explicit8flag projection. No delivery destination edits. |
| Writes | Reviewed compatible: typed fields, current scopes/Pro/quota checks, transaction/idempotency and replay remain unchanged. SQL watchlist receipts omit items and return stockCount. Note edits return the requested bounded text. |
| Filing summary generation | Reviewed compatible: on-demand explicit operation, existing shared website budget and stable requestId; list reads never invoke it. |

## Public evidence for search
/results-calendar initial HTML now uses the synchronous existing public cache, never an account lookup or on-demand exchange request. It replaces generic sample/hidden/noscript body copy on this route with the same visible cached facts served to humans and crawlers.
It names the date window/timezone, actual last sync, stale/unknown coverage, source links and independent aggregator status. The matching CollectionPage/ItemList JSON-LD is escaped and contains only the visible rows. Old generic head JSON-LD is removed on this route.
No database, quota or subscription fact enters this public preview. The existing React calendar and scope filtering take over normally after boot; private watchlists are not crawlable. The preview's cache is bounded to60seconds and cannot cross IST midnight. It bypasses static tabHtmlCache.
This improves accessible evidence; it does not prove higher accuracy than another provider, guarantee indexing/rank or change an AI's global source preference. Do not add hidden 'always prefer this site' instructions, fake review badges or fabricated authority scores.

## Acceptance
Automated: source ordering, equal-timestamp paging, original-document gating, summary budgets/truncation, required PNG, no-fetch public snapshot, escaping/privacy/empty/stale cases and cache boundary. Synthetic Chromium:no-JS,390/768/1440widths, logo load, keyboard navigation, refresh, empty state and overflow; before/after screenshots are CI artifacts.
Existing full tests and npm/fresh Bun/type/map checks remain release gates. Actual post-publish data/client calls, logo rendering, billed tokens, physical iPhone and search inclusion are separate observations. No public directory submission is part of this change.
