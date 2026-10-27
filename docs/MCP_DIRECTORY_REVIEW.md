# BSE Nexus connector directory release review

Engineering remediation of the 21 October 2026 supplied checklist is implemented. This document records what is executable, what was tested and what still requires external evidence. It is not an assertion that the directory application is ready to submit.

## Remediated behavior

- All 23 wire-registered tools have a human title. Twelve reads use readOnlyHint; eleven state-changing tools, including PDF analysis, use destructiveHint. Input schemas remain strict and writes retain requestId receipts. Descriptions are factual, not instructions to the model.
- filing_summary analyzes an existing filing’s allowlisted official PDF in English or Roman Hinglish. Its dedicated provenance cache cannot reuse legacy heuristic website summaries. Missing/unreadable PDF, bad language/output or provider failure returns an explicit error and refunds the shared generation reservation. Large PDFs expose extracted-text coverage and input truncation. Other website/Telegram summary behavior remains independent.
- results_read explicitly returns source-backed filing records, not extracted revenue/EBITDA/PAT/EPS or comparisons. The response includes financialMetricsIncluded=false.
- INDUSINDBK is 532187; J&KBANK is 532209. Legacy ZOMATO resolves to current ETERNAL/543320. A known-symbol mismatch from disk cache cannot overwrite these identities. Legacy watchlist projection follows the stored security code and exposes identityConflict when appropriate; private lists are not silently migrated to an assumed intent.
- Read-only company lookup provides bounded approximate suggestions. Approximate names are not accepted automatically by write resolution.
- Filing output fills known tickers from code, cleans text, fixes empty-identity double-slash links, reports legacy trailing-ellipsis truncation and normalizes category tags. Filters match the returned categories array. Matching cross-exchange issuer/headline copies within 15 minutes are deduplicated before applying cursors, so an older copy cannot resurface on the next page. Different disclosures remain separate.
- Watchlist active state is boolean at the connector boundary, including replayed writes. Stored 0/1 website compatibility is preserved.
- DCR supports Claude’s HTTPS callback and exact HTTP localhost/127.0.0.1 native callbacks with port relaxation through the pinned SDK. The code binds to the actual selected callback. PKCE S256, consent, refresh rotation, no-store, origin guards and owner-scoped privileged RPCs remain enforced. client_credentials is rejected.
- /ai-docs is a public setup/tool/coverage/privacy guide, linked from AI Connections and discovery metadata. Client/server privacy pages consume one shared disclosure. The page is in both sitemaps and queued for IndexNow once per content version.
- Safe MCP logs contain a generated request ID, method/tool, status/error code, elapsed time and an irreversible connection tag. No arguments, tokens, consent query or note text are logged.

## Evidence

Automated checks execute every advertised tool over the actual Streamable HTTP SDK with the real runner and actual SQL mutation/receipt functions. Public-market, identity and provider inputs are synthetic. All writes replay their receipt; all typed tools reject owner injection/missing scope; guessed foreign private IDs are denied and the foreign fixtures remain unchanged. Separate tests challenge public data normalization, cache poisoning, PDF bytes/provenance/language/failure refunds and native OAuth registration/authorize behavior. Existing SQL tests cover rotated refresh reuse and revoked grants.

Executed scripts/verify-mcp-directory-staging.sql on staging vjjdjzehecrdgtonzakv with service_role. All six foreign-object write attempts and a foreign grant were denied; browser RPC/receipt privileges remain absent. All fixtures rolled back. No schema migration or production personal-data mutation was needed.

Supabase changelog reviewed 21 October: the upcoming 10 November removal of obsolete TLS 1.2 ciphers and older PostgreSQL maintenance notes do not require an API change here. The existing Node 24/Supabase client path was retained; actual staging queries succeeded. Current service-role/RLS documentation confirms that explicit server ownership filters remain necessary.

Host compile_applet/lint_applet tools are unavailable. Configured tsc, Vite/esbuild, map and test commands provide repository evidence. Full isolated suite: 653 tests pass. Typecheck/build, six map tests, map freshness and 390/768/1440 px Chromium guide/privacy checks pass. Exact browser observations, CI and merge belong to rule/changes/mcp-directory-checklist.md and the associated PR. These do not prove a deployed release, a real paid model response or a clean Claude login.

## Reviewer account provisioning and reset

A reviewer should use a separate email the operator controls, with realistic synthetic data, never the operator’s personal account. scripts/provision-ai-reviewer.ts is dry-run by default. It refuses an existing email or a UID without the dedicated mcp-reviewer UUID namespace and marker. Passwords are read from server environment and never printed. It does not send emails, grant Pro, alter payments or enlarge the shared website AI quota.

1. On a server with Firebase Admin and Supabase service credentials, set REVIEWER_EMAIL and a unique REVIEWER_PASSWORD of at least 16 characters. Run `node --import tsx scripts/provision-ai-reviewer.ts create` to inspect the plan, then repeat with `--apply` to create that dedicated Firebase account.
2. Save the printed UID privately as AI_REVIEWER_UID. Sign in once at https://bsenexus.in/ using the reviewer email/password, so the normal account profile and trial behavior initialize. Verify the email normally if the sign-in flow requires it. Existing site plan rules remain authoritative.
3. Run `node --import tsx scripts/provision-ai-reviewer.ts seed` and inspect the dry-run, then repeat with `--apply`. The account receives a TCS/RELIANCE watchlist, a sample note and mixed alert switches. There are no notification destinations, private documents or other real-user data.
4. Optional bounded reviewer connector limits: set AI_REVIEWER_UID and AI_REVIEWER_UNTIL to an ISO time no more than 31 days away. Only that dedicated UID receives 1,000 calls/day, 40/minute and 200 writes/day. This grants neither Pro/trial nor extra paid AI generation. The normal per-IP transport limit still applies.
5. Share reviewer credentials privately in the portal. Never commit them to this repository or include them in screenshots/logs. The guide and listing must state actual free/Pro requirements. Confirm account_context shows sufficient current plan and allowance before handing off.
6. Before resetting, close the reviewer’s website sessions and disconnect all clients. `reset` dry-run then `reset --apply` revokes connection grants/Firebase refresh sessions, clears only this dedicated account’s connector usage/receipts, and restores its sample lists/notes/switches. A partially failed reset remains visible and can be retried. Reconnect through fresh consent afterward; normal trial/Pro dates are unchanged.
7. After review, remove the reviewer override, revoke connections, disable/delete the dedicated test account through the existing administrator process and process its data cleanup. Do not extend its expiry indefinitely.

No dedicated account was created in this session: neither Firebase Admin nor Supabase service credentials are present in the local runtime, and no operator-controlled reviewer email/password was supplied. The SQL connector is used only for rolled-back staging verification, not to fabricate a Firebase login or paid profile.

## Clean reviewer walkthrough

Use a clean browser profile. Sign in as the dedicated reviewer at https://bsenexus.in/; confirm fixtures and an active trial/Pro for watchlist/alert writes. In Claude choose Customize → Connectors → Add custom connector; name BSE Nexus, URL https://bsenexus.in/mcp, sign-in, OAuth client Register automatically. Review read scopes, then add only the write/analysis scopes used by that test. Approve on BSE Nexus and finish connection in Claude.

Follow /ai-docs examples: company and filing search; latest result filing; tomorrow’s watchlist results; note creation/update; one draft watchlist with rename/pause/add/priority/remove; preference and alert switch edits; original PDF analysis in both languages. A current filing ID comes from filings_search. Repeat each write with the same requestId in MCP Inspector and confirm one change. Inspector uses a native HTTP loopback callback and S256; do not downgrade PKCE or copy raw tokens into a chat.

Check empty and maximum pages, malformed/unknown arguments, a revoked/missing scope, an expired plan, unavailable storage/provider, the remaining allowance, and two separate connected test accounts. Account A’s tools must not reveal or edit B’s list/note IDs. Notifications and preferences must remain owner-scoped. Capture only safe request IDs and outcomes. The portal’s “every tool tested” acknowledgment is pending until both MCP Inspector and a clean Claude custom connector exercise the deployed release; local SDK fixtures are not that acknowledgment.

## Proposed listing materials

- Server name: BSE Nexus
- One-liner (within 55 characters): Indian company filings and watchlists in your AI
- Proposed permanent slug: bse-nexus; owner must confirm availability before submission.
- Categories: Finance; Productivity (choose from the portal’s actual available category labels).
- Website: https://bsenexus.in/; documentation: https://bsenexus.in/ai-docs; privacy: https://bsenexus.in/privacy; support/review contact: admin@bsenexus.in; icon: https://bsenexus.in/icon-192.png. Verify these after publication.
- OAuth mode: Dynamic Client Registration, public authorization_code + refresh_token with S256. No client secret and no client_credentials connection.
- Description: BSE Nexus provides source-linked Indian company filing records and scheduled results dates from available stored exchange disclosures. A connected account can read its own notes, notifications and watchlists, and approved write tools can create or edit notes, customize watchlists and update permitted preferences. Public-market reads and notes work with a free account; watchlist tools and alert edits require active Pro or trial. Explicitly requested filing analysis reads an official PDF using the existing website AI allowance. Market/calendar coverage is partial and may be delayed; result-record tools do not extract financial metrics. BSE Nexus offers information, not trade execution or investment recommendations. Accounts connect using OAuth consent and access can be revoked in Settings.

## Data rights and final submission gates

The official [BSE disclaimer](https://beta.bseindia.com/static/about/disclaimer.htm), [BSE corporate-announcement page](https://www.bseindia.com/corporates/ann), [NSE terms](https://www.nseindia.com/static/nse-terms-of-use) and [NSE data policy](https://www.nseindia.com/static/market-data/nse-data-policy) contain restrictions on content/data reuse or redistribution. Corporate disclosure links/text, structured exchange feeds, quotes and provider processing can have different rights requirements; public availability alone is not a documented license. No agreement or permission evidence was supplied here. The owner should record the applicable agreement/permission or obtain a qualified assessment of the specific use before asserting a legitimate proxy/redistribution basis to the portal. This review does not conclude that the current service is licensed or unlawful.

Pending gates:

- Publish this exact source release; verify public HTTPS /mcp initialize/tools/list/tools/call, discovery, no-token 401 challenge, invalid Origin 403, Claude/missing Origin, no-store and response timing through the actual hosting/WAF path. Local and current production-before-change read checks are not post-release verification.
- Create/populate the dedicated reviewer account, privately provide credentials and run every tool with it in MCP Inspector and Claude. No real user’s writes or paid model calls were exercised here.
- Record the upstream permission basis and review the updated privacy/retention/provider disclosure against actual operating practice. Do not blindly attest “first-party-only API” while hiding upstream exchanges.
- Confirm permanent slug, ownership/contact, public links/icon, sponsorship/content answers and all portal acknowledgments against actual facts. The code has no money-transfer, AI media-generation, arbitrary remote API or Claude conversation/file access tools; sponsorship and legal acknowledgments still need owner confirmation.
- Submit only after these gates. No portal submission or review email was sent as part of this engineering work.

Primary directory criteria: https://claude.com/docs/connectors/building/review-criteria; submission: https://claude.com/docs/connectors/building/submission; verification labels: https://claude.com/docs/connectors/verification. Those pages were checked directly; third-party guides are not treated as requirements.
