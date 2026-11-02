# Interrupted security work: recovery status, 1 November 2026 IST

Current CSP contract (2 November 2026): the owner subsequently authorized completing the useful pending PRs. The reconciled candidate now keeps the report-only trial disabled by default and preserves ordinary caching/offline navigation. See `csp-safe-rollout.md`; the historical instruction below to retain a draft applied to the previous always-on candidate. Real provider journeys and report review remain required before activating the server flag. This update does not claim deployment, migration or enforcement.

## Verified starting state

Remote main was a863ac03657edc153f449bf7f97b3431717134c4. All 867 upstream blobs were reconstructed and Git-blob-hash verified before edits. No other user's checkout was modified; the abandoned merge-work directory was copied to an isolated recovery checkout.

The original authorization required separate branches/PRs, map generation and committed outputs, followed by a later explicit request to merge. Deployment and production migrations remain excluded.

Commit a863ac0 removed/reverted 15 paths from the approved dependency, PDF, workflow and auth-schema fixes. Those exact paths were restored from its immediate parent 98c1646. The newer GiftActivationPage.tsx and giftAccess.ts changes were preserved. Generated maps were rebuilt from the resulting source, rather than copied from either side.

## Prepared changes

| Work | Local status | Remote status at review |
| --- | --- | --- |
| Restore sync regression | local commit 766f338, branch security/restore-synced-controls | PR 52 merged as 7f0579bf43f1c10ce8630030fef62613041058b3 |
| Durable FAQ quota | local commit 33f9e3d, branch security/reconcile-faq-quota | PR 43 merged as bc4d318bf9b5eec5d8bea7567ca1642adf983c23 |
| Timing-safe admin PIN migration | local commit afdc365, branch security/reconcile-admin-pin | PR 46 merged as d6d6ca19836f7c3025a9d603a51fa76923e8f449 |
| Nonce CSP report-only | reconciled with current merged main; draft readiness gate retained | original PR 41 remains draft/unmerged |

Reconciliation applied source patches and merged semantic-domain memberships without dropping the restored PDF or schema entries. Maps were generated and checked at each step. No source files from unrelated performance/Dependabot PRs were merged.

## Executed validation

- Restoration alone: npm run lint, npm test (879 passed, 33 suites, zero skipped/failed), production build with --ignore-scripts, six map tests, map generation/check and git diff --check passed.
- FAQ: 10 focused API/SQL/logging tests passed. These exercise two HTTP router instances with one isolated quota store, spoofed XFF, unavailable/malformed durable receipts, bank availability, idempotent refunds, prior-day refunds, role privileges, migration replay and bounded retention. No real Gemini request or hosted database write.
- PIN/auth: 20 focused tests passed, including both PIN routes, denied credentials, legacy/environment migration, malformed bcrypt, store failures, compare-and-swap conflicts/rotation, owner identity, elevation and CAPTCHA/App Check behavior.
- Final combined source: npm run lint passed; npm test passed 903/903, 33 suites, zero failures/skips; npm run test:map passed 6/6; npm run map:check passed (603 files, 1598 edges, 27 domains); git diff --check passed.
- npm audit --json: zero high/critical, 16 moderate; --omit=dev: zero high/critical, 8 moderate. Dependency installation reused the prior restored node_modules; a new npm ci was not run in this checkout. No claim of a fresh install or new GitHub CI run.
- node scripts/verify-gift-access.mjs stopped at Playwright launch because chromium_headless_shell-1234 is absent. No successful browser acceptance is claimed. Host compile_applet/lint_applet tools are not exposed.
- The final actual npm run build result is recorded in the build follow-up below.

Build follow-up: actual `npm run build` passed, including prebuild, TypeScript, Vite, startup-budget guard, esbuild and build copy. Startup entry was 622,260 raw / 174,276 gzip bytes. Reverted only prebuild's incidental src/version.ts increment afterward, as required by that file's existing instructions; no release version change is part of this work. Final map freshness and diff checks were repeated after that restoration.

## Publication approval and verified delivery

The owner explicitly approved uploading the regenerated maps and completing the eligible GitHub merges on 1 November 2026 IST. The earlier automatic-review block was resolved. JSON and HTML blobs were uploaded to the same private repository and their hashes matched the locally generated outputs. No alternative destination or bypass was used.

| Work | Tested PR head | Successful CI run | Merge commit |
| --- | --- | --- | --- |
| Restoration / PR 52 | 120e17cb619bf2abd81521d2afb6d65d5a32dbcc | 41240810762 | 7f0579bf43f1c10ce8630030fef62613041058b3 |
| FAQ quota / PR 43 | b668a928241752c5a26f2dfa6b56341fc66cefad | 41241192189 | bc4d318bf9b5eec5d8bea7567ca1642adf983c23 |
| Admin PIN / PR 46 | 85fa090b24a444b761030b2043914d5b1301f34c | 41241523545 | d6d6ca19836f7c3025a9d603a51fa76923e8f449 |
| Gift CI isolation / PR 53 | 7dbf5e683ebf9a4922eb488901772030184dde4f | 41242539946 | bbd4867bfb672195fa8156ff105e10c321c8100c |

All four jobs passed at each listed head: rules-map, application, bun-application and development-preview. Hosted checks performed fresh npm installs, a separate fresh Bun resolution/build, full tests, type checks, production builds, generated-map checks and the existing Chromium runtime/Gift/restart fixtures. These synthetic fixtures do not establish real provider or physical-device acceptance.

Current merged main at CSP reconciliation: bbd4867bfb672195fa8156ff105e10c321c8100c. CSP PR 41 is reconciled with that exact main and remains draft under its established provider-journey/report-only release gate. The PR body records the current pushed head and CI result. Original Task 8 remains dependent on enforcing CSP. No deployment or hosted migration was performed.

## Remaining release gates

- No production deployment, production SQL, hosted staging migration, paid provider call, notification or payment occurred.
- The FAQ and auth-account-limits migrations remain unapplied by this recovery. Rehearse and verify service-role/PostgREST privileges, then coordinate schema before runtime deployment. The FAQ retention job is not scheduled.
- Real home/announcements/company/login, Google/email/CAPTCHA, Cashfree sandbox, notification opt-in, Clarity consent and OAuth callback journeys/report review remain open for CSP. Keep PR 41 draft until its established browser/report-only rollout gate is met. A separate enforcing-CSP change is required afterward.
- Original Task 8 (token storage assessment and OAuth origin/branding warning) remains explicitly dependent on enforcing CSP. It was not silently implemented ahead of that gate.
- Local/mock/PGlite checks establish bounded code behavior, not current production protection or a security certification. Moderate dependency findings remain.

Rollback and consumer dispositions are documented in restore-security-sync-regression.md and each recovered task's change record. Retain quota receipts and auth counters during runtime rollback; do not replay the broad source sync.

## Browser fixture follow-up

CSP run 41242027239 passed application/Bun/map checks but failed its Gift browser fixture because newly introduced direct Firebase readiness imports escaped the older synthetic AuthContext adapter. PR 53 fixes that shared CI boundary on main without changing production auth or removing assertions. Its current-head CI passed all four jobs. Local VM lifecycle and actual Vite transform probes also passed; real SDK imports are explicitly rejected in this offline fixture. Both generated maps were refreshed. The CSP draft includes that exact repair and the new main; its final CI result is recorded in PR 41.
