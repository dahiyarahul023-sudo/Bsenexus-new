# BSE Nexus connector quality and release gate

## What the OAuth incident taught us
A passing protocol/mock test was insufficient for the actual custom-domain browser journey. The relative303 change ended the handler response but did not preserve navigation through a gateway that follows redirects internally. The real browser stayed at /authorize and the SPA rendered404. This was a missed integration boundary.

Keep one evidence record per incident across chats: starting/deployed SHA and revision, exact route, expected vs observed result, safe timestamps/trace stages, known facts, hypotheses, controls, change, tests, merge, deployment and live acceptance. Never restart diagnosis from memory or treat merged source as a published fix. A fresh chat begins by reading the current record and verifying the deployed revision.

Diagnose in this order: discovery/status -> registration -> valid authorize -> public-domain browser consent -> approval/callback -> token -> read-only tool. Compare public/published responses with redirect=manual. Invalid requests returning quickly do not certify the valid path. Check browser address and rendered page, not just status200. Preserve working host/Origin/PKCE/ownership/quota rules. Do not edit Worker/DNS/Transform Rules to explain an app defect without independent evidence.

Before declaring a connection fixed, the real production client must complete that sequence. Synthetic CI tests are a regression contract; they do not replace account consent or prove platform UI/icon behavior.

## Date and intent contract
- Upcoming result dates are scheduled board-meeting notices. They are not already-declared financial results.
- meetings_read reads the available stored calendar, including today by default, sorted by meeting date before paging.
- watchlist_results_upcoming joins the connected account's durable watchlists with the calendar in one tool invocation. It requires market:read, watchlists:read and active Pro/trial; no caller UID is accepted.
- All active lists are included by default. An exact owned watchlistId can select one list, including a paused list if explicitly requested.
- today/tomorrow mean Asia/Kolkata. For tomorrow only, pass fromDate=tomorrow and toDate=tomorrow. ExactYYYY-MM-DD ranges are inclusive and limited to the next60days. Upcoming without a specified start includes today; a model must not silently move the requested range forward.
- Returned referenceDate/fromDate/toDate, lastSyncedAt, stale, nextOffset and coverage must be preserved in the answer. Empty coverage is not proof of no scheduled result. Do not substitute older outcomes for missing upcoming dates.
- results_read remains for declared filings/available summaries, with source links; it does not certify extracted financial metrics.
- Scheduled calendars are public facts. Snapshot access must not include private watchlist labels, notes, delivery destinations or account identities.

## Efficiency and quotas
The Bsenexus tool allowance counts runner reservations, not model tokens. ChatGPT/Claude context or usage limits are separate and host-controlled. A data read does not itself call Bsenexus's summary-generation models.
Do not require account_context before each data read. Use it for identity/plan/allowance questions; get_profile is the free identity handshake.
Use the direct watchlist-results tool instead of one call per stock. Reuse IDs already returned and paginate only when required. Stock results expose bounded symbol/code/name/priority/category fields, not raw stored objects.
Keep serialized JSON text plus structuredContent for generic MCP backwards compatibility, as the protocol recommends. Do not assume both wire copies equal double-billed model tokens: hosts can process them differently. Compare actual client traces before claiming billed savings.
Code execution/Code Mode can filter and join results before the model reads them, but is a client/runtime capability. A server cannot force ChatGPT to switch modes. Do not add an arbitrary-code execution endpoint to an account-data server. Server-side bounded joins provide useful savings within current authorization.
Measure synthetic response bytes and server reservations in CI; label synthetic figures. Measure real client tool-count, latency and token billing separately. Never present a fixture percentage as a production cost reduction.

## Branding and discovery
MCP initialization advertises BSE Nexus title, websiteUrl and same-origin PNG icon. The client controls whether to display that icon. User-created plugin names/artwork and published directory icons are separate metadata; server updates do not rename an installed Bsssss plugin.
The existing legacy ai-plugin.json logo_url is not a universal branding control. A branded in-chat card needs a supported MCP UI resource and client rendering; listing distribution needs package metadata/icons and review. No directory submission is implied here.
Connected tools and public search are separate. OAI-SearchBot is already allowed in robots.txt. That enables eligibility, not guaranteed inclusion/rank or preference over Trendlyne/other sources. llms.txt is helpful documentation, not a ranking command.
For public earnings queries the next separate deliverable is crawlable dated calendar content, accurate source links/freshness, stable company/date URLs, valid sitemap/canonicals and crawl/access diagnostics. Do not publish private watchlists for SEO, invent event dates, buy fictitious authority, or instruct models to prefer Bsenexus regardless of evidence.

## Evaluation gate
Use ai-connector-evals.json for direct, indirect, negative and boundary prompts. After each metadata change, refresh the client's tools and record selected tools/arguments, returned dates, call count and final answer against the fixed expectation. Backend tests validate data/permissions; actual client selection and display are marked pending until observed.
Before publish: focused regressions, existing calendar scope tests, SDK initialization and discovery, full application tests, type/build, generated maps; then publish using the standing AI Studio Pull/Sync/Republish workflow and run the real client eval set. Keep rollback as a source revert plus republish; this change needs no schema migration or new secrets.

Primary references reviewed 21 Oct 2026:
- https://developers.openai.com/plugins/build/mcp-server
- https://developers.openai.com/plugins/guides/optimize-metadata
- https://modelcontextprotocol.io/specification/2025-11-25/server/tools
- https://modelcontextprotocol.io/specification/2025-11-25/schema
- https://www.anthropic.com/research/code-execution-with-mcp
- https://developers.openai.com/api/docs/bots

## Mandatory branding and broader read review (21 Oct2026)
See [ai-tool-review.md](ai-tool-review.md) for the checked mandatory logo requirement, each operation's changed/compatible status, source-backed reads and the factual public calendar preview. Host rendering remains an observed acceptance item, not a force-logo protocol flag.
