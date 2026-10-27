# Change: bound OAuth authorization and consent handoff

- Starting commit: f74e1e87f2c45d2c1b1dde6874d670104b4f5555.
- Objective: valid anonymous /authorize requests terminate within five seconds with a consent redirect or a clean OAuth error; preserve discovery, public-PKCE DCR, host/Origin guards and unauthenticated MCP behavior.
- Evidence: Muse's 21 October 2026 brief reports public 522 and direct-origin hangs on revision untitled-00256-nxk. This is supplied runtime evidence, not independently reproduced in this session.
- Source: BsenexusOAuthProvider.authorize validates then awaits begin_ai_connection_request and calls res.redirect(303, /plugin?request=...). The DAO attaches a ten-second AbortSignal but has no independent promise deadline. No user-session lookup or self-fetch is present in this provider path.
- Independently inspected production: Supabase edge logs in 18:36–18:46 UTC on 20 October show client lookups and begin_ai_connection_request returning HTTP 200. Two diagnostic pending records were persisted. No active lock wait was observed during this inspection. These facts do not establish the HTTP response outcome.
- Unknown: exact production failure after persistence, including application/Cloud Run response logs. Source-level reproduction and installed SDK inspection are required before assigning a root cause.
- Impact: temporary read-only GitHub Actions investigation runs the repository map:impact command before production-source edits. The local execution environment is unavailable.
- Consumers: SDK authorize router/provider/DAO and consent handoff are under review. Public discovery, MCP auth, host/Origin policy, scopes/quotas and existing consent UI must stay compatible. Gemini confidential-client support is outside this fix.
- CI blocker: main deleted package-lock.json in f74e1e8; application/rules-map npm ci and fresh-Bun setup fail. Restore the unchanged lock blob from green parent eb49a62 (root dependency metadata matches current package.json).
- Delivery: source prepared in PR #2; final CI/merge state is recorded by GitHub. No hosting deployment, Cloudflare changes, feature-flag changes or schema migration.
- Cleanup: the temporary investigation workflow will be removed before merge. Muse diagnostic client cleanup will only target the exact verified synthetic client and associated test requests after it is no longer needed.

## Reproduction and chosen correction

- GitHub Actions investigation 39480806692 ran map:impact before implementation and inspected the installed pinned SDK. Its healthy fixture completed 303 in 222 ms. Restoring the lockfile alone made all three existing CI jobs pass (run 39480806546).
- Before the implementation, run 39481460566 reproduced three failing behavior tests: stalled lookup exceeded 4.5 seconds; pending-storage failure returned 302 rather than a clean local error; a thenable ignoring cancellation did not settle within 500 ms. Two normal/invalid-input cases passed. These failures establish deadline/error gaps, not the exact original production cause.
- Fresh live probe from the runner: public domain returned 522 in 849 ms; published origin with forwarded host returned 303 in 995 ms. Redirects were NOT followed. The earlier direct-origin hang is no longer reproduced, so Cloudflare/hosting redirect handling remains a live boundary to verify. No infrastructure edits are proposed.
- Correction: independently race the AI storage await against its abort signal, preserve its normal ten-second default, and use two-second budgets for each OAuth client lookup and pending-consent write (at most about four seconds for both storage awaits). Timeout never automatically retries a possibly committed write.
- Correction: explicitly end the 303 response with a same-origin relative /plugin?request= Location; durable persistence still precedes the handoff. This avoids the cross-domain hop if a hosting gateway follows redirects. It is a proxy-compatibility measure, NOT a proven root-cause finding.
- Storage/response failures after provider validation return sanitized OAuth temporarily_unavailable JSON with HTTP 503. SDK validation, registered callbacks, state, PKCE and scopes remain intact. Diagnostic stages log an opaque correlation ID, stage, status and elapsed milliseconds only.
- Related consumers: oauth.ts/AI DAO changed; http.ts (host/Origin/flag guards), policy.ts (strict true/default public origin), tools.ts (same AiError contract and ten-second default), API compatibility routes and consent page (same request binding and URL query) reviewed-and-compatible. Non-AI domain peers reached through server.ts/routes.ts retain their own DAOs and business rules; full application regression checks cover them. No frontend/layout change or schema migration.
- Domains: ai-connections gains the authorization regression test. The generator must refresh both artifacts after these changes; do not hand-edit generated maps.
- Actual local checks: unavailable because no usable local execution environment exists. Verification runs on GitHub Actions with synthetic local storage and no production credentials. Live ChatGPT approval/tool invocation, Cloud Run logs and physical-device checks remain pending the authorized AI Studio sync/republish.

## Post-change verification

- Run 39481898514: all six authorize regression tests passed. The healthy router probe completed 303 in 96 ms with an empty, explicitly ended response and relative consent Location. Each stalled storage path returned an OAuth error in about two seconds; both sequential cases took 4.014 seconds in total. A dependency ignoring cancellation settled as a storage error in 34 ms with a 30-ms test deadline.
- Discovery (root and path resource metadata), DCR public/invalid cases, exact unauthenticated GET/POST MCP error body and WWW-Authenticate challenge passed. Existing trusted-proxy/Origin/security/PKCE/SQL suites run in the full CI job.
- The same job executed npm run map:generate. Both generated outputs are copied from the generator's exact emitted diff, with strict context/count checks; they were not manually regenerated.
- Pre-deployment live checks still target the previous hosted code: public 522 in 1.192 s, published origin 303 in 1.664 s. The new source has not been published. Do not report public 522 fixed until post-republish acceptance succeeds.
- Required host-only compile_applet/lint_applet tools and local terminal are unavailable. Actual npm type/build checks run on GitHub; this limitation does not count as a host-tool pass.

## Final source and cleanup review

- Full application run 39481898320: npm type check, all 574 backend tests and application build passed on the changed source (the map job correctly waited for generated outputs in the following commit). Fresh Bun build also passed.
- Run 39482236619 verifies committed generated outputs: rules-map fixtures/check and fresh Bun build passed; the final application job is recorded by GitHub. Run 39482236694 independently regenerated the maps and emitted MAP_PATCH_LENGTH 0.
- Before removing the temporary workflow, that runner executed git grep -nF across tracked files for its exact filename. The only match was the workflow's own search command. No source consumer references it.
- Diagnostic cleanup completed as explicitly requested: exact muse-diagnostic-probe client with the verified example.com callback and zero grants; eight associated pending requests and one client removed. Independent readback: zero diagnostic records remain, and real ChatGPT client 3df822fe-10e2-4341-bf4e-f87fcd814818 remains present. No actual client/grant was revoked.
- Final change consists of OAuth provider/AI DAO, six regression cases, restored unchanged lockfile, domain/map artifacts and the evidence/runbook documents. The temporary investigation workflow is removed.
- Rollback: revert this source change and sync/republish through the existing workflow. No schema rollback is needed. Pending requests expire normally; no account grants are created by diagnostic authorization requests.
- Next deployment step: Rohit syncs/pulls the green main revision and Republishes in AI Studio. Muse repeats public and published-origin GET authorization without following redirects, real ChatGPT consent plus a read-only tool, discovery/DCR/MCP 401 regressions and homepage/health. If the public request still fails while Node logs response_finished, inspect that request's hosting/Worker response handling before changing unrelated configuration.
