# Connector dates, compact reads and engineering lessons

Starting commit: 5030d9bee22248ef895e1dc2269df23ce157f34d. Date: 21 Oct 2026 IST.
Request: explain repeated setup failures; nearest upcoming watchlist results, lower call/context overhead, correct branding, and realistic public AI discovery.

Verified source facts:
- market.meetingsData calls getResultsCalendarData("upcoming", ..., "market"). The upstream upcoming filter deliberately excludes TODAY, and market scope restricts to marketUniverse. It returns only20 entries without pagination or freshness/source fields.
- No server operation joins the connected account's watchlist stocks with upcoming calendar rows. A model may need many watchlist/company/calendar calls; each runner invocation reserves quota.
- watchlists_read returns raw previews; watchlist_stocks_read returns raw stored stock objects. MCP HTTP result contains full JSON in both text and structuredContent.
- MCP initialization identifies Bsenexus without icons/websiteUrl; legacy ai-plugin logo_url already exists. Rendering remains client-controlled.
- robots.txt already permits OAI-SearchBot; connector use and public search discovery are separate. No guarantee of ranking or global source preference.
- Personal Context did not locate the actual skipped-date/tool-call transcript; root cause of that particular answer and precise token/quota cost remain unknown.

Plan before source edits:
- map:impact source and inspect all HTTP/OpenAPI, policy/runner, calendar/UI/poller/DB consumers.
- Preserve existing website filters. Extract a read-only shared calendar snapshot for AI; scope private results using durable owner-filtered watchlist reads, not guest/default lists.
- Add nearest-date IST selection, literal today/tomorrow or exact date boundaries, sorting before paging, source/freshness/coverage; a single scoped watchlist-results read.
- Bound watchlist output to documented fields; reduce repeated MCP text with a compact summary and full structured data, retaining a text-only fallback.
- Add standards-based server branding, concise intent guidance; no arbitrary code execution, model routing service, new schema, quota changes or public directory submission.
- Regressions: IST boundary, today/tomorrow inclusive, nearest matches beyond market first page, exact ownership/pro/scopes, empty/missing coverage, payload size, SDK initialize and protocol behavior.
- Local execution unavailable. Use remote CI without credentials. compile_applet/lint_applet unavailable; report npm type/build substitutes.

Impact command ran on initial branch before source changes (workflow39497285349): inspected calendar service reverse consumers, market-data/public/API/AI domains, existing calendarScope and SDK tests. Calendar snapshot extraction moves only enrichment retrieval before website filtering; existing website scope/filter/count/sort logic stays unchanged. API routes, poller/sync service, notifications/monitor/SEO callers reviewed-and-compatible; no date ingestion, retry policy, payment, auth or schema edits.
Changed consumers: MCP tools/policy/metadata and REST board-meetings date/page parameters; legacy OpenAPI/Gemini schema generation propagates those fields. Existing company/results/filings routes remain compatible. Frontend uses its original getResultsCalendarData contract, so no visual/UI changes or browser visual claims.
SDK1.32.1 ImplementationSchema accepted icons/title/websiteUrl in the runner. Backwards JSON text fallback is retained after primary MCP guidance review; compact stock projection and a direct join reduce the actual returned data/calls.

First focused runner39498026244: existing connector11/11 plus new behavior regressions5/5 passed. Synthetic oversized25-stock fixture shrank from1429792 to2877 JSON bytes after excluding unrelated stored fields; this is a data-minimization fixture, not measured production token or quota savings. Fresh Bun type check caught a test-double return type mismatch (raw PostgREST envelope vs aiDb unwrapped data); corrected the fixture to exercise the actual envelope/unwrapping contract. No production logic change needed for that failure.
