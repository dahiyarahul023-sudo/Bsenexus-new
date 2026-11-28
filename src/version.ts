// Central app version shown in Settings and the public footers.
//
// The patch number auto-increments on EVERY production build via the
// `prebuild` npm script (scripts/bump-version.mjs), so each Publish in
// AI Studio bumps it: 2.6.1 → 2.6.2 → 2.6.3 ...
//
// NOTE for local dev: running `npm run build` locally also bumps this file.
// Revert it (git checkout -- src/version.ts) before pushing, so GitHub
// keeps the base and only real publishes advance the number.
export const APP_VERSION = '2.6.86';

declare const __APP_BUILD_ID__: string;
const buildId = typeof __APP_BUILD_ID__ === 'string' ? __APP_BUILD_ID__ : '';

export const APP_VERSION_LABEL = `v${APP_VERSION}${buildId ? ` · Build ${buildId}` : ''}`;
