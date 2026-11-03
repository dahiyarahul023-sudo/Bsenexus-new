# UX batch 1: truthful access, inbox recovery and result status

- Starting upstream: 860a03bfdef0994cfe0e75874ef1aee40784b3e9. Isolated local snapshot has every upstream text blob hash-verified; existing uncommitted work elsewhere is untouched.
- User objective: implement the approved audit in coherent sections, preserving current functionality. This batch completes the status-display section (F01–F03); navigation, classification and visual changes remain separate batches.
- Verified facts: SubscriptionCard assumes no last payment means trial, even for an administrator, and uses a historic expiry in SubscriptionProgress. AuthContext fabricates a fresh 365-day admin expiry. CompanyIntelligenceModal ignores upcomingEvent.isDeclared and always renders Scheduled. NotificationInbox combines a failed read with a no-saved-data message and lacks in-place Retry.
- Live database read: notifications, user_notification_receipts and user_notification_inbox_state exist, have RLS and service-role SELECT. Sampled notification-related log requests were successful. This does not establish the root cause of the live inbox request failure; no production schema/data writes are needed or made in this batch.
- Source of truth: existing server access and event evidence. No prices, duration policy, quotas, grants, delivery or result evidence rules change.
- Impact: npm run map:impact -- src/components/SubscriptionCard.tsx src/components/NotificationInbox.tsx src/context/AuthContext.tsx src/components/SettingsTab.tsx src/components/CompanyIntelligenceModal.tsx server/api/payments.ts server/database/notificationDao.ts. Reviewed commerce, session, feed-alerts, company results and gift-access domains.
- Acceptance: admin access has no invented expiry/trial/payment; ordinary paid/trial/gift expiry stays intact; read failures are distinct from empty and retry in place; previous same-owner content remains usable on refresh failure; declared results cannot display Scheduled.
- Entry points: Settings billing/profile refresh; Layout inbox/header/count; Company Hub opened from search, Watchlist or Calendar. Existing overlay/focus/scroll owners remain.
- Consumer dispositions and validation: to be completed with implementation evidence below.
- Deployment: source-only change; no migration required. Publishing and production verification remain separate. Roll back this batch as a unit.

## Implementation and consumer dispositions

| Consumer | Disposition and evidence |
|---|---|
| SubscriptionCard / subscriptionPresentation | Changed: server isPro and effective access expiry determine the view. Admin has no countdown/trial/upgrade claim; gift/paid/trial remain distinct; absent gift details cannot crash or fabricate a seven-day gift. Unknown reads never appear Free. Card and payment history remount per user identity. |
| AuthContext hydration / Settings billing index | Changed: preserve server subscriptionAccess; remove invented admin 365-day expiry; admin days-left display is suppressed, with explicit Administrator access in Settings. Owner/admin isPro rules remain unchanged. |
| UserProfileModal / Layout / AI gates | Reviewed-and-compatible: Profile already labels administrator first; Layout does not display proDaysLeft; paid/gift/ordinary profile gates retain their original rules. Presentation helper never persists or grants access. |
| Payment status / subscriptionAccess / Cashfree grants, receipts, history | Reviewed-and-compatible: existing response fields are consumed, no API contract, storage, grants, prices, claims or receipt records changed. Administrator fallback is display-only and still requires server isPro. |
| NotificationInbox / notificationSnapshots | Changed: loadError separate from mutation feedback; cold read failure has one explicit Retry, no false empty state; successful empty is distinct; transient failed refresh retains confirmed items; 401/403 clears private snapshots. Owner/request sequence guards remain. |
| Layout unread controller / read and mute operations | Reviewed-and-compatible: retained same-owner mounting, optimistic count reconciliation and confirmed mutation paths are unchanged. Retry invokes only the existing read. No additional interval or subscriber introduced. |
| Notification API / DAO / durable receipts | Reviewed-and-compatible: schema/permissions exist; no root-cause claim or production repair is inferred from successful DB samples. No fallback that conceals a storage failure was introduced. |
| Company Hub / Calendar / Watchlist | Changed Hub only: isDeclared now controls Declared / Latest result versus Scheduled / Next Catalyst and suppresses an upcoming countdown for a declared result. Calendar/Watchlist already consume verified declaration evidence and are compatible. No result classification change. |

## Verification and release boundaries

- Full offline suite with CI NODE_ENV/JWT test configuration: 992/992 tests passed (34 suites). An initial run omitted that configuration and exposed the known ephemeral-JWT test setup mismatch; the correctly configured run passed without changing security tests.
- New coverage: four subscription-source/duration tests plus four actual component SSR scenarios covering cold failure, successful empty versus refresh failure, administrator billing, and declared versus scheduled company UI. Existing optimism, freshness and expiry regressions also pass. Final focused rerun recorded in handoff.
- npm run lint passed. npm run build passed, including the unchanged startup-byte budget. Generated version bump reverted as required by src/version.ts. npm run test:map passed 6/6; generated maps refreshed and map:check passed.
- Interactive browser: BLOCKED. Local fixture server starts, but cloud browser refused localhost and then rejected reload under its security policy. No workaround, alternative browser execution, screenshot or interactive pass is claimed. Actual component SSR is additional evidence, not a substitute for browser/device checks.
- Local fixture server is explicitly isolated, uses synthetic access/API records and denies all writes. It is not registered as a production route.
- compile_applet and lint_applet are not installed in this environment; configured lint/typecheck and production build were used and are reported separately, not relabelled as those host checks.
- F01/F03 source defects and F02 presentation/recovery are implemented. F02's production API failure remains an open runtime verification item. Physical phone, live payment/delivery and deployed status are unverified.
- No production data/schema, hosting configuration, real payment, AI quota consumption or outbound notification changed.
