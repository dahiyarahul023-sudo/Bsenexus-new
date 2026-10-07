# Backend strategy and verified starting point

Baseline reviewed: `3f35f3ba442d1571051c6f418c93ceaf8d0cf484` on 2026-10-06.
This change establishes the engineering foundation. It does not certify or deploy a complete production backend.

## Phase 1 — repeatable changes (implemented here)

- Root `AGENTS.md` points all contributors to `rule/` before editing.
- Eighteen backend rules translate research findings into concrete evidence requirements.
- Twelve reviewed domains supplement source imports with cross-boundary business relationships.
- Generated JSON and a local interactive HTML map show imports/consumers plus route, HTTP, store/RPC and environment-name call sites.
- Generation, watch, impact and freshness commands; behavioral map tests; PR template and CI workflow.
- Clean-install lock repair adds missing platform package records while preserving every existing package version and record.
- Historical auth/durability explanations corrected where checked against current source.

## Phase 2 — pricing and referral contract (current repository baseline)

Rechecked at main `b4e66b36d9fd8f82b86d80b722bdef2d654569ef` on 2026-10-07. The earlier pricing conflict is historical; do not ask the user to resolve it again or silently revert prices.

| Plan | Standard INR | Referral INR | Days |
|---|---:|---:|---:|
| Weekly | 89 | 59 | 7 |
| Monthly | 299 | 199 | 30 |
| Half-yearly | 1499 | 999 | 180 |
| Yearly | 2699 | 1799 | 365 |

Evidence: `server/config/plans.ts::PRO_PLANS` defines charged amounts in paise; `src/config/plans.ts` defines display values. `server/services/referralPaymentContract.ts` validates the order contract used by payment grant paths. Relevant checks are `pricingSync.test.ts`, `referralContract.test.ts` and `referralApi.test.ts`; their presence is not a claim they passed in a given deployment.

Referral ownership, pending applications, order attribution, settlement and stream reconciliation are implemented in repository source. Follow `REFERRALS.md` for the exact behavior and required database/legacy cutover. Repository implementation does not establish that migration 006 is installed or that live rewards and streams work.

Next bounded work: reconcile the payment schema below and rehearse the referral cutover on an isolated database with legacy records accounted for. Preserve current prices and reward policy.

## Phase 3 — make the database reproducible (release blocker)

`server/database/paymentEntitlementsDao.ts::grantPaymentAtomically` passes nine named parameters and expects a complete entitlement. `001_initial_schema.sql` defines a five-argument function returning `{ok:true}` and different payment columns. `paymentOrdersDao.ts` calls `record_pending_order_atomic` and `claim_order_for_grant`; checked-in migrations mention their privilege repair but do not define their bodies.

A deployed database may contain additional manual schema. Its actual state has NOT been inspected in this change. Run the existing read-only `docs/audit/schema-contract.sql` against an authorized database, inspect definitions/privileges, then create an additive compatibility migration and test a new database plus an upgraded copy. Keep existing paid records intact. Acceptance includes wrong owner, duplicate order, simultaneous different orders for one UID, timeout after commit and retry, restart and profile-mirror repair. Do not run destructive or speculative production SQL.

## Phase 4 — close runtime evidence gaps

| Domain | Next evidence needed | Completion criterion |
|---|---|---|
| Sessions/authorization | Actual JWT invalidation policy, middleware mounts, negative HTTP tests | Expired/revoked/wrong-user access denied; durable authority outages visible |
| Quota/notifications | Migration-backed concurrent requests and restart checks | No overspend, duplicate consumption or cross-user read/clear effects |
| Feed/alerts | Multi-instance scheduling and recipient deduplication tests | Bounded upstream load and no unintended duplicate delivery |
| Storage/cache | Per-DAO outage policy and mutation invalidation checks | Paid state never relies on ephemeral files; no cross-user cache leaks |
| Operations | Deployment config, readiness, logs, rollback and alert handling | Operators can detect degraded dependencies and recover without hidden loss |

Repeat the rule workflow for each bounded change. Update this strategy with evidence, not optimistic status labels. No synthetic performance targets, guessed traffic levels or unspecified infrastructure choices have been imposed.


## Phase 5 — keep the strategy trustworthy

For each change, follow `WORKFLOW.md` and update this strategy when a blocker is resolved or evidence changes. Never leave a resolved product choice written as an open decision. The 2026-10-07 wiring update extends semantic review to transitive import consumers, so a shared helper can expose related contracts and tests. The regression test reproduces a helper-to-plan-to-display dependency; it does not certify production behavior.
