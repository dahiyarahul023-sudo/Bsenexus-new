# Change: recover application deleted from main

- Starting commit: 221879ea4ef06c3f23d067f1f4bd6c6732c19c51.
- User objective: investigate and repair the complete AI Studio startup failure.
- Verified failure: user screenshot shows "Bun could not find a package.json file to install from", install exit status 1 and "Dev server not running" on 2026-10-11.
- GitHub evidence: the starting recursive tree has only two blobs: metadata.json and supabase/migrations/007_fix_lints_search_path_rls_rpc.sql. Its parent 8308b81ce64acb8505922d8dd14000ab229df5b3 has 487 blobs. 485 files were removed, including package.json, server.ts, src/, public/, scripts/, rules and CI.
- Recovery: restore the complete parent tree 5dbeb1308c0e8f175b2409876fa1c85bb36c0cc1 as a new commit after the deletion; no force reset. Both surviving blobs are byte-identical to the parent and remain preserved, including migration 007.
- Consumers: frontend entry/assets, backend routes/jobs/auth, package scripts/lockfile, tests, docs/maps and CI are restored byte-for-byte; no new behavior, auth, pricing, billing or database execution.
- Impact: npm run map:impact -- package.json server.ts inspected using the surviving local checkout. Entire project is affected because its entry files were removed.
- Graph/domain maintenance: restore the parent's original map, domains and rules without modifying their relationships. This recovery record is the only additional file.
- Verification: untruncated recursive trees compared, restored blob set and hashes checked after push. This proves file recovery, not successful deployment.
- Remaining release blocker: pre-deletion run 38105694007 failed npm ci because package.json/package-lock.json are out of sync (PGlite and platform package records missing). Recovery preserves that prior state; do not claim CI passes.
- Unavailable checks: compile_applet/lint_applet are not exposed. AI Studio signed-in session is inaccessible here; its file sync, install and preview cannot be independently verified.
- Owner continuation: sync the recovered GitHub main into AI Studio and verify Code contains root package.json before retrying installation. Do not initialize a replacement blank app with bun init. Republish requires a successful build.
- Database: migration 007 retained as a file only; no live SQL was applied.
- Rollback: recovery is a new, reversible commit with full prior history retained. Reapplying the deletion is not a usable application rollback.
