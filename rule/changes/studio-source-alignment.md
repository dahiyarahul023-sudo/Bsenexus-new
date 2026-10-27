# Studio source alignment and Gift API recovery — 28 October 2026 IST

- Canonical repo: dahiyarahul023-sudo/Bsenexus-new-orig, starting main e67b26ccdea232dffa93d8312a7d5dfcd20f7e1d. No push to retired Bsenexus-new.
- User authorized preserving Studio code and changing its connection, then requested code fixes and merge, leaving private preview checks to the user. No live preview acceptance claimed.
- Downloaded current Bse workspace through Export before mutation. Existing Gift, calendar, connector, security and runtime work is absent from canonical main; this PR migrates that work. Exclude unreferenced prompt screenshots and exported .aistudio media; delete no canonical base files.
- Preserve canonical-only work from 2fafd9fa14c7c2ee1bdcd4ab907b59a1cd7a6b7e...e67b26ccdea232dffa93d8312a7d5dfcd20f7e1d: three audit records, safeStorage and six reads, UUID handling/test. Newer Studio CompanyIntelligenceModal already returns after all hooks, including useLayoutEffect; retain it. Navigation fixture loads the real preserved storage helper rather than its generic empty-module stub.
- Screenshot: Server returned non-JSON response (200). Earlier read-only live investigation saw Studio startup HTML at the known Gift endpoint while api/ping returned pong. Exact proxy rewrite rules unproven.
- Reproduced customFetch bug: HTML 200 produced an error body but Response.ok true and a network success event. Regression fails before fix (200 != 502). Return API_NON_JSON_RESPONSE; 2xx HTML becomes 502, existing error statuses preserved, page content never copied, no automatic replay or new offline/success event. JSON, cancellation, existing 401 refresh and real outage contracts compatible.
- Disabled gifts now return 409 GIFT_ACCESS_DISABLED before auth/storage/mail. All six endpoints tested with zero storage/mail calls. Real store outages remain 503; feature stays off by default.
- AdminGiftAccess gives typed preview/API-version guidance. Existing failed-read gates preserve drafts, disable create/resend/revoke and require successful explicit refresh. Activation cannot display success from HTML either.
- Preserve explicit dev --port 3000 and stable single process. Remove broad nonproduction PORT=8080 rewriting; direct/production startup respects platform PORT. Last CLI port wins, allowing npm run dev -- --port 4000. Process fixture now replaces the correct server entry when CLI flags follow it.
- Exported npm lock disagreed with manifest (missing MCP/Playwright, incompatible Zod); npm ci rejected it. Reconcile lock against unchanged manifest; clean install succeeds (661 packages). No dependency ranges/policy changes.
- Impact command: npm run map:impact -- server/api/giftAccess.ts src/api.ts src/components/AdminGiftAccess.tsx server/utils/serverStartup.ts. Imports/events and operations/gift/session/commerce peers reviewed.
- Changed: source alignment, transport failure, disabled envelope, recovery copy, CLI/process fixture, lockfile, evidence/map.
- Compatible: API mount, PIN/Firebase/Origin guards, idempotent claims, resend/revoke, paid/trial/referral isolation, Telegram and connector projections. No access guard relaxed. Shared payment/calendar/notes/account clients retain success:false/items:[], JSON/error-status behavior; HTML 2xx deliberately no longer succeeds.
- Release gates: docs/GIFT_ACCESS.md and prior additive migrations in order, verified sender and controlled account flow before enablement. Source merge is not a live migration/email/Share confirmation. No production schema/data, secrets, payments, emails or paid Gemini calls changed.
- Private browser acceptance left to user explicitly; CI browser fixtures remain. Host compile_applet/lint_applet unavailable locally.
- Before repair, three new regressions failed as expected. Clean npm ci and Firebase patch completed; lint passed. Initial full suite 848/849 passed: only navigation harness stub failed after safeStorage preservation. Load real helper without weakening assertions and rerun.
- Final checks recorded after completion. Committed, CI-passed, merged, deployed remain separate. Rollback: revert PR; no live data/schema changed; never restore automatic watcher.

## Completed local checks

- Full offline suite with concurrency 4: 849 tests, 32 suites, all passed, zero failures/skips (52.46s). Focused transport/Gift/navigation/process run: 17/17 passed. An earlier unconstrained rerun ended without a final TAP summary and is not counted as proof; the bounded rerun completed.
- npm run lint passed. Production build passed; entry budget 621603 raw / 174002 gzip bytes. Existing server-bundle size warning retained.
- Six map tests passed. Map generation and freshness check passed: 580 source files, 1545 import edges, 27 domains. git diff --check passed.
- Host preview and live release checks remain with the user; no deployment claim. Remote CI and merge reported separately in delivery.
