# Watchlist, unread alerts, device delivery and Radar repair

- Starting remote main: `44c21bab82143a768344a1398638546e6427835a`.
- User objective: repair the Red watchlist from phone through desktop, retain company names, show the five unread alerts clearly, keep device notification On/Off available, group same-company Radar reports, stop false source-delay states and exclude unrelated companies from Home.
- Evidence: six user screenshots dated 2026-10-19. `HomeForYou.watchlistFilings` used company-name substring matching; `WatchlistManager` had two duplicated editors inside a fixed 480px scroll panel; its item parser discarded company metadata. Softglass applied a solid background to the whole icon-only switch. Native push permission hid the banner independently of provider subscription, leaving no permanent retry/off control. `radarIntakeStatus` depended on one instance's memory and treated optional RSS age as whole-Radar delay.

## Ownership and coordinated changes

| Consumer | Disposition and evidence |
|---|---|
| Home watchlist preview and Radar scope | Changed: `shared/watchlistIdentity` admits active lists and exact BSE codes, exact symbols or complete normalized company names. Conflicting codes fail closed. Home requests the selected stock identities and refreshes on `watchlists-changed`; no ticker substring matching. Empty/error states are distinct. |
| Watchlist companies, edit panel, selection, priority, notes and company detail | Changed: `WatchlistEditor` has compact list controls, four always-visible priority filters, optional add settings, full company identity and ordinary page scrolling. Existing create/rename/delete/undo, company detail, notes and priority commands are retained. Names/codes survive add, parse, priority and undo. App remount and account-keyed caches isolate account changes. |
| Watchlist API/JSON persistence | Changed compatibly: optional company name/code accompany single-stock additions; server master identities take precedence, and the permissive numeric fallback no longer overwrites a stored name. JSON metadata needs no watchlist schema change. Existing Pro/auth gates and monitor invalidation remain. |
| Inbox list, read actions, header/profile counts, installed-app badge | Changed: inbox opens on Unread, keeps all five filters visible, labels Read/Unread, and background-refreshes visible content. Read success is confirmed before changing the list/count; failed writes retain unread items. Owner/filter guards avoid stale read results. `useUnreadNotificationCount` also updates the optional App Badging API from the same confirmed count. |
| Alert presets and custom rules | Changed: shared contained switches, wrapping headers, concise copy and sticky Save changes/Done state. Both save entry points call the same durable preset mutation. Existing scope/channel policy and custom-rule API are retained. |
| Settings, alert modal and optional permission banner | Changed: shared `DeviceNotificationControl` always exposes per-device On/Off and installation/denial/retry status. `oneSignal` keeps native permission separate from provider subscription, confirms delivery registration, persists explicit device opt-out and guards newer choices against late Allow. Existing worker URL/scope and no automatic permission prompt are preserved. |
| Radar Home/dashboard/detail/follows | Changed: one presentation group per exact company set, latest report first, with every separate report reachable. Durable event/update IDs and follows are retained; unrelated proceedings are never rewritten into one case. Filters run before grouping. Existing source history, detail and price provenance remain compatible. |
| Radar source status, poller/watchdog/cron | Changed: private `impact_radar_source_checks` records seven days of intake scan outcomes, shared across instances. List GET remains database-only, reading the latest actual scan. Unknown, failed, overdue and optional-news outage states are distinct. The existing awaited cron maintenance and watchdog continue driving intake; no fake checks are seeded. This scan status is not a claim that a newly published exchange filing has already been ingested. |
| Authentication, payment, referrals, AI quota, Telegram policy, public announcement feed | Reviewed-and-compatible: no entitlement, pricing, reward, summary, Telegram recipient policy or shared public-feed contract was changed. Server notification broadcasting is retained; a new unread inbox item does not itself prove OS push delivery. |

## Action and failure contracts

- `watchlist.stock.add`: draft/search → optional optimistic row → confirmed API write → named stock snapshot/cache → Home refresh. Error preserves input; no confirmed success toast before the response. Duplicate add/create clicks are guarded. Numeric-only stocks may still show BSE code until a sourced company name is available; no company name is invented.
- `watchlist.priority.change`: existing command changes all occurrences; name/code metadata is retained in the durable JSON.
- `notification.read`: owner-scoped write → confirmed item/read-filter update → authoritative count refresh → optional installed-app badge. Failed writes retain unread state. Mark-all updates the captured IDs without treating subsequently loaded items as confirmed read.
- `device.push.change`: direct user gesture requests native permission when necessary → provider registration/opt-out → subscription confirmation. Browser denial, iPhone browser-tab installation requirements, unavailable SDK and newer competing choices have explicit outcomes. Desktop permission never grants an iPhone permission.
- `radar.company.open`: exact company group → independently identified report → its original timeline/follow/price anchor. Grouping only changes presentation.
- `radar.scan.status`: successful/failed intake completion → private check row → any instance's database-only read. An older write cannot replace the newest timestamp; cleanup affects only the seven-day operational ledger.

## Validation and release evidence

- Impact analysis: `npm run map:impact -- src/components/WatchlistManager.tsx src/components/HomeForYou.tsx src/components/NotificationInbox.tsx src/components/AlertRulesModal.tsx src/utils/oneSignal.ts src/components/ImpactRadar.tsx server/services/impactRadarService.ts`, then App/count/DAO follow-through. Imports, browser events, API/JSON consumers, themes and source jobs were manually reviewed.
- Behavior coverage: exact identity/short-ticker false positives, inactive/conflicting codes, numeric company metadata after priority edits, same-company grouping without ID rewriting, private RLS check history, out-of-order checks, unknown/partial/overdue source states, permanent push Off/reload and unconfirmed registration. Render coverage checks all priority controls, full names, separate Radar reports and switch semantics.
- Staging migration applied and queried: RLS enabled, anon read denied, authenticated write denied, service-role write allowed. No user alerts or sample scan-success rows sent/inserted for verification.
- Required host-only `compile_applet` and `lint_applet` are unavailable as tools or executables. Managed preview browser control is unavailable, so no interactive browser, actual phone/tablet/desktop screenshots, focus/zoom/keyboard/OS-push checks are claimed. Source/SSR checks do not certify the device matrix.
- Validation commands and final results are recorded below after completion.

## Release and recovery

Apply `20261019143927_radar_source_checks.sql` before the runtime release. Existing authenticated scheduler/watchdog must execute a real intake to populate check history; an empty history remains explicitly pending. Publish the normal application hosting release after the GitHub commit. A GitHub push and table migration are not application deployment or confirmed iPhone push delivery.

Rollback: restore the previous application commit; retain the additive private table and original event/follow evidence. Clear only newly introduced account-scoped client caches if needed. No watchlists, historical reports, follows or receipts are deleted by this repair.

Action evidence: specified, source-traced, implemented and automatically tested where listed; actual browser/OS/provider acceptance remains unverified. Full frontend-program completion is not claimed.


## Final verification — 2026-10-19

- `node --test --test-concurrency=4 --import tsx server/tests/*.test.ts`: **539 passed, 0 failed, 0 skipped**.
- `npm run build`: passed (TypeScript, Vite and server bundle). Existing large-entry-chunk warning remains; no performance improvement is claimed. The build's automatic local version bump was restored before commit as `src/version.ts` instructs.
- `npm run lint`: passed. `npm run test:map`: **6 passed**. Regeneration/freshness check passed with 419 files, 1,108 import edges and 24 semantic domains.
- Production and staging: additive `radar_source_checks` migration applied successfully. Production query confirms RLS enabled, anon read denied, authenticated write denied, service-role write allowed and zero seeded checks.
- Security advisor: the new private table has the expected informational [RLS-with-no-browser-policy notice](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy); browser grants are revoked, and only the server writes it. Four pre-existing mutable-function-search-path warnings concern unrelated functions and were not modified.
- Browser/device/provider testing remains unavailable as described above. No real push, Telegram message or synthetic scan success was sent as a test. Hosting release and subsequent real scan/phone delivery remain separate from this code and schema handoff.
- Delivery target: tested source pushed to the existing GitHub `main` after checking its expected head; application hosting deployment is not performed by this task.

Migration identity: the script was created with the CLI, then its local filename was aligned to the actual production-applied version `20261019143927` before commit. Staging records the same SQL under its native application version `20261019143034`; no applied history or schema was rewritten.

First-read follow-through: `createDefaultWatchlists` now resolves its stock metadata at creation time. A new-account regression confirms that the very first Home request can exactly match TCS by BSE code without waiting for a cached list to expire. The complete suite was rerun: 539 passed; the application build passed again. GitHub checks for the main repair commit `317468e2e752da682188542cbed469a19f2b0397` all passed before this follow-through.
