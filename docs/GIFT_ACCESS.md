# Gift Pro Access operations

Owner UI: **Settings → Admin Engine → Gift Pro Access**. Verify the current owner PIN (15-minute elevation); server authorization remains mandatory even when the section is visible.

## Release order

1. Apply the additive `supabase/migrations/20261026192403_gift_pro_access.sql` on an isolated/staging database first. It creates service-only invite/audit tables and updates the existing connector's explicit Pro predicate. An unexpected connector contract fails the migration instead of silently omitting gift access. Apply after existing payment/security and connector migrations; never edit applied history.
2. Check table RLS, function EXECUTE privileges and service-role-only access. No anon/authenticated table/RPC rights are required. This app uses Firebase identity at the Express boundary, not a browser-supplied database UID.
3. Verify the existing server-only RESEND_API_KEY and the verified BSE Nexus sender domain. Gift sends do not fall back to onboarding@resend.dev. Check the production provider's tracking configuration preserves the fragment link. Provider acceptance is not inbox-delivery confirmation. No real email is sent by automated tests.
4. Enable `GIFT_ACCESS_ENABLED=true` in server secrets only after schema checks; deploy/publish the runtime. Until then the feature returns an explicit unavailable response and existing paid/trial access continues on its existing paths.
5. Verify one controlled mailbox through actual Firebase sign-in, email verification, preview, explicit activation, billing, protected website/connector reads, revoke and independent paid access. Local fixtures do not prove a live provider flow.

## Rules

- Disabled gifts return JSON `409 GIFT_ACCESS_DISABLED`; real store outages remain `503`. HTML startup pages, even HTTP 200, are failed transport (`API_NON_JSON_RESPONSE`): retain drafts, block writes and explicitly refresh after readiness. No uncertain email/access change is confirmed. Development defaults to port 3000; stop the old process before restarting after sync and reload once ready. Production respects platform PORT.

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

## Preview errors after syncing code

The admin panel calls `/api/gifts/admin`. A JSON `API route not found` (404) means the connected HTTP server has not exposed that path. It does not mean an email API key is missing. Current code deliberately returns 503 `Gift access is not enabled yet.` when its flag is off; an enabled route without a login returns 401. Database/sender setup and admin PIN failures have separate responses.

After pulling a backend change into AI Studio, stop/start its existing preview process once and reload the preview document. The development command uses one Node process with the existing tsx loader. It deliberately stays alive during edits; adopt backend changes with one explicit restart followed by a fresh preview document. Automatic process watching is unsuitable for this HMR-disabled preview because it can close Vite while a lazy module is loading. It does not enable Vite HMR or change the production `npm start` command. Never launch a second server on the same port. A browser refresh alone cannot replace an already running backend process.

If `VITE_API_BASE_URL` is configured, the preview's API requests go to that server. Update/restart that target rather than changing the browser to a different origin as a workaround. Do not paste service keys into frontend code. The admin panel preserves drafts, identifies a missing Gift server and disables changes until a read succeeds; no send is retried automatically.

The outer Google AI Studio `There was an issue while sharing your applet` banner is a separate platform operation. App API success cannot prove sharing works. Investigate its own failed request/status and editor logs; do not restore an old app or delete files based only on the banner. Google staff's 27 October discussion describes several distinct causes, including sandbox state, invalid virtual file paths and syntax errors: https://discuss.ai.google.dev/t/ai-studio-keeps-saying-the-service-is-temporarily-unavailable-please-try-again-and-there-was-an-issue-while-sharing-your-applet/187622 . The GitHub tree uses relative paths; AI Studio's private virtual workspace and sharing request remain unverified here.
