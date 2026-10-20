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
- Delivery: investigation branch only; no deployment, Cloudflare changes, feature-flag changes or schema migration.
- Cleanup: the temporary investigation workflow will be removed before merge. Muse diagnostic client cleanup will only target the exact verified synthetic client and associated test requests after it is no longer needed.
