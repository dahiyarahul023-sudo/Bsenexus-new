# Change: wait for admin reset focus restoration

- Starting commit: 3eccbba4adaa8b4669923234da51029e3efbb28f, PR #65.
- User objective: complete the pending admin session/PIN repair and merge after checks pass.
- Verified failure: Actions run 42022470087, development-preview job 127228369570, passed the 390px journey but failed the immediate focus assertion at 1440px. Application, Bun and rules-map jobs passed.
- Source evidence: scripts/verify-admin-quota.mjs waits for the disappearing modal before testing focus. AiUsageCard releases its pending button in the asynchronous action's finally block; modal disappearance alone is not that readiness signal.
- Impact: npm run map:impact -- scripts/verify-admin-quota.mjs; browser fixture only. AuthProvider, AdminPinModal, AiUsageCard, quota API, middleware and security policy are reviewed-and-compatible and unchanged.
- Implementation: wait up to three seconds for the same exact reset control to regain focus, then retain the original identity assertion. This is an observable-condition wait, with no fixed sleep or removed assertion.
- Acceptance: both 390x844 and 1440x844 must still pass cached-session rejection, wrong PIN, successful reset, explicit-denial re-prompt, cancellation, account switch, status outage, keyboard containment and restored focus. Timeout remains a failure.
- Local checks: typecheck and production build passed before this test-only correction. Current-host Chromium cannot start because AF_UNIX socket creation is denied; the official Playwright shell download also failed. These are not passing browser results. The existing remote CI job will execute the corrected browser suite.
- Required checks unavailable: compile_applet and lint_applet are not exposed. No product refactor is included.
- Deployment: no migration or production reset. Revert this test-only follow-up for rollback. Real owner sign-in/PIN and production reset remain separate acceptance checks after deployment.
- Graph: regenerated and checked with the test change. No new semantic relationship.
- Delivery: committed/pushed, CI, merge and deployment are reported independently after observing their results.
