# Change: review the pending dependency candidates together

- Starting source: main `39bbd52d36bb151f3930e9e4fb826811cff90f02`, reconciled clean-install/PDF repairs and PR #39. Objective: assess all four open dependency PRs rather than merging failed checks.
- Verified root cause: #49/#50/#51/#55 all failed npm ci because main deleted the lockfile; the Bun job also requires moving that file. Their original diffs only changed package.json, without a synchronized lockfile or regenerated maps.
- Exact reviewed candidates:

| PR | Dependency | Previous | Candidate |
| --- | --- | --- | --- |
| 49 | firebase | 12.19.0 installed | ^13.1.0 |
| 50 | undici | 7.30.1 | 8.12.3 |
| 51 | lucide-react | ^0.546.0 | ^1.64.0 |
| 55 | @modelcontextprotocol/sdk | 1.32.1 | 1.32.2 |
| 55 | @electric-sql/pglite | 0.5.8 | 0.5.13 |
| 55 | esbuild | ^0.25.0 | ^0.28.2 |
| 55 | playwright | 1.62.1 | 1.64.1 |

- Impact: `npm run map:impact -- package.json`; reviewed identity/auth/App Check and Gift fixtures, MCP wire/schema/authorization tools, SQL migration fixtures, icon consumers, Vite/server builds and the existing EnvHttpProxyAgent consumer in radarMovementService. No new product API, privilege, billing, schema or notification rule.
- Registry evidence: exact official npm manifests were read for every candidate. Undici 8.12.3 requires Node >=22.19.0; declare that floor in both package metadata and lockfile. Verification ran on Node 24.22.1. Runtime hosting version remains unverified and must satisfy that floor before deployment. MCP requires Node >=18, Playwright >=20; Lucide's React peer includes 19. Current React imports and icons typecheck without source rewrites. Firebase's official 13.0.0 breaking AI Logic changes do not match this application's Firebase imports; 13.1.0 includes an Auth initialization fix. Provider login is not certified by this review.
- Consumers: frontend SDK/auth, server HTTP proxy agent, MCP SDK and test-only PGlite are reviewed-and-compatible under the complete integrated offline suite. Build inputs are changed; actual Vite and server bundle execute. Firebase's existing postinstall patch is rerun. Prices, owner predicates, account scopes, durable quotas and migrations remain unchanged.
- Implementation: synchronize manifest and npm lockfile, preserve existing security overrides, regenerate both source maps. Fresh candidate install completed (662 packages). TypeScript lint passed; 929/929 integrated backend tests passed, 34 suites, zero skipped/failing. Production build passed; startup budget 625,217 raw / 174,779 gzip bytes. Six map tests and map freshness passed. This is integrated local evidence; hosted CI on a final published head remains outstanding.
- Browser: the Playwright Chromium download was actually attempted and returned an invalid/truncated ZIP. No synthetic browser/provider journey is marked passed locally. Hosted development-preview and fresh Bun jobs must still run after the source/map publication gate is resolved.
- Audit: npm advisory request attempted separately; report only its actual result, never infer a clean audit from build/test success.
- Other closed-unmerged PRs were inventoried: #47 is the older dependency group superseded by current candidates; #48 is a separate Express 5 migration and is intentionally not revived; #11 is a closed Radar history/archive proposal whose schema/private-archive gates are not supplied by ordinary PR merging. None is silently reopened or deployed.
- Rollback: revert the dependency integration and lockfile together. Keep Node floor if any retained dependency still requires it. No migration or production operation occurred.
- Publication boundary: automatic review twice rejected generated architecture-map uploads even after the connected account and same-owner private repository were verified. The candidate is prepared locally; remote source-only preparation, if present, is explicitly draft and cannot satisfy the required map check. Do not bypass the rejection or merge with stale maps. Explicit owner approval is needed for the generated files.
- Delivery: reviewed and locally tested; remote commit/CI/merge/deployment/live behavior are separate states. PR #41 remains independently gated on deployed report-only CSP/provider journeys and logs.
