# Change: speed pass 1 - one revocation check per token per minute (30 Oct 2026)

- Starting commit: 7200ff2cba5bb28b9052c4d05eeb813c3c2650cf (main, after PR #37).
- User objective and acceptance cases: the owner reports every section of the site is very slow. Find causes from evidence, fix the bounded ones, hand off the rest honestly.
- Verified facts (file + symbol):
  - `src/api.ts customFetch` attaches `Authorization: Bearer <Firebase ID token>` to every API call (localStorage fallback).
  - `server/security/auth.ts authMiddleware`: a Bearer header wins over the local `authToken` cookie, so the cheap local `jwt.verify` path never matches a Firebase token; it then calls `adminAuth.verifyIdToken(token, true)` on EVERY request. `checkRevoked=true` makes the Admin SDK ask Google's identity backend about the user, so each API call paid one extra network round trip, and a screen that fires several calls at once paid it several times in parallel.
  - The app never calls `revokeRefreshTokens` (grep of `server/`), so revocation only happens when the owner disables or revokes a user in the Firebase console.
  - Earlier evidence (rule/changes/performance-startup.md): mobile Lighthouse 48 (22 Oct), TBT about 1.4 s, one TTFB sample of 7.6 s, initial JS 1,007,826 raw / 272,481 gzip bytes in one file.
  - `server.ts` serves hashed build assets with `maxAge 1y, immutable` (good) but compresses every response on the fly with gzip level 6 (no precompressed or brotli assets).
  - The web process also runs the announcement/radar/ADR pollers on `setInterval` and uses synchronous local-file reads/writes in several request paths.
- Assumptions/unknowns: actual server and browser timings were NOT measured. The live site was unreachable from this session (proxy refused `bsenexus.in`), the npm registry is blocked (no `npm ci`, no build, no bundle analysis). The size of the gain from this change is therefore unknown; only the removal of a per-request network call is established by reading the code. Cloud Run settings (region, min instances, CPU allocation) and whether Cloudflare caches `/assets/*` are unknown.
- Changed source of truth: `server/security/verifiedTokenCache.ts` (new) and the single verification call in `authMiddleware`.
- Impact command and affected semantic domains: `node scripts/spider-map.mjs --impact server/security/auth.ts server/security/verifiedTokenCache.ts` (output reviewed; `authMiddleware` is mounted for every request).
- For each relevant consumer: changed / reviewed-and-compatible / blocked, with evidence:
  - All authenticated API routes (`requireAuth`, `requireAdmin`, `requireProOrAdmin`): reviewed-and-compatible; they still receive the same `req.user` shape. Admin elevation is derived from the cookie on every request outside the cache (`getCookieElevation`), so it is not cached.
  - `/auth/session` login (`auth.verifyIdToken(idToken, true)`): reviewed-and-compatible; deliberately NOT cached, login always verifies fresh.
  - `server/api/giftAccess.ts` separate `verifyIdToken`: unchanged.
  - `authIdentity.test.ts`, `deepAuditAuth.test.ts` (mock `verifyIdToken` per call): reviewed-and-compatible; the cache is disabled when `NODE_ENV=test` or `NODE_TEST_CONTEXT` is set, so their mocks stay exact. They were NOT run here (dependencies unavailable).
- Assignment scope: backend performance.
- Expected user-visible effect: fewer slow API calls after the first one; no visible behaviour change.
- Failure/security/concurrency cases: only successful verifications are cached; an entry never outlives the token's `exp`; identical concurrent tokens share one in-flight check; failures are never cached; the key is a SHA-256 of the token (raw token not stored); size capped at 2000 entries. Accepted trade-off: a user revoked or disabled in the Firebase console can keep using an already-verified token for up to 60 s (default). Set `FIREBASE_VERIFY_CACHE_MS=0` to restore per-request checks, or up to 300000 to widen the window.
- Implementation and coordinated updates: `server/security/verifiedTokenCache.ts`, `server/security/auth.ts`, `server/tests/verifiedTokenCache.test.ts`, this record, regenerated `rule/generated/*`.
- Commands actually run and results:
  - `tsx --test server/tests/verifiedTokenCache.test.ts`: 9 pass.
  - `node scripts/spider-map.mjs` and `--check`, `node --test scripts/spider-map.test.mjs`: see PR description.
  - TypeScript `transpileModule` syntax check of the three TS files.
- Required checks unavailable (reason; do not mark passed): `npm run lint`, full `npm test`, `npm run build` and the startup performance budget guard (npm registry blocked). CI must run them.
- Deployment/migration requirements and rollback: deploy only, no migration. Optional env `FIREBASE_VERIFY_CACHE_MS`. Rollback: revert the PR or set the env var to 0.
- Remaining risks and next bounded step: see "Open performance items".
- Graph/domain/documentation refreshed: `rule/generated/spider-map.*` regenerated.
- Delivery status: committed on `perf/speed-pass-1`; not merged; CI not run; not deployed; not measured.

## Open performance items (not done, need measurement or owner access)

| ID | Likely impact | Status | What and why |
| --- | --- | --- | --- |
| PERF-2 | High | Owner/infra | Cloud Run: the code comments say request-based billing. With CPU only allocated during requests, cold starts and the in-process pollers (every 60 s) compete with user requests. Check region (asia-south1 for Indian users), set min instances to 1, enable startup CPU boost, and consider CPU always allocated. The one 7.6 s TTFB sample points at cold start or CPU starvation but is a single sample. |
| PERF-3 | High | Needs build access | Initial JS is still one 1 MB (273 KB gzip) file; every deploy invalidates all of it. Run a bundle visualizer, split stable vendors (react, firebase, sentry, framer-motion) with `manualChunks`, defer Sentry and App Check init until idle, and keep the existing budget guard. Expect better repeat-visit load and less main-thread work (TBT 1.4 s). |
| PERF-4 | Medium | Needs build access | Static JS/CSS is gzip-compressed on every request at level 6. Precompress at build (brotli + gzip) and serve those files, or let Cloudflare/CDN cache and compress `/assets/*`. |
| PERF-5 | Medium | Architecture | Pollers, ingestion and AI jobs share the web process and event loop. Move them to a separate Cloud Run service or job so page requests never wait on them. |
| PERF-6 | Low-Medium | Needs measurement | Startup fires several calls (`/auth/status` is requested from both App.tsx and AuthContext, `/api/settings`, `/api/watchlists`, `/api/users/profile` more than once). Deduplicate and defer non-critical ones; measure first. |
| PERF-7 | Low | Cleanup | `public/assets/aistudio/*.jpg` (about 3.1 MB of Chrome screenshots, added by commit 0ba6974 "temporary media assets") are referenced nowhere in `src/` or `server/`. They are not downloaded by visitors but enlarge the repo and image. Confirm with the owner before deleting (AGENTS.md pre-deletion trace). |
| PERF-8 | Low | Cleanup | `recharts` and `date-fns` are listed in package.json/Vite config but imported by no file in `src/`; verify and remove if truly unused. |

## Pending-PR review — 2 November 2026 IST

Reconciled the original change with main 39bbd52 and the clean-install/PDF recovery. The original PR description was stale: all four original-head hosted CI jobs passed in run 41050055709; that is historical evidence, not validation of this integration.

Security review added generation-fenced clear semantics (old pending work cannot refill a cleared cache or remove a newer same-token flight), bounded in-flight retention and refusal to retain claims with absent/non-finite expiry. Existing fresh session verification and per-request PIN elevation remain outside the cache. Same-token sharing, TTL/expiry, denied verification and cache capacity retain independent tests. Cache revocation delay remains default 60 seconds, at most the configured five-minute cap; zero disables it. No live latency gain is claimed.

Current integrated local verification: 929/929 backend tests passed (including 12 cache tests), lint and production build passed. No deployment/provider call. Final dependency integration and hosted CI are separate evidence. Map publication is blocked by automatic approval review despite verification that the destination is the connected owner's private repository; do not merge with stale maps or bypass that block.
