# Change: research-backed backend rules and living impact map

- Starting commit: `3f35f3ba442d1571051c6f418c93ceaf8d0cf484`.
- Objective: prevent AI changes from missing connected backend/frontend effects; leave a repository entry point and maintainable spider-web map.
- Verified facts: existing `AGENTS.md` has deletion/refactor guardrails; `scripts/audit-map.mjs` supplies useful dated inventories; existing narrative includes stale revocation/durability descriptions; application pricing consumers disagree with the catalogue; payment SQL differs from DAO calls.
- Unknowns: desired referral pricing, actual deployed SQL/configuration, production concurrency behavior. These are not inferred from comments or old audit evidence.
- Implementation: `rule/` rules, research, strategy, domains and change template; root entry point; AST map generator and interactive local viewer; watch/impact/check commands; behavioral tests; CI and PR template; lockfile platform records restored.
- Impact example: `npm run map:impact -- server/config/plans.ts` connects pricing to payment and referral domains, checkout/display/copy and candidate tests. Domain links are reviewed relationships, not invented import edges.
- Expected user effect: contributors can inspect connected features before editing and detect stale map outputs automatically. Existing runtime application behavior and price values are not changed by this foundation.
- Coordinated documentation: corrected current Firebase revocation check and quota/notification durability notes; marked historical maps as historical.
- Lockfile scope: 99 missing platform dependency records added; all original package records and versions preserved. No new application library introduced.

## Validation

- `npm ci --ignore-scripts --no-audit --no-fund`: initially failed on missing lock records; passed after repair. Existing Firebase postinstall patch was read and separately run.
- `npm run test:map`: 4 behavioral tests passed (resolution/reverse reachability/semantic peer, drift and missing paths, cycles, inline-script escaping).
- `npm run map:generate` and `npm run map:check`: passed; current counts are in the generated artifact rather than duplicated here.
- `npm run map:impact -- server/config/plans.ts`: exercised payment/referral impact output.
- Application type check and build: FAIL on pre-existing referral catalogue fields, missing helper and unsupported argument. Build's automatic version bump was restored; no generated version change is included.
- Backend tests without a test JWT secret: 223 pass / 3 failures. Missing environment explains some failures; this was not called a passing run.
- Backend tests with `NODE_ENV=test` and a disposable test-only `JWT_SECRET`: see final evidence below. No deployment credentials or live payment requests were used.
- `compile_applet` / `lint_applet`: unavailable in this environment; not reported as run. This change adds tooling/docs and repairs lock metadata, with no runtime file deletion/rename/refactor.

## Remaining risks and rollback

Application checks are intentionally not weakened or skipped to conceal baseline failures. The PR is a foundation, not production approval. See `../BACKEND_STRATEGY.md` for the pricing and SQL blockers. Rolling back this tooling commit removes its map/CI/docs; no database migration or runtime data rollback is needed. Reviewers must require the desired checks in branch protection to enforce merge blocking; the workflow alone cannot force every AI or maintainer to comply.

## Final local evidence

- Configured backend run: **233 passed, 2 failed** (235 tests). Remaining failures: referral test module imports missing `getEffectivePlanPrice`; route-resolution pricing page asserts a different title. These existing contracts need reconciliation.
- Staleness negative check: deliberately modified generated JSON was rejected by `map:check`, then restored.
- Lockfile comparison: every original package record is byte-content-equivalent after JSON parsing; only the 99 missing records were added.
- Interactive viewer's inline JavaScript parsed successfully; visual/browser interaction testing is unavailable: no browser executable is installed and the browser download returned an invalid archive. No screenshot or real-browser success is claimed.
