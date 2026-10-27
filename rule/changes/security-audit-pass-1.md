# Security audit pass 1: reconciled merge of PR #27

- Starting PR head: `1b3fbdb37aeb1be5f44dc8944571364f356f8959` (`security/audit-pass-1`). Reconciled main: `83999b86faf11e98f2b0340847666486025a5dc1`.
- User objective: merge PR #27 while preserving the newer work on main, resolving conflicts, and verifying the resulting application.
- Assignment scope: bounded backend security merge; no pricing, UI redesign, database migration or deployment configuration change.

## Verified implementation and conflict resolution

- Main already fixes `getSanitizedClientIp` to use Express `req.ip` and already updates the contrary assertion in `accountProtection.test.ts`. Retain main's entire account limiter, including its newer distributed protection logic; do not replace it with the old audit-branch implementation.
- Preserve the newer `auth.ts` implementation on main, including PIN elevation and configured CAPTCHA enforcement. The original audit's list of open findings predates that work and is not a current certification.
- `firestore.rules`: normal owners may edit their own `alert_rules` and `user_notes` only while retaining `userId`; existing admin and delete permissions are preserved.
- `server/api/routes.ts`: cache statistics and circuit-breaker diagnostics require the existing elevated admin middleware. Public health responses retain a successful liveness response without internal telemetry.
- `server/api/payments.ts`: use equal-length `crypto.timingSafeEqual` for webhook signatures; preserve existing base64/hex support, provider verification and payment idempotency.
- `server.ts`: preserve the existing one-hop proxy default and add the original bounded `TRUST_PROXY_HOPS` override. Comments explicitly require verifying the actual ingress and excluding shorter origin paths before increasing trust; a CDN alone does not prove a safe hop count. No live environment variable was changed.
- Keep the audit's IP-spoofing regression tests and Firestore ownership test updates. Add the new test to the identity semantic domain. Regenerate both maps from the merged source with the repository's TypeScript 5.8.3 installation rather than choosing either stale generated artifact.

## Impact and consumer dispositions

Impact command: `npm run map:impact -- server.ts server/api/payments.ts server/api/routes.ts firestore.rules server/security/accountRateLimiter.ts server/tests/firestoreRulesSecurity.test.ts`.

| Consumer | Disposition and evidence |
| --- | --- |
| FAQ quota, session lockout, CAPTCHA IP context | Reviewed-and-compatible: retained main's `getSanitizedClientIp` and its callers in `faq.ts`, `auth.ts` and `server.ts`. Default proxy policy is unchanged. |
| Auth, owner administration and account limits | Reviewed-and-compatible: newer main implementations retained; existing corrected IP expectation passes with the audit regression tests. |
| Layout reconnect and server self-ping | Reviewed-and-compatible: `Layout.tsx` checks success of `/api/health`, and the server self-ping remains successful. |
| Cache and circuit-breaker diagnostics | Changed: GET endpoints use `requireAdmin`, matching existing administrative reset/clear endpoints. |
| Payments and paid entitlement | Reviewed-and-compatible: signature equality changes only; provider, ledger and entitlement paths retained. Backend payment/auth tests pass. |
| Firestore notes and alert owners | Changed: client updates cannot transfer document ownership. Server Admin SDK operations and authorized unchanged-owner updates retain their existing contract. |
| Frontend, jobs, caches, prices and manual product copy | Reviewed-and-compatible: no frontend source, background schedule, business policy or response-contract redesign. |

## Validation actually executed

- Reconstructed the immutable main snapshot through the connected GitHub API; all 711 downloaded text files matched their upstream Git blob hashes before edits. Required existing icon/avatar assets were also restored and hash-verified for tests. Assets are retained unchanged in the final Git tree.
- `npm ci --no-audit --no-fund --fetch-retries=1 --fetch-timeout=30000`: passed, including the repository's Firebase postinstall patch.
- `npm run lint`: passed.
- `NODE_ENV=test JWT_SECRET=<disposable test-only value> npm test`: **815 tests passed, 32 suites, zero failures/skips**. An initial run had two missing-local-asset failures; after restoring the original assets the entire suite passed.
- `npm run build --ignore-scripts`: passed, including TypeScript, Vite, startup performance budget and bundled server. This runs the production build body while avoiding an unrelated prebuild version bump. Startup entry: 968,439 raw / 260,908 gzip bytes.
- `npm run map:generate`, `npm run map:check`: passed, 554 files / 1,475 import edges / 26 semantic domains.
- `npm run test:map`: six passed. `git diff --check`: passed.
- GitHub-hosted checks are separate from these local results and must be read from the final PR head. Host-only `compile_applet`/`lint_applet` are unavailable; no module deletion or refactor was performed.

## Remaining boundaries and rollout

- Publishing `firestore.rules` is a separate Firebase operation; merging does not publish them. The Firestore test suite simulates rule logic rather than running the Firebase Emulator, so emulator and deployed-rule behavior remain unverified.
- The anonymous FAQ quota still uses instance-local storage and checks availability before awaiting Gemini, then consumes quota after success. Shared atomic reservation and concurrent-request protection remain a separate follow-up, not a claimed fix in this merge.
- Actual Cloudflare/Cloud Run ingress topology and direct-origin restrictions remain unverified; do not infer a production hop override from this change.
- Production prerequisites for the separate deep-audit migration remain documented in `deep-audit-repair.md`; this merge does not apply or certify that migration.
- No live payments, provider calls, user notifications, Firestore rules publication or database migrations were performed. Browser/device and live runtime behavior were not verified.
- Rollback: revert this PR's merge commit; any separately published Firestore rules require a separate rules rollback. Preserve main's unrelated newer protections.
- Delivery: reconciled source and local checks complete; GitHub commit, hosted checks, merge and runtime deployment are separate states recorded in the PR and handoff.
