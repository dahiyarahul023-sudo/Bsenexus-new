# Change: backend scope and complete impact follow-through

- Starting commit: `b4e66b36d9fd8f82b86d80b722bdef2d654569ef` (main, 2026-10-07).
- User objective: research-backed backend rules; explain change effects; maintain the spider web and instructions for future AIs; backend-focused work.
- Verified facts: the repository already has 18 rules, 12 semantic domains, a generated interactive map and CI. `scripts/spider-map.mjs::impact` previously selected domains only from explicitly changed paths, missing domains reached through imported helpers. `scripts/spider-view.html::render` repeated the same omission. `BACKEND_STRATEGY.md` retained an obsolete open pricing decision alongside a newer correction.
- Assumptions/unknowns: deployed schema, database migration status and live referral behavior are unverified here. No claim of a complete production audit.
- Changed source of truth: map impact selection now expands domains once from the reverse-import closure and reports `viaFiles`; the engineering viewer uses the same selection and displays provenance. Business domain membership itself is unchanged.
- Impact: map generator, map tests, engineering viewer, generated artifacts, backend workflow and strategy documents. Product frontend files and runtime backend contracts are not changed.
- Consumer dispositions: CLI impact output **changed** (domain reachability and additive provenance); engineering viewer **changed** (same domain semantics); generated JSON/HTML **changed** (source fingerprints and viewer); source-domain membership **reviewed-and-compatible** (same 12 business contracts); application API/UI/storage/jobs **reviewed-and-compatible** (no runtime edits); production cutover **blocked/unverified** (deployment-specific evidence still needed).
- Expected user-visible effect: a helper change can now show payment/display/test relationships through the helper's consumers; future contributors must record effects and compatible consumers rather than silently omit them. Backend scope explicitly excludes unrelated screen redesign.
- Regression evidence: added a helper → plan consumer fixture with a payment domain and display peer. Before the implementation fix, the new test failed because `semanticDomains` was empty; afterward all five map tests passed. Existing cycle and non-recursive-domain checks remain passing.
- Research: rechecked the primary abstracts/metadata for Perry et al., SWE-bench and Spracklen et al.; retained study-specific limits and separated research findings from project controls.
- Initial impact command was attempted while the source snapshot was still being materialized and failed because `tsconfig.json` was not yet present. This is a procedural limitation, not a passing pre-edit check. A complete-snapshot impact check and final validation are recorded below.
- Required host checks: `compile_applet` and `lint_applet` are not available in this environment. Record ordinary typecheck/build separately; do not claim these host checks ran.
- Deployment and rollback: engineering tooling/documentation only; no database migration, payment, notification or production deploy. Revert this commit to restore the previous map semantics and matching generated artifacts. Never use that as a rollback for unrelated referral/database changes.
- Remaining risks: static imports plus reviewed domains do not discover every runtime dependency. Dynamic references, SQL effects and external systems still require manual tracing. This change does not enforce whether every AI reads the rules.

## Final validation and delivery

- Clean dependency install: `npm ci --ignore-scripts --no-audit --no-fund --fetch-retries=0 --fetch-timeout=15000` passed; existing package deprecation warnings recorded in the session. No dependency/version changes.
- Complete-snapshot impact: `npm run map:impact -- scripts/spider-map.mjs scripts/spider-view.html` passed. The map generator test is an import consumer; the viewer is a runtime template read by the generator, so it was explicitly included despite not being a static import. This illustrates the manual boundary check.
- `npm run map:generate`, `npm run map:check` passed: 304 source files, 828 edges, 12 domains, matching the original inventory counts.
- `npm run test:map`: 5 passed, 0 failed; new regression failed before the fix.
- `node scripts/patch-firebase-auth.cjs` and `npm run lint`: passed.
- `NODE_ENV=test JWT_SECRET=<disposable-local-test-value> npm test`: 257 passed, 0 failed, 0 skipped. No production credentials used.
- `npm run build --ignore-scripts`: passed. This executes the configured build without the unrelated prebuild version bump. Existing bundle-size warnings remain. The local source snapshot omitted binary public assets and old audit datasets; font-resolution warnings mean this local bundle is NOT a deployable artifact. GitHub CI runs on the full checkout.
- `compile_applet` / `lint_applet`: unavailable, not passed. No browser interaction test was performed for the engineering viewer; its inline script is syntax-checked and domain selection mirrors the tested CLI algorithm.
- Generated JSON/HTML refreshed together. No app runtime, product frontend, schema, pricing or dependency changes.
- Delivery: see the associated GitHub commit/PR and current CI status. No production deployment or live verification performed.
