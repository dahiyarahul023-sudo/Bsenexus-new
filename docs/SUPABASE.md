# Authentication and data storage

Firebase and Supabase serve different roles in this app. Supabase Auth is not
used for user sign-in. Firebase Auth supplies the verified UID used to scope
server-side Supabase operations.

| Data or operation | Current code path | Store |
| --- | --- | --- |
| Google / email-password / anonymous sign-in | `src/firebase.ts`, `src/context/AuthContext.tsx` | Firebase Authentication |
| ID token verification and app JWT cookie | `server/security/auth.ts`, `firebaseAdmin.ts` | Firebase Admin SDK; server-signed cookie |
| Profiles, preferences, trial and tier fields | `server/database/usersDao.ts` | Supabase `users`; local JSON cache |
| Watchlists | `server/database/watchlistDao.ts` | Supabase `user_watchlists`; local JSON fallback |
| Announcements | `server/database/announcementDao.ts` | Supabase `announcements`; local JSON fallback |
| Alert rules | `server/database/alertRulesDao.ts` | Supabase `alert_rules`; confirmed durable reads/writes; local JSON only for unconfigured non-production development |
| Notifications | `server/database/notificationDao.ts` | Supabase `notifications`; local JSON fallback |
| User notes | `server/database/notesDao.ts` | Supabase `user_notes`; local JSON fallback |
| Settings, logs, feedback | Their corresponding DAOs | Supabase `settings`, `logs`, `feedback`; local JSON fallback |
| Account lockouts / failed-attempt counters | `server/security/accountRateLimiter.ts` | Supabase `auth_account_limits`; local JSON fallback |
| Results calendar synchronization | `server/services/resultsCalendarService.ts` | Supabase `results_calendar`; service cache |
| Sent news-alert deduplication | `server/services/stockNewsService.ts` | Supabase `sent_news_alerts`; local JSON cache |
| Payment orders and entitlements | `paymentOrdersDao.ts`, `paymentEntitlementsDao.ts` | Supabase `payment_orders`, `payment_entitlements` |
| Manual storage-mode persistence/recovery | `server/database/firebase.ts` | Firestore `system_config/storage_mode` |
| Diagnostics events | `server/database/diagnosticsDao.ts` | Local `data/diagnostics.json` |
| Error reports | `src/lib/sentry.ts` | Sentry when a DSN is configured |

## Request flow

1. The browser signs in through Firebase Auth; passwords are handled by Firebase.
2. The browser sends the Firebase ID token to `POST /auth/session`.
3. Firebase Admin verifies the token. Anonymous identities cannot receive app
   sessions. Owner privileges require the verified owner email in token claims;
   a body-supplied email cannot grant privileges or inherit another account's role.
4. The server reconciles paid entitlements and reads the profile durably from
   Supabase, then issues a seven-day JWT in an HttpOnly cookie.
5. `src/api.ts` sends the current Firebase token as a Bearer header and includes
   cookies. The server checks authentication and authorization before using its
   privileged Supabase client. Bearer credentials take priority over the cookie.

Firebase ID tokens are currently also cached in browser localStorage; server
JWTs are returned in the session response and set in a cookie. Logout clears
the cookie and browser caches; it does not revoke previously issued JWTs.
Older app cookies without verified-email claims require a new session exchange
or sign-in; this also invalidates anonymous sessions minted by the old fallback.

## Configuration and durability

- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` enable the server-only client.
  The service-role key bypasses RLS and must never be placed in a `VITE_*`
  variable or browser code. Backend route authorization remains necessary.
- `JWT_SECRET` is mandatory. Firebase Admin credentials are separate from the
  public Firebase browser configuration. Configure secrets in the hosting
  environment, not in committed files.
- General application DAOs can use local JSON when Supabase is unavailable.
  These files live under `data/` and Cloud Run disk is revision-local: local
  data is not a durable backup across redeployments.
- Payment-critical operations and durable profile reads fail closed with a
  retryable error when Supabase cannot be reached. They must not silently
  mark a payment successful using only local files.
- Firestore quota/manual-mode controls remain in the code, but do not switch
  the migrated Supabase DAOs into Firestore. The database migration is partial.

This mapping describes repository behavior. It does not verify the deployed
environment variables, existing Supabase rows, or applied database migrations.

## Development startup

The server honors `PORT` (default `3000`). Vite HMR shares the HTTP listener,
so it does not need a separate listener on port `24678`. `DISABLE_HMR=true`
disables HMR. If the HTTP port is occupied, startup closes Vite and exits with
an actionable error instead of leaving a second worker process running.
Stop the duplicate preview process or configure a free port, then restart.

## Alert settings — 2026-10-08

The existing `alert_rules(id text primary key, user_id text references users(uid), rule jsonb, created_at timestamptz)` table supports both presets and custom rules. This change requires no new table or DDL. Live schema was checked read-only. Presets use three deterministic IDs derived from verified UID and preset key, written in a single bulk upsert. Existing duplicate generated presets remain archived in the table; effective reads choose the latest per owner/key, with canonical saves taking precedence. New custom-rule IDs remain stable across retries and updates/deletes filter ownership. Do not delete historical rows as a prerequisite for release.

Ship the frontend and server together: the UI now uses `PUT /api/alert-rules/presets`. Reads and writes fail with a visible 503 when configured durable storage is unavailable. The filing monitor reads a fresh paginated rule snapshot before processing new filings; it does not rely on startup-only cache restoration. Global filing inbox broadcasts are replaced by recipient-specific entries. General system notices and admin Telegram remain separate.
