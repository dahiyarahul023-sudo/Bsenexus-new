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
