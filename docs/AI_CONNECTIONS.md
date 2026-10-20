# AI connections: implementation and rollout

This is a custom remote MCP connection with OAuth, not an AI-directory publication. A compatible AI client starts authorization, Bsenexus asks the signed-in account to select permissions, and the client receives an opaque token. Users do not create or paste a long-lived API key. Client availability and its subscription requirements are controlled by the client vendor.

## Current release state

Source implementation and tests are complete. The user explicitly approved publishing to `dahiyarahul023-sudo/Bsenexus-new/main` and applying staging then production migrations on 20 October 2026. Prior automatic-review approval blockers were resolved by that approval.

The schema is now installed in **Bsenexus-staging (`vjjdjzehecrdgtonzakv`)**, migration version `20261020084643`, and **Bsenexus (`ibldmiumivdspzhslsud`)**, version `20261020085056`, both named `ai_connections`. Six private RLS tables and seven invoker functions were verified: browser roles have no read/execute privileges; service_role has the required access. The shared watchlist revision column/trigger is present. All 31 pre-existing production watchlist documents retained their original aggregate content hash; their initial revisions remain zero.

A rollback-only integration test ran successfully on actual staging as service_role, covering registration, single-use consent, client/callback binding, code exchange/replay, mutations, retry receipts, stale-write denial, cross-account denial, forbidden profile fields, Pro expiry, quotas and refresh replay revocation. Cleanup was independently checked: zero synthetic users, grants or clients remained. See `scripts/verify-ai-connections-staging.sql`. All 27 connection-specific local tests passed again after approval.

`AI_CONNECTIONS_ENABLED` remains **false by default**. Database installation does not deploy the running application or establish browser/real-AI-client acceptance. Roll out the compatible application to all writers and complete those checks before enabling connections. No application hosting deployment was performed during this rollout.

Security advisors on both projects were reviewed. The six new private tables deliberately have no browser RLS policies and produce only the informational [RLS-without-policy notice](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy); direct privileges are revoked and service-role access was verified. Production also has four pre-existing [mutable-search-path warnings](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable) outside the new functions. They were not changed by this release. Read-only checks confirmed all four are invoker functions, deny browser-role EXECUTE, and browser roles cannot CREATE in public. All seven new functions have an empty search_path and no browser execute permission.

## Connection and ownership

- Canonical resource: `https://bsenexus.in/mcp`, configurable with server-only `AI_PUBLIC_ORIGIN`.
- Public clients use exact registered HTTPS callbacks, authorization code flow and S256 PKCE. Plain HTTP, IP/local callbacks, custom ports, credentials and fragments are rejected. Native/desktop localhost callback flows are not supported in this version.
- Consent requests expire in 10 minutes; codes in 2 minutes; access tokens in 15 minutes; connections and rotating refresh tokens in 30 days. Refresh replay revokes the connection. Tokens and consent secrets are stored only as SHA-256 hashes.
- Consent defaults to read permissions. Additional write permissions require the user's selection. Developer-supplied application names are explicitly unverified; the consent page shows the callback origin.
- Every call resolves the account from the validated grant. Tools reject supplied UIDs, roles, prices, URLs and SQL. The external tool surface does not accept website cookies or Firebase/site tokens as an AI credential.
- Website consent/revocation uses existing sign-in and an exact Origin plus JSON content-type check. Grant ownership, scope, revocation, expiry and current paid entitlement are checked again for personal mutations inside the database transaction.
- Disconnect revokes all tokens in that connection. An already completed operation is not undone. A running model generation can finish after revocation; new calls fail.

## Tools and plans

Scopes further restrict every row below. An active existing Pro expiry/trial or an authoritative payment entitlement grants Pro tools; no new payment plan or price is introduced. Admin accounts get the bounded Pro connection budget, not unlimited AI access.

| Capability | Free | Active Pro/trial |
|---|---|---|
| Company lookup, bounded filings/results/meetings | Yes | Yes |
| Own notes read/create/edit | Yes | Yes |
| Summary language and in-app mute preference | Yes | Yes |
| Own notifications and permitted alert preferences read | Yes | Yes |
| Watchlist read/create/rename/pause, individual stocks and priorities | No | Yes |
| Change eight named alert category switches | No | Yes |
| Filing summary generation | Existing one-time website demo | Existing shared website generation quota |
| Billing, Pro grants, admin controls, Telegram destinations/sending, bulk deletion, arbitrary fetch/SQL | Unavailable | Unavailable |

Pilot connection budgets are **20 requests/day, 5/minute and 5 writes/day** for free; **200/day, 20/minute and 50 writes/day** for Pro. Writes also count toward the total daily/minute budget. All AI clients share the account's durable buckets; reconnecting does not reset them. Daily reset is midnight Asia/Kolkata. Schema discovery, consent/settings and the minimal `get_profile` identity tool do not consume this tool budget; HTTP abuse limits still apply. Public registration and pending authorization records also have global capacity limits.

New summaries additionally consume the website's existing allowance (currently 100/day for ordinary Pro generation). Cached summaries do not call the model. A failed generation releases its generation reservation/free demo claim; its accepted connection request still counts. Stable `requestId` values return the saved receipt without a second mutation or quota charge; reusing an ID with different arguments is rejected. Preserve the same ID after a timeout because the outcome can already be committed.

MCP publishes its typed tools directly. `/api/ai/openapi.json` describes **only** the four implemented OAuth-protected GET compatibility routes: `/api/ai/v1/filings`, `/results`, `/board-meetings`, `/company`. Gemini declarations require a host execution loop. A schema that is readable in a browser does not establish that a particular AI platform can execute it.

## Exploit and load boundaries

Authorization, entitlement, ownership, strict argument schemas, resource binding and budgets are server controls. Filing/note text and model instructions never grant permission. There are no arbitrary network, database or shell tools. Company names must resolve unambiguously before an edit. Results preserve source/coverage limitations; numerical metrics are not fabricated from missing filings.

Responses are bounded (25 filings/stocks, 20 watchlist descriptors with five-stock previews, ten notes, eight results, 20 notifications/meetings). Note text is capped at 2,000 characters; account safety capacities are 200 notes, 100 lists, 1,000 stocks/list and ten active connections. Personal writes and receipts commit together. Database failures fail closed. AI tokens, request bodies and consent queries are redacted from Sentry errors/traces; OAuth and account routes use no-store/no-referrer and bypass the PWA cache. Hosting/CDN request-log query retention must be checked separately during deployment.

An approved malicious client can misuse its **permitted** individual edits within these bounds. Read-only consent, narrow optional write scopes, bounded operations, activity history and revocation reduce that exposure. This is not a claim of zero exploit risk or a full penetration test. Infrastructure/WAF bot controls, distributed ingress limits and capacity monitoring remain deployment responsibilities; per-process IP limiters alone are not a distributed DDoS defence.

Website watchlist writes use request-local revision compare-and-swap while connections are enabled. A stale write retries with current cloud state; normal reads no longer upload old backups or run legacy whole-document migrations over AI edits. Website watchlists/profile/notes refresh when the user returns to the tab. This is focus/visibility refresh, not realtime cross-device synchronization. Open unsaved note drafts remain under the user's control.

## Approved rollout sequence

1. Keep `AI_CONNECTIONS_ENABLED=false` on every instance. Install pinned dependencies and deploy compatible code while disabled. Ensure `AI_PUBLIC_ORIGIN` matches the public HTTPS origin and trusted-proxy configuration matches the actual ingress.
2. After explicit approval, use Supabase CLI to apply `supabase/migrations/20261020072807_ai_connections.sql` to **staging** first. The CLI was unavailable in the authoring environment; isolated PGlite execution does not replace this step. The schema adds six private RLS tables, service-only RPCs and a watchlist revision column/trigger. It does not rewrite existing user lists or payment entitlements.
3. Verify all tables/RPC signatures, browser-role permission denial, current existing-table column types, the watchlist trigger and website editing in staging. Run a real OAuth consent/code/refresh/revoke cycle with a compatible external MCP client. Check free, trial, Pro, expiry, exhausted quota, no-token, wrong-account, revoked connection and database outage states. Test malicious note/filing text without changing the permission decision.
4. Browser QA remains required for direct `/plugin` entry, sign-in return, callback consent, copying, disconnect, repeated Terminal entry and browser Back/Forward. Exercise 390/768/1440px, both themes, keyboard/focus, 200% zoom and reduced motion. The remote browser could not reach the local preview; no visual pass is claimed.
5. For future installations, apply the reviewed migration to production only after staging database acceptance and production migration approval. This database step is complete for the current release; browser/client acceptance is still required before enabling the feature. Roll out compatible code to **all** writers before enabling the flag. Older website instances doing blind watchlist upserts must not coexist with enabled AI writers.
6. Enable a small pilot, check OAuth error categories, latency, quota/registration capacity and database load, and confirm no private responses are cached at the CDN. Validate real model/provider costs before expanding budgets or advertising a one-click directory connection.

Disablement: turn the flag off on every instance to stop new OAuth/tool calls. After approval, revoke grants if credentials may have escaped. Keep additive records for investigation and stable retry evidence; do not drop tables or remove the shared revision column as a casual rollback. Registration capacity and token/receipt retention need an explicitly reviewed operational cleanup policy before a broad launch. Never log or copy raw OAuth secrets while diagnosing a connection.


## 2026-10-20 connection/ingress and usability review

Read `rule/changes/ai-connection-usability.md` for the current evidence and delivery status. The public OpenAPI route returned 200 but MCP and OAuth discovery returned 403 `Invalid connection host`. The canonical origin advertised by OpenAPI was already correct. The source guard read raw Host despite the application already trusting one ingress hop; an automated production-mode proxy rewrite regression reproduces this rejection. Root and path-specific resource discovery now both return canonical metadata. The guard now uses Express trusted-proxy hostname handling, with canonical issuer/resource URLs still constructed solely from AI_PUBLIC_ORIGIN. Verify that the real ingress overwrites forwarded host/IP headers and that the configured trust boundary matches the deployment; raw production headers have not been observed.

MCP requests and preflights with a browser Origin use exact allowlisting: the configured public origin, https://chatgpt.com, https://claude.ai and https://gemini.google.com. Server-to-server clients usually omit Origin. Add another browser client's exact origin using server-only `AI_ALLOWED_ORIGINS` (comma-separated, no wildcard); a website Origin is never authentication. Bearer verification, disabled-by-default gating, scope/entitlement checks and database budgets remain in place.

The only visible site entry is Settings → AI Connections. `/plugin`, `/ai-plugin` and OAuth consent deep links remain compatible. The page offers explicit ChatGPT, Gemini, Claude and compatible-other-client instructions, a named server-URL field and clipboard recovery. Copying a public address never grants access. Grants are labelled Approved AI access rather than claiming the external AI completed its setup. Read scopes remain the consent default; late account/request responses are hidden and same-owner background refresh preserves content.

No manual user API key is required. This version supports automatic registration of public S256 PKCE OAuth clients. In Claude, select Register automatically rather than its published-identity option: this server does not resolve URL-based client metadata documents. Localhost/native callbacks and fixed confidential-client credentials remain unsupported.

Provider setup documentation reviewed on 2026-10-20:
- ChatGPT: https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt — current Plugins setup plus the legacy Apps interface; web/account/workspace availability is controlled by OpenAI.
- Gemini: https://support.google.com/gemini/answer/17209137?hl=en — web Custom apps setup; documentation currently requires an eligible personal account in the US, English and Keep Activity enabled. Availability cannot be enabled by a BSE Nexus code change.
- Claude: https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp — Customize/Connectors setup and automatic registration; workspace owners may need to add the connector.

Production was inspected read-only: six connection tables have RLS and deny browser-role table access; six business RPCs are invoker functions, fixed empty search_path and deny browser EXECUTE. There were zero registered clients and zero active grants, including admin. This is a dated observation, not evidence that hosted setup was enabled or that a client connected. The advisor's RLS-without-policy INFO entries are intentional for these service-only tables: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy . Four unrelated pre-existing mutable-search-path warnings were not modified: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable .

Ingress IP abuse limits remain per process: SDK registration 20/hour/IP and MCP 60/minute/IP, plus the durable account/tool budgets and global 10,000-client/pending-request capacity. Distributed ingress protection and reviewed registration/token retention are still operational work; no zero-exploit or load-capacity certification is claimed.

The host flag must be configured in the actual runtime, not just a preview or browser setting. Keep it disabled during rollout, deploy compatible writers, verify discovery 200 and unauthenticated MCP 401 with WWW-Authenticate after enablement, then complete consent/code/refresh/revoke and real-client/device acceptance before broader rollout. This source change does not deploy or enable hosting.

Local follow-up validation: all 568 backend tests, npm and isolated fresh-Bun builds, map check and six map fixtures pass. The real connection component was browser-tested at 320–1440 CSS pixels with test-only API/auth adapters, including manual-copy recovery, account changes, failure/retry, revocation and optional consent. This is Chromium coverage; live-client OAuth and physical iOS/Android acceptance still require the deployed runtime. `get_profile` uses explicit SDK schema generics to avoid unbounded Zod compatibility inference; pinned SDK/Zod dependencies remain installed.
