# Frontend strategy and evidence-based priorities

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
