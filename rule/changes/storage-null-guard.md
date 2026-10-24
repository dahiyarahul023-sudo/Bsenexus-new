# Change: guard Web Storage reads against disabled storage (Sentry BSENEXUS-9)

- Starting commit: 2fafd9fa14c7c2ee1bdcd4ab907b59a1cd7a6b7e (main HEAD 2026-10-19)
- User objective and acceptance cases: weekly autonomous code-health scan (2026-10-24). Sentry logged BSENEXUS-9 "TypeError: Cannot read properties of null (reading 'getItem')" (19 Oct, single occurrence). A codebase-wide audit found every `.getItem(` receiver is literally `localStorage`/`sessionStorage` — the null receiver is `window.localStorage` itself, which is null when Web Storage is disabled (Firefox `dom.storage.enabled=false`, WebViews with DOM storage off, enterprise policy). Six call sites read storage with no try/catch and no null check, so the throw propagates (Layout.tsx:111 runs on every page load — a storage-disabled user hard-crashes on every load). Acceptance: (1) all six sites return null instead of throwing when storage is unavailable; (2) behavior identical when storage works; (3) `npm run lint` clean; (4) no other call sites changed.
- Verified facts (file + symbol):
  - Unguarded sites (confirmed by reading each with context): src/components/Layout.tsx:111 (`useState` initializer, app shell, every page load), src/components/Layout.tsx:118 (60s interval), src/App.tsx:223 (`sessionStorage`, Cashfree re-verify effect), src/components/PricingPage.tsx:20 (referral restore effect), src/components/ProCheckoutView.tsx:43 (checkout referral effect), src/components/WatchlistManager.tsx:644 (`useState` initializer, view-mode restore).
  - `typeof window !== 'undefined'` guards (Layout, PricingPage, WatchlistManager) do NOT protect: `window` exists but `window.localStorage` is null.
  - All other `.getItem(` call sites are inside try/catch (swallowed) or already null-guard (cache.ts `window.localStorage &&`) — verified by full grep.
  - App.tsx:225 `sessionStorage.removeItem` needs no change: with the safe getter, `stashed` is null so the `if (stashed)` branch (containing removeItem) never runs.
- Assumptions/unknowns and how they will be resolved: the exact browser/env of the Oct 19 event is unknown (no stack trace; Sentry free plan). The fix addresses the only mechanism consistent with the evidence (null storage object), and is behavior-preserving otherwise.
- Changed source of truth: new src/utils/safeStorage.ts (`safeGetItem`, `safeSessionGetItem`); one-line swaps at the six sites + imports.
- Impact command and affected semantic domains: `npm run map:impact` on the new file has no consumers yet (new); per-file impact for the five touched components — domains: frontend-session, frontend-navigation. No contract change (same return values when storage works).
- Related consumers: API, UI, storage/RPC, jobs, caches, manual copy: none — read-path only, null-on-failure matches the previous `typeof window` fallback values at each site.
- For each relevant consumer: changed / reviewed-and-compatible / blocked, with evidence:
  - Layout story-session check: changed — null storage now reads as "not seen" (same as the previous `typeof window === 'undefined'` → false path).
  - App Cashfree stash: changed — null storage now skips re-verification (same as no stashed order).
  - Pricing/ProCheckout referral restore: changed — null storage now means no saved code (same as empty).
  - Watchlist view mode: changed — null storage falls through to the existing `window.innerWidth >= 768` default.
- Assignment scope: frontend / robustness; no visual or behavior change when storage works.
- Frontend: n/a beyond the six read sites; no state-shape changes.
- UI state/device matrix: no browser verification possible in this run (detached); logic verified by lint + unit-style reasoning. No browser behavior claimed.
- Expected user-visible effect: none for normal users. Storage-disabled users no longer crash (previously: hard crash on every load via Layout.tsx:111).
- Failure/security/concurrency cases relevant to this change: safeGetItem catches ALL throws (SecurityError, null deref) and returns null; no secrets involved; no async.
- Implementation and coordinated updates: see files; map regenerated in same push.
- Commands actually run and results:
  - `npm run lint` (tsc --noEmit) — clean (covers new safeStorage.ts + all five touched components).
  - `npm run build` — ok.
  - Grep audit: every remaining `.getItem(` in src/ is either inside try/catch or null-guarded (`window.localStorage &&`); the six swapped sites were the only unguarded ones.
- Required checks unavailable (reason; do not mark passed): real storage-disabled browser repro (detached run); behavior verified by code reasoning (null → existing fallbacks).
- Deployment/migration requirements and rollback: revert commit; needs Rahul's AI Studio sync + Republish. No migration.
- Remaining risks and next bounded step: none identified.
- Graph/domain/documentation refreshed: `npm run map:generate` in same push.

- Delivery status: commit / merge / CI / deployment, reported separately.

## Frontend action and consistency record (when applicable)

n/a — read-path hardening only, no actions changed.
