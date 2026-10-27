# Gift Pro Access operations

Owner UI: **Settings → Admin Engine → Gift Pro Access**. Verify the current owner PIN (15-minute elevation); server authorization remains mandatory even when the section is visible.

## Release order

1. Apply the additive `supabase/migrations/20261026192403_gift_pro_access.sql` on an isolated/staging database first. It creates service-only invite/audit tables and updates the existing connector's explicit Pro predicate. An unexpected connector contract fails the migration instead of silently omitting gift access. Apply after existing payment/security and connector migrations; never edit applied history.
2. Check table RLS, function EXECUTE privileges and service-role-only access. No anon/authenticated table/RPC rights are required. This app uses Firebase identity at the Express boundary, not a browser-supplied database UID.
3. Verify the existing server-only RESEND_API_KEY and the verified BSE Nexus sender domain. Gift sends do not fall back to onboarding@resend.dev. Check the production provider's tracking configuration preserves the fragment link. Provider acceptance is not inbox-delivery confirmation. No real email is sent by automated tests.
4. Enable `GIFT_ACCESS_ENABLED=true` in server secrets only after schema checks; deploy/publish the runtime. Until then the feature returns an explicit unavailable response and existing paid/trial access continues on its existing paths.
5. Verify one controlled mailbox through actual Firebase sign-in, email verification, preview, explicit activation, billing, protected website/connector reads, revoke and independent paid access. Local fixtures do not prove a live provider flow.

## Rules

- One invitation targets one exact normalized (trim/lowercase) verified email. Do not remove dots or plus aliases. Current Firebase token identity must match the website session UID; role/email/duration fields from the request cannot grant access.
- Owner chooses 1–3650 access days and 1–30 claim days (default 7). Duration starts on confirmed claim, using database time. A first-login trial may overlap independently.
- Gift access runs alongside existing access: effective access uses the latest valid expiry, never a sum of gift durations. Paid orders, receipts, referral rewards and ordinary user access records are untouched. A new owner-approved invite is a separate grant, never a public reusable promotion code.
- Repeated/parallel claims return the original grant and expiry. Expired or revoked gifts cannot be revived by replay or account deletion/recreation. Invite/audit records have no user-delete cascade and no automatic expiry purge.
- Creation request IDs have immutable inputs. If the response is uncertain, refresh history and retry the same creation request; do not blindly create another invitation. Resend intentionally rotates the verifier, invalidates the previous link and preserves the original deadline. There is a one-minute resend cooldown and 50-new-invites/rolling-24-hour owner budget.
- Delivery is pending/accepted/failed/unknown; a timeout is not a sent or activated success. A failed/unknown send can be resent explicitly. Resend/revoke have separate durable operation receipts. No automated retries rotate tokens.
- Revoke blocks subsequent gift-authorized requests; already authorized/in-flight operations are not undone. Paid/trial access remains independent. Personal Telegram entitlement checks re-read gift access before dispatch rather than trusting the monitor's cached user snapshot; raw exchange ingestion does not depend on gift storage.
- Raw activation secrets exist only in the email and browser/server request memory. Database stores SHA-256 verifiers. The canonical HTTPS link uses a fragment, removed before optional telemetry; activation excludes Clarity/Sentry/client telemetry/push startup and offline caching. Reopening after reload is supported; no token is saved to browser storage.
- Never log request bodies or raw invite links. Audit records retain actor, operation and time, not tokens. Existing server/session compromise remains outside an invite token's protection.

## Recovery / rollback

Disable GIFT_ACCESS_ENABLED to stop new sends/claims and runtime gift eligibility while diagnosing a release; this also temporarily pauses existing gift-only access. Keep the tables and audit history. Re-enable only after verification. Paid/trial data is never rolled back. Do not drop the gift tables while the connector predicate references them; a schema rollback needs a forward migration restoring that predicate first.
