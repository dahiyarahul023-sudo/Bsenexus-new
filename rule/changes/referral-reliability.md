# Referral reliability

Starting commit: 4ec85ccadb3497cdfe2372c1eda8897b9bd35cad (current main, including restored referral prices).

Objective: unique custom-code ownership across instances; immediate pending visibility when an authenticated friend applies a code; durable exactly-once reward after verified payment; private live dashboard updates.

Evidence: referralsDao.ts is local-cache-first and ignores Supabase returned errors; custom-code upsert can replace ownership; checkout attribution is order_referrals.json; conversion credit errors are swallowed; recover/claim reject discounted orders; dashboard fetches only on open/mutations and resets edit fields each fetch.

Impact: ran scripts/spider-map.mjs --impact server/database/referralsDao.ts; trace includes API, payment grant paths, dashboard, profile/entitlement mirror, SQL and tests. No runtime files will be deleted or renamed. Host compile_applet/lint_applet unavailable; repository checks will be recorded honestly.

Design: service-role-only database commands and constraints; immutable code aliases; bound order attribution and reward snapshot; transactional settlement on durable granted-payment transition; authenticated SSE with database-change wakeups and periodic reconciliation; no client-supplied reward/owner authority. Applying != verified purchase.

Unknown: live database schema/data and deployment credentials are not available. Migration/cutover needs explicit rehearsal and preservation of legacy referral records; no production SQL or real payments will run here.

Validation: final full backend suite passed 257/257; spider-map tests passed 4/4; TypeScript lint and production client/server build passed. The 18 new referral checks cover actual SQL ownership/settlement/rollback/access-floor behavior, HTTP authorization and storage failure, payment matching, payout decimals, and stream framing/cancellation. PGlite runs the migration but serializes connections; no real multi-instance or Cashfree sandbox/browser validation was performed. Build emits the existing large-chunk advisory. Host compile_applet/lint_applet are unavailable.

Delivery includes the previously unmerged rule/spider-map foundation so this branch is self-contained. Read rule/REFERRALS.md before rollout: existing data requires an audited import, modern paid-grant schema verification, migration rehearsal and coordinated cutover. No production schema, payment or balance was changed.
