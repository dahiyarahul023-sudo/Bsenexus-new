# Change: dependency vulnerability remediation (Task 1)

- Starting commit: `7200ff2cba5bb28b9052c4d05eeb813c3c2650cf` (verified origin/main, exact Git tree).
- User objective and acceptance cases: audit production/all dependencies; remove high/critical findings with minimal compatible upgrades; retain lockfile and run clean install, full tests, lint/build and map checks.
- Verified facts: registry-backed `npm audit --omit=dev` reports body-parser high (root Express 4 -> body-parser 1.20.8; @google/genai / yahoo-finance2 -> @modelcontextprotocol/sdk -> Express 5 -> body-parser 2.3.0, also direct SDK path), and root zod 3.25.76 high (direct dependency; @modelcontextprotocol/sdk and its zod-to-json-schema deduplicate here). No critical findings. Patched body-parser versions are 1.20.9 and 2.4.0 (GHSA-27r3-jxmh-p828); Zod has no patched v3 release (GHSA-mrhx-c7xc-m3w5), patched v4 >=4.6.6.
- Assumptions/unknowns: runtime compatibility of patched Zod must be established by wire/schema tests and full suite; existing SDK supports v4. Audit findings reflect registry data on 30 October 2026, not a permanent guarantee.
- Changed source of truth: package.json plus package-lock.json; only the MCP type boundary needs AnyZodObject -> ZodObject for Zod 4.
- Impact command: `npm run map:impact -- package.json scripts/patch-firebase-auth.cjs server/ai/tools.ts server/ai/http.ts`; AI connections/providers, API input parsing and all dependency consumers reviewed.
- Consumers: Express 4 application and SDK Express 5 changed via major-specific overrides; MCP tool/policy/filing/gift schemas reviewed and tested; Firebase, sharp, pdf-parse, undici, jsonwebtoken, firebase-admin, yahoo-finance2 reviewed by installed dependency tree and audit. Pricing, referrals, sessions, jobs and storage policies unchanged.
- Postinstall review: scripts/patch-firebase-auth.cjs imports only node fs/path, recursively visits two fixed local node_modules/@firebase/auth/dist locations, changes a local JS assertion to an early return, and writes those local files. No HTTP, child process, eval, remote download or remote execution. Directory symlinks are not traversed (Dirent.isDirectory/isFile only).
- Scope: backend/dependencies, no UI behavior redesign.
- Expected effect: compressed malformed requests no longer crash upstream parser; patched validation library; API semantics retained.
- Failure/security cases: compressed trailing bytes regression for both parser majors; MCP validation/wire and full existing auth suite. Regression evidence and command results to be filled after execution.
- Commands actually run: baseline `npm ci` succeeded (661 packages; local postinstall patched eight files); `npm audit --omit=dev` exited 1 (2 high, 2 moderate, no critical). Full baseline audit in progress; final results recorded below.
- Not run: no live provider requests, payments, deployment or browser claims.
- Deployment/rollback: owner may review/merge and later rebuild/deploy; no migration. Revert commit to restore prior dependencies (and known vulnerabilities).
- Graph/domain/documentation: regenerate map from final source, retain semantic domain relationships.
- Remaining risk: moderate fast-uri and Vite findings to assess separately; no blanket certification of live exploitation.
- Delivery: pending commit/PR; not merged, CI not yet observed, browser not verified, not deployed.

## Final local evidence

- `npm ci`: passed on final lockfile (662 packages, eight local Firebase patches).
- `npm audit --omit=dev` and `npm audit`: both actually run before and after; after remediation both exit 1 solely for two moderate findings, **0 high / 0 critical**. Remaining paths: @modelcontextprotocol/sdk -> ajv -> fast-uri 3.1.8 (several URI normalization advisories, fix 3.1.9); dev Vite 6.4.4 (GHSA-8g5g-mxqh-grgj). Production audit includes Vite through the production @tailwindcss/vite / @vitejs/plugin-react peer relationships. These are documented remaining risks, outside the high/critical acceptance threshold; development server must not be exposed as production. No forced broad audit fix performed.
- Final parser resolution: Express 4 -> body-parser 1.20.9; SDK Express 5 -> body-parser 2.4.0. Zod 4.6.7 is shared by direct code, SDK, zod-to-json-schema and yahoo-finance2. Original @grpc/grpc-js and Express type overrides retained.
- `npm run lint`: passed after install. An initial attempt while installation was still finishing returned tsc not found; this was rerun successfully after clean install completed.
- `NODE_ENV=test JWT_SECRET=<disposable test-only value> npm test`: **873 passed, 33 suites, zero failures/skips**. Existing MCP wire, validation, OAuth, gift, auth and quota behavior retained. No new behavior test added for an upstream implementation change; therefore no old-code regression claim.
- `npm run build`: passed, including actual prebuild, TypeScript, Vite, performance budget (622242 raw / 174264 gzip bytes) and server bundle. Reverted only the incidental prebuild version increment, since this PR is not a release.
- `npm run map:generate`, `npm run test:map` (6/6) and `npm run map:check`: passed (589 files / 1571 import edges / 27 domains).
- Not run: authenticated external browser/provider flows, live deployment/migration. Host-only compile_applet/lint_applet tools unavailable; no files deleted/renamed. GitHub CI is independent and must be read on the final PR commit.
