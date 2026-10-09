# Frontend strategy and evidence-based priorities

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
