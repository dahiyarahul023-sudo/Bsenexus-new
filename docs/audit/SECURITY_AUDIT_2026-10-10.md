# Bsenexus Security Audit — 2026-10-10

Auditor: Security Auditor (Explore sub-agent)
Scope: NEW code (Supabase, Sentry, Resend, Announcement scheduler, Avatars, UI visuals) +
       regression check of previous SEC-001..SEC-013 fixes + all the
       PageSpeed-confirmed Trust & Safety items (CSP, HSTS, COOP, XFO, Trusted Types,
       console errors, source maps).

Findings: 18 issues (4 CRITICAL, 5 HIGH, 6 MEDIUM, 3 LOW).
All previous fixes from the 1 Oct 2026 audit are STILL in place (no regressions),
except for a minor currency-comparison regression noted as SEC-108.

---

## CRITICAL

### SEC-101 — All HTTP security headers disabled (CSP, HSTS, COOP, XFO, CORP, COEP)
- **Severity:** CRITICAL
- **File:** `server.ts:88-95`
- **Description:** `helmet` is mounted with **every** protective header explicitly turned off:
  ```ts
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    frameguard: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
  }));
  ```
  The Cloudflare `_headers` file (`public/_headers`) only sets
  `X-Content-Type-Options: nosniff` and `Referrer-Policy`. None of the
  PageSpeed-required headers (CSP, HSTS, COOP, X-Frame-Options, Trusted Types)
  are emitted anywhere.
- **Impact:**
  - **No CSP** → any injected `<script>` runs (XSS); `javascript:` URIs work;
    inline event handlers fire; remote scripts can be loaded.
  - **No HSTS** → first-visit HTTP downgrade / SSL-strip possible.
  - **No COOP** → `window.open()` cross-origin references enable
    Spectre-class side-channels and clickjacking-by-proxy.
  - **No X-Frame-Options / `frame-ancestors`** → entire site is clickjackable.
    An attacker can render bsenexus.in inside an invisible iframe and trick
    the user into clicking payment / "grant Pro" / "delete account" buttons.
  - **No Trusted Types** → DOM XSS sinks (`innerHTML`, `document.write`,
    `eval`) are unenforced — a single future bug becomes a critical XSS.
- **Fix (server.ts):** replace the disabled helmet block with an explicit,
  strict configuration. Keep it tight enough not to break the existing
  inline-service-worker handler and the SSR HTML, but lock down everything else.

```ts
// server.ts — replace lines 88-95
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        // OneSignal + Firebase + reCAPTCHA push their own inline bootstrap scripts.
        // Lock these to specific hosts; do NOT use 'unsafe-inline'.
        "'unsafe-inline'",            // TODO: replace with nonce/hash per-route (see SEC-110)
        "https://cdn.onesignal.com",
        "https://www.gstatic.com",
        "https://www.google.com",
        "https://www.googletagmanager.com",
      ],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:"],          // avatars live on /avatars/v1/*
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      connectSrc: [
        "'self'",
        "https://api.bseindia.com",
        "https://onesignal.com",
        "https://firebaseinstallations.googleapis.com",
        "https://firestore.googleapis.com",
        "https://www.googleapis.com",
        "https://recaptchaenterprise.googleapis.com",
        "https://o4512192922255360.ingest.de.sentry.io",   // Sentry EU
      ],
      frameSrc: [
        "'self'",
        "https://www.google.com",         // reCAPTCHA iframe
        "https://bseindia.com",
      ],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],         // clickjacking — equivalent to XFO: DENY
      requireTrustedTypesFor: ["'script'"],  // SEC-105 — Trusted Types enforcement
      upgradeInsecureRequests: [],
    },
  },
  // HSTS — 1 year, include subdomains, preload-ready
  strictTransportSecurity: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  crossOriginOpenerPolicy: { policy: 'same-origin' },     // SEC-104 — COOP
  crossOriginEmbedderPolicy: { policy: 'credentialless' }, // works with credentialless fetches; can switch to 'require-corp' later
  crossOriginResourcePolicy: { policy: 'same-site' },
  frameguard: { action: 'deny' },                          // defense-in-depth alongside CSP frame-ancestors
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xContentTypeOptions: true,
  xDnsPrefetchControl: { allow: false },
}));
```

Also append to `public/_headers` so Cloudflare serves the same headers on
fully static assets that never hit Express:

```
/*
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: credentialless
  Cross-Origin-Resource-Policy: same-site
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
```

### SEC-102 — Trusted Types not enforced (DOM-based XSS mitigation missing)
- **Severity:** CRITICAL (only because the PageSpeed brief explicitly calls it out
  alongside CSP; otherwise MEDIUM until the rest of CSP lands)
- **File:** `server.ts:88` (helmet config) + `src/components/ui/CommonQuestionsFAQ.tsx:79`
- **Description:** No `require-trusted-types-for 'script'` directive is set, so
  DOM sinks (`innerHTML`, `document.write`, `eval`, `new Function()`,
  `element.outerHTML = …`) are unguarded. The codebase already has one
  `dangerouslySetInnerHTML` (`CommonQuestionsFAQ.tsx:79`) where the data is
  `JSON.stringify(faqSchema)` — `JSON.stringify` does NOT escape `<` or `>`,
  so a future FAQ entry containing `</script><script>alert(1)</script>` would
  break out of the `<script type="application/ld+json">` tag and execute.
- **Impact:** A single future bug — a new FAQ entry, a SSR template mistake,
  an AI-generated summary that slips into the DOM — becomes an immediately
  exploitable XSS because there is no policy gate.
- **Fix:**
  1. Land the CSP directive `requireTrustedTypesFor: ["'script'"]` from SEC-101.
  2. Add a minimal Trusted Types policy at app boot (`src/main.tsx`):

```ts
// src/main.tsx — before any other import
if (typeof window !== 'undefined' && 'trustedTypes' in window) {
  try {
    (window as any).trustedTypes.createPolicy('bsenexus-default', {
      createHTML: (s: string) => s,     // escape hatch — narrow later
      createScript: (s: string) => s,
      createScriptURL: (s: string) => s,
    });
  } catch { /* policy already created */ }
}
```

  3. In `CommonQuestionsFAQ.tsx`, harden the JSON-LD injection so a stray
     `</script>` cannot break out:

```ts
const faqJson = JSON.stringify(faqSchema)
  .replace(/</g, '\\u003c')      // stops </script> breakout
  .replace(/>/g, '\\u003e')
  .replace(/&/g, '\\u0026');
// then:  dangerouslySetInnerHTML={{ __html: faqJson }}
```

### SEC-103 — Firebase App Check defined but never mounted on any route
- **Severity:** CRITICAL
- **File:** `server/security/auth.ts:174-192` (defines `requireAppCheck`) — never
  imported or used anywhere in `server/api/routes.ts`, `server/api/payments.ts`,
  `server/api/referrals.ts`, `server/api/notes.ts`, `server/api/faq.ts`, or
  `server.ts`. Confirmed via grep: only the definition site matches.
- **Description:** The middleware is a no-op until `FIREBASE_APPCHECK_ENFORCE=true`,
  and even then it is not attached to any route. Clients (including attackers
  with stolen auth cookies) can hit every API endpoint with no App Check token.
  reCAPTCHA Enterprise is enforced only on `/auth/session` and `/auth/login`
  (`server/security/auth.ts:312, 537, 674`) — **0 other endpoints** verify a
  reCAPTCHA token.
- **Impact:** Bot-friendly API surface. Attackers can:
  - Spam `POST /api/feedback` to flood admin Telegram (only `apiRateLimiter`
    applies, 300/min/IP — trivially rotated across IPs).
  - Spam `POST /api/telemetry/event` with `type:ERROR` to trigger admin
    crash alerts (`triggerCrashTelegramAlert`) — DoS on the admin's phone.
  - Probe `POST /api/payments/create-order` for plan/referral-code combos.
  - Hammer `POST /api/announcements/:id/generate-summary` (only `aiRateLimiter`
    20/min/IP applies; the Gemini quota is the real backstop, not anti-abuse).
- **Fix:**
  1. Mount `requireAppCheck` on every state-changing public endpoint. The
     minimum viable rollout is to attach it to the routers that mutate user
     state or call AI:
     ```ts
     // server/api/routes.ts — replace the router mounts (lines 104-116)
     apiRouter.use("/seo",        requireAdmin, aiRateLimiter, requireAppCheck, seoRouter);
     apiRouter.use("/payments",   requireAppCheck, paymentsRouter);
     apiRouter.use("/referrals",  requireAppCheck, referralsRouter);
     apiRouter.use("/notes",      requireAppCheck, notesRouter);
     apiRouter.post("/feedback",                 requireAppCheck, apiRateLimiter, /* … */);
     apiRouter.post("/telemetry/event",          requireAppCheck, aiRateLimiter, /* … */);
     apiRouter.post("/client-log",               requireAppCheck, requireAuth, /* … */);
     apiRouter.post("/announcements/refresh",    requireAppCheck, requireAuth, aiRateLimiter, /* … */);
     apiRouter.post("/announcements/:id/generate-summary", requireAppCheck, requireAuth, aiRateLimiter, /* … */);
     apiRouter.all("/company-intel/:identifier/ai-overview", requireAppCheck, requireProOrAdmin, aiRateLimiter, /* … */);
     ```
  2. In production, set `FIREBASE_APPCHECK_ENFORCE=true`. The middleware
     already fails closed when enforcement is on, so a missing/invalid token
     returns 401. Document this in `docs/SUPABASE.md`.
  3. Add reCAPTCHA verification to `POST /api/feedback` (admin-Telegram-spam
     channel) and `POST /api/telemetry/event` (admin-Telegram-spam channel #2).
     Use the same `verifyRecaptchaToken()` helper that `/auth/session` already
     uses, with action `'FEEDBACK'` and `'TELEMETRY'` respectively.

### SEC-104 — Cross-Origin-Opener-Policy missing (origin isolation)
- **Severity:** CRITICAL (per the PageSpeed brief)
- **File:** `server.ts:92` (helmet disabled) + `public/_headers` (no COOP)
- **Description:** Without `COOP: same-origin`, any cross-origin `window.open`
  or `target=_blank` keeps a synthetic reference, allowing shared-array-buffer
  and `window.opener` attacks. Combined with the missing
  `Cross-Origin-Embedder-Policy`, the site has no Spectre isolation.
- **Impact:** Side-channel attacks; tabnabbing via `window.opener.location = …`
  on legacy browsers; eligibility for `SharedArrayBuffer`-gated APIs is lost.
- **Fix:** Add `crossOriginOpenerPolicy: { policy: 'same-origin' }` to the
  helmet config in SEC-101, and add `Cross-Origin-Opener-Policy: same-origin`
  to `public/_headers`.

---

## HIGH

### SEC-105 — Service-role key paths accept VITE_-prefixed env vars
- **Severity:** HIGH
- **File:** `server/services/resendMailer.ts:14-22`, `server/services/oneSignal.ts:39-47`
- **Description:** Both service helpers fall back to `VITE_RESEND_API_KEY` and
  `VITE_ONESIGNAL_REST_API_KEY`. Any env var prefixed with `VITE_` is bundled
  into the browser by Vite. A misconfiguration (a developer setting
  `VITE_RESEND_API_KEY=…` "to test it quickly") would leak the Resend API key
  to every visitor. This is the same class of bug as SEC-002 (forged JWT via
  unverified fallback) — a fallback that should not exist.
- **Impact:** Potential silent leakage of server-only API keys to the browser
  bundle.
- **Fix:** Remove the `VITE_` fallbacks entirely:

```ts
// server/services/resendMailer.ts:14-22
function getApiKey(): string {
  return String(
    process.env.RESEND_API_KEY ||
    process.env.RESEND_KEY ||
    ''                       // ← VITE_RESEND_API_KEY removed
  ).trim();
}

// server/services/oneSignal.ts:39-47
export function getOneSignalApiKey(): string {
  if (dynamicApiKey) return dynamicApiKey;
  return String(
    process.env.ONESIGNAL_REST_API_KEY ||
    process.env.ONESIGNAL_API_KEY ||
    ''                       // ← VITE_ONESIGNAL_REST_API_KEY removed
  ).trim();
}
```

### SEC-106 — `/api/cron/poll-announcements` has no IP allowlist for Cloud Scheduler
- **Severity:** HIGH
- **File:** `server/api/announcementCron.ts:13-71`, mounted in `server.ts:100-107`
- **Description:** The cron handler relies solely on a shared bearer secret
  (`CRON_SECRET`). There is no IP allowlist for Google Cloud Scheduler's
  egress range and no HMAC over the request body. If `CRON_SECRET` is ever
  leaked (e.g., exposed in a Cloud Run revision's env in the console, in a
  support ticket, in a screenshot), anyone on the internet can trigger
  ingestion cycles at will, racing the real scheduler and burning BSE source
  quota.
- **Impact:** DoS of the BSE source (WAF 403) by triggering overlapping polls;
  the `running` lock prevents true concurrency, but an attacker can still
  force the `backoff` and `busy` paths to monopolise the cadence.
- **Fix:**
  1. Add a Cloud Scheduler IP allowlist. Cloud Scheduler's HTTP target calls
     originate from documented GCP egress ranges (the operator can confirm
     the project's egress IP in Cloud Run logs). Reject any non-GCP-IP request
     before the bearer check.
  2. Rotate `CRON_SECRET` on any operator change. Document this in
     `docs/audit/ANNOUNCEMENT_SCHEDULER_2026-10-10.md`.
  3. (Optional, harder) Replace the static bearer with an OIDC token minted by
     the Cloud Scheduler service account and verified via the Firebase Admin
     SDK or `google-auth-library` — that way no long-lived secret is stored at
     all.

```ts
// server/api/announcementCron.ts — add at the top of the handler
const GCP_SCHEDULER_IP_PREFIXES = ['35.191.', '130.211.']; // Google Cloud load-balancer health-check + scheduler ranges
function isCloudSchedulerIp(req: express.Request): boolean {
  const xff = (req.headers['x-forwarded-for'] as string || '').split(',')[0].trim();
  return GCP_SCHEDULER_IP_PREFIXES.some(p => xff.startsWith(p));
}
// inside the handler, before the bearer check:
if (process.env.NODE_ENV === 'production' && !isCloudSchedulerIp(req)) {
  res.status(403).json({ success: false, error: 'Forbidden origin' });
  return;
}
```

### SEC-107 — `/api/referrals/events` SSE keeps an open socket for 55 s without re-verifying the auth token
- **Severity:** HIGH
- **File:** `server/api/referrals.ts:46-79`
- **Description:** `requireAuth` runs once at connection open. The SSE handler
  then polls for 55 seconds, sending a fresh snapshot every 3 s. If the user's
  JWT expires (7-day cookie) or the Firebase ID token is revoked mid-stream,
  the snapshot continues to be served. Combined with the long `55_000` ms
  timeout and the absence of any heartbeat-side re-auth, a stolen-then-revoked
  session keeps leaking referral dashboard data for up to 55 s.
- **Impact:** Modest data leak window (max 55 s) for referral earnings, payout
  UPI IDs, bank info, and conversion history. Low volume per call, but
  deterministic on the path of a revoked-session attacker.
- **Fix:**
  1. Shorten the SSE timeout to 30 s and have the client reconnect — the
     client will then re-run `requireAuth` with a fresh token.
  2. Inside `refresh()`, re-validate the user object before sending the
     snapshot:

```ts
// inside refresh()
const u = (req as any).user;
if (!u || u.uid !== uid(req) || u.isAnonymous) {
  close();
  return;
}
```

  This is a stopgap; the real fix is server-side token rotation on the SSE
  stream, which requires breaking the cookie into a short-lived bearer.

### SEC-108 — Currency comparison regressed to case-sensitive (regression of SEC-006)
- **Severity:** HIGH (regression of a payment-integrity fix)
- **File:** `server/services/referralPaymentContract.ts:7`
- **Description:** The previous audit's fix made the currency comparison
  case-insensitive. The current code uses strict equality:
  ```ts
  return Boolean(recorded && recorded.uid===expected.uid && recorded.planId===expected.planId
    && recorded.currency===expected.currency && …);
  ```
  Cashfree returns `order_currency` in the case the merchant sent at order
  creation. Our `recordPendingOrder` records `plan.currency` from
  `server/config/plans.ts` (currently `'INR'`). If a future plan or a manual
  Cashfree test uses `'inr'`, the comparison fails and a legitimately paid
  user is told their payment "does not match the recorded checkout".
- **Impact:** Not directly an attack — but it weakens the payment-integrity
  invariant that the previous audit deliberately hardened. More importantly,
  it means an attacker who can influence the case of `order_currency` (e.g.
  by replaying a webhook with a modified body — which the HMAC should catch,
  but defense-in-depth says do not rely on that) could potentially cause
  payment grants to fail or be mis-compared.
- **Fix:**

```ts
// server/services/referralPaymentContract.ts
export function matchesReferralPayment(
  recorded:{uid:string;planId:string;currency:string;amountPaise:number}|null,
  expected:{uid:string;planId:string;amount:number;currency:string},
):boolean {
  const paise=expected.amount*100;
  return Boolean(recorded
    && recorded.uid===expected.uid
    && recorded.planId===expected.planId
    && recorded.currency.toUpperCase()===String(expected.currency||'').toUpperCase()
    && Number.isFinite(paise)
    && Number.isSafeInteger(Math.round(paise))
    && Math.abs(paise-Math.round(paise))<0.000001
    && Math.round(paise)===recorded.amountPaise);
}
```

### SEC-109 — Source maps: build config is correct, but no `sourcemap` directive leaves PageSpeed complaining
- **Severity:** HIGH (PageSpeed-confirmed)
- **File:** `vite.config.ts:41-45`
- **Description:** `vite.config.ts` does not set `build.sourcemap`. Vite's
  default is `false` for production, so no `.map` files are emitted. However,
  some bundled modules (notably `framer-motion`, `react-dom`, `firebase`)
  ship `//# sourceMappingURL=` comments in their pre-minified builds. When
  Vite concatenates them, the trailing comment survives in the output bundle,
  pointing to a `.map` file that does not exist. PageSpeed flags this as
  "Missing source maps for large first-party JavaScript".
- **Impact:** PageSpeed dings the score; no direct security impact today
  (since the maps don't exist, no source is leaked). But the absence of
  hidden source maps also means Sentry stack traces are minified-only,
  slowing incident response.
- **Fix:** Generate **hidden** source maps. They are uploaded to Sentry (for
  symbolication) but never served publicly because the bundle comment is
  stripped when `sourcemap: 'hidden'`:

```ts
// vite.config.ts — inside the `build:` block
build: {
  minify: 'esbuild' as const,
  target: 'es2020',
  chunkSizeWarningLimit: 1200,
  sourcemap: 'hidden',     // emits .map files but does NOT add //# sourceMappingURL= to the bundle
},
```

  Add a Sentry upload step to CI:
  ```bash
  sentry-cli sourcemaps upload --release bsenexus@$(node -p "require('./package.json').version") dist/assets
  ```
  After upload, delete the local `.map` files before deploying so they
  cannot be served from `dist/`.

---

## MEDIUM

### SEC-110 — `dangerouslySetInnerHTML` in `CommonQuestionsFAQ` not hardened against `</script>` breakout
- **Severity:** MEDIUM (currently not exploitable because `COMMON_QUESTIONS`
  is hardcoded, but it becomes exploitable the moment an FAQ entry is sourced
  from user input or AI output)
- **File:** `src/components/ui/CommonQuestionsFAQ.tsx:79`
- **Description:** `JSON.stringify(faqSchema)` does not escape `<` or `>`, so
  an FAQ answer containing `</script><script>alert(1)</script>` would break
  out of the `<script type="application/ld+json">` tag.
- **Impact:** Latent XSS. Not exploitable today, but Trusted Types (SEC-102)
  will fail this component the moment it is enforced.
- **Fix:** Use the hardened serializer from SEC-102.

### SEC-111 — `helmet.crossOriginEmbedderPolicy` disabled breaks `credentialless` CORP for third-party images
- **Severity:** MEDIUM
- **File:** `server.ts:90`
- **Description:** `crossOriginEmbedderPolicy: false` means no COEP header is
  sent, so the browser cannot enforce CORP on cross-origin images (e.g.
  account photoURLs that come from Google's `lh3.googleusercontent.com`).
  When SEC-101 lands `COEP: credentialless`, those Google photo URLs need
  `crossorigin="anonymous"` on the `<img>` tag or they will be blocked.
- **Impact:** Once COEP is enabled (SEC-101), Google account avatars may
  fail to render.
- **Fix:** In `src/components/ui/UserAvatar.tsx`, add `crossOrigin="anonymous"`
  to the `<img>` tag when `id` is null (i.e., the photoURL is a remote
  account photo):
```tsx
<img
  src={…}
  crossOrigin={id ? undefined : 'anonymous'}
  referrerPolicy="no-referrer"
  …
/>
```
  Verify that `lh3.googleusercontent.com` sends `Cross-Origin-Resource-Policy:
  cross-origin` (it does as of 2026). If it stops, switch to `COEP: require-corp`
  and proxy Google photos through `/api/avatar-proxy?url=…`.

### SEC-112 — `console.error`/`console.warn` calls in client code reach the production bundle
- **Severity:** MEDIUM (PageSpeed-confirmed)
- **File:** 70 occurrences across 23 files in `src/`. The biggest offenders:
  `src/context/AuthContext.tsx` (17), `src/components/SettingsTab.tsx` (9),
  `src/components/WatchlistManager.tsx` (6).
- **Description:** `vite.config.ts` already sets `esbuild.drop: ['console',
  'debugger']`, which should strip ALL `console.*` calls during minification.
  However, PageSpeed still reports "Browser errors logged to console". The
  likely culprits are:
  1. **Uncaught promise rejections** — many `.catch(() => {})` handlers
     swallow errors silently, but a few (e.g. `useVisibilityInterval.ts:29`,
     `usePullToRefresh.ts:147`) re-throw or rely on the global
     `unhandledrejection` event.
  2. **Network 401/403 errors** — `customFetch` in `src/api.ts` triggers
     `console.warn` on token refresh failures (`api.ts:56`).
  3. **React hydration mismatches** — SSR HTML in `server.ts` vs client
     render can produce console errors on dev; in production these become
     "Minified React error #418" / #423 logs.
  4. **Image onError handlers** — `UserAvatar.tsx:15` calls
     `setFailedURL(photoURL)` which is silent, but other components log
     errors on image load failure.
- **Impact:** PageSpeed dings the score; user-visible console noise makes
  debugging harder; some errors may also surface to Sentry as
  `unhandledrejection` events.
- **Fix:**
  1. Verify esbuild drop is applied to all chunks. The current `esbuild.drop`
     option at the top level of `vite.config.ts` is correct, but if a chunk
     is built by a plugin that bypasses esbuild (e.g. CSS, image transforms),
     its imports may still contain console calls. Add a `pure: ['console.error',
     'console.warn']` option as a belt-and-braces measure:
     ```ts
     esbuild: {
       drop: ['console', 'debugger'] as ('console' | 'debugger')[],
       pure: ['console.error', 'console.warn', 'console.info', 'console.log'],
     },
     ```
  2. Wrap the global `unhandledrejection` handler in `src/main.tsx` to
     forward to Sentry (which already has `beforeSend` filtering) and
     swallow benign patterns:
     ```ts
     window.addEventListener('unhandledrejection', (e) => {
       const msg = e.reason?.message || String(e.reason || '');
       if (/ResizeObserver loop|AbortError|Failed to fetch dynamically/i.test(msg)) {
         e.preventDefault();   // do NOT log to console
       }
     });
     ```
  3. In `AuthContext.tsx`, downgrade `console.warn` calls that fire during
     expected flows (e.g. "Could not get idToken from Firebase User") to
     silent catches — these are not actionable in production.

### SEC-113 — `/api/users/check-username` is unauthenticated and reveals username availability
- **Severity:** MEDIUM (user-enumeration surface)
- **File:** `server/api/routes.ts:1071-1094`
- **Description:** The endpoint has no `requireAuth` and no `apiRateLimiter`.
  It returns `{ available: false, suggestion: … }` for taken usernames. An
  attacker can enumerate the entire user base by trying common
  handles (`admin`, `rahul`, `trader123`, …). The `suggestion` field leaks
  the canonicalised form of existing handles.
- **Impact:** Username enumeration → targeted phishing / credential stuffing
  on the discovered handles.
- **Fix:** Add `requireAuth` and a per-IP rate limit, and consider only
  returning `available: false` without a suggestion for unauthenticated
  callers:
```ts
apiRouter.get("/users/check-username", requireAuth, apiRateLimiter, async (req, res) => {
  // …existing body…
});
```
  Or, if unauthenticated checks are required for the signup flow, add a
  hard per-IP rate limit (5/min/IP) and return a generic `unavailable`
  without a suggestion.

### SEC-114 — `/api/notifications` and `/api/notifications/unread-count` are unauthenticated
- **Severity:** MEDIUM
- **File:** `server/api/routes.ts:2326-2372`
- **Description:** Both endpoints call `getReqUserId(req)` which returns
  `'guest'` for unauthenticated requests. The DAO then queries
  notifications for the guest UID — which should be empty, but it still
  costs a Supabase round-trip per request. Worse, an attacker can spoof
  another user's UID by setting a forged cookie (which `authMiddleware`
  would reject, but if the JWT verify path falls through to the guest
  branch, the request continues). The endpoint never explicitly checks
  `if (!uid || uid === 'guest') return 401`.
- **Impact:** Low — the guest UID has no notifications, so no data leaks,
  but the endpoint consumes DAO reads on every anonymous hit.
- **Fix:**
```ts
apiRouter.get("/notifications", requireAuth, async (req, res) => { … });
apiRouter.get("/notifications/unread-count", requireAuth, async (req, res) => { … });
```

### SEC-115 — `/api/feedback` has no reCAPTCHA verification (admin Telegram spam channel)
- **Severity:** MEDIUM
- **File:** `server/api/routes.ts:439-467`
- **Description:** Any anonymous user can submit feedback, which calls
  `sendToTelegram(...)` to notify the admin. The `apiRateLimiter`
  (300/min/IP) is the only defence. An attacker rotating IPs can flood
  the admin's Telegram chat with thousands of feedback messages per
  minute.
- **Impact:** Admin DoS via Telegram notification spam.
- **Fix:**
  1. Add reCAPTCHA verification (action `'FEEDBACK'`) before saving feedback.
  2. Lower the per-IP rate limit to 5/min/IP for this endpoint specifically:
```ts
const feedbackLimiter = rateLimit({
  windowMs: 60 * 1000, max: 5,
  standardHeaders: true, legacyHeaders: false,
  validate: { xForwardedForHeader: false, forwardedHeader: false, default: true },
});
apiRouter.post("/feedback", feedbackLimiter, async (req, res) => {
  const { recaptchaToken, recaptchaAction, type, message, email } = req.body || {};
  if (recaptchaToken) {
    const assessment = await verifyRecaptchaToken(recaptchaToken, recaptchaAction || 'FEEDBACK', {
      ip: getSanitizedClientIp(req),
      userAgent: req.headers['user-agent'] as string,
      host: req.headers.host as string,
    });
    if (!assessment.valid) {
      return res.status(400).json({ success: false, error: assessment.userMessage || 'Security verification failed.' });
    }
  } else {
    return res.status(400).json({ success: false, error: 'Security verification is required.' });
  }
  // …existing body…
});
```

---

## LOW

### SEC-116 — `CommonQuestionsFAQ` uses `dangerouslySetInnerHTML` even though the data is static
- **Severity:** LOW
- **File:** `src/components/ui/CommonQuestionsFAQ.tsx:79`
- **Description:** See SEC-110. The data is currently hardcoded, so this is
  not exploitable, but `dangerouslySetInnerHTML` is the wrong tool for JSON-LD.
- **Fix:** Render the JSON-LD via a `<script>` element with a `ref` and
  `document.createTextNode(json)` — React will not escape it, but Trusted
  Types will not flag it either. Or simply use the hardened `JSON.stringify`
  from SEC-102.

### SEC-117 — Sentry DSN hardcoded in `server/sentry.ts`
- **Severity:** LOW (informational — Sentry DSNs are designed to be public)
- **File:** `server/sentry.ts:7-16`
- **Description:** `DEFAULT_SENTRY_DSN` is a hardcoded URL. This is fine —
  Sentry DSNs identify the project, they are not secret. The DSN is also
  exposed to the browser via `/api/config/public` (`routes.ts:143`), which
  is intentional.
- **Impact:** None. This is documented for completeness.
- **Fix:** None required. Optionally, remove the hardcoded DSN and require
  `SENTRY_DSN` to be set in env — fail closed if missing.

### SEC-118 — `.env.example` does not document `FIREBASE_APPCHECK_ENFORCE`
- **Severity:** LOW
- **File:** `.env.example`
- **Description:** The App Check enforcement flag (`FIREBASE_APPCHECK_ENFORCE`)
  is checked in `auth.ts:177` but never appears in `.env.example`. Once
  SEC-103 is fixed and App Check is mounted, operators need to know to set
  this flag in production.
- **Fix:** Add to `.env.example`:
```
# Firebase App Check enforcement (set to 'true' in production after mounting requireAppCheck)
FIREBASE_APPCHECK_ENFORCE="false"
```

---

## Previous audit regression check (all PASS, except SEC-108)

| Prev ID | File:Function | Status |
|---|---|---|
| SEC-001 | `server/security/auth.ts:97-148` `authMiddleware` | PASS — unverified `jwt.decode()` fallback removed (lines 133-138 comment) |
| SEC-002 | `server/security/auth.ts:349-376` `/auth/session` | PASS — unverified `jwt.decode()` fallback removed (lines 357-362 comment); only `adminAuth.verifyIdToken(token, true)` mints JWTs |
| SEC-003 | `firestore.rules:42-56` `isNotElevatingRole()` | PASS — blocks `tier`, `proExpiresAt`, `proPlanId`, `lastPaymentAt`, `lastOrderId`, `grantedOrderIds`, `maxWatchlistStocks`, `freeSummaryUsed`, `trialUsed` |
| SEC-005 | `server/api/routes.ts:2719, 2730` `/security/audit`, `/security/pen-test` | PASS — both gated by `requireAdmin` |
| SEC-007 | `server/api/routes.ts:1894, 1906` `/storage/quota-mode` | PASS — both GET and POST gated by `requireAdmin`; also `/storage/status`, `/storage/cleanup`, `/storage/test-alert`, `/storage/reset-quota`, `/storage/reset-permission` are all `requireAdmin` |
| SEC-008 | `server/api/routes.ts:2560-2592` `/telemetry/event` | PASS — uses `aiRateLimiter`, inline-checks `if (!uid || uid === 'guest')` returns 401, strict field whitelist. **NOTE:** not using `requireAuth` middleware directly, but the inline check is functionally equivalent. |
| SEC-006 | `server/services/referralPaymentContract.ts` | **REGRESSION → SEC-108** — currency comparison is now strict equality, not case-insensitive |
| SEC-009 | `server/security/auth.ts:588-596, 724-732` | PASS — hardcoded owner UID fallback removed; `elevatedUid` is taken from the verified Firebase session only |
| LOGIC-012 | `server/services/telegram.ts:91-93, 146-148` `sendToTelegram`, `sendReplyToTelegram` | PASS — both have the 400/403 guard that returns early without tripping the circuit breaker |

---

## Supabase security (NEW code audit — PASS with notes)

### Supabase client init (`server/database/supabase.ts`)
- Service-role key is read from env (`SUPABASE_SERVICE_ROLE_KEY`) — never
  bundled, never exposed to the browser. The client is a module-level
  singleton, set up with `auth: { persistSession: false, autoRefreshToken: false }`.
  ✅ PASS.
- The comment at line 6-8 explicitly says "Never expose this client to the
  browser bundle; it is server-only." Good.

### RLS policies (`supabase/migrations/001_initial_schema.sql`)
- RLS is enabled on every table (lines 120-130).
- No permissive policies are created — the comment is explicit:
  "the anon and authenticated (browser) keys can read/write NOTHING."
- `grant_payment_atomic` is `security invoker` and has `revoke all from
  public, anon, authenticated; grant execute to service_role` (lines 168-171).
  ✅ PASS.

### Privileged RPCs (`supabase/migrations/002_restrict_privileged_rpcs.sql`)
- All four privileged RPCs (`grant_payment_atomic`,
  `record_pending_order_atomic`, `claim_order_for_grant`,
  `claim_free_summary_demo`) are revoked from `public, anon, authenticated`
  and granted only to `service_role`. ✅ PASS.

### AI quota RPC (`supabase/migrations/003_durable_ai_quota.sql`)
- `manage_ai_quota` is `security invoker`, revoked from public, granted to
  `service_role` only. The function checks `p_uid != 'guest'` and uses
  `pg_advisory_xact_lock` for cross-replica serialisation. ✅ PASS.

### Referral RPCs (`supabase/migrations/006_durable_referrals.sql`)
- `referral_command`, `referral_settle_order`, `referral_snapshot`,
  `referral_admin_accounts`, `preserve_referral_bonus_access` are all
  `security invoker` and granted only to `service_role`. ✅ PASS.
- The `referral_command` function uses dynamic SQL in two places
  (lines 105, 107) via `execute 'update ... using $1, $2'`. The values
  are passed as bind parameters (`using expiry, o.referrer_uid`), so
  this is not SQL-injectable. ✅ PASS.

### Dual-write scenario (Firestore + Supabase)
- The `docs/SUPABASE.md` mapping shows that payment-critical paths
  (`payment_orders`, `payment_entitlements`) are Supabase-only — there is
  no Firestore dual-write for money truth.
- General DAOs (users, watchlists, announcements, alert_rules, etc.)
  use Supabase as primary with local JSON fallback. This is documented
  in `docs/SUPABASE.md` lines 53-58: "Payment-critical operations and
  durable profile reads fail closed with a retriable error when Supabase
  cannot be reached. They must not silently mark a payment successful
  using only local files."
- ✅ PASS — no silent inconsistency risk for payment truth.

---

## Sentry security (NEW code audit — PASS)

### Client-side Sentry (`src/lib/sentry.ts`)
- DSN is read from `import.meta.env.VITE_SENTRY_DSN` (build-time) or
  fetched from `/api/config/public` (runtime). Both are public-by-design.
- `beforeSend` filters benign patterns (ResizeObserver, AbortError, etc.).
- `setSentryUser(id, email)` is called from the auth context to attach
  the user ID and email to error reports. **NOTE:** this DOES send the
  user's email to Sentry. If PII policy requires not sending email,
  change `setSentryUser` to only set `id`:
  ```ts
  export function setSentryUser(id: string | null, _email?: string | null) {
    try {
      Sentry.setUser(id ? { id } : null);   // no email
    } catch {}
  }
  ```
  This is a policy decision, not a bug. ✅ PASS with note.

### Server-side Sentry (`server/sentry.ts`)
- DSN is read from env, with a hardcoded default. The default is a
  public Sentry DSN — fine.
- `Sentry.init` is called with `tracesSampleRate: 0.1` (10% of transactions).
- No `beforeSend` filter on the server side, so server errors include the
  full request body and headers by default. **Recommendation:** add a
  server-side `beforeSend` that scrubs `Authorization`, `Cookie`,
  `x-firebase-appcheck`, and `x-webhook-signature` headers:
  ```ts
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'production',
    tracesSampleRate: 0.1,
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
        delete event.request.headers['x-firebase-appcheck'];
        delete event.request.headers['x-webhook-signature'];
      }
      return event;
    },
  });
  ```
  ✅ PASS with recommendation.

---

## Resend email security (NEW code audit — PASS with notes)

### Email header injection
- `server/services/resendMailer.ts:60-63` validates `to` with the regex
  `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`. This rejects newlines (`\r`, `\n`), so
  header injection via the `to` field is blocked. ✅ PASS.
- However, the `subject` field (line 77) is NOT validated for newlines.
  In `buildReceiptEmail`, `subject` is constructed from `d.orderId` which
  is server-generated (`BN_<plan>_<customerId>_<uuid>`), so it is safe
  today. But if the receipt email is ever extended to include user input
  in the subject, this becomes a header-injection vector.
- **Recommendation:** add a newline-strip in `buildReceiptEmail`:
  ```ts
  const subject = `BSE Nexus invoice — ${d.orderId}`.replace(/[\r\n]/g, ' ');
  ```

### SSRF via email body
- The HTML receipt (`resendMailer.ts:199-216`) does not embed any URLs
  beyond the static `bsenexus.in` mentions. The `d.paymentMethod` field
  is server-derived from Cashfree's payment response (limited to "UPI",
  "Visa Credit Card", etc.). No user-controlled URLs are embedded. ✅ PASS.

### Email enumeration
- The `/api/payments/send-receipt` endpoint (`payments.ts:920-990`)
  requires `requireAuth`, checks order ownership, and returns 403 for
  non-owned orders. The `toEmail` is supplied by the client but the
  order must belong to the caller. An attacker cannot probe for other
  users' orders. ✅ PASS.

### Rate limiting
- `sendReceiptLimiter` (`payments.ts:911-918`) limits to 20 emails per
  10 minutes per IP. ✅ PASS.

---

## Announcement scheduler security (NEW code audit — PASS with notes)

### Auth bypass
- `/api/cron/poll-announcements` (`server/api/announcementCron.ts:13-71`)
  uses `timingSafeEqual` against the SHA-256 of `CRON_SECRET`. The
  comparison is constant-time and uses a hash to equalise lengths. ✅ PASS.
- The endpoint is mounted BEFORE `authMiddleware` in `server.ts:100-107`,
  which is correct — the cron scheduler does not have a user session.
- **NOTE:** See SEC-106 for the missing IP allowlist.

### IDOR
- The scheduler does not accept any user-controlled identifiers. It
  triggers `processAnnouncements()` which reads from the BSE source and
  writes to the announcements table. No user-specific data is accessed.
  ✅ PASS.

### Concurrency
- A `running` flag (line 16) prevents overlapping invocations on the
  same instance. A `nextEligibleAt` timestamp (line 17) gates backoff.
  ✅ PASS for single-instance; see SEC-106 note about multi-revision
  rolling deploys.

### Error handling
- The catch block (lines 60-65) does NOT log exception text — only a
  generic `[POLLER] Poll invocation failed` message. The comment at
  line 62 explains: "Do not log exception text: upstream messages may
  contain request secrets." ✅ PASS — good practice.

---

## Profile avatar security (NEW code audit — PASS)

### File upload
- There is NO file upload. The avatar picker
  (`src/components/AvatarPicker.tsx`) selects from a fixed catalogue
  of 12 character avatars (`src/config/avatars.ts:2-9`). The selected
  avatar ID is mapped to a static URL `/avatars/v1/<id>-<size>.webp`
  hosted on the same origin. ✅ PASS.

### XSS via image URL
- `avatarIdFromPhotoURL` (`src/config/avatars.ts:19-26`) validates
  that the photoURL is on `https://bsenexus.in` origin with no query
  string or hash, and matches one of the 12 exact catalogue paths.
  Any other URL returns `null`, which causes `UserAvatar.tsx:7` to
  fall through to the initials fallback. ✅ PASS.
- The `<img>` tag (`UserAvatar.tsx:12-15`) sets `referrerPolicy="no-referrer"`
  and uses `src` (not `srcdoc` or `innerHTML`), so even a malicious
  `data:` URL would not execute JavaScript. ✅ PASS.
- **NOTE:** Firebase Auth's `updateProfile({ photoURL })` is called
  client-side (`AuthContext.tsx:1004`), so a malicious client could
  bypass the catalogue and set `photoURL` to any URL via direct
  Firebase SDK calls. However, `UserAvatar.tsx` re-validates the URL
  via `avatarIdFromPhotoURL`, so a foreign URL just renders as the
  initials fallback — not XSS. ✅ PASS.

### Self-referral / cross-account
- `createAvatarSaveController` (`src/utils/avatarSave.ts:8-37`) checks
  `currentAccount()?.uid !== account.uid` before applying the avatar,
  preventing a race where the user switches accounts mid-save. ✅ PASS.

---

## New UI visuals security (NEW code audit — PASS)

### XSS surface
- Grep for `dangerouslySetInnerHTML|innerHTML|eval|new Function|document.write`
  across `src/components/` returns exactly ONE hit: `CommonQuestionsFAQ.tsx:79`
  (covered in SEC-110/SEC-116). No other new UI component uses these sinks.
- `ParticleRibbons.tsx`, `RichVisual.tsx`, `helios.tsx`, `StoryVisuals.tsx`,
  `MagneticButton.tsx`, `ScrollProgressBar.tsx`, `Reveal.tsx`, `BseNexusLogo.tsx`,
  `ModernAuthCard.tsx` — none use `dangerouslySetInnerHTML`. ✅ PASS.

### Server-side rendered HTML
- `server.ts` uses `escapeHtmlText` and `escapeHtmlAttr` consistently
  for all user-controlled data in SSR pages (lines 139-145 define the
  helpers; used throughout the announcement, results, company, guide
  renderers). ✅ PASS.
- The PDF link in the announcement page (`server.ts:776`) is gated
  through `escapeHtmlAttr` AND the URL is fetched through
  `isAllowedBseDocumentUrl` on the server side via `/api/pdf-open`
  (lines 2116-2189). ✅ PASS — SSRF protected.

---

## Environment variables audit

### `.env.example` review
- `SUPABASE_URL=""` and `SUPABASE_SERVICE_ROLE_KEY=""` are empty
  placeholders. ✅ PASS.
- `MIGRATION_TOKEN=""` is documented as a server-only token. ✅ PASS.
- `RESEND_API_KEY=""` is empty. ✅ PASS. **(See SEC-105: the code
  accepts `VITE_RESEND_API_KEY` as a fallback — remove that fallback.)**
- `SENTRY_DSN` and `VITE_SENTRY_DSN` are hardcoded to a public DSN.
  ✅ PASS (Sentry DSNs are public by design).
- `ONESIGNAL_APP_ID` and `VITE_ONESIGNAL_APP_ID` are hardcoded to a
  public app ID. ✅ PASS (OneSignal app IDs are public).
- `ONESIGNAL_REST_API_KEY=""` is empty. ✅ PASS. **(See SEC-105: the
  code accepts `VITE_ONESIGNAL_REST_API_KEY` as a fallback — remove.)**
- `CRON_SECRET=` is empty. ✅ PASS.
- `FIREBASE_APPCHECK_ENFORCE` is NOT in `.env.example` → SEC-118.

### Hardcoded secrets
- No secrets are hardcoded in the new code. The Sentry DSN in
  `server/sentry.ts:7-8` is a public identifier, not a secret.
- The OneSignal app ID in `server/services/oneSignal.ts:8-9` is a
  public identifier.
- ✅ PASS.

---

## Summary of fixes (priority order)

1. **SEC-101** (CRITICAL) — Re-enable helmet CSP/HSTS/COOP/XFO/CORP/COEP
   in `server.ts:88-95` and add the same headers to `public/_headers`.
2. **SEC-103** (CRITICAL) — Mount `requireAppCheck` on every state-changing
   API route; set `FIREBASE_APPCHECK_ENFORCE=true` in production.
3. **SEC-104** (CRITICAL) — Add `COOP: same-origin` (covered by SEC-101).
4. **SEC-102** (CRITICAL) — Add Trusted Types policy + harden
   `CommonQuestionsFAQ` JSON-LD.
5. **SEC-105** (HIGH) — Remove `VITE_RESEND_API_KEY` and
   `VITE_ONESIGNAL_REST_API_KEY` fallbacks.
6. **SEC-106** (HIGH) — Add Cloud Scheduler IP allowlist to
   `/api/cron/poll-announcements`.
7. **SEC-107** (HIGH) — Re-verify auth on SSE refresh ticks; shorten
   timeout to 30 s.
8. **SEC-108** (HIGH) — Make currency comparison case-insensitive
   (regression of SEC-006).
9. **SEC-109** (HIGH) — Set `build.sourcemap: 'hidden'` in `vite.config.ts`;
   upload to Sentry; delete local `.map` files before deploy.
10. **SEC-110/116** (MEDIUM/LOW) — Harden `dangerouslySetInnerHTML` in
    `CommonQuestionsFAQ`.
11. **SEC-111** (MEDIUM) — Add `crossOrigin="anonymous"` to remote avatar
    `<img>` tags before enabling COEP.
12. **SEC-112** (MEDIUM) — Add `pure: ['console.error', 'console.warn', …]`
    to vite esbuild config; swallow benign `unhandledrejection` events.
13. **SEC-113** (MEDIUM) — Add `requireAuth` + rate limit to
    `/api/users/check-username`.
14. **SEC-114** (MEDIUM) — Add `requireAuth` to `/api/notifications` and
    `/api/notifications/unread-count`.
15. **SEC-115** (MEDIUM) — Add reCAPTCHA + tighter rate limit to
    `/api/feedback`.
16. **SEC-118** (LOW) — Document `FIREBASE_APPCHECK_ENFORCE` in
    `.env.example`.

All Supabase, Sentry, Resend, announcement-scheduler, avatar, and UI-visual
code is otherwise sound. The previous audit's fixes are intact except for
the SEC-108 currency-comparison regression.
