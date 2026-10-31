# Change: bounded streaming PDF proxy (Task 4 / PDF-1)

- Starting commit: `7200ff2cba5bb28b9052c4d05eeb813c3c2650cf`, latest origin/main checked before branch.
- Objective: /api/pdf-open gets a dedicated 20/min req.ip limiter, eight-download process-wide cap (503 + Retry-After), and backpressure-aware streaming with 25 MiB running limit; retain exact BSE allowlist/redirect validation, filename and PDF type.
- Facts: routes.ts fetches all candidate bodies into readBoundedDocument before send; only generic limiter protects it. bseDocument.ts already revalidates every redirect and restricts exact HTTPS BSE hosts; preserve that helper for every caller. AI/Telegram PDF readers still require bounded buffers for extraction and are unchanged.
- Impact: `npm run map:impact -- server/api/routes.ts server/utils/bseDocument.ts`. AI-documents, public-contract, frontend PDF helper and generic API mounts reviewed. pdf-open handler moved to a focused router for injected fetch/concurrency tests; apiRouter mounts it exactly once, preserving the URL.
- Source of truth: dedicated pdfOpen router's limiter/cap and streaming function. Admission slot covers candidate fetches, backpressure and cancellation until finally; disconnected clients abort upstream. Timeouts release slots. Cap is per Cloud Run process (eight downloads per instance), not a distributed fleet cap; hosting max-instances/provider budgets remain external controls.
- Consumers: public frontend PDF opens reviewed-compatible, allowlisted attachment redirects retained; clients may receive 429/503 with Retry-After. Mid-stream oversize terminates the PDF connection (cannot send a second status after bytes), pre-stream oversize returns 413. Non-PDF and failed bodies are cancelled before trying another candidate. No external redirect target is ever copied into client Location.
- Security tests: oversize stream cancelled mid-download, no full body buffer, sanitized content disposition/type, global cap and release, IP limiter/spoofed-XFF behavior, forbidden redirect target never fetched, safe BSE-only fallback. Old-code regression evidence recorded below.
- Scope: backend only; no auth/prices/referrals/storage/migration changes.
- Commands/results: pending below. No browser/provider/live claims. Host-only compile_applet/lint_applet unavailable for this bounded route refactor; actual TypeScript/full suite/build run instead and limitation disclosed.
- Owner rollout: review/merge separately, then rebuild/deploy; no migration. Revert PR to roll back (restores memory/bandwidth risk).
- Remaining risks: attacker can rotate real IPs, consume eight streaming slots per instance, and scale traffic across instances; 5-second upstream budget, 20/min IP control and bounded in-flight count reduce per-instance exposure. Client may see interrupted PDF on oversize/upstream loss.
- Graph/domain: add focused router/tests to AI-documents; regenerate map.
- Delivery: pending commit/PR; not merged; CI/browser/deployed separately.

## Actual local verification

- `npm ci`: passed (661 packages; local Firebase patch only).
- Final serialized checks individually exited **0**: `npm run lint`, `npm test` (**878/878**, 33 suites, zero skipped/failed), `npm run build` (actual prebuild, TypeScript, Vite, startup budget, server/copy), `npm run map:generate`, `npm run test:map` (6/6), `npm run map:check`. Incidental version increment reverted.
- Focused mocked-fetch/stream/allowlist + existing audit tests: **14 passed**. Unknown-length oversize reader is cancelled after 12 bytes read with only 6 written (10-byte fixture cap); a declared oversize response is cancelled before headers. In-flight cap/release, 21st-request denial, XFF spoofing, safe filename/type and hostile redirect behavior all pass.
- Old-source comparison was **not run**: these tests target the new focused router/stream seam, which did not exist on main. Original source inspection establishes the prior buffering/no-dedicated-limit behavior; do not claim an executed old-code failure. Existing BSE allowlist tests remain green.
- Not run: live BSE downloads, browser/device PDF viewer and fleet load test. No real upstream/provider traffic, migrations or deployment. Cap is eight per process, not a fleet-wide distributed semaphore.

## Merge preparation

- Reconciled with main b9764e370e84f718028aec2af78f1ecb88dcada4; retain earlier merged tasks and this task's implementation. Generated maps rebuilt from combined source. No deployment or hosted migration. Local combined checks recorded in the PR.
