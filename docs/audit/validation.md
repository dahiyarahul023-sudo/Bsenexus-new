# Validation and coverage ledger

## Baseline and changes

* Exact remote baseline: main 55d35a16a0a0b09017f685af4f4170acc2d30b3e, tree 04566f381711344a7ffdcbc8d8da2dd03369d373. 284 blobs downloaded and Git SHA verified.
* Configured baseline test suite: 188 tests, 185 passed, 3 failed. Failure group: missing PricingPage/client branch and obsolete pricing assertions. Baseline type check passed.
* New tests use synthetic data and per-file temporary state. Existing authentication tests were also isolated after repeated runs exposed shared account-counter pollution.
* Final test suite at current checkpoint: 200 tests, all passed. A second full run also passed 200/200 after state isolation.
* TypeScript noEmit/lint and production Vite/esbuild build passed before final documentation. Recheck final tree before push. Build bumps src/version.ts; reset only that generated local bump so future publish remains responsible for it.
* Initial app chunk approximately 1.63 MB / 419 kB gzip; existing large-chunk warning remains.

## Meaningful added regressions

* Anonymous/ordinary sessions cannot invoke expensive shared administration, SEO write/fetch or global broadcasts.
* Approved BSE initial host cannot redirect into a metadata/private host; such destination was never contacted in fake-fetch test.
* Streaming document download cap works without Content-Length.
* Failed access-probe connection is inconclusive, not a blocked attack; unverified security checks remain unverified.
* 110 concurrent local quota requests consume at most 100 units; UID text admin does not unlock unlimited use.
* Ordinary callers cannot disable system alert presets.
* Empty feed has no manufactured financial announcements; failed/incomplete FII/DII source produces null.
* Malformed percent escapes do not crash share-link parsing.
* Personal Telegram destination cannot switch away from saved target or fall back to shared destination.
* Private/reserved/metadata IPs and non-HTTP URL are rejected by SEO scraper before HTTP request.
* 25-character username collision reserves suffix and deduplication terminates with unique handles.

## PostgreSQL evidence

`database-proof.json` records actual isolated PostgreSQL/PGlite execution, not a regex assertion. Original initial schema granted EXECUTE to anon/authenticated and SECURITY DEFINER function wrote a yearly entitlement for synthetic test-victim and amount zero. Fixed schema removed anon/authenticated EXECUTE; same request denied with 42501. Upgrade repair was applied twice successfully. The old 5-argument contract was also queried from pg_proc. Service-role grants were explicitly provisioned in the isolated environment; production grants/overloads still require introspection. No live Supabase request changed data.

## Browser evidence

`browser-evidence.json` records Chromium 153 on Linux with emulated widths 320,360,390,430,768,820,1024,1366,1920 and guest/Pro/admin fixtures. Routes: /, /pricing, /guides, /companies, /announcements, /results-calendar, /watchlists, /?tab=settings, /filing/TEST/AUDIT-ID. Initial 243-scene matrix: no horizontal document overflow and no page JavaScript exception. These are fixture APIs; external requests/service workers were blocked. Feed fixture was corrected to the actual array contract before final matrix.

Filing route final URL retained identity across all fixture roles. Initial client pricing fallback was repaired. 24 targeted scenes tested bottom-scroll occlusion, Choose Pro Weekly and Save Note. After final pricing connection fix, guest choice opens login; Pro/admin fixture choice opens checkout. Save Note guest displays sign-in prompt/login; Pro/admin opens editor. Footer padding/right reserve removed permanent footer-link occlusion at targeted sizes. One remaining background occlusion was an intentional notification permission prompt. Targeted action snapshots supersede first-matrix pricing action assumptions. Latest footer changes were checked in targeted cases, not another unnecessary 243-case run.

Pending: real Firebase login, live Supabase writes, Cashfree sandbox checkout/webhooks, source fetching/delivery, Safari/WebKit/Firefox, real device safe areas/keyboard, focus trapping/screen readers, production cold-cache LCP/INP/CLS, distributed races and restarts. Standard browser binary download failed; isolated Chromium npm binary enabled these local checks. Do not translate emulated dimensions into “works on every iPhone/iPad.”

## Dependency and secret limits

`dependency-audit.json` is npm advisory output: 16 vulnerable package entries, 6 high, 10 moderate, 0 critical. Aggregate dependency entries may share an advisory. No exploitable runtime path was proven from counts. No forced dependency upgrade was applied because suggested changes included a Firebase downgrade. Compatible fixes remain a separate follow-up.

Source snapshot did not include a real .env file or service account credential file; environment usage was indexed by name. Public Firebase project config is not an Admin secret. This does not establish that full Git history, generated client bundles, logs or live cloud secrets are leak-free. Reports contain synthetic user/filing data and source paths, not real credentials. Full secret-history scan and live IAM/rules verification remain pending.

## Evidence labels

* **Code fixed:** source changed and appropriate local checks pass; deployment not implied.
* **Browser verified:** the named behavior ran in Chromium with fixture APIs; production not implied.
* **Local exploit reproduced:** isolated app/database proof; no claim real customer was attacked.
* **Open static risk:** reason exists in code; reproduce before claiming observed user impact.
* **Live pending:** unavailable environment/schema/revision is needed; no invented status.

No ASVS level certification, full pentest, complete manual line review, universal device guarantee or successful live redeploy is claimed.
