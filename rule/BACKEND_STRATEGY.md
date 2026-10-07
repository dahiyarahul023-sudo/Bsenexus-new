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

## Phase 2 — pricing contract (historical baseline; updated 2026-10-07)

Main `4ec85cc` now defines higher regular prices and referral discounts consistently in both catalogues. The referral reliability change preserves those values and fixes payment-path parity; the observations below describe the earlier `3f35f3b` baseline, not a current request to choose prices. See `REFERRALS.md` for the current contract and deployment blockers.

Observed facts:

- `server/config/plans.ts` charges 5900 / 19900 / 99900 / 179900 paise. `src/config/plans.ts` agrees on ordinary display prices.
- `server/tests/referrals.test.ts` instead expects ordinary prices 89 / 299 / 1499 / 2699 rupees and referral prices 59 / 199 / 999 / 1799. The test imports `getEffectivePlanPrice`, which the current display catalogue does not export.
- `PricingPage`, `ProCheckoutView`, `SettingsTab` and `src/utils/cashfree.ts` reference missing referral display fields/functions; `getLowestPlanPrice` is called with an unsupported argument.
- Type checking/build fail on these references. The configured backend suite also fails its referral module and SSR pricing-title assertion.
- `server/api/payments.ts` create/verify/webhook consider a possible referral amount; recover/claim currently compare against standard amount. Introducing a real discounted amount requires all paths to be coordinated. Existing standard-only values mask that future divergence.

Unresolved product choice: whether current base prices stay 59/199/999/1799 for everyone, or the higher base prices with referral discounts are intended. Conflicting tests alone are not authority to raise customer prices.

Next bounded implementation: confirm that choice; create a typed charge/display/referral contract, update all checkout/grant/recovery/history/receipt/SSR/copy consumers, then use independent expected-price and parity tests. Do not fix this by weakening tests, adding `any`, or silently changing money values.

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
