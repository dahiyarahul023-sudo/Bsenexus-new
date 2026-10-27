# Development preview: stable React graph, disabled HMR and active telemetry redaction

- Starting upstream commit: `99d1b20ad6dd3f174b7383f636d147a1b8078050` (26 October 2026). Work is isolated from previous scratch edits. Runtime text files were compared against the immutable upstream Git blobs. Unavailable historical binary assets are preserved through the upstream base tree when publishing this patch.
- Request: investigate the uploaded `IMG_7982.mp4`, repair its errors and improve verification so a passing build is not presented as runtime acceptance.
- Video facts: React reports repeated Invalid hook call, null `useState` at `SettingsTab`, Sentry reports ignored transaction callbacks, and Vite reports a closed-before-open WebSocket/unhandled rejection. The counter is repeated log entries, not a verified count of independent defects.
- Source facts: the starting commit already adds React/ReactDOM aliases, adds late dependencies to `optimizeDeps.include`, and rewrites `useDeveloperMode`. A fresh local Settings render on that source succeeds. The historical browser's exact optimized graph/cache/restart sequence is unavailable; its React crash was **not** independently reproduced and must not be attributed to a proven component Rules-of-Hooks violation.
- Confirmed remaining defects: Vite 6.4.4's CSS/client module unconditionally calls `transport.connect` even with `server.hmr=false`. Sentry 11 defaults to streaming and ignores the existing `beforeSendTransaction` privacy callback. The upstream npm lock also contains root Zod 4.6.7 despite the declared exact 3.25.76 dependency.
- Risk addressed: late optimizer discovery can replace shared React chunks while an HMR-disabled document retains its original renderer. Null dispatcher failures are consistent with this mechanism, but the video's precise historical cause remains unproven. Aliases alone do not stop optimizer graph replacement.

## Implementation and consumer dispositions

| Owner / consumer | Disposition and evidence |
| --- | --- |
| `vite.config.ts` browser optimization | Changed: explicit complete startup dependency set, `noDiscovery=true`; AST regression scans static imports, exports and literal dynamic imports under src and fails for an unprepared new browser dependency. Existing aliases/dedupe and lazy boundaries remain. |
| `scripts/vite-preview-client.mjs` | Changed: serve-only adapter omits the single connection call only when the final merged HMR setting is false. Retains actual Vite CSS/error/helper exports. Enabled HMR and application modules are untouched; an upstream client format change fails visibly rather than silently bypassing the adapter. |
| `server.ts` middleware-mode Vite | Reviewed-and-compatible: its final `hmr=false` uses the same configResolved gate; its enabled mode still shares the Express HTTP listener. No server startup, API, job, auth or proxy policy is changed. |
| Settings, Filings, Earnings Calendar, Market News, AuthContext, retained tabs | Reviewed-and-compatible: same actual App/main, state owners and dynamic components. Chromium visits Settings cold and switches retained lazy tabs without reloading the document. Guest/offline fixture data is explicit. No layout, entitlement, preference, notification or data policy changes. |
| `src/lib/sentry.ts`, `server/sentry.ts` | Changed: `traceLifecycle='static'` keeps the existing transaction redactor active under SDK 11. Existing exception filtering/redaction, DSN resolution and sample rate remain. SDK 12 migration must review the callback API again. |
| OAuth telemetry | Reviewed-and-compatible: shared `redactAiTelemetry` and existing AI telemetry regressions remain; no new personal data or provider requests are introduced by tests. |
| npm/Bun installation | Changed: Playwright 1.62.1 is a dev-only test dependency; regenerate the inconsistent npm lock, restoring the declared root Zod 3.25.76 and missing optional platform entries. Existing runtime versions are retained. Bun's independent build remains in CI. |
| GitHub CI | Changed: separate development-preview job installs Chromium and runs the real dev server/browser smoke. Test data intercepts every API and external request, including Sentry, so no real notification, payment, login or paid AI action occurs. Job presence does not prove branch protection requires it. |

Impact command: `npm run map:impact -- vite.config.ts scripts/vite-preview-client.mjs src/lib/sentry.ts server/sentry.ts`. Reviewed document-startup-security, operations, navigation and AI telemetry consumers. No API/storage/cache-key contract or production migration is added.

## Acceptance and evidence

- `npm test` under CI's disposable test JWT configuration: **817 tests passed**, zero failures/skips. Includes browser-dependency coverage, actual installed Vite-client adapter behavior and server Sentry lifecycle assertions; existing telemetry privacy tests pass.
- Typecheck and production build pass. Startup budget: **968463 raw / 260919 gzip bytes**. Build used `--ignore-scripts` to avoid an unrelated version bump.
- Actual Chromium 153, 390/768/1440 CSS px with reduced motion: cold Settings renders; tablet/desktop Settings → Filings → Earnings Calendar → Market News → Settings → Filings → Settings navigation succeeds. Tailwind body styles still apply; one optimized React graph; zero hook/null-dispatcher errors, ignored-Sentry callback warnings or HMR sockets.
- The same browser check on the starting upstream config/client Sentry reproduces ignored-callback warnings on all three widths, **three disabled-HMR socket attempts and two optimized dependency graph hashes in the same server session**; the regression fails. Fixed source passes with one graph and zero sockets. The graph replacement mechanism is observed; the video's exact null-useState failure is still not independently reproduced.
- The local standard Playwright browser CDN download was unavailable. A separately installed scratch-only serverless Chromium binary was used instead; it is not shipped or added as a project dependency. Local source snapshot lacks some historical fonts/logos, so typography/branding pixel acceptance is excluded. CI uses the unchanged real upstream assets.
- Physical iOS/Android, signed-in/Pro/admin accounts, host-specific reverse proxies, deployment and old open AI Studio documents are not certified. Tests do not grant identity or weaken authorization. Enabled-HMR local module behavior is covered by the adapter regression; the hosted proxy's socket path remains infrastructure-specific.
- Clean isolated `npm ci --ignore-scripts --no-audit --no-fund`: exit 0; Playwright installed and root Zod 3.25.76 verified. Local full tests/build used the pre-existing pinned runtime dependency installation; the clean-install validation is separately recorded.
- `map:generate`, `map:check`: pass, 557 files / 1476 edges / 26 domains; six map tests pass and `git diff --check` passes. Host `compile_applet` / `lint_applet` tools are not available; repository typecheck/build are recorded separately.
- Final repeated fixed browser check: `runtimeErrors: []`, `hmrSockets: 0`, `reactGraphs: 1`. The starting-source check reported three Sentry warnings, three sockets, two graph hashes and failed as expected.
- GitHub CI/merge and live hosting are separate from these local results and are reported in the PR/handoff.

## Recurrence and delivery

Run the new dev-runtime browser check after dependency, lazy-import, JSX-runtime, optimizer, React/Sentry or HMR changes. Keep new browser runtime dependencies in the explicit include set. Review callback compatibility when upgrading monitoring SDKs. Do not replace/rename hooks merely because the dispatcher is null: first distinguish hook order/call-site defects from multiple React runtimes.

Already-open development documents cannot safely keep their previous React modules after a dependency/config/server restart. After syncing this change, restart AI Studio's preview and reload the document once. This is a development cache/module lifecycle step, not a production data reset. A build and backend tests alone are insufficient evidence of this workflow.

Rollback: revert this bounded change and its dev-only test dependency/lock/workflow together; no data migration. Existing deep-audit production migration/runtime publication prerequisites remain independent and are not bypassed. Source/merge/CI/deployment are separate delivery states.

Action evidence: open/switch Settings and sibling tabs is specified, source-traced, implemented, automated-tested and browser-verified with guest offline fixtures; private accounts and live host publication remain unverified. This bounded runtime repair does not complete the full frontend consistency program.
