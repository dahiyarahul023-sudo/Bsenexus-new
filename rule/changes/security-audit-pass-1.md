# Change: security audit pass 1 (24 Oct 2026)

- Starting commit: 1d12667eb7199078bf7f86d4f62940be4cc85417 (main)
- User objective and acceptance cases: owner believes the live site is being exploited. Audit every surface from several angles, fix confirmed holes, then re-attack from a different angle. This record covers pass 1 only (auth/session, payments, public routes, Firestore rules). Passes on AI/OAuth, Supabase RLS, SEO prerender/XSS, CI and dependencies are NOT done yet.
- Verified facts (file + symbol):
  - `server/security/accountRateLimiter.ts getSanitizedClientIp` returned the LEFT-most `X-Forwarded-For` entry, which the caller writes. Used by `server/api/faq.ts quotaIdentityFor` (anonymous Gemini quota, 4/day/IP), `server/security/auth.ts` `/auth/session` lockout key and reCAPTCHA IP context, and `server.ts` `/api/security/verify-recaptcha`.
  - `express-rate-limit` limiters use `req.ip` (trust proxy 1), so they were not spoofable; only the custom IP keys were.
  - `/api/cache/stats` and `/api/circuit-breakers` had no auth; `/api/health` exposed upstream health, cache and breaker state. Only `src/components/Layout.tsx` calls `/api/health`, and it ignores the body.
  - `firestore.rules` `alert_rules` and `user_notes` `update` allowed the owner to rewrite `userId` (no immutability check).
  - `server/api/payments.ts` webhook compared the HMAC with `===`. The grant itself re-fetches the order from Cashfree, checks the recorded ledger row and is idempotent, so replay was already harmless.
- Assumptions/unknowns: whether a CDN (for example Cloudflare) sits in front of Cloud Run is unknown. If it does, `TRUST_PROXY_HOPS` must be set to 2, otherwise `req.ip` is the CDN edge and per-IP limits become shared buckets. Previously-deployed Firestore rules must be republished by the owner for RULES-1 to take effect.
- Changed source of truth: client IP derivation (`req.ip` only), `trust proxy` hop count (env `TRUST_PROXY_HOPS`, default 1 = unchanged), admin gate on two telemetry routes, Firestore rules, webhook compare.
- Impact command and affected semantic domains: `node scripts/spider-map.mjs --impact server/security/accountRateLimiter.ts server/api/routes.ts server/api/payments.ts firestore.rules server.ts server/tests/firestoreRulesSecurity.test.ts` (output reviewed; candidate tests include accountProtection, firestoreRulesSecurity, payments and referral suites).
- For each relevant consumer: changed / reviewed-and-compatible / blocked, with evidence:
  - FAQ quota (`faq.ts`): changed behaviour (quota key now real IP); compatible API.
  - `/auth/session` lockout and reCAPTCHA context: changed behaviour; compatible API.
  - Layout `/api/health` ping: reviewed-and-compatible (only checks that the request succeeds).
  - Admin UI use of `/cache/stats` or `/circuit-breakers`: none found in `src/`; admin callers already send the owner token.
  - Payments webhook: reviewed-and-compatible; both base64 and hex signatures still accepted.
  - Firestore clients writing `alert_rules`/`user_notes`: server code uses the Admin SDK (bypasses rules); browser edits that keep `userId` still pass.
- Assignment scope: backend security.
- Expected user-visible effect: none for normal users. Anonymous callers can no longer mint unlimited AI questions by rotating a header.
- Failure/security/concurrency cases: see findings below.
- Implementation and coordinated updates: listed files plus new regression test `server/tests/clientIpSpoofing.test.ts`, mirror update in `server/tests/firestoreRulesSecurity.test.ts`, regenerated `rule/generated/*`.
- Commands actually run and results:
  - `node scripts/spider-map.mjs` then `--check`: passed (with global TypeScript 6.0.3, repo pins ~5.8.2; diff is hashes and shifted line numbers only).
  - `node --test scripts/spider-map.test.mjs`: 6 pass.
  - TypeScript `transpileModule` syntax check of all five edited TS files: no syntax errors.
- Required checks unavailable (reason; do not mark passed): `npm ci` could not run because the session's egress proxy refused `registry.npmjs.org`. Therefore NOT run: `npm run lint` (tsc), `npm test`, `npm run build`, and the new test file. CI must run them before merge.
- Deployment/migration requirements and rollback: deploy app; republish `firestore.rules` (Firebase console or CLI). Set `TRUST_PROXY_HOPS=2` if a CDN fronts Cloud Run. Rollback: revert the PR; rules revert needs republishing.
- Remaining risks and next bounded step: see "Open findings".
- Graph/domain/documentation refreshed: `rule/generated/spider-map.json` and `.html` regenerated; no domains.json membership change.
- Delivery status: committed on branch `security/audit-pass-1`; not merged; CI not run; not deployed.

## Findings (pass 1)

| ID | Severity | Status | Summary |
| --- | --- | --- | --- |
| FAQ-1 | High | Fixed | Anonymous Gemini quota keyed by spoofable header, so unlimited AI calls up to 20/min per real IP |
| AUTH-1 | Medium | Fixed | Same helper keyed `/auth/session` lockout and reCAPTCHA IP |
| RULES-1 | Medium | Fixed in file, needs republish | Owner could re-point `userId` on `alert_rules` / `user_notes` |
| INFO-1 | Low | Fixed | Unauthenticated cache, circuit-breaker and upstream health detail |
| PAY-1 | Low | Fixed | Webhook signature compared non-constant-time |
| AUTH-2 | Medium | Open | `/auth/session` only verifies reCAPTCHA when a token is supplied (fail-open), so scripted clients can skip it; enforcing blind could lock out real users if reCAPTCHA is misconfigured |
| AUTH-3 | Low | Open | Admin PIN plaintext/env compare uses `===` (gated behind verified owner sign-in) |
| FAQ-2 | Medium | Open | FAQ quota lives in a local JSON file, per Cloud Run instance and ephemeral, so it is weaker than it looks; every request rewrites the whole file |
| PDF-1 | Low | Open | `/api/pdf-open` is unauthenticated and can buffer up to 25 MB per request; only the generic 300/min limiter applies |
| AUTH-4 | Info | Open | Free 7-day Pro trial on every new verified Google account invites multi-account farming |
