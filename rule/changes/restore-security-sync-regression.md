# Change: restore security controls removed by a later source sync

- Starting commit: a863ac03657edc153f449bf7f97b3431717134c4 (current main, 1 November 2026 IST review).
- Objective: resume the interrupted security tasks and restore the previously approved and merged protections before completing the pending PRs.
- Verified facts: GitHub commit a863ac0 removed the PDF streaming router/tests, auth-account-limits migration/test, Dependabot configuration and four change records. It also restored unbounded PDF buffering, tag-pinned workflows and older vulnerable body-parser/Zod dependencies. The immediately preceding 98c1646 contains the approved protections and the newer Gift login fix.
- Source of truth: restore only the 15 paths changed by a863ac0 from its parent 98c1646; preserve all other current main files, including GiftActivationPage.tsx and giftAccess.ts. Rebuild generated maps from the final combined source.
- Impact command: npm run map:impact -- server/api/routes.ts server/ai/http.ts server/security/accountRateLimiter.ts (output reviewed before source restoration). Public PDF, AI connection schemas, identity/storage and CI dependency consumers reviewed.
- Changed consumers: bounded PDF route mount, Zod v4-compatible MCP schema typing, dependency lock/overrides, pinned workflow actions and weekly grouped dependency updates. Restore the original tested migration and its evidence; no hosted database action.
- Reviewed-and-compatible: current Gift claim readiness/verification changes, other API routes, BSE SSRF allowlist, auth/session/payment/referral policies and existing browser UI remain unchanged. PDF rate/size/concurrency and auth-schema behavior retain the already approved contracts.
- Failure/security/concurrency: reuse the restored PDF adversarial tests and isolated SQL replay/privilege tests; full backend tests, lint/build, map generation/check/tests and clean installation/audit results recorded below. Existing quota and PIN PRs are separate follow-ups.
- Deployment/migration: no deployment or production SQL. The auth-table migration remains a separately coordinated release prerequisite. The restored workflow has CI-only push/PR jobs, no deployment job. Runtime rollback must preserve the migration's counters.
- Required unavailable checks: host compile_applet/lint_applet are not exposed; no browser/device or live provider acceptance is claimed for this restoration.
- Rollback: revert this bounded restoration only if a replacement protection is supplied; do not replay the broad sync or overwrite newer source.
- Graph/domain: restored the original semantic memberships and regenerated both spider-map outputs.
- Delivery: verification in progress; committed, CI, merge and deployment reported separately in the PR.
