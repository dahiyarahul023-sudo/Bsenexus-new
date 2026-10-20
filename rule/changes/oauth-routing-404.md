# Change: OAuth consent handoff and SPA route parity

- Starting commit: 65d02418e4f972b992bf96c74bc08c68a4b2bbaa.
- Request: after Connect/permission and return to Bsenexus, the user sees the React Page Not Found screen; normal site navigation sometimes does too.
- Screenshot evidence: exact copy/branding/buttons match src/components/NotFoundPage.tsx, not server.ts::renderGeneral404Page. The supplied custom-tab photo does not expose the full pathname.
- Source facts: BsenexusOAuthProvider.authorize returns a 303 to /plugin?request=...; App.getAppPathRoute recognizes /plugin and /ai-plugin, but not /authorize. A proxy following the redirect server-side could return the SPA under /authorize and trigger the observed client 404. This is a hypothesis until live/header/browser probes run.
- Separate confirmed gap: App navigation emits /settings, but server.ts production VALID_SPA_ROUTES and development navigation allowlist omit it. Server exact matching also disagrees with client case/trailing-slash normalization. Preserve genuine unknown-route 404s.
- Read-only database evidence: ChatGPT clients register ChatGPT callbacks, not Bsenexus callbacks. Recent pending requests remain unused; do not change the registered callback.
- Impact: run map:impact for OAuth, server routing, App and SW before source edits. Frontend/backend rules, frontend map/strategy/completion guide, current consent/auth/route/SW consumers inspected.
- Local shell/browser environment unavailable; temporary GitHub Actions uses an isolated browser package. No Cloudflare/hosting changes or actual account approvals.
- Actions: ai.connect from external client, /authorize, /plugin consent, Settings direct/internal navigation/refresh. Authority remains in the approval RPC; page navigation never grants access.
- Required evidence: live public/published response status/Location; anonymous browser address/heading; controlled proxy-follow regression; route parity/private cache/noindex/true unknown 404; existing security/protocol tests.
- Diagnostic GETs use state codex-routing-investigation and only create expiring pending requests, no account grants or token exchanges.
- Delivery: investigation branch only; report implementation, browser checks, CI, merge, deployment and live-client acceptance separately.
