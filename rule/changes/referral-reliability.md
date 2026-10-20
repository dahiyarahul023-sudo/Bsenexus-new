# Referral reliability

Starting commit: 4ec85ccadb3497cdfe2372c1eda8897b9bd35cad (current main, including restored referral prices).

Objective: unique custom-code ownership across instances; immediate pending visibility when an authenticated friend applies a code; durable exactly-once reward after verified payment; private live dashboard updates.

Evidence: referralsDao.ts is local-cache-first and ignores Supabase returned errors; custom-code upsert can replace ownership; checkout attribution is order_referrals.json; conversion credit errors are swallowed; recover/claim reject discounted orders; dashboard fetches only on open/mutations and resets edit fields each fetch.

Impact: ran scripts/spider-map.mjs --impact server/database/referralsDao.ts; trace includes API, payment grant paths, dashboard, profile/entitlement mirror, SQL and tests. No runtime files will be deleted or renamed. Host compile_applet/lint_applet unavailable; repository checks will be recorded honestly.

Design: service-role-only database commands and constraints; immutable code aliases; bound order attribution and reward snapshot; transactional settlement on durable granted-payment transition; authenticated SSE with database-change wakeups and periodic reconciliation; no client-supplied reward/owner authority. Applying != verified purchase.

Unknown: live database schema/data and deployment credentials are not available. Migration/cutover needs explicit rehearsal and preservation of legacy referral records; no production SQL or real payments will run here.

Validation: final full backend suite passed 257/257; spider-map tests passed 4/4; TypeScript lint and production client/server build passed. The 18 new referral checks cover actual SQL ownership/settlement/rollback/access-floor behavior, HTTP authorization and storage failure, payment matching, payout decimals, and stream framing/cancellation. PGlite runs the migration but serializes connections; no real multi-instance or Cashfree sandbox/browser validation was performed. Build emits the existing large-chunk advisory. Host compile_applet/lint_applet are unavailable.

Delivery includes the previously unmerged rule/spider-map foundation so this branch is self-contained. Read rule/REFERRALS.md before rollout: existing data requires an audited import, modern paid-grant schema verification, migration rehearsal and coordinated cutover. No production schema, payment or balance was changed.

## Supabase staging rehearsal — 2026-10-07

Connected projects verified: Bsenexus (production) and Bsenexus-staging. Neither contained legacy referral tables before rehearsal. This does NOT establish absence of local-file referral obligations on the running application.

Migration 006 was applied successfully to Bsenexus-staging only. The actual staging grant_payment_atomic RPC was exercised under service_role in a transaction rolled back at completion: normalized duplicate code rejected; application visible as pending; bound discounted checkout granted its 14-day reward; repeated grant/settlement did not extend again; stale profile update preserved bonus. Verified afterwards: users/orders/referral accounts/rewards all zero. Referral RPC EXECUTE is denied to anon/authenticated and allowed to service_role. referral_accounts_v2 is included in supabase_realtime. Security advisor reported only informational RLS-without-policy findings; these referral tables intentionally permit server access only. Reference: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

Production was inspected read-only and is NOT migrated. Its grant_payment_atomic and record_pending_order_atomic definitions differ materially from staging: production uses the older grant flow and mutable pending-order upsert; staging has immutable order checks and user-row serialization. Do not infer production compatibility from the staging result. Real simultaneous-connection/cross-referral deadlock rehearsal, production-function compatibility, server-local legacy export/reconciliation, deployed browser stream and Cashfree sandbox verification remain outstanding. Hosting access is still required; do not merge/deploy merely because GitHub CI is green.

GitHub Actions run 37556562195 passed both application and rules-map jobs, including clean install, type check, backend tests, build, map tests and freshness.

### Exact rolled-back staging smoke query

```sql
begin;
set local role service_role;
do $test$
declare owner_id text:='referral-rehearsal-'||gen_random_uuid()::text;
buyer_id text:='referral-rehearsal-'||gen_random_uuid()::text;
other_id text:='referral-rehearsal-'||gen_random_uuid()::text;
oid text:='referral-rehearsal-'||gen_random_uuid()::text;
code text:='T'||upper(substr(md5(random()::text),1,15));
s jsonb; expiry bigint; collided boolean:=false;
begin
perform public.ensure_user_skeleton(owner_id,1);
perform public.ensure_user_skeleton(buyer_id,1);
perform public.ensure_user_skeleton(other_id,1);
perform public.referral_command('ensure',owner_id,jsonb_build_object('code',code));
begin
perform public.referral_command('ensure',other_id,jsonb_build_object('code',lower(code)));
exception when others then
if sqlerrm not like '%REFERRAL_CODE_TAKEN%' then raise; end if;
collided:=true;
end;
if not collided then raise exception 'duplicate code accepted'; end if;
perform public.referral_command('apply',buyer_id,jsonb_build_object('code',code));
s:=public.referral_snapshot(owner_id);
if (s->>'pending')::integer<>1 then raise exception 'pending missing'; end if;
perform public.record_pending_order_atomic(oid,buyer_id,'','pro_monthly',19900,'INR');
perform public.referral_command('bind',buyer_id,jsonb_build_object('orderId',oid,'code',code,'planId','pro_monthly','basePaise',29900,'paidPaise',19900,'currency','INR'));
perform public.grant_payment_atomic(oid,buyer_id,'','pro_monthly',30,19900,'INR',0,'verify');
s:=public.referral_snapshot(owner_id);
if (s->'account'->>'free_days')::integer<>14 or (s->>'pending')::integer<>0 or jsonb_array_length(s->'rewards')<>1 then raise exception 'reward missing'; end if;
select pro_expires_at into expiry from public.users where uid=owner_id;
perform public.grant_payment_atomic(oid,buyer_id,'','pro_monthly',30,19900,'INR',0,'webhook');
perform public.referral_settle_order(oid);
if (select pro_expires_at from public.users where uid=owner_id)<>expiry then raise exception 'duplicate reward'; end if;
update public.users set pro_expires_at=0,tier='free' where uid=owner_id;
if (select pro_expires_at from public.users where uid=owner_id)<>expiry then raise exception 'lost bonus'; end if;
end $test$;
select 'PASS: real payment RPC, code collision, pending, reward, replay, stale profile under service_role; all test data rolled back' as result;
rollback;
```

## Additional compatibility and concurrency checks — 2026-10-07

Read production column definitions/defaults and the exact ensure_user_skeleton, record_pending_order_atomic and grant_payment_atomic definitions without reading customer rows. Reconstructed the three tables locally with their primary keys and service_role BYPASSRLS, then ran migration 006 and the smoke query above against those production function bodies in PGlite. Passed code collision, pending visibility, reward settlement, replay and stale-profile protection. This verifies that basic flow with the production function bodies; it does not clone all production constraints, policies or simultaneous transactions. No production function was replaced.

Submitted two payment-grant transactions concurrently through separate staging database sessions (backend PIDs 292146 and 292143), holding each transaction for three seconds after grant. Both completed successfully and returned free_days=14 and reward count=1 for the same attributed order. Removed only the explicitly created referral-concurrency-20261007 test rows, then verified staging users/orders/referral accounts/rewards were all zero. This is one duplicate-order race test, not a load test or a cross-referral lock-cycle proof.

Repository deployment notes identify AI Studio/Cloud Run, but do not establish the current project/service ID or provide deployment access. No matching Cloud Run connector was found in the available plugin search. Still required before live cutover: running-service access and local referral export/reconciliation, current revision/source verification, sandbox end-to-end browser/payment checks and coordinated production migration/deployment. PR remains draft. Production data and schema remain unchanged.
