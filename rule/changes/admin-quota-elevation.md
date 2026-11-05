# Change: verified admin sessions and PIN-before-quota-reset

- Starting commit: `edf5e16e7ad232761c2a6764ec3545b987e2b5c2` (GitHub main, 5 November 2026).
- User objective: expired Firebase Bearer must not mask a valid server cookie; cached identity cannot establish admin UI; all three quota-reset entries obtain a 15-minute PIN elevation and retry only explicit elevation denial once.
- Verified sources: `server/security/auth.ts` authMiddleware, requireAdmin, verify-pin and status; `src/api.ts` customFetch; `src/context/AuthContext.tsx` cached restore/role derivation; SettingsTab, AiUsageCard and StorageManager reset handlers. The existing Admin Master Key sheet is the real location; no Root Ops section exists.
- Scope: shared authentication contract and existing reset interaction; quota policy/window, infrastructure and secrets unchanged. No migration.
- Impact: `npm run map:impact -- server/security/auth.ts src/api.ts src/context/AuthContext.tsx src/components/AdminPinModal.tsx src/components/AiUsageCard.tsx src/components/SettingsTab.tsx src/components/StorageManager.tsx` run before source editing. Identity/session, frontend AI, billing and dependent guarded administration reviewed.
- Consumers: auth transport/context/status, PIN modal and three reset handlers changed. Gift Pro/Payment History/Pro readers reviewed through their shared auth middleware/context. Existing reset route and plan catalogue remain compatible; success counts come from the existing route. The quota service removes the literal UID admin bypass, reconciling the conflicting legacy quota test with the standing audit assertion; verified admin flags still grant unlimited access, and plan limits are unchanged. No generic replay of uncertain writes.
- Source of truth: verified server identity and same-UID cookie elevation. AuthContext owns display state and a cancellable PIN request; reset callers own feedback and quota-refresh events.
- Failure/concurrency: expired/malformed Bearer, invalid cookie, wrong UID/email, unverified email, guest PIN, wrong PIN, expired elevation, modal cancel, duplicate requests and late account responses require regression coverage.
- Browser matrix: actual AuthProvider, customFetch, AiUsageCard and AdminPinModal rendered at 390×844 and 1440×844 against explicit synthetic Firebase/API adapters. Both passed: cached admin rejected/token cleared; Google fixture confirms server roles; zero reset calls before PIN; wrong PIN performs no reset; correct PIN confirms resetCount=2; stale server elevation reopens PIN; cancel performs no replay; account switch cancels pending action; status-read outage cancels the pending PIN request; keyboard trap/Escape/focus return; no horizontal overflow or page errors. These are local fixtures, not real Google/provider or physical iPhone evidence.
- Validation/results:
  - Regression reproduced before fix: expired Bearer + valid admin cookie returned 403; identity/PIN tests failed as expected.
  - Fresh npm ci with the restored, manifest-matching lockfile: 662 packages installed. Initial offline-only install lacked cached metadata; normal clean installation succeeded. No manifest/dependency policy change.
  - npm run lint / tsc --noEmit: zero errors; npm run build passed including startup budget and server bundle; npm run build --ignore-scripts also passed against the clean installation.
  - Full NODE_ENV=test JWT_SECRET=<disposable fixture> npm test: 1025/1025 passing, zero failed/skipped (includes real auth middleware, real PIN and quota reset routers, and existing adminPin/aiQuotaAdmin suites).
  - Focused auth/reset/transport suite passed 35/35 before the final extra status acceptance case; final full suite covers all additions.
  - npm run map:generate, npm run map:check and npm run test:map: current outputs, 6/6 map tests.
  - git diff --check passed.
- Live acceptance outcomes (5 November 2026): NOT RUN for fresh owner Google sign-in, Gift Pro PIN verification, production quota reset/reset count, real 15-minute wait/re-prompt, deliberately aged production Firebase session, Payment History/Gift Pro guest-banner recovery, and live error/search copy. This branch has not been deployed and the real PIN is intentionally user-entered. No production reset was performed. Source error copy no longer names Root Ops; real-middleware tests verify the replacement. The 15-minute boundary is exercised with a controlled test clock, without weakening the production window.
- Required host checks: compile_applet/lint_applet are not exposed; repository TypeScript/build and map checks passed.
- Delivery: branch/PR only; no merge/deployment authorized in this request. Rollback: revert the source PR; no data/schema rollback.

## Frontend action and consistency record

- `admin.verify-pin`: existing Gift Pro dialog and Settings Admin Master Key form -> force Firebase refresh -> server verify -> cookie -> status refresh -> update shared elevation. Cancel/account switch discards pending reset.
- `admin.reset-ai-quota`: Settings AI usage, Admin Master Key and Storage Manager (all/user) -> obtain elevation if needed -> existing POST -> explicit denial may prompt/retry once -> confirmed feedback/reset count -> `bse_ai_quota_refresh`.
- Preserve existing control tokens/layout; shared PIN dialog gains keyboard/focus ownership. No new navigation section.
- Implementation, automated validation, browser verification, GitHub CI and live deployment remain separate evidence states.

- Graph/domain/documentation: identity, trial-quota, frontend-session and frontend-ai memberships include the shared action and regression suites; frontend map/strategy and README describe the actual existing entry point. Build-generated version metadata is included.
- GitHub delivery: branch codex/fix-admin-quota-elevation; PR/CI status must be read from GitHub separately. No merge or deployment.

- Repeatable browser regression: `node scripts/verify-admin-quota.mjs` uses synthetic providers only and is included in the existing development-preview CI job after Chromium installation. Local Chromium uses the existing runtime executable override; the committed script defaults to Playwright Chromium. No new dependency or secret.
