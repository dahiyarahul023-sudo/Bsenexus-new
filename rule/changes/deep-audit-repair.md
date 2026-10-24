# Deep audit repair

Starting upstream main: 7ba693c046509e8ae7bce55f3419bd98383dc375 (2026-10-25 IST).
User objective: verify and repair all three uploaded deep audit portions without changing prices or referral rewards.

Verified: production already has service-only nine-argument grant_payment_atomic and referral/demo functions; both referral triggers exist. The live grant lacks amount/plan checks and per-user serialization. Session initializes trials without trial_used. Reconcile uses an unlocked upsert and promotes legacy profile fields. Personal test accepts a raw destination. Legacy admin watchlist migration can run for any new UID. Notes check JSON ownership but mutation queries omit the SQL owner predicate. Account limiter trusts raw leftmost XFF, caches shared state and performs non-atomic increments.

Plan: forward-only service-only database contracts; atomic first trial; per-user grant/reconcile locking; no automatic paid promotion from profile fields; database protection from stale profile saves; atomic distributed login protection; actual admin PIN elevation; server-owned CAPTCHA actions and mounted opt-in App Check; nonce-bound private Telegram linking and shared-channel exclusion at personal sends; explicit UID filters and owner-only legacy import.

Impact: npm run map:impact -- server/security/auth.ts server/database/paymentEntitlementsDao.ts server/database/watchlistDao.ts server/database/notesDao.ts server/api/routes.ts (output captured locally). Payments, referrals, authentication, AI connections/quota, notes, watchlists, Telegram, frontend sessions/settings and background delivery reviewed together.

Acceptance: mismatched amount/owner/plan/currency rejected, duplicates do not extend or revive expired access, concurrent purchases accumulate, reconcile cannot overwrite a grant, trial cannot replay after cleared expiry, browser roles cannot execute privileged functions, cross-user notes denied, nonowner cannot import admin data, unknown/unverified Telegram recipients cannot receive personal sends, nonce expiry/replay and webhook authentication enforced, distributed lockout outage denies login, PIN needed for admin routes, omitted CAPTCHA rejected when enforced.

Delivery/test results and consumer matrix will be appended after validation. Required host compile_applet/lint_applet commands and Supabase CLI are unavailable; standard TypeScript/build checks and MCP migration support are available.

## Consumer dispositions

| Consumer | Disposition and evidence |
|---|---|
| Cashfree create/webhook/verify/claim/recover | Reviewed-and-compatible: same grant DAO and nine named parameters; provider PAID/ownership/paise checks remain. New RPC also validates immutable checkout fields and plan duration. Missing-ledger recovery now fails explicitly. |
| Paid reconciliation / Pro middleware / AI OAuth | Changed: one service-only reconciliation RPC locks users; no profile-to-paid promotion. Ordinary profile trial access remains valid until expiry. |
| Profile/session/pricing/history | Changed: atomic first-use flag, historical trial flags backfilled, monotone access trigger and actual returned database row. Prices untouched; existing active expiry retained. Owner Pro exemption retained; administration requires short-lived PIN proof. |
| Referral apply/bind/settle/SSE | Reviewed-and-compatible: attribution and reward mode remain immutable per checkout. Trigger runs inside hardened paid transaction, duplicate callback tested with actual 006 functions. A later code application intentionally cannot rewrite an open checkout. |
| Notes API/DAO | Changed: reads before update/delete and final mutations include SQL user_id plus id; JSON ownership check retained. Client note contract unchanged. |
| Website and AI watchlists | Changed: legacy admin import only for configured LEGACY_ADMIN_UID; existing CAS/owner-specific storage preserved. Empty setting disables legacy import. |
| Telegram tests/profile/settings/news sends | Changed: durable verified link required; no typed ID establishes authority. Unlink removes outstanding challenge and binding. Pro gates and language-only updates preserved. |
| Telegram workers and delayed AI reply | Changed: verified link checked immediately before personal send/reply; shared admin broadcasts retain elevated admin controls. |
| Settings and AuthContext/customFetch | Changed: account-keyed verification control; session CAPTCHA uses SESSION; optional App Check header supported. Loading/error/retry and late/account-switched responses guarded. |
| AI size and quota controls / SSRF | Reviewed-and-compatible: readBoundedDocument already caps 25 MiB, inline PDFs at 6 MiB, extracted text at 80,000 characters; existing allowlist validates every redirect. Quota reservation/refund preserved; missing production database can no longer issue a local free demo. |

## Migration and release gates

New migration: `20261024193046_deep_audit_security.sql`. The Supabase CLI was unavailable (`npx --offline supabase --help`: ENOTCACHED); this file was timestamped locally rather than falsely reporting a CLI-generated migration. The migration checks the modern contract explicitly. Repository 001 is historically incompatible with the verified modern payment tables: new installs require an audited modern schema export first; this change refuses to guess historical payment conversions.

Local SQL tests execute the real new functions with migration 006 in PostgreSQL WASM. They do not establish true multi-connection race/load behavior. Account row locks cover different first orders and reconciliation; reciprocal referral purchases can deadlock and should be safely retried by provider/recovery (transaction rollback, no double credit).

The attempted MCP migration targeted **Bsenexus-staging (`vjjdjzehecrdgtonzakv`)**, not production. Automatic approval review rejected it, citing changes to existing trial state, payment/auth functions and Telegram/account controls. **No staging or production migration was applied.** No real payments, payouts or Telegram messages were sent. Production (`ibldmiumivdspzhslsud`) was inspected read-only.

After explicit approval: rehearse migration on staging; run rolled-back service-role negative/replay/referral checks and genuine separate-connection concurrency; then coordinate production migration before runtime rollout. Keep the new runtime on a review branch until the prerequisite migration is installed. Historical accounts are marked trial_used=true without extending/reducing current expiry. Preserve a schema/data export; do not rollback by deleting reward/entitlement history or resetting trial flags.

Telegram runtime setup: configure a random 32–256 character base64url TELEGRAM_WEBHOOK_SECRET and canonical TELEGRAM_WEBHOOK_URL; from the PIN-elevated owner session call POST /api/telegram/webhook/setup once. This intentionally changes the bot's incoming webhook; inspect any existing handler before registration. Then users create a verification link in Settings, open Telegram/Start and check verification. Private chats only; all old raw-ID links need verification. Until setup, personal linking fails visibly and unverified legacy recipients are skipped. Global admin broadcasts remain a separate path.

Production CAPTCHA must have a configured site key, assessment key, project and allowed hostnames. App Check remains an explicit deploy-time setting: configure Firebase and VITE_APPCHECK_ENFORCE=true before FIREBASE_APPCHECK_ENFORCE=true. Neither missing token nor assessment action is client-optional once enforced. Existing admin sessions require re-entering PIN; elevation is 15 minutes and same-UID only.

No local Chromium/Firefox/Playwright or required host compile_applet/lint_applet executables are installed. Actual Settings/browser/device and live bot/provider flows remain unverified; TypeScript, production bundle and behavior tests do not stand in for those checks.

## Validation actually executed

- Local `npm test` with a disposable test JWT secret: 738 tests passed (31 suites); no skips. Earlier four failures from obsolete fixtures were corrected: Firebase-only owner administration is denied; Radar admin fixture supplies verified PIN elevation; browser fetch harness knows its App Check dependency.
- New audit SQL/auth cases: 13 tests passed, including actual Telegram API routing, forged-webhook rejection and hashed account-bound challenges.
- `npm run lint`: passed. `npm run build`: passed, including startup performance budget (1,013,488 raw / 273,213 gzip bytes). `npm run test:map`: six passed; `npm run map:check`: 532 files / 1,424 import edges / 26 domains. `git diff --check`: passed.
- All untouched reconstructed files were checked against upstream Git blob hashes: no mismatches. No secret values or customer records added to Git.
- Browser/device, live Cashfree, live Telegram and real separate-connection database concurrency: not executed. Migration, runtime deployment and production behavior: not applied/verified. Required host compile_applet/lint_applet unavailable.

Delivery: implementation and forward migration prepared for a GitHub review branch/PR; main remains unchanged. Database release remains blocked by automatic approval review and requires explicit approval before staging rehearsal. CI and deployment are separate from the local checks above.

GitHub upload review initially rejected the existing watchlist source as a possible disclosure to an unverified repository. Read-only repository metadata then confirmed the same private Bsenexus-new repository with owner/admin/push access; the flagged identifier and storage code were already present in that repository. Upload of the hardened watchlist file was subsequently approved after that verification. No other destination was used.
