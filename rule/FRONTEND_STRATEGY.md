# Frontend strategy and evidence-based priorities

2026-10-25 follow-up: eager animation components use m with main-owned LazyMotion/domAnimation; full-motion dynamic screens remain separate. Canvas curve points are reused with identical drawing-command evidence. Calendar Telegram uses current Indian-day eligibility and a separate service-only code/day ledger across restarts; legacy cutover and uncertain outcomes do not replay automatically. See changes/performance-calendar-followup.md for validation and publication boundaries.
2026-10-24 measured startup: App keeps the terminal shell, auth/plan/admin dialogs, share detail, notes and checkout/receipt behind demand boundaries. The initial static JS closure measured 1,523,525 to 1,007,826 raw bytes and 402,836 to 272,481 gzip bytes in the same local dependency environment. Hero heading/copy/CTA render without entry fades; sample bars animate scale instead of layout width. Every production build checks the static closure and deferred-feature records, with a 1.10MB raw / 300kB gzip regression limit. Real Navigation Timing samples retain >=60s visits; missing values stay null and the admin load card includes retained-sample p75/p95. These are not Core Web Vitals. Authenticated-only telemetry, 500 retained events, anonymous RUM, physical devices, live CDN caching and post-publish Lighthouse remain distinct limitations. See changes/performance-startup.md.

2026-10-24 calendar legacy entry: root ?tab=results-calendar and ?tab=results now redirect to the source-backed /results-calendar document before either server fallback. Other URL state survives; private/ambiguous tabs and non-root routes stay with existing owners. Public company footer links directly. PR 16 names/guide links were observed live today; the new alias correction still needs separate release verification. See changes/calendar-legacy-entry.md.

2026-10-24 bounded ADR/Story follow-up: optional account-saved bottom Story navigation uses the existing queue, Switch and failure feedback; gesture navigation remains tested when hidden. Public ADR cache survives browser reload/server restart, retains missing symbols on partial refresh and distinguishes unconfirmed evidence. Unit/callback tests do not certify device layout or deployment, and an ongoing upstream rate limit is not called repaired. See changes/adr-bse-story-results.md.

2026-10-23 calendar discovery: standalone results/board-meeting guide actions now lead directly to /results-calendar from header, intro and footer. Existing native routing and callout/button styles remain owners. The public calendar links back to its explanation. Exact-code F&O names supplement the resolver in calendar read HTML/schema and connected tools; unknown cached names remain intact. Product copy no longer promises zero-latency or millisecond delivery. See changes/calendar-discovery-identity.md for tests and separate browser/merge/publication status.

2026-10-21 MCP directory follow-up: public setup/tool/coverage docs, one shared client/server privacy disclosure and current identity presets address the supplied checklist. Existing AI Connections advanced help links to the guide; Watchlist/Story/F&O fallbacks share the corrected IndusInd identity. Synthetic-adapter Chromium checks cover 390/768/1440 px, keyboard tool disclosures and guide/privacy navigation. Clean external Claude/Inspector, reviewer provisioning and source-data permission remain separate gates. See changes/mcp-directory-checklist.md and docs/MCP_DIRECTORY_REVIEW.md.

2026-10-21 directory/loading follow-up: Settings Companies & Exchanges and AI Connections now use App-owned internal history navigation and the existing page skeleton during cold lazy imports. One ordered directory module supplies live totals to client/server copy, metadata, filters, schema and landing discovery; Nexus Select Trust is appended as NXST/543913. Delayed-chunk Chromium checks cover phone/tablet/desktop, Back/Forward and document continuity with synthetic auth/API adapters; live publishing and crawler acceptance remain separate. See changes/directory-loading-indexnow.md.

2026-10-21 screenshot follow-up: readable calendar identities and sticky date headings, direct Story controls/visible progress, responsive AI revoke cards, neutral startup, silent restoration and distinct-company Home previews address the reported journeys. BSE/NSE operator profiles use verified public identities and official investor links, with coordinated directory and sitemap discovery. Actual component/CSS Chromium checks use synthetic auth/API adapters; physical devices, live OAuth and hosted release remain distinct. See changes/calendar-story-ui-followup.md for exact outcomes and limitations. This does not certify the entire frontend program.

2026-10-21 bounded calendar follow-up: All / F&O Stocks / Watchlist reuse existing controls. Per-account last selection, scoped cache/request guards and authoritative server membership address this calendar journey. Direct BSE security-code intake includes uploaded stocks absent from the symbol master (including 544307); partial failures preserve existing schedules and successful sync invalidates enrichment. This does not change filings, AI/history intake or subscription policy. Automated/render/build evidence, blocked browser interaction and delivery status are recorded separately in changes/calendar-fno.md.

2026-10-20 Settings AI entry correction: the existing connection row is now included in the rendered Settings group. Eighteen identity/search/action render checks pass; actual browser/device and hosted OAuth verification remain separate. See changes/ai-settings-entry.md.

2026-10-17 bounded Impact Radar follow-up supersedes the initial inline layout: two Home cards and separate ordinary news, native full Radar dashboard/detail, Watchlist Radar scope, timing colours with labels, reduced-motion-safe pulse, source/date evidence and observed NSE session changes. The existing RSS cache coalesces simultaneous Radar/news requests. Neutral pre-event content, authenticated durable follows and reviewed-case grouping remain intact. Automated source/contract/render tests do not certify browser/device usability or hosting deployment; see changes/impact-radar-follow-up.md.

2026-10-11 performance follow-up: entry JavaScript 1,692,008→1,464,208 raw bytes; default CTA delay and recursive layout reads removed; decorative work bounded/paused and optional SDKs deferred. Clean install/tests/build pass. Browser acceptance, real INP/PageSpeed improvement and deployment remain separate gates. See docs/audit/PERFORMANCE_SECURITY_2026-10-11.md; P3 is not complete from bundle size alone.

User clarification, 2026-10-07: apply the depth of backend planning to FRONTEND work. The backend-only restriction added in PR #9 was a misunderstanding. This strategy corrects scope and preserves existing backend safety controls. It does not claim a complete frontend redesign or a full browser audit.

Baseline inspected: main `d1df67a462fc4ec4222b9c1944a6ebff93fabeb9`. Read current source when resuming; generated maps and historical reports are aids.

## 1. Establish the frontend operating system

Deliverables: `FRONTEND_RULES.md` (20 rules and an evidence matrix), `FRONTEND_MAP.md` (source owners and journeys), `FRONTEND_RESEARCH.md` (primary sources and official guidance), nine `frontend-*` semantic domains, and generated browser-event call sites/peer links in the existing spider map. `AGENTS.md`, the shared workflow, change template and PR template route future contributors through them.

The map remains maintained by generation/watch/freshness checks. It does not become production telemetry. Existing CI checks its structure; actual UI behavior needs browser checks when runtime/frontend styling changes.

## 2. Establish an honest browser baseline before choosing redesigns

| Priority | Inspect next | Acceptance evidence |
|---|---|---|
| P0: identity and paid actions | Guest/login/expiry; checkout return; receipt/history; referral pending and confirmed state | Correct identity and confirmed outcomes; stale/denied/retry states visible; no duplicate action; sandbox provider flow where needed |
| P1: navigation and loading | App path/tab logic, share routes, lazy panels, PageSkeleton, scroll restoration | Direct entry, refresh, Back/Forward, slow chunk, failed chunk, cached navigation; usable content never disappears without a recovery path |
| P1: shared overlays | Body-scroll lock, payment and note dialog hooks, custom confirmation/dropdowns | Nested open/close, Escape, keyboard tab order, focus restoration, mobile keyboard and scroll; failures documented before bounded fixes |
| P1: editable state | Note draft/save/list/count; queued preferences | Failed save preserves input; newest edit wins; delete does not reappear; account switch cancels or isolates old work |
| P2: design consistency | Global CSS/theme/fonts, shared actions, layout, payment/referral/notes styles | Before/after evidence across related surfaces, device widths and themes; no speculative global token rewrite |
| P2: feed and AI | Filters, density, stale timestamps, summary cancellation and quota events | Rapid changes, background refresh and late response checks; no old result replacing a newer selection |
| P2: offline/privacy | Service-worker and application caches, network banner, consent/push controls | Reconnect and account switch; private content isolation; meaningful consent/permission recovery |
| P3: measured performance | Eager/lazy imports, long lists, repeated polling, costly animation | Reproducible profile/bundle/network evidence before/after; select improvements from measurements |

These are review priorities, not a list of proven bugs. Some existing behavior has tests; inspect coverage rather than assume an entire screen is covered. No new business policy, pricing or visual direction is invented here.

## 3. Make one verified frontend change at a time

For each concrete issue: reproduce → trace imports/events/state/CSS/API → explain connected effects → implement → test the affected journey and sibling states → update rules/map/change record → review and deliver. Use screenshots for visual comparisons and interaction evidence for behavior. A screenshot alone cannot verify saving, payment, retry or keyboard flow.

Start with the highest-priority reproducible failure in the baseline. Do not rewrite the whole application merely because it has several styling systems. Request a product choice only when the current source and user instruction do not settle a material design/behavior decision.

## Current evidence limits

2026-10-23 calendar/brand follow-up: durable history recovery, rolling-source retention, IST-day cache projection and post-commit filing pagination scroll/focus have regression coverage. The round logo opens Story; brand text uses For You, as clarified in changes/story-toolbars-company-adr.md. Archive preserves past meeting evidence without inventing result declarations. Browser/device and deployed behavior remain separate gates. See changes/calendar-archive-home-scroll.md.

- Repository source establishes React/Vite, shared contexts, custom path/tab handling, mixed eager/lazy screens, global and scoped CSS, browser events and existing utility/API tests.
- Existing `npm test` lives under `server/tests` and includes some frontend utility/contract tests. This is not a complete browser, visual-regression or accessibility suite.
- No production UI, browser/device support matrix or accessibility conformance has been certified in this rules change. Package build warnings are not performance measurements.
- The payment database/referral cutover requirements remain in backend documents. They are relevant dependencies for those frontend journeys, not the purpose or completion condition of this frontend-rule deliverable.
- Future implementation updates must mark this strategy with actual evidence and remaining gaps. Do not leave resolved problems described as open decisions or promote untested requirements to “passed.”

## 4. Complete the user's full frontend requirement

Read [FRONTEND_COMPLETION_GUIDE.md](FRONTEND_COMPLETION_GUIDE.md) before planning or implementing frontend consistency work. It specifies screen/action inventory, shared command and state ownership, every action's required effects, a design/token adoption contract, action-level interactive mapping, automatic refresh, enforcement and evidence gates.

Current status (2026-10-07): these missing requirements are now specified; their runtime implementation and browser verification remain open. The previous foundation establishes rules and file-level mapping only. Execute phases A–G in the guide in bounded feature changes; update this status with concrete evidence after each change. Never treat the written strategy as proof that all buttons, screens, styles or transitions comply.


2026-10-08 bounded alert implementation: stable preset identity, durable confirmation, separate custom rules with edit controls, owner/session response guards, and periodic server snapshot refresh address phase C for alert settings. Browser and live provider verification remain separate release gates; see `changes/alert-reliability.md`.

2026-10-09 bounded referral repair: full-link parsing and shared checkout input address truncated paste and forced capitalization; wrapping URL/code presentation addresses clipping. Backend alias ownership/reward policy remains unchanged. Automated and browser evidence are recorded separately in `changes/referral-link-input.md`; this does not complete the full frontend program.


2026-10-09 bounded Home news implementation: prominent text-only lead/support cards, visible-screen polling, explicit pending-headline acceptance, original-link/date provenance and mobile News access address this Home journey. Existing NewsPortal and server RSS cache remain compatible. Behavior tests/build/map checks are separate from actual device/browser verification; see `changes/home-market-news.md`. No claim of full frontend completion or deployment.


2026-10-09 screenshot-guided mobile correction: Home news metadata/controls compacted, shared action primitives adopted, full news search/action wrapping fixed, and mobile branding restored after removing phone theme toggle. Separate Story/Active header controls removed as requested. Source/automated evidence and browser/device acceptance remain separate; see `changes/news-mobile-controls.md`.


2026-10-09 news simplification: icon-only AI/Share/Notes replace redundant direct dispatch/external-open controls. Dedicated News navigation replaces Settings news discovery shortcut. Existing AI feedback, note editor, share actions and automatic delivery preferences remain; evidence in changes/news-minimal-actions.md.


2026-10-09 keyword guides: shared static English article records supply server catalogue and frontend fallback. Native links open full server-rendered API/shareholding drafts with code, semantic tables, eight FAQs/schema and exact metadata. Pending review is explicit; getIndexableMarketGuides excludes them from discovery/sitemap/IndexNow. Existing guide modal and backend business rules remain compatible. See changes/keyword-guides.md for tests and separate browser/deployment limits.


## Filings refresh verification — 2026-10-09

Cache initialization and every refresh share publication-date sorting and seven-day pruning. Historical backfill cannot outrank current filings through ingestion time. Cached/unverified, failed, blocked, empty and historical feeds have explicit status; the header offers refresh. `server/tests/announcementFeed.test.ts` covers data ordering, corrected records, IST parsing and status policy. Fresh production browser showed today’s filings before this change; the screenshot’s old session was not reproduced. Post-change device/reconnect verification remains a deployment audit item. See `changes/filings-freshness.md`.


## Approved material visuals — 2026-10-10

Shared `styles/rich-ui.css` owns light/dark surfaces, semantic accents, layered edges and explicit action/focus/pressed/disabled states. `ui/RichVisual` supplies small decorative native vectors and real Earnings date tiles. Navigation retains one `renderNavIcon` across desktop, menu and phone dock; the active footprint is fixed. Helios badges preserve semantic tone and text, and shared ActionButton/PlanCard/SlidingTabList distribute the approved treatment to existing consumers.

Notes/Watchlist empty illustrations, locked Pro, checkout selected/next plans, confirmed receipt, referral metrics/stable tabs, compact push prompt, quiet inbox unread accents and filing controls adopt the system. Logos and company identity are excluded. Cashfree prices/verification, expiry, referral drafts/SSE/payouts, notes writes, watchlist search and modal ownership remain with their existing modules. Legacy softglass is an explicit warm-light exception, not a new app theme. Browser execution was blocked by the environment; source/build evidence does not certify rendered/device behavior. See `changes/rich-visual-system.md`.


## Original profile avatars — 2026-10-10

`profile.avatar.select` is a draft in inline AvatarPicker, entered through Account Profile or Settings Edit Profile; selection changes only its preview. `profile.avatar.save` goes through AuthContext/createAvatarSaveController to existing Firebase Auth updateProfile. Confirmed writes update profile/cache/header; denial, outage and account changes preserve existing display and permit retry. Account photo restores the identity provider photo or initials. Firebase photoURL, including an explicit null, is authoritative during hydration and name-update response merging. No server profile whitelist or paid rights changes.

UserAvatar shares 96/256/512 transparent WebP sources across header, profile and Settings. The grid auto-fits, selection does not alter label geometry, existing overlays own scroll/focus, English labels and shared theme/focus tokens remain. Company logos are excluded. Save-controller/SSR/asset tests establish source behavior; real-device rendering and live Firebase save remain unverified in this environment. See changes/profile-avatars.md.


2026-10-10 avatar follow-up: Settings index Account & Identity and its Profile row now render the selected shared UserAvatar. Account section exposes direct Change avatar with the existing inline picker; Edit Profile keeps its picker. Avatar/photo/character search terms discover profile controls. Section/sheet/account changes dismiss draft UI. Persistence and other consumers remain unchanged; browser/device acceptance is unverified. See changes/settings-avatar-entry.md.

2026-10-17 source-independent Radar intake: explicit RSS times normalize to UTC; private DB terms admit material news-only and independent reports without a named authority. Cards/timelines carry publisher and source type, related-topic reports remain distinct without an exact proceeding reference. Earliest news preserves price anchor; selected final NSE sessions persist as private duplicate-safe numeric snapshots. Existing Home/dashboard/follow/modal behavior is retained. See changes/radar-material-intake.md for actual validation and release limits.

2026-10-17 focused Radar scope: normal acquisitions/mergers and statutory compliance or purchase-order noise are excluded from Radar, with ordinary News/Announcements unchanged. The stable deals category now reads Insolvency & disputes. Source-derived company-first headings replace generic synthetic development updates; legacy records are hidden consistently at DAO list/detail/following reads without deleting evidence or follows. See changes/radar-focused-events.md for exact verification and deployment limits.

2026-10-18 Radar coverage/compact detail: source filing identity repairs legacy numeric names; report-day history remains visible for future hearings. Movement records carry explicit NSE/BSE provenance and optional exchange symbol; private proxy-aware report downloads and bounded queuing avoid dropped requests. Sparse detail omits missing FAQs, reduces missing prices to one retry row, and collapses source history/method/verification behind native details controls. See changes/radar-coverage-compact.md for tests and actual browser/upstream limits.


2026-10-18 content-led Stories: Home and Layout retain the shared TodayMarketStoryModal callbacks. A pure validated adapter generates readable variable-length chapters from the unchanged public feed. Neutral topic identities replace bank logos/links for FII/DII and other aggregates; official company logos remain untouched. Typed news/metric/comparison/chart/list views replace mandatory nested hero/badge/bullet blocks. Cache precedence, stable selection, explicit request states, content-based duration, pause-safe chart/hold/menu/visibility behavior, reduced motion and portal focus/scroll ownership are documented in STORIES.md. Automated/render/build evidence and the blocked browser/device gate are recorded separately in changes/clean-market-stories.md; no merge or deployment is implied.


2026-10-18 bounded Company news follow-up: one chapter has at most seven screens total and at most two per company, with related pages/company groups kept together and recent distinct companies prioritized. Chapter-wide progress includes a current/total count and never resets on an article sequence. Generic/continuation updates can be clean text; relevant sector art is capped and non-repeating, and only unambiguous awarded-order amounts use a source-backed metric. Other chapters, company identity/actions, existing read cache and API remain compatible. See changes/bounded-company-stories.md for regression evidence and separate browser/merge/deployment status.

2026-10-18 shared Radar prices: security aliases reuse private snapshots across reports. Previous session (blue, explicitly before report), up to three event-window sessions and latest company context are distinct. Small selectable up/down bars expose exact dates/prices/sources; refresh keeps usable observations. Boot/watchdog and authenticated cron await bounded capture without browser visits; storage/source failures are separately logged. Targeted company-report links show latest reports from old detail without joining unrelated proceedings. See changes/radar-price-context.md for checks and hosting/browser limits.


2026-10-18 notification startup repair: verified Firebase readiness gates Layout's account-scoped unread controller; guest/invalid server sessions receive 401 from unread-count, and its successful responses are private/no-store. Header, inbox and profile share one confirmed count; owner/sequence guards block late responses and read actions refresh after confirmation. Native browser permission and SDK subscription remain separate: granted permission hides the banner across reload/login even with a late/blocked SDK, with permission/subscription/focus changes reconciled. Web SDK PushSubscription uses its correct namespace; the original worker URL migrates scope only to /push/onesignal/, with auto-resubscription and no automatic permission prompt. Preview cleanup preserves push workers. Free for All copy is removed. See changes/notification-startup.md for tests and separate browser/provider/deployment limits.


2026-10-19 Telegram results policy: Settings personal and server AI labels now describe financial-results-only replies and one company/period summary. Existing switch state/save handlers, Pro scope, summary-language control and site-requested AI are unchanged. Backend durable claims enforce the behavior across BSE/NSE copies. This is a copy-only UI edit; automated checks do not establish browser/device rendering. See changes/telegram-results-delivery.md for evidence and release state.


2026-10-19 watchlist/alerts/Radar repair: responsive WatchlistEditor replaces duplicated fixed-height management panels, exact active-list identities replace Home substring matches, named BSE metadata survives save/priority/undo, and account-keyed caches/remount isolate private state. Unread-first inbox, explicit read labels, confirmed writes and optional App Badging share the existing count owner. Settings and alert rules retain DeviceNotificationControl with confirmed provider On/Off and saved opt-out; native permission alone is not delivery success. Contained shared switches and persistent Save changes remove the softglass icon-switch artifact. Radar groups company reports for presentation while preserving proceedings/follows; a private seven-day scan ledger removes process-local freshness assumptions. See changes/watchlist-alert-radar-repair.md for tests, migration and separate browser/provider/hosting verification limits.


2026-10-20 bounded AI connection repair: a single Settings entry, provider-specific OAuth steps, explicit copy/approval states and same-owner refresh improve the setup journey. Scoped phone/tablet layout changes are source/typecheck/build verified; browser/physical-device acceptance remains blocked by the current test environment. Proxy-aware discovery and exact MCP Origin checks retain bearer-only authority. This is not a hosted-client or full frontend completion claim; see changes/ai-connection-usability.md.

2026-10-20 AI connection verification follow-up: eight Chromium scenario groups pass on the actual component/CSS with test-only API/auth adapters, including 320–1440 CSS widths, manual copy, dark mode, 200% CSS zoom, keyboard focus, account isolation, retry/revoke and opt-in consent. This does not certify live OAuth, storage or physical iOS/Android devices. See changes/ai-connection-usability.md for concurrent-main integration and separate CI/merge/hosting status.


2026-10-22 brand/refresh/inbox follow-up: App preserves For You across ordinary authentication; generic landing launches share that default while explicit deep links retain intent. Original BseNexusLogo/icon.svg replaces green text tiles in directory, guides, not-found and initial document. Layout keeps the owner-keyed inbox mounted while closed; NotificationInbox owns ephemeral per-filter snapshots (All/Watchlist/Results), background refresh and confirmed read/clear reconciliation. The read action sits right below filters. Watchlist readiness distinguishes cold/failed from confirmed empty; three pull indicators sit below their respective toolbars. Settings combines quiet device vibration with visible pressed/focus/active states. Radar retains server intake policy and resumes client checks on visible/online/pageshow. Public exchange pages now share ordinary intelligence/render caching, exact venue identity and verified stored filings; legacy static rendering is no longer the route owner. See changes/brand-refresh-inbox.md for current tests/browser/merge/publication evidence.


2026-10-22 Overnight ADR: one validated public USD regular-session snapshot feeds the compact Home Helios card, company intelligence strip, one Market pulse Story and the opt-in watchlist inbox worker. Shared density/themes/actions and existing company callbacks remain authoritative. Source/session dates, stale/error/partial status, whole-chapter progress and account-safe settings remain explicit. The existing cron/watchdog and notifications primary key provide private per-owner/session insertion without a new Scheduler or schema. See ADR.md and changes/overnight-adr.md for exact boundaries, evidence and separate browser/merge/deployment state.


2026-10-22 Radar/research follow-through: source-traced count/history/worker consistency implemented with regression tests. Stored-count, recent-updates, result-quarter and import-progress facts have distinct owners and labels. Browser visual, deployed worker lifetime/multi-instance routing and live exchange/storage behavior remain release checks; tests do not certify them. See changes/radar-research-counts.md.

2026-10-25 deep security repair: Settings personal linking changes to account-keyed bot verification with visible setup/error/retry states, and session exchange carries CAPTCHA/optional App Check. Backend admin authorization requires PIN elevation independently of display roles. Local source/typecheck/build/behavior tests are separate from browser/device checks and the blocked database migration. See changes/deep-audit-repair.md; do not release runtime ahead of migration.

2026-10-25 Calendar result evidence follow-up: the two per-company archive controls had the same owner/endpoint. Retain only the ledger control and explicit click-to-sync; last-N-year labels describe a date range rather than a guaranteed quarter count. Shared completion copy distinguishes stored filing counts from unresolved document verification. Generic outcomes need bounded official-document proof; source failures retain links and readable verified cards. See changes/calendar-result-evidence.md for separate automated, browser, merge and release evidence.


2026-10-27 Gift Pro Access: Settings Admin Engine lazily mounts owner-keyed invitation management. Explicit review/send, pending/accepted/failed/unknown email states, preserved drafts, resend/revoke confirmation and bounded history use /api/gifts. /activate-gift captures an email fragment before optional telemetry; same-document reopens and account-keyed state survive login/switch safely. Same-email fresh Firebase verification and an explicit confirmation precede the atomic grant. Unified read-only subscription projections reach billing, profile, quota and gates without rewriting payment/trial provenance; paid progress/source remains separate. The forward migration and GIFT_ACCESS_ENABLED deployment gate remain required. See changes/gift-pro-access.md and docs/GIFT_ACCESS.md for exact tests and live-provider limitations.
