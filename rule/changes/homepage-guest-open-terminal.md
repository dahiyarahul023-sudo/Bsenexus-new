# Homepage "Open Terminal" → Guest Entry Fix

## Problem
Clicking **Open Terminal** on the public homepage (`/`) opened the Auth modal, and choosing **Guest** closed the modal but left the visitor stuck on `LandingPage` instead of entering the terminal.

### Root Cause
1. In `src/context/AuthContext.tsx`, `quickDemoLogin('Guest')` falls back to a local guest object (`uid: 'trader_*'`, `isAnonymous: true`) when Firebase anonymous auth is restricted (`auth/admin-restricted-operation`). `syncUserProfile` enforced `auth.currentUser?.uid === uid` before setting `user`/`profile`, which always evaluated to `false` when `auth.currentUser` was `null`, returning `null` while `quickDemoLogin` still closed the modal and returned `{ success: true }`.
2. Even for Firebase anonymous sessions, `syncUserProfile` made unnecessary `/auth/status` and `/api/users/profile` calls (triggering `401` → `auth-expired`) and could race with `onAuthStateChanged`'s `sessionEpoch` increment.
3. For active local fallback guests (`trader_*` with `auth.currentUser === null`), a late `onAuthStateChanged(null)` or `auth-expired` event could wipe the guest session.
4. `src/App.tsx` defaulted `LandingPage`'s `onEnterTerminal()` pending destination to `'home'` instead of `'dashboard'` (`/announcements`, matching the direct terminal link and other pages' "Open Terminal" buttons), and only completed `pendingTerminalTabRef` inside `AuthModal`'s `onSuccess` callback.

## Changes
- `src/context/AuthContext.tsx`:
  - Short-circuited `isGuestUser` in `syncUserProfile` to synchronously construct and commit the strictly free, local-only guest profile (`tier: 'free'`, `proExpiresAt: 0`, `maxWatchlistStocks: 5`) with admin/elevation cleared and no `localStorage` persistence, while guarding against overwriting a different signed-in Firebase user.
  - Preserved active local fallback guest sessions (`trader_*` + `bse_guest_active_session === 'true'`) across `onAuthStateChanged(null)` and `auth-expired` events (explicit `logout()` still clears `sessionStorage` and redirects to `/`).
  - Checked `syncUserProfile` return value in `quickDemoLogin` before closing the auth modal and returning `{ success: true }`.
- `src/components/ui/ModernAuthCard.tsx`:
  - Checked `quickDemoLogin('Guest')` result in `handleGuestLogin` before closing the modal and firing `onSuccess`.
- `src/App.tsx`:
  - Updated `LandingPage`'s `onEnterTerminal` default pending tab from `'home'` to `'dashboard'` (`/announcements`) so Homepage "Open Terminal" → Guest opens the same live announcements terminal as direct `/announcements` links (`onSignIn` still targets `'home'`).
  - Added a `useEffect([user])` completion guard for `pendingTerminalTabRef` so modal close and terminal entry always complete in one action.
- `server/tests/guestTerminalEntry.test.ts`:
  - Added unit regression tests covering restricted Firebase anonymous auth fallback, `auth-expired`/late `onAuthStateChanged(null)` survival, no localStorage persistence, no server profile calls, and concurrent Firebase anonymous login.

## Consumers Reviewed
- `src/context/AuthContext.tsx` — changed.
- `src/components/ui/ModernAuthCard.tsx` — changed.
- `src/App.tsx` — changed.
- `src/components/LandingPage.tsx` — reviewed-and-compatible (`onEnterTerminal()` continues to invoke `App.tsx`'s handler with no layout/design changes).
- `src/components/AuthModal.tsx` — reviewed-and-compatible (forwards `onSuccess` to `ModernAuthCard`).
- `src/components/CompaniesPage.tsx`, `src/components/TrustPages.tsx`, `src/components/NotFoundPage.tsx` — reviewed-and-compatible (already pass `'dashboard'`).
