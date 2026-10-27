# Change: controlled AI account connections

- Starting commit: 3984be397e32bab62c1a3b8a1ca343ffbd9abc89 (Bsenexus-new/main).
- Objective: OAuth + PKCE, revocable scoped account tools, live subscription checks, durable per-account budgets, consistent personal edits, simple responsive connection hub. No arbitrary URL/SQL/admin tools. No pricing changes.
- Verified baseline: aiPlugin.ts exposes four anonymous read tools; numeric-code filtering falls through; AiPluginPage passes announcements instead of dashboard to App; browser previously reproduced blank Terminal entry and stale title.
- Owners: verified website identity for consent; durable grant + hashed tokens for external tools; existing users/payment_entitlements and user_watchlists/user_notes remain authoritative.
- Impact: npm run map:impact -- server/api/aiPlugin.ts src/components/AiPluginPage.tsx src/App.tsx server/database/watchlistDao.ts. Source graph plus manual auth, profile, notes, monitor, SW and public-copy review.
- Changed consumers: AI gateway, connection hub, App routing, Settings/Landing/Layout/CommandPalette entry copy, owner-scoped account reads/writes and quota storage.
- Reviewed compatible: payment catalogue/grants/referrals (prices unchanged), notes UI (same durable table), notification delivery (same profile preferences), company/detail views (same IDs). Browser and deployment evidence recorded below when executed.
- Security acceptance: expired/revoked/foreign tokens, wrong scopes, stale Pro, malformed arguments, code/refresh replay, consent CSRF/redirect abuse, unknown tools, duplicate mutations, quota races, store outage and private caching.
- Navigation acceptance: direct plugin entry, return after auth, Terminal, Back/Forward, settings entry; phone/tablet/desktop and light/dark.
- Deployment: compatible application with flag disabled, approved staging schema and acceptance, approved production schema, then enable only after all website writers are upgraded. External marketplace publication/platform credentials are distinct from implementation and must not be claimed as deployed.
- Local source obtained through connected GitHub because direct clone had no credentials. Initial npm ci exposed missing optional lockfile entries; installation repaired the lockfile while pinning the MCP SDK. Host compile_applet/lint_applet tools are unavailable; npm typecheck/build are the available project checks.
- Rollback: revert app commit; revoke grants; retain additive private tables until retention/deletion is separately authorised.
- Status: source implementation and local verification complete. Staging and production migrations are installed and verified as recorded below. No hosting deployment or live-client/browser acceptance claimed. See `docs/AI_CONNECTIONS.md` for exact tool/plan matrix, limits, threat boundaries and rollout.

## Consumer evidence

| Consumer | Result |
|---|---|
| MCP/OAuth (`server/ai/*`, `aiConnectionsDao`) | Changed: public-client S256 PKCE, opaque hashed credentials, expiry/resource/client binding, refresh rotation/replay revocation, explicit consent and owner-only revocation. SDK handler tests exercise bad verifier and unknown client before exchange. |
| Existing four GET data routes, OpenAPI, manifest, Gemini declarations | Changed: executed GET contracts, OAuth, CORS/no-store including denied paths, explicit host execution requirement; no invented endpoint/metric claims. Numeric company matching, real filing IDs and ISO cursor timestamps verified. |
| Account tools and SQL | Changed: verified grant owner, strict schemas, live durable plan check, service-only RPC/table privileges, all-connection account budgets, bounded reads/writes, atomic receipts and second transaction-level grant/plan check. Private storage outage cannot become local write success. |
| Website watchlist writers/readers | Changed: request-local revision CAS while enabled; stale retry preserves a simultaneous AI stock edit. Read paths do not upload old backups/migrate whole documents in this mode. Existing flag-off behavior retained. Monitor cache invalidated on AI mutations; other instances retain the existing bounded monitor TTL. |
| Website profiles, notes and notification preferences | Changed: approved fields only; alerts cannot alter destinations/send messages. Return-to-tab refresh suppresses late account/profile reads. Notes keep the same owner-scoped durable shape; unsaved drafts remain local. Existing note screen listens to notes-changed. |
| Payments, trials, existing AI generation quota | Reviewed compatible: no prices/grant logic changed. Pro expiry/trial/payment entitlement checked live. Model generation shares website quota/free demo; failed generation releases its separate reservation. |
| `/plugin`, Settings, header/mobile nav, command palette, landing | Changed: sign-in, platform choice, MCP instructions, consent permission checkboxes, copy failure, loading/error/retry, usage, connections/disconnect and recent activity. Terminal maps to dashboard; Settings and Back handling share the existing routes. No directory publication promised. |
| Service worker, server/CDN cache contract | Changed: plugin/OAuth/account paths bypass offline cache, personal responses no-store; deployment still must verify edge policy. |
| Sentry errors/traces | Changed: shared redaction strips raw OAuth credentials, consent query strings, sensitive headers and private AI request bodies without mutating requests; behavior test covers nested reports and ordinary diagnostics. Infrastructure access-log configuration remains unverified. |

## Validation

- `npm ci --ignore-scripts --no-audit --no-fund` passed after lockfile repair; existing Firebase patch script passed. Existing dependency versions were preserved except the explicitly pinned Zod dependency required with the new SDK.
- `npm run lint` passed; `npm run build` passed (existing large-chunk warning). Build-only version increment restored before committing source.
- `npm test`: **566 tests, 565 passed, one pre-existing failure** in `searchEngineDiscovery.test.ts`: expects the unchanged index title to start with Bsenexus, but baseline `index.html` starts “BSE Corporate Announcements &amp; Filings Live”. Neither the index nor that assertion was changed.
- **27 connection-specific tests passed** across contract/HTTP, SDK PKCE, strict tools, PGlite transactions/privileges, website CAS concurrency and telemetry. PGlite is isolated test evidence, not Supabase deployment evidence.
- `npm audit --omit=dev --json`: zero reported production dependency vulnerabilities at this check; not a penetration-test certification.
- `npm run map:generate`, `npm run map:check`, `npm run test:map`: passed; six map tests. Reviewed semantic domains updated in the same change. `git diff --check` passed.
- Required host `compile_applet`/`lint_applet` unavailable. Supabase CLI could not be installed in this environment. Real external OAuth clients, paid-provider calls, desktop/mobile visual/keyboard/theme/Back acceptance and deployed ingress/CDN behavior remain unverified. The remote browser could not reach the workspace local preview (`ERR_CONNECTION_REFUSED`); no screenshots or visual pass claimed.

## Approved rollout evidence — 20 October 2026

The user explicitly approved upload to `dahiyarahul023-sudo/Bsenexus-new/main` and the prepared migration to staging, then production after staging verification. The previous automatic-review blockers are resolved; the same server-file upload and migration tools accepted the newly authorized actions. Source publication must still be confirmed by its returned GitHub ref/commit, independently of database installation.

- Staging: **vjjdjzehecrdgtonzakv**, migration `20261020084643_ai_connections`, successfully applied.
- Actual staging service-role transaction tests: registration, consent reuse denial, exact client/callback binding, code exchange and replay denial, personal watchlist/stock mutation, idempotent retry and argument-conflict denial, stale revision CAS rejection, foreign-account denial, role-field rejection, live Pro expiry, account quota and rotating refresh replay revocation. All assertions passed; the transaction rolled back. A separate query confirmed zero synthetic users and no remaining grants/clients. The executed test is retained at `scripts/verify-ai-connections-staging.sql`.
- Production: **ibldmiumivdspzhslsud**, migration `20261020085056_ai_connections`, applied only after staging database acceptance. No smoke accounts or tools were run against production.
- Both projects: all six private tables have RLS; anon/authenticated have no SELECT privileges; service_role has SELECT/INSERT/UPDATE/DELETE. All seven functions are SECURITY INVOKER, use empty search_path, deny anon/authenticated EXECUTE and allow service_role. Watchlist revision bigint NOT NULL/default 0 and its trigger verified.
- Existing production watchlists: **31 records**, aggregate lists/UID content digest unchanged across migration; no existing revision advanced. No existing watchlist contents, user plans or payment records were rewritten.
- Security advisors: new private tables produce expected informational RLS-without-policy notices; policies intentionally remain absent because browser access is forbidden. [Advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). Four unrelated existing production function search_path warnings remain (all four are invoker-only and deny browser EXECUTE; browser CREATE on public is also denied); none of the seven new functions has that warning. [Remediation reference](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable).
- Before publication, repaired an initial download normalization: unmodified mapped files were restored to byte-exact upstream Git blobs (the retrieved snapshot had appended a trailing newline). Confirmed zero upstream byte differences outside the intended change set and regenerated the map. This is local snapshot repair, not an unrelated source change in GitHub.
- After approval, **27/27 connection-specific tests passed again** and map freshness passed. No application code changed during rollout except adding the executed staging verification script and maintaining evidence/domain/map documentation.

## Remaining activation checks

The source default remains `AI_CONNECTIONS_ENABLED=false`. Database installation is complete, but application hosting deployment, real OAuth/MCP client acceptance and device/browser/keyboard/theme/Back acceptance are not established. Compatible website writers must all be deployed before enabling AI edits. No application hosting deployment was performed; no unrelated hosting project was created. The existing SEO-title test failure and host/browser limitations above remain disclosed. Rollback and controlled activation are described in `docs/AI_CONNECTIONS.md`.
