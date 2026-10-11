# Fix: AI Studio compression middleware TS2769 under fresh Bun resolution

- Starting main: deac36517929badb5edd75755dbf3258aa3e2886.
- Screenshot: server.ts(57,9) TS2769, last-overload message, build exit 2 repeated; Cloud Run precondition toast has no detailed reason. OneSignal App ID prompt separate.
- Reproduction: Bun 1.4.3 fresh minimal Express 4/compression install with original declared types fails tsc at app.use(compression(...)) with TS2769/RequestHandler not assignable to PathParams. Same fixture with global Express 4 type overrides passes.
- Fix: exact @types/express 4.17.25 and root overrides for @types/express/core 4.19.9; retain existing grpc security override. Update npm lock. No runtime middleware cast, suppression, Express major upgrade or behavior change.
- Reviewed-and-compatible: global compression/filter/SSE exclusion, cookie parser, auth/API middleware and responseHeaders keep their existing runtime behavior. Only dependency type resolution changes. New CI job uses fresh Bun without npm lock so npm-only validation cannot hide this regression.
- Impact: map:impact server.ts/package.json; map regenerated/checked. Runtime routes/storage/jobs/copy unaffected. CI's npm lock move is within an isolated disposable job; committed lock and application files remain intact.
- Validation: before fixture fails, corrected fixture passes. Full clean Bun resolution and npm build results recorded in final handoff. Initial isolated full-source copy omitted root server.ts and failed with missing-module setup error; copied root and reran.
- Full clean Bun 1.4.3 install without npm lock: 611 packages; actual Firebase patch, typecheck/Vite/esbuild production build pass. Fresh Bun picks newer permitted runtime dependency versions, so its bundle measurement is separate from the locked npm baseline.
- Unavailable host compile_applet/lint_applet: use repository build/typecheck equivalents. Screenshot alone does not establish Cloud Run precondition cause or successful deployment.
- Release: update AI Studio package.json with exact versions/overrides, reinstall dependencies and rebuild before publishing. Keep npm lock for npm/CI; ignore any stale Bun dependency cache via normal reinstall. Keep private service keys server-only.
- Rollback: revert this dependency-only commit if needed; no production data changes. Preserve earlier application recovery/security fixes.
