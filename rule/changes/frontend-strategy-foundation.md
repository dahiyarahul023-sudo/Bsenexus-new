# Change: frontend strategy, rules and wiring

- Starting commit: `d1df67a462fc4ec4222b9c1944a6ebff93fabeb9`, main.
- User objective: apply the same depth of research, rules, impact tracing and maintained spider mapping to FRONTEND work. The prior backend-only interpretation was incorrect.
- Scope correction: `AGENTS.md`, README, shared workflow and templates now recognize frontend work. Earlier backend protections remain; historical change records are not rewritten.
- Verified source: `main.tsx` mounts StrictMode/App; App owns path/tab/lazy routing; contexts own identity/toasts/intelligence/notes; global and scoped styles coexist; NoteEditor dispatches notes-changed and SavedNotesScreen/Settings listen. `api.ts` emits network-status consumed by Layout. These relations are documented in FRONTEND_MAP.
- Pre-edit impact command: `npm run map:impact -- src/App.tsx src/index.css src/context/AuthContext.tsx scripts/spider-map.mjs scripts/spider-view.html` passed.
- New deliverables: FRONTEND_RULES (20 rules and state/device evidence matrix), FRONTEND_MAP (owners, journeys, events and maintenance), FRONTEND_RESEARCH (two frontend studies plus original cross-file research and React/W3C guidance), FRONTEND_STRATEGY (ordered verification priorities and honest gaps).
- Maintained relationships: nine frontend semantic domains join the existing twelve backend/shared domains. All referenced source/test paths are checked by the generator. Each domain lists candidate tests, not a coverage certification.
- Implementation: AST collects literal/computed global window/document event call sites. Impact output adds one-hop opposite-role event peers and relevant semantic domains. The viewer uses the SAME injected peer helper as the CLI, shows a separate peer card and event contract table, and preserves import-arrow semantics.
- Limits: computed names/constants, target aliases, bubbling, third-party events, context meanings and CSS inheritance require manual tracing. Events are candidates, not proof of mounted listeners or payload compatibility. Broader import closures can yield broad review sets; explain justified exclusions.
- Consumer dispositions: future AI entry instructions **changed**; semantic domains **changed**; CLI and engineering viewer **changed**; generated outputs **changed**; product frontend runtime/screens/styles **reviewed-and-compatible** (no behavior redesign in this strategy deliverable); backend runtime/schema/pricing **reviewed-and-compatible** (unchanged).
- Expected effect: frontend work has its own rules and real code-based journey map. A note-editor change can expose saved-list and Settings listeners without a direct import. Future work must document state, style, event, route and browser evidence in addition to code checks.
- Regression: the added disconnected producer/listener test failed before implementation and passed afterward. It checks event target separation, computed-name disclosure, reverse discovery and domain test selection. Existing cycle/non-recursive and script-escaping tests still pass.
- No new dependencies, schema changes, payments, notifications, production deployment or product UI redesign.
- Rollback: revert this tooling/docs commit and regenerate matching artifacts. Do not roll back unrelated backend work. Restoring the mistaken backend-only scope is not the intended long-term direction.

## Verification

- `npm run map:generate` and `npm run map:check`: passed; 304 files, 828 imports, 21 domains (9 frontend), 155 browser-event call sites.
- `npm run test:map`: 6 passed; frontend event regression failed before the implementation fix.
- Actual-repository assertion: NoteEditor impact includes SavedNotesScreen and SettingsTab as browser-event peers; passed.
- Generated viewer inline JavaScript: syntax check passed; browser interaction/accessibility not certified.
- `npm run lint`: passed.
- `npm run build --ignore-scripts`: passed; skipped unrelated prebuild version bump. Local snapshot omits public binary assets and old audit datasets, so font-resolution and bundle-size warnings remain; this local bundle is not a deployment artifact. Full-checkout CI must validate the merge.
- `NODE_ENV=test JWT_SECRET=<disposable-test-value> npm test`: isolated final run passed 257 tests, 0 failed/skipped. An earlier parallel run exited without a complete summary; it was not used as evidence of full coverage.
- Host-only `compile_applet` / `lint_applet`: unavailable, not claimed as passed. The browser matrix is a requirement for future runtime UI changes; no application visual/browser pass is claimed for this rules change.
- Deployment: none. Backend database/referral cutover evidence remains in its existing documents and is not the completion criterion for the requested frontend strategy.

## Full-checkout CI correction

The first GitHub map freshness check failed. Comparing tracked file hashes exposed newer `public/sitemap.xml` and `server/services/marketGuidesService.ts` content in the repository than in the reused local snapshot. Both local copies were refreshed from the PR commit without changing their repository contents, and the map was regenerated against that current source. This preserves the newer guide work. The initial local freshness result covered the incomplete baseline only; the final GitHub result is the full-checkout gate.
