# Gift Pro Access — 27 October 2026

## Scope and source

- Initial source: main ec3cd17f52e07d8f7ddcab6f2ba41d1dd6ac2fbb, reconstructed and verified from GitHub blobs. Final branch uses main ae9a5b2b0da2f88987e8c57d3423c2a3a0bdba30 and preserves its dependency-lock repair. Unrelated source and assets remain upstream blobs.
- Owner workflow: Settings → Admin Engine → Gift Pro Access. Owner PIN elevation, email, 1–3650 access days, 1–30 claim days (default seven), internal note, review/send, paginated history, resend and revoke.
- Recipient workflow: canonical /activate-gift fragment link → invited verified Firebase account → preview → explicit confirmation. Opening a link cannot activate it. Same verified email and session UID are required; account-keyed UI rejects stale results.
- Gift starts at successful claim, runs alongside other access and never extends or overwrites paid/trial records. One immutable invite produces one grant; a new owner-approved invitation is a separate grant.

## Contracts and reviewed consumers

| Boundary | Disposition and evidence |
| --- | --- |
| Identity/admin | Changed: server/api/giftAccess.ts reuses requireAuth/requireAdmin, same-owner PIN elevation and fresh revoked-token-aware Firebase verification; API tests exercise wrong UID, unverified/ordinary users and request tampering. MFA enrollment is not added by this feature. |
| Durable state | Changed: service-only gift_access_invites/events and gift_access_command own duration, email, token hash, idempotency and atomic redemption. No raw token storage, public RPC/table access or account-delete cascade. |
| Paid/trial/referrals | Reviewed-and-compatible: separate tables/read-only projection; no payment order, receipt, reward or profile grant is written. SQL/API projection tests preserve paid expiry and reject replay/recreated-account redemption. |
| Website/profile/billing | Changed: subscriptionAccess projection feeds auth/profile responses, protected routes, billing and shared progress consumers. Gift labels and actual duration replace the incorrect trial label. Existing paid progress/source remains independent. |
| AI/quota/connector | Changed: live access projection reaches tool state and quota; forward migration checks and patches the exact connector transactional Pro predicate. Actual connector migration fixture verifies grant/revoke. |
| Personal Telegram | Changed: recipient entitlement is reread at dispatch rather than trusting a cached profile. Existing user toggle and verified chat binding remain authoritative. Raw filing ingestion is independent of gift reads. |
| Email/retry | Changed: verified sender required; accepted/failed/unknown are distinct. Immutable creation IDs, durable operation receipts, one-minute resend cooldown, rotated hashes and 50-new-invites/24h budget. No automated resend after uncertain outcomes. |
| Browser privacy/navigation | Changed: capture/clear fragment before optional telemetry, exclude activation from telemetry/push/SW cache, no-store/noindex/referrer headers, safe same-document reopening. Existing home/settings navigation and payment return flow reviewed. |
| Styles/state | Changed: scoped gift-access.css, existing theme tokens and lazy boundaries, owner/account keyed state, retry/preserved drafts and explicit revoke confirmation. Browser fixtures verify narrow phone through desktop, dark state and keyboard claim. |
| Deployment | Blocked on production release prerequisites and sender configuration; feature defaults off. Tests and merge do not prove deployment or inbox delivery. |

## Verification

- Initial impact: npm run map:impact -- server/security/auth.ts server/api/payments.ts src/components/SettingsTab.tsx src/components/SubscriptionCard.tsx. Follow-up impact: src/components/GiftActivationPage.tsx scripts/verify-gift-access.mjs. Manual route, context, CSS, background job, RPC, privacy and billing traces above supplement the map.
- This restored session initially had dependency symlinks pointing to an unavailable old workspace. That attempted suite did not execute application tests. Restored the latest main lock unchanged, then clean npm ci --ignore-scripts --no-audit --no-fund installed 661 packages; manifest/package versions were not changed.
- NODE_ENV=test JWT_SECRET=<disposable offline fixture> npm test: 842 tests, 32 suites, 842 pass, zero failures/skips, 41.01 seconds. External network is blocked by the existing routine-test guard. Includes SQL, API, actual connector, payment/referral/auth/quota regression suites.
- npm run lint passed with TypeScript 5.8.3. npm run map:generate and map:check passed; six map tests passed. npm run build --ignore-scripts passed; startup budget 621030 raw / 173793 gzip bytes across one entry. Existing bundle warning retained. Host compile_applet/lint_applet tools are unavailable.
- Real Gift components/CSS in Chromium: 320/390/768/1440 px all pass. Review cannot send; explicit create, revoke confirmation, error/retry, guest sign-in, preview before claim, keyboard claim, wrong-account switch, refresh/reopen, no overflow and zero page errors. APIs/auth are synthetic adapters, with external requests blocked. This does not certify live Firebase/mail providers.
- Final review reproduced an existing-paid-user preview crash: toLocaleDateString rejected timeStyle. Changed it to toLocaleString and exercised a future paid expiry in every browser width before activation. Browser regression is also added to development-preview CI.
- Staging migration history confirms gift_pro_access version 20261026192403 installed. Fresh read-only privilege checks confirm both gift tables have RLS; anon/authenticated have no helper EXECUTE; service_role does; functions are SECURITY INVOKER. Rolled-back service_role transaction exercises create, wrong email, duplicate claim/same expiry, exact 30-day duration and revoke. No fixture survives rollback and no email is sent.
- Staging security advisor returned existing INFO-only RLS-without-policy notices on other service-only tables; no gift-table warning. Do not add public policies to silence those notices. Reference: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy.

## Release and recovery

- Read-only production check on 27 October: claim_trial_atomic(text,text,text), auth_account_command(text,text,integer,bigint,bigint) and gift_access_command(text,text,jsonb) are absent. Existing mutate_ai_account is present. The prior deep_audit_security production release must precede gift enablement. No production migration or real mail was executed during this task.
- Verify server-only RESEND_API_KEY and verified sender domain; check provider tracking preserves fragment links. After required migrations, enable GIFT_ACCESS_ENABLED=true and publish the runtime. A controlled mailbox/Firebase sign-in, billing/protected read, revoke and paid-access preservation still need live verification.
- Rollback: disable GIFT_ACCESS_ENABLED for runtime sends/claims/gift eligibility, retain invite/audit history; never roll back paid/trial facts. Do not drop tables while connector SQL references them. See docs/GIFT_ACCESS.md.
- Local implementation and browser/SQL checks are complete. Commit, remote CI, merge and publication are reported independently on the PR; nothing in this record claims a production deployment.
- Final development runtime browser check passed at 390/768/1440 px: cold Settings, retained lazy tabs, CSS and Sentry, one React graph, zero runtime errors/HMR sockets. Gift fixture uses the installed Chromium executable explicitly; default Playwright executable was absent locally. Final map check: 576 source files, 1538 import edges, 27 semantic domains.
