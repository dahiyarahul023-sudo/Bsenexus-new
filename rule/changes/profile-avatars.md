# Change: original transparent profile avatars

- Starting commit: `6dfccfb05b07ad2b28446b1ebccd933c39f98f30`.
- User asks for selectable profile avatars inspired by the soft 3D creatures in Instagram DYlIXcdGYdE, with clean background and clarity at different sizes. Original characters; no company-logo change.
- Reference inspected in Chrome: clay creatures with simple faces, rounded silhouettes, soft lighting; public caption links a Figma collection. Reference assets are not copied. ImageGen creates original transparent cutouts.
- Source trace: Layout and UserProfileModal render profile.photoURL; Firebase Auth sync prefers Firebase user's photoURL; backend /users/profile strict whitelist intentionally excludes photoURL. Backend/DAO/authorization not changed. Use existing Firebase updateProfile for the account photo.
- Source owners: config/avatars catalogue and assets; ui/UserAvatar renderer; utils/avatarSave confirmed save/controller; AuthContext publishes account photo to existing profile/cache; inline AvatarPicker drafts; existing parent overlays own lifetime/scroll.
- Entry points: Account Profile → Choose your avatar; Settings → Edit Profile → Choose. Existing Google/account photo restoration remains. Avatar action saves independently of name/handle edits; shown in copy.
- Impact command: `npm run map:impact -- src/context/AuthContext.tsx src/components/UserProfileModal.tsx src/components/Layout.tsx src/components/SettingsTab.tsx`.
- Relevant domains: identity/frontend-session/frontend-design/frontend-navigation/offline-privacy. Domains/map/docs updated with new owners/tests.
- State contract: draft choice changes preview only; save validates catalogue, signed-in/current UID and duplicate lock; confirmed Firebase write precedes profile/cache update. Failed write preserves original photo/draft with retry; changed account cannot receive old completion. Account photo restoration uses providerData, or initials when absent.
- Actual selected avatar is not tier/paid authority; existing live-expiry Pro ring/status remain. No new upload URL, arbitrary remote avatar input, server endpoint, storage bucket, reward/payment change or runtime 3D engine.
- Assets: 96/256/512 WebP with preserved alpha/srcSet; character object-fit contain, ordinary account photo cover; reserved image geometry and initials fallback on error. Original master PNGs retained separately; production optimizations are resize/encode only.
- Verification and delivery: pending final evidence below. Browser local preview was blocked in preceding turn by URL security policy; do not claim device/browser acceptance from source/build/assets.

## Consumer dispositions and evidence

- **Changed:** Layout header, UserProfileModal and Settings edit sheet use UserAvatar; profile/settings inline picker entries share AuthContext.save and never edit tier/expiry. `src/main.tsx` loads scoped avatar styles. Selection labels have fixed typography independent of checkmark.
- **Changed:** AuthContext hydration treats Firebase photoURL including null as authoritative; name-save response merges the live Firebase photo to avoid reverting an independently saved avatar. Existing local session cache receives confirmed display state, not draft state.
- **Reviewed-and-compatible:** App navigation, profile/settings parent overlay dismissal/body scroll and name/handle/Telegram handlers retain owners. Existing paid expiry ring/status and Checkout/Receipt/referral handlers are unchanged. Catalogue photoURLs are not entitlement authority.
- **Reviewed-and-compatible:** server/api/routes.ts profile whitelist and usersDao remain unchanged; no photoURL sent through the unrelated server profile update. Existing api session/identity and notification preference queue are unchanged. Asset URLs expose only public generated artwork, not identity data.
- **Reviewed-and-compatible:** ordinary identity-provider photo URLs retain object-fit cover/referrer behavior; all catalogue assets use contain plus responsive sources. Company logos and existing icon system are unchanged. Error fallback occupies the same reserved geometry.
- **Blocked:** actual browser/device visual acceptance, keyboard/focus walkthrough and real Firebase save/reload verification. Cloud browser could not reach the previous local preview and file-preview was blocked by environment URL policy; no alternate-surface bypass attempted. No claim of production deployment or live persistence from mocks.

## Checks

- `npm run lint`: passed. Initial test actor type omitted isAnonymous; fixed the fixture and reran.
- `npm run build`: passed (TypeScript, Vite, esbuild); existing large-chunk warning remains. All 36 WebP files present in dist; generated version bump restored before committing.
- `node --test --import tsx server/tests/avatar.test.ts server/tests/preferenceSaveQueue.test.ts server/tests/accountProtection.test.ts`: 19 passed. Covers catalogue URL validation, awaited confirmation, duplicate write, failure/retry, changed account, guest denial, original-photo/initials restoration, SSR source geometry and all responsive asset dimensions/alpha. Initial asset run preceded encoder completion; reran after completion. A single resampled cat-256 corner had alpha 1/255; test permits this negligible edge tolerance, otherwise corners are zero. No artwork retouching.
- `npm run test:map`: 6 passed. `npm run map:generate` / `npm run map:check`: regenerated and checked same source state.
- 12 generated originals → 36 WebP variants, 554,968 bytes total. Full generation prompts/provenance in public/avatars/v1/README.md. No new package dependency.
- Required host `compile_applet` and `lint_applet` are unavailable; repository equivalents above run. Automated evidence does not stand in for browser acceptance.
- Delivery: prepared for direct main push under standing user authorization. CI/deployment/live behavior must be checked separately after push.
