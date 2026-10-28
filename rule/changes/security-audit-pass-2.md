# Change: security audit pass 2 (28 Oct 2026)

- Starting commit: 0ba69749db6d362ac2238edd881ce8f4eb07ae59 (main, includes merged pass 1 / PR #27 and the 25 Oct deep-audit repair).
- User objective and acceptance cases: continue the owner-requested security audit (site believed to be exploited). Pass 2 covered Supabase RLS/RPC privileges, the GitHub workflow, the AI/OAuth/MCP surface, server-rendered HTML and frontend XSS sinks, and security headers. Overlap with `deep-audit-repair.md` (payments, trial, referral, Telegram, admin PIN, login protection) was deliberately not repeated.
- Verified facts (file + symbol):
  - `server.ts` (8 places) and `server/services/seoPrerender.ts` (2 places) wrote `JSON.stringify(...)` output straight into `<script type="application/ld+json">`. `JSON.stringify` does not escape `<`, so any string containing `</script>` ends the block. The data is filing headlines, company names and AI summaries from the database (third-party text), not request-reflected, so this is stored injection. Four other sites already escaped (`server.ts` result page, `publicCalendar.ts`, `exchangeProfiles.ts`, and one `seoPrerender` site that only handled `</script`).
  - `server/security/responseHeaders.ts` sets a CSP with no `script-src` (documented there: inline SSR/bootstrap scripts are not nonce-based), so the browser does not stop an injected inline script.
  - `src/api.ts`, `src/context/AuthContext.tsx`, `src/firebase.ts` keep the Firebase ID token in `localStorage` (`bse_nexus_fb_id_token`), so a script running on the origin can read it.
  - Reviewed and found sound: SSRF guard `server/utils/bseDocument.ts` (exact HTTPS hostname allowlist, every redirect revalidated, size cap); `/embed/widget` renderer (all interpolations escaped); `src/` has one `dangerouslySetInnerHTML` (static FAQ schema, no user data); OAuth provider `server/ai/oauth.ts` (S256 PKCE and state required, exact redirect match, opaque hashed secrets, public-client DCR limited to 1-3 validated callbacks); MCP tools take the user id from the verified grant, never from tool arguments; management routes check Origin and JSON content type; Supabase tables have RLS + `revoke all` for anon/authenticated and the privileged functions are `security invoker` with fixed `search_path` and service-role-only execute; workflow uses `contents: read`, no `pull_request_target`, `persist-credentials: false`.
- Assumptions/unknowns: whether any stored filing text actually contains `<` or `</script>` is unknown (database not inspected). `auth_account_limits` is used by code and by `20261024193046_deep_audit_security.sql` but no migration in Git creates it; the 25 Oct staging rehearsal indicates it exists in the live schema, so this is treated as documentation drift and no migration was added.
- Changed source of truth: one shared serializer `scriptSafeJson` in `server/utils/helpers.ts`.
- Impact command and affected semantic domains: `node scripts/spider-map.mjs --impact server/utils/helpers.ts server.ts server/services/seoPrerender.ts` (reviewed; SEO/prerender and public-content domains).
- For each relevant consumer: changed / reviewed-and-compatible / blocked, with evidence:
  - Announcement, filing, company, guide, FAQ, pricing and static SEO pages in `server.ts`: changed (JSON-LD now escaped); output is still valid JSON, crawlers read the same values.
  - `seoPrerender` home/list/company pages: changed in the same way.
  - Pages that already escaped (`publicCalendar.ts`, `exchangeProfiles.ts`, result page): reviewed-and-compatible; left unchanged to avoid double escaping.
  - `pageRenderCache`: cached HTML older than deploy keeps the old markup until its TTL (1 hour for announcements) expires or an admin clears the cache.
- Assignment scope: backend security.
- Expected user-visible effect: none. Structured data content is identical after parsing.
- Failure/security/concurrency cases: new test proves a hostile headline cannot close the script element and still round-trips; a source scan fails if a raw JSON-LD interpolation is reintroduced (verified: it fails on the pre-fix code and passes on the fix).
- Implementation and coordinated updates: `server/utils/helpers.ts`, `server.ts`, `server/services/seoPrerender.ts`, `server/tests/jsonLdScriptSafety.test.ts`, regenerated `rule/generated/*`.
- Commands actually run and results:
  - `tsx --test server/tests/jsonLdScriptSafety.test.ts`: 3 pass; with the original sinks restored: 1 fail (expected).
  - `node scripts/spider-map.mjs` then `--check`, `node --test scripts/spider-map.test.mjs`: see handoff (run with global TypeScript, not the repo pin).
  - TypeScript `transpileModule` syntax check of the three edited source files.
- Required checks unavailable (reason; do not mark passed): `npm ci` is blocked in this session (egress proxy refuses `registry.npmjs.org`), so `npm run lint`, the full `npm test`, `npm run build` and `npm audit` were NOT run. Dependency vulnerabilities are therefore unaudited. CI must run lint, tests and build before merge.
- Deployment/migration requirements and rollback: deploy only; no migration. Optionally clear the page render cache after deploy. Rollback: revert the PR.
- Remaining risks and next bounded step: see "Open findings".
- Graph/domain/documentation refreshed: `rule/generated/spider-map.*` regenerated.
- Delivery status: committed on `security/audit-pass-2`; not merged; CI not run; not deployed.

## Findings (pass 2)

| ID | Severity | Status | Summary |
| --- | --- | --- | --- |
| XSS-1 | Medium (High impact if triggered) | Fixed | JSON-LD blocks built with plain `JSON.stringify`; stored `</script>` in third-party text could run script on the origin |
| HDR-1 | Medium | Open | CSP has no `script-src`, so any injected inline script runs; needs nonce/hash work on the SSR and bootstrap scripts, then report-only trial |
| TOK-1 | Low | Open (design) | Firebase ID token kept in `localStorage`; combined with HDR-1 it is the prize for any XSS |
| DB-1 | Info | Open (docs) | `auth_account_limits` has no CREATE in Git migrations, though code and the deep-audit migration depend on it |
| DEP-1 | Unknown | Not done | `npm audit` could not run in this session |
| OAUTH-1 | Low | Open | Dynamic client registration is public; `client_name` is caller-chosen (80 chars) so a hostile app can look like a well-known one on the consent screen; make sure the consent UI shows the callback origin prominently |
| WF-1 | Info | Open | Workflow actions are pinned by tag, not commit SHA |
