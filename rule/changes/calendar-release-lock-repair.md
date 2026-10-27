# Repair reproducible calendar release dependencies — 27 October 2026

- Starting commit: ec3cd17f52e07d8f7ddcab6f2ba41d1dd6ac2fbb.
- Objective: restore clean reproducible npm installation and existing release checks while preserving current homepage lazy loading, payment-store changes, calendar coverage, security and other source behavior. This is a release gate discovered during the authorized calendar SEO sprint.
- Evidence: current main's application, rules-map and development-preview jobs fail; Bun passes. All three failing logs start with npm ci EUSAGE: required playwright1.62.1 absent, zod4.6.7 does not satisfy manifest3.25.76, and optional platform packages missing. Application fallback cascades into missing-module TypeScript diagnostics; these are not independent proof of hundreds of source errors.
- Parent2e863cbe38fb1ebcf9ed1db6117d9bf8adfe78c3 has all four checks green. Current package.json is unchanged by ec3cd17; only package-lock.json changed. Reuse that matching committed parent lock rather than selecting fresh versions or removing live SDK imports. Isolated npm ci against this manifest/parent-lock installed661 packages successfully.
- Planned source of truth: package-lock.json only; generated graph refreshed from actual reconstructed sources with TypeScript pinned by the restored lock. Dependency versions and intended manifest remain unchanged.
- Checkout limitation: git transport has no credentials in this environment. Reconstruct source-pattern files at the exact SHA through the connected repository; verify every byte against Git blob IDs before tests. Never upload unrelated reconstructed files. Required host compile_applet/lint_applet are unavailable; normal repository checks and remote CI remain separate.
- Impact: run map:impact for package-lock.json before changing it. No import consumers or API/storage schema changes are introduced by a lock-only repair. Review Node/Bun build, dev-runtime preview, map generator, offline backend tests, MCP SDK/zod runtime imports and browser-tool dependency contract. Existing UI actions/payment/auth semantics are reviewed-and-compatible because those source files are preserved byte-for-byte.
- Acceptance: npm ci succeeds without fallback; applicable repository tests, lint, map generation/check and production build pass; final GitHub checks pass before merge. No real payment, notification, paid AI request, migration or deployment is part of verification. No new low-value implementation-mirroring test; clean install plus actual suite/build challenge the regression.
- Rollback: revert only lock and regenerated artifacts/evidence; do not revert unrelated homepage/payment/security changes. Existing deep_audit_security production prerequisite remains separate and was still absent from read-only migration history27 October.
- Delivery status at record creation: prepared, not committed/merged/deployed. Final results appended after verification.

## SEO measurement and live log

27 October live calendar HTTP200, self-canonical, one H1,93/93 cached dates, zero numeric company headings, correct27 October–10 November window; last sync27 October00:29:56.464 UTC. Guide has three direct calendar links; calendar links back. Dynamic count growth91→93 is not an SEO gain. Homepage now has one raw-HTML H1 (missing yesterday); this is observed delivery, not an authored change in this repair. Hosted entry index-DcyNui8P.js differs from yesterday; exact backend/hosting revision is unverified.

Both legacy aliases still return200/no Location in this request environment despite the existing main301 handler. A control request to http://bsenexus.in/results-calendar exposes301→HTTPS; /privacy also returns200 despite source redirect. Do not infer the exact edge/origin cause or recreate the existing redirect. Need hosting/origin evidence; user owns publishing. Plugin Management's Cloudflare search returned no usable integration.

Finalized Windsor read: requested27 September–26 October, observed through24 October; newest fetched rows27 October02:56:55 UTC /08:26:55 IST. include_fresh_data=false, no force refresh. Missing25–26 October are not zero activity; older rows retain cache fetch timestamps. Page-only total173 impressions,0 clicks,CTR0%, weighted position26.06.

| Window | Impressions | Clicks | CTR | Impression-weighted position |
| --- | ---: | ---: | ---: | ---: |
| 11–17 October | 50 | 0 | 0% | 21.32 |
| 18–24 October | 31 | 0 | 0% | 37.84 |

Only24 October is newly returned:4 impressions,0 clicks, position46. This tiny partly post-release observation cannot measure the effect of PR16 whose exact release time is unknown. Weighted lower position is better. Different rolling windows are not equivalent to before/after release experiments.

India target-query period27 September–24 October: all returned groups zero clicks. bse results calendar: calendar MOBILE2 impressions/20.5 position,DESKTOP1/49; guide MOBILE4/24.75,DESKTOP3/16.67. bse result calendar: calendar DESKTOP2/45,guide DESKTOP6/12.83,MOBILE2/32.5; legacy DESKTOP1/55. bse quarterly results: calendar DESKTOP11/43.82,guide DESKTOP8/25.125,legacy DESKTOP1/74. upcoming bse results returned no rows; no India home/TABLET rows returned. Absence is not zero demand; query totals omit anonymized queries and remain separate from page totals. No current India live rank or harmful cannibalization claim.

Sources: live https://bsenexus.in/results-calendar and guide/aliases/home; connected Search Console and production migration history; https://github.com/dahiyarahul023-sudo/Bsenexus-new/actions/runs/40379114034 ; current/parent commits and reviewed source.

## Final local verification and reviewed diff

- All564 source files plus domains were verified against upstream Git blob IDs before mutation. Additional repository assets/fixtures were restored byte-for-byte after an initial partial-checkout suite run reported819/826 with seven ENOENT failures (icon/avatar files, two guide drafts, two CSVs and _redirects). No assertions were weakened. Final full suite:826 tests/32 suites passed, zero failures/skips, NODE_ENV=test and disposable offline JWT secret,32.04s.
- Matching manifest + restored parent lock clean npm ci --ignore-scripts --no-audit --no-fund:661 packages installed. Restored lock blob3d7262dec472a9f6dad062967ceba25ba83e5df8 exactly matches the green parent's existing blob; package.json unchanged.
- npm run lint passed with TypeScript5.8.3. npm run build --ignore-scripts passed (no prebuild version bump); startup budget620339 raw/173589 gzip across one entry file. These are build bytes, not measured device-speed improvements. Existing bundle warning retained.
- npm run map:impact -- package-lock.json: no reverse-import/semantic-domain consumers; manual SDK/zod/dev-runtime source trace completed. npm run map:generate and map:check passed:564 files,1499 edges,26 domains. Six map-tool tests passed.
- Generated map correction also removes a phantom firebase-applet-config.json fingerprint absent from Git and refreshes an already-stale src/version.ts fingerprint. Actual src/version.ts and all other source files remain exact upstream blobs. Import edges are unchanged. Both map artifacts generated by the unmodified repository script, never hand-edited.
- Recheck against tree after tests: only package-lock.json and generated map outputs differ; new evidence record is additive. No production mutations, notifications, payments, API contract or UI-source edits.
- npm run test:dev-runtime attempted locally but Chromium executable is absent; remote development-preview CI must pass before merge. Required host compile_applet/lint_applet are unavailable. Current-source production physical-device/CWV and exact deployed revision remain unverified.
- Uploaded generated artifact SHAs verified equal local Git object hashes. CI/merge/publication remain separate; final delivery details are recorded on the PR.
