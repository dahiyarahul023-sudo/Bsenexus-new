# Change: constant-time legacy admin PIN migration (Task 5 / AUTH-3)

- Starting commit: `7200ff2cba5bb28b9052c4d05eeb813c3c2650cf`, latest origin/main verified before branching.
- Objective: use timingSafeEqual on equal-length SHA-256 digests for all non-bcrypt PIN comparisons; migrate matching legacy/plaintext and APP_PIN to bcrypt before elevation; never fall back from malformed bcrypt to plaintext.
- Facts: both /auth/login and /auth/verify-pin duplicate plaintext === checks and catch-to-plaintext fallback. Existing settingsDao.saveSettings swallows cloud failures, so that function alone cannot establish a durable migration. Existing authAttempt converts PaymentStoreUnavailableError to 503; owner authentication, CAPTCHA, account lockout/delay/reset and log branches are already shared contracts to preserve.
- Impact: `npm run map:impact -- server/security/auth.ts server/database/settingsDao.ts`. Identity, admin settings, account protection and elevation consumers reviewed.
- Source of truth: shared adminPin.verifyAndMigrateAdminPin; both routes use it. PIN-only persistence method confirms configured Supabase write before local/cache update; production with no store fails closed. General saveSettings behavior unchanged. No plaintext fallback after a bcrypt error; stored hash takes precedence over env APP_PIN.
- Consumers: both routes changed at comparison boundary only; owner/session, lockout, failure delays, logs, JWT/cookie lifetime unchanged. Settings UI already writes bcrypt and is reviewed-compatible. Other settings/jobs/prices/referrals unchanged.
- Tests: real HTTP routes cover wrong PIN, plaintext -> bcrypt on both routes, bcrypt retry/no plaintext/hash-as-PIN acceptance, env APP_PIN, and equal-length digest comparisons; migration store failure cannot grant elevation. Old-code test result and commands recorded below.
- Scope: backend auth only; no migration/deployment or browser claim. Host-only compile_applet/lint_applet unavailable for shared-helper refactor; actual lint/full suite/build replace no claimed host check.
- Owner steps/rollback: normal review/merge/rebuild/deploy, no SQL. Successful first owner PIN use upgrades legacy storage. Preserve saved bcrypt when rolling back runtime. Existing other-instance settings caches may briefly hold legacy values; each upgraded instance migrates before granting. Legacy pin administration requires trusted verified owner identity as before.
- Risks: timingSafeEqual covers comparisons, not total route/database/bcrypt duration; lockout/delay remain necessary. Existing general settings read/local-cache and concurrent partial-update design remains outside this bounded fix.
- Graph/domain: add helper/tests to identity; regenerate maps.
- Delivery: pending commit/PR; not merged; CI/browser/deployed separate.

- Focused evidence: new helper + both real PIN HTTP routes pass (8 new tests); existing identity/elevation/Telegram/auth tests pass when started with the repository's disposable test JWT environment (18 focused before adding the cloud-failure case). An initial standalone focused run omitted JWT_SECRET and two pre-existing elevation fixtures failed; rerun with proper test env passed.
- Old-code proof: restored only immutable main auth.ts in an isolated temporary verification window (new settings/helper retained); the same real-route tests fail **twice**, because matching legacy PIN remains plaintext for both login and verify-pin. Fixed auth.ts restored before checks. No real Firebase/provider request.
- Explicit migration failure branch returns retryable 503 without resetting lockout, issuing a cookie or logging successful elevation. Production unconfigured persistence and mocked configured cloud outage are covered.

- Final concurrency review: PIN persistence now compares the approved PIN to the live cloud verifier, reuses a matching already-migrated bcrypt value, refuses a rotated PIN, and uses a JSON-value compare-and-swap update (or conflict-refusing insert for a missing row). A legacy local snapshot cannot overwrite a newer PIN or unrelated settings mutation. Dedicated configured-cloud fixtures cover same-PIN replica migration, rotation and CAS failure. Full checks rerun after this adjustment.

## Final results

- `npm ci`: passed (661 packages; eight local Firebase patches).
- Final CAS-aware code: `npm run lint`, `npm test` (**882 passed**, 33 suites, no failures/skips), `npm run build` (actual prebuild/TypeScript/Vite/budget/server/copy), `npm run map:generate`, `npm run test:map` (**6/6**) and `npm run map:check` all individually exited **0**. Incidental version bump reverted.
- New PIN tests: **9/9**, including wrong/correct/plaintext/environment on both real routes, malformed bcrypt/no fallback, storage failures and cloud CAS/rotation/replica migration. Old auth route code was executed against the pre-CAS real-route tests: two migration assertions failed as expected; no claim that every added test was run against old code.
- Existing owner identity, cookie elevation, CAPTCHA, account protection and auth tests remain green; source trace confirms both duplicated comparisons now call the shared helper and no direct appPinHash/APP_PIN === comparison remains.
- No migration, real Firebase sign-in, production settings write or live/browser/device check. Strict configured-cloud write and conflict fixtures are mocked; owner should rehearse first PIN migration on staging before runtime rollout. General settings read/cache design outside this PIN boundary is not certified.
