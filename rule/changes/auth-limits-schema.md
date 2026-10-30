# Change: restore auth_account_limits schema contract (Task 6 / DB-1)

- Starting commit: `7200ff2cba5bb28b9052c4d05eeb813c3c2650cf`, latest origin/main verified before branching.
- Objective: add idempotent service-only table creation from **observed staging** definitions, leaving existing columns/rows intact; prove empty-database creation and replay with PGlite. No hosted migration.
- Mandatory sources read: docs/audit/schema-contract.sql, docs/SUPABASE.md, accountRateLimiter.ts and the deep-audit RPC migration.
- Read-only evidence, 30 October 2026: connected Supabase project listing identifies Bsenexus-staging as vjjdjzehecrdgtonzakv. ONLY that staging project's catalog was queried; no production SQL was executed. information_schema.columns: id text NOT NULL, no default; data jsonb NOT NULL DEFAULT '{}'::jsonb; updated_at timestamptz NOT NULL DEFAULT now(). Constraint/index: PRIMARY KEY(id), named auth_account_limits_pkey; RLS enabled, not forced. Existing table privileges: postgres and service_role have all seven table privileges; no public/anon/authenticated grants. No rows/personal payloads read.
- Impact: `npm run map:impact -- server/security/accountRateLimiter.ts docs/audit/schema-contract.sql supabase/migrations/20261024193046_deep_audit_security.sql`; account lockout check/fail/reset and shared RPC reviewed-compatible, no runtime change. Repeated impact scan after install to retain complete evidence.
- Source of truth: forward additive migration generated with `supabase migration new auth_account_limits_schema`, exact observed staging columns/defaults/PK, RLS on, revoke PUBLIC/anon/authenticated, grant ALL to service_role. CREATE IF NOT EXISTS never alters existing column definitions or counters.
- Tests: fresh PGlite database, exact column/default/nullability contract, browser read/write denial, service_role default insert and update, RLS enabled, replay preserves catalog and live lockout row. Negative old-source case omits this migration and table lookup fails. PGlite is isolated, not staging/prod.
- Scope: schema only; login/PIN/session/account-limit policy/prices/referral behavior unchanged. Existing modern deep-audit functions reference the relation but do not CREATE it; this closes that drift.
- Owner steps: rehearse migration on staging, compare production schema privately with the supplied read-only contract query, confirm equivalence, then apply under normal reviewed rollout. No production inspection allowed here, so production no-op is conditional on matching the staging contract; not falsely claimed as observed.
- Rollback: retain table/counters and roll back dependent runtime if necessary. Do not drop a live auth-protection table. Only remove a newly created unused table in a separate reviewed migration after dependent code/RPCs are removed.
- Risks: this restores one table contract, not a certification that all historical migrations/bootstrap dependencies are complete. Existing broader settings/auth storage behavior remains unchanged.
- Commands/results: pending below. No browser checks relevant to DDL; no hosted DDL or deployment.
- Graph/domain: add migration and SQL test to identity/storage; regenerate/check outputs.
- Delivery: pending commit/PR; not merged; CI separate; no migration/deployment.

- Impact-tool limitation: docs/audit/schema-contract.sql is outside the source scanner; the initial mixed source/docs command failed with Unknown path. The source-only scan (accountRateLimiter.ts plus deep-audit migration) completed before final review; docs/catalog consumers were manually inspected. No source behavior was changed.

## Actual verification

- `npm ci`: passed (661 packages, local Firebase postinstall only).
- Final isolated checks each exited **0**: `npm run lint`, `npm test` (**874 passed**, 33 suites, 0 failed/skipped), `npm run build` (prebuild/TypeScript/Vite/budget/server/copy), `npm run map:generate`, `npm run test:map` (**6/6**), `npm run map:check`. Incidental version bump reverted.
- New PGlite SQL test: 1 passed. Its first query on the old empty migration fixture rejects relation does not exist; new DDL creates exact columns and privileges, rejects anon/authenticated reads and inserts, allows service_role writes and preserves a populated lockout row/catalog on replay. This is an executed old-absence assertion, not a hosted old-runtime test.
- `git diff --check`: passed. No hosted migration, database write, production inspection, browser session or runtime deployment. Catalog reads were confined to Bsenexus-staging. Production schema equivalence must be checked by owner before applying; no unconditional production no-op claim.
