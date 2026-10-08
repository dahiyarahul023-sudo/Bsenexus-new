# Alert presets, persistence and evaluation

Starting main: 2c18c01965b7edcec6b7deae8310615dae01f3dd. Separate from referral PR 14.

Observed: screenshots show off switches returning on and 10 rules becoming 13 after save. AlertRulesModal POSTs three new IDs on every save, ignores HTTP failures and reads the first category match (system defaults). DAO cloud writes are fire-and-forget and reads/evaluation use process-local cache restored once. Symbol matching compares a ticker with a company name. Global filing inbox records bypass personal rules. Live read-only database check: alert_rules exists with id PK, user_id FK, rule JSONB and RLS; 26 rows / 5 owners, all exact old preset names. No new table is required for stable preset IDs.

Acceptance: save repeatedly without growing effective presets; off/scope/channels persist on reopen; custom rules separate from presets and editable; checked durable writes and reads across instances; snapshot refresh before monitor processing; ticker/scrip, category and channel matching; preserve master Telegram/Pro/mute gates. Keep historical rows intact and deduplicate the effective view. No real notification sent during testing.

## Implemented contract

- `alert.presets.save`: both Layout entry points and SettingsTab use the same modal. One PUT writes all three canonical presets with stable owner-derived IDs. Repeated saves preserve off/scope/channels and do not add effective rules. Canonical values override retained historical duplicates; old rows are not deleted.
- `alert.custom.save/toggle/delete`: custom rules have stable retry IDs, validation, checked persistence, ownership filters and an Edit action. Presets and system defaults are excluded from the custom tab/count. The modal checks HTTP/body failures, shows errors, preserves failed-save drafts and discards responses after close/account change. Controls are disabled during saves.
- Server GET reads the database directly; monitor refreshes a paginated snapshot before each processing cycle. Storage failure is visible and does not claim a local-only success. Non-production unconfigured development retains local fixtures.
- Ticker/scrip matching uses the existing stock resolver; corporate presets cover buybacks/rights as advertised and all declared custom categories are evaluated. Explicit preset channel choices replace inherited filing preference defaults. Telegram master/Pro/link/age gates and inbox mute are retained. A removed watchlist stock is rechecked for eligibility, allowing independent all-market/custom matches.
- Global filing inbox insertion previously made global-watchlist matches visible to all users. New filing inbox entries are recipient-specific. Existing historical system records and general broadcasts are preserved. Admin Telegram and OneSignal remain independent paths.

## Consumers

| Consumer | Disposition |
| --- | --- |
| AlertRulesModal, API and shared alert model | Changed: one preset contract, custom separation/editing and confirmed lifecycle |
| SettingsTab and Layout entry points | Reviewed-compatible: both mount the shared modal; no separate save path |
| Monitor and alert decision helper | Changed: fresh snapshot, symbol matching, channel precedence and recipient inbox records |
| NotificationInbox / notification DAO | Reviewed-compatible: existing private IDs and read receipts are used; prior shared records retained |
| AuthContext/customFetch/service worker | Reviewed-compatible: verified UID required, cancellable requests, no-store; SW already excludes alert-rules |
| Telegram/news/admin/OneSignal | Master/entitlement gates retained; news/admin/push independent of this filing preset UI |
| Supabase alert_rules | Existing table inspected; PK/FK/JSONB/RLS present. No schema mutation or data deletion necessary |

## Verification and delivery

Completed local verification: `NODE_ENV=test JWT_SECRET=<test-only> npm test`: 278/278 passed (30 suites); 14 added regression/API/decision tests. `npm run lint` passed; `npm run build` passed (existing large-chunk warning only). `npm run test:map`: 6/6 passed; map generation/check and `git diff --check` passed. The build-only version bump was restored before delivery. Legacy-duplicate regression initially failed with an older enabled value winning; corrected selection now passes. Browser verification remains unavailable: no Chromium executable in this workspace; earlier cloud browser could not reach the local harness and installation was blocked. No actual Telegram, push or email was sent. Live database inspection was read-only (26 legacy preset rows across five owners; monitor enabled, Telegram enabled, inbox unmuted). All four required tables were confirmed present: alert_rules, notifications, user_notification_receipts and user_notification_inbox_state. That does not prove the deployed runtime uses the same environment or that exchange/provider delivery is healthy.

## Limits and rollout

Backend/frontend must ship together. This is not a durable notification outbox redesign: existing monitor processing/delivery checkpoints and provider retry semantics still need a separate live-runtime assessment. Saved filters apply to newly received filings; no historical replay or promise of every exchange filing is made. Browser interaction, real multi-instance provider delivery and live deployment are not certified by mocked transport/API tests. Host `compile_applet`/`lint_applet` are unavailable.

Upstream advanced during work to 801a506e7f6cdcec25c48e1ee4ad63fd0f7b19d4 (market guide content only). That change is preserved. The upstream lockfile had dropped PGlite despite its declared dependency and existing SQL tests; restore its pinned lock entry so clean installs retain the existing test dependency. This branch is separate from referral PR 14.



Rollback: revert this frontend/server change together; retain all alert rows. Older code will again select built-in defaults and may add duplicate presets, so rollback is not a data cleanup. No schema rollback is required. New saves use existing columns and preserve historical rows. Deployment status: prepared for a GitHub branch/PR, not merged or deployed during verification.
