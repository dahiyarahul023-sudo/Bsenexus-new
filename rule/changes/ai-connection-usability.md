# AI connection usability and ingress review — 2026-10-20

Starting remote commit: `a00579d98a82ba97c6c7227502f1b74393da0a56`.

## Request and acceptance
One Settings entry; clear ChatGPT/Gemini/Claude setup without user API keys; responsive phone/tablet/desktop; truthful setup/authorization state; retain server authorization, bounded tools, quota and admin restrictions.

## Verified baseline
- Public OpenAPI GET returns 200 with canonical `https://bsenexus.in`; root MCP and both discovery endpoints return 403 `Invalid connection host`. Raw-host validation in `server/ai/http.ts::mountAiIntegration` does not use the existing one-hop proxy configuration in `server.ts`. Exact deployed proxy headers remain unobserved.
- Screenshot shows `connections_not_enabled`; `connectionsEnabled` is disabled unless the server flag is exactly true. Current hosted flag cannot be read anonymously.
- Production read-only SQL: six OAuth tables have RLS and deny anon/authenticated SELECT/INSERT/UPDATE/DELETE; six business RPCs are invoker functions, fixed empty search_path and deny browser EXECUTE. Zero registered clients and zero active grants, including admin. No secrets or user rows read.
- Existing 27 connection/OAuth/SQL/watchlist/telemetry tests pass before edits. No schema/production data changes planned.

## Action ownership and consumers
- `ai.settings.open`: Settings row is the sole visible terminal entry. Remove duplicate Layout header/tab/mobile links, landing navigation/CTA/footer links and command-palette entry; retain canonical `/plugin` and consent deep links.
- `ai.setup.choose/copy`: AiPluginPage owns only the selected client and clipboard feedback. Provider instructions use official documentation. Clipboard copy never means authorization.
- `ai.consent.allow/revoke`: existing verified website session and Origin+JSON checks; database grant/ownership/PKCE/resource/expiry rules unchanged.
- `ai.transport.request`: validate canonical hostname using Express trusted-proxy semantics, reject invalid browser Origins, preserve bearer-only account access and disabled fail-closed behavior.
- `ai.status.refresh`: same-account content remains usable during refresh; account/request changes suppress obsolete status, consent and mutation feedback.

## Consumer dispositions
Changed: MCP transport guard/tests; scoped connection page/styles; Settings copy; Layout, command palette and landing entry points; documentation and generated map.
Reviewed-and-compatible: OAuth provider/SDK S256, tools and strict schemas, six private tables/RPCs, quotas/idempotency, entitlement checks, website watchlist CAS, notes/profile refresh, telemetry redaction, canonical/deep-link routes and PWA no-store bypass.
Blocked: hosting configuration/deployment; actual signed-in external-client OAuth acceptance and physical iPhone/Android/tablet testing until the new runtime is deployed.

## Validation and delivery
- Dependencies: `npm ci --ignore-scripts --no-audit --no-fund` passed.
- Two regressions reproduced before fixing: production-mode trusted-ingress discovery rejected 403; origin-level protected-resource discovery returned 404. Both now pass alongside invalid-host/untrusted-proxy/invalid-Origin, preflight, no-token, cookie-only and disabled-state checks. A synthetic authenticated SDK client initializes and lists typed tools; no admin/payment/SQL tool appears. This smoke test does not bypass or certify production token storage.
- Targeted connection/OAuth/SQL/watchlist/telemetry, route and cancellation tests passed (39 tests). Existing SQL cases cover client/callback/resource binding, replay revocation, ownership, entitlement, quota concurrency and idempotent receipts.
- Initial full suite: 567/568 passed; the existing title-prefix assertion disagreed with the unchanged search-first homepage title. Follow-up now checks the exact existing title plus Open Graph/Twitter parity, without changing production SEO. Final bounded full suite: **568/568 passed**, zero cancellations/skips. Original missing XML/CSV/avatar fixtures were restored and blob-hash verified; they are not changed by this PR.
- Typecheck (`npm run lint`), production client/server build (`npm run build`, then final `npm run build --ignore-scripts` to avoid an unrelated version bump), map generation/check and six map fixtures passed. Final check rerun is recorded below. The existing large-entry-chunk warning remains.
- Initial browser setup was blocked by an invalid browser archive and an incomplete registry download. A later successful temporary registry install provided Chromium 153 with Playwright 1.62.1. The real component, actual CSS and original font were rendered with test-only auth/API adapters. Eight scenario groups pass: 320/390/768/1024/1440 CSS widths and all four client guides without horizontal overflow; copy/client-switch/manual-copy recovery; Settings navigation, dark mode, 200% CSS zoom and keyboard focus; stale refresh and account-switch isolation; revoke failure/success; signed-out cleanup/sign-in; disabled/malformed responses and retry; 320px consent read defaults, optional writes, focus preservation, duplicate-click coalescing and storage failure. No page errors. Phone-width and consent screenshots were visually inspected. These adapters do not certify live OAuth, actual storage, touch hardware or WebKit/iOS behavior.
- Required host-only compile_applet/lint_applet tools are unavailable. Physical iPhone/Android/tablet and external-client OAuth remain unverified.
- Production DB checks were read-only. The body fingerprints of all seven deployed migration functions (six business RPCs plus the watchlist revision trigger function) exactly match the reviewed migration, including quota serialization, replay and ownership logic. No schema, grant, quota or hosting changes were performed.
- Final rerun after transport edge-case handling: ingress tests 2/2, lint, client/server build, map:check and map tests 6/6 passed. The earlier expanded connection/route/cancellation run passed 39/39.
- A hosting integration search found no suitable Google Cloud Run/AI Studio deployment capability in the returned results; hosting configuration remains outside currently connected access.

### Scope decisions
The broad map reaches most application domains through Layout/App/server mounts. Only AI entry links and the dedicated connection journey changed. Identity/payment/referral/feed/Radar/notes/commerce handlers, shared design tokens, polling and delivery jobs retain their existing contracts. Account and request guards protect late frontend updates; full DOM interaction verification remains the blocked browser gate.

### Delivery
PR #1 is approved by the user for merging. Follow-up fixes are verified locally; final GitHub CI and merge are checked separately. Hosting must be deployed with correct ingress and server settings, then real-client acceptance completed before enabling a broader rollout. No hosting runtime/session is connected.

### Approved follow-up and concurrent main change
Main advanced to `291537cadb494333abfc32227470b70c0838f11d` while this PR was open. Its overlapping fixes target SDK type inference and absent status fields. Resolve these intents with explicit `get_profile` registration generics (rather than casting the entire server) and the PR's existing runtime status validation/retry state (rather than treating missing limits as zero). The main lockfile removed the manifest's direct SDK/Zod dependencies and hoisted Zod 4 despite the manifest pinning Zod 3; retain the compatible original lockfile, including platform optional dependencies. No dependency versions or runtime schemas change. Regenerate the map instead of retaining stale main fingerprints of uncommitted files. Both histories are preserved in the integration commit.

First PR CI found TS2589 at the inferred SDK registration in the fresh-Bun job and the stale SEO assertion. Explicit schema generics preserve SDK checks and runtime schemas. Final npm lint/build, isolated fresh Bun 1.4.3 build (without npm lockfile), all 568 backend tests, map check and six map fixtures pass locally. Fresh Bun did not reproduce the initial inference failure locally; GitHub CI remains authoritative for that runner.

## Rollback
Revert this bounded source change. Keep existing schema, quotas and grants. Feature flag remains disabled by default; no migration or automatic authorization is introduced.
