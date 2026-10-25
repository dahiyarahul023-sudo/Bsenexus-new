# Frontend engineering rules

Read this before changing the Bsenexus frontend. The user's assignment is to apply the same disciplined thinking used for backend work to FRONTEND work. These are requirements and evidence standards, not a claim the current UI passes every rule. Primary research and official guidance are in `FRONTEND_RESEARCH.md`; actual wiring is in `FRONTEND_MAP.md`.

## Rules with observable acceptance criteria

| ID | Rule | Evidence for the affected feature |
|---|---|---|
| F01 | Read the real screen, caller, state owner and styles before editing. Label assumptions; do not invent props, API fields, assets or libraries. | File/symbol evidence, actual response shape, source of any new API/dependency; no placeholder data presented as real |
| F02 | Trace the full user journey and all sibling consumers of the changed fact. Imports alone are insufficient. | `map:impact` plus browser events, context, CSS inheritance, storage, URLs and API contracts; each relevant consumer marked changed / compatible / blocked |
| F03 | Define the intended visual or behavior change and preserve unrelated design. Reuse existing controls and tokens after checking their actual semantics. | Before/after scope, touched routes and shared control consumers; explain why a new primitive is necessary. `ui/ActionButton` and `landing/ActionButton` are distinct files, not interchangeable by name |
| F04 | Give shared state one clear owner; derive values rather than keeping competing copies. Keep server facts distinct from drafts and optimistic state. | Owner → mutation → all readers documented; changing account, rapid edits and a delayed older response cannot resurrect stale state |
| F05 | Treat effects as external synchronization with cleanup. Test replay, unmount and changed dependencies; do not hide dependency errors with arbitrary suppression. | No duplicate interval/listener/subscription; cancel or ignore obsolete responses; React StrictMode replay leaves the feature usable |
| F06 | Every async surface needs explicit initial-loading, content, empty, error, retry and stale/background-refresh states, plus denied/offline when relevant. | State matrix with actual triggers and recovery. Keep usable content during refresh; no artificial delay, invented zero balance or premature empty state. Follow `docs/frontend-loading.md` |
| F07 | Success UI must match confirmed outcomes. Distinguish queued/saving/saved/failed and payment pending/verified/failed. | Failed save keeps draft and useful recovery; duplicate clicks do not create duplicate operations; redirect alone never shows paid success |
| F08 | Navigation is a contract: URL, active tab, deep-link detail, Back/Forward, refresh and scroll must agree. | Direct-entry and internal-navigation checks, including share pages, unknown routes and an unloaded lazy chunk |
| F09 | A modal owns focus, dismissal and scroll only for its lifetime; nested dialogs must cooperate. | Keyboard entry, Tab/Shift+Tab containment, accessible name, Escape policy, inert background where appropriate, restored focus and scroll after closing/unmounting; mobile keyboard does not hide actions |
| F10 | Use semantic HTML and accessible names before ARIA. Color, hover and animation must not be the sole way to convey meaning. | Keyboard-only journey; labels/errors tied to inputs; focus visible and unobscured; status announcements; contrast and target-size checks against WCAG 2.2 with its exceptions, not a blanket claim of compliance |
| F11 | Responsive behavior must support content and interaction, not just fit a screenshot. | Narrow phone, tablet and desktop; long titles/values, text zoom, portrait/landscape and virtual keyboard where relevant. No clipped primary action or unintended horizontal overflow |
| F12 | Global CSS and theme tokens have a wide effect. Inspect selector/class/token consumers beyond imports. | Light/dark and relevant design-theme checks on related screens; specificity, portal inheritance, fonts, z-index and component-scoped styles reviewed |
| F13 | Motion should explain state, preserve input responsiveness and honor reduced motion. | Reduced-motion alternative; no invisible full-screen navigation gap, inaccessible auto-advancing control or blocking animation; loading indication reflects actual loading |
| F14 | Cache and local storage are not authorization or confirmed freshness. Bind private client state to the correct user and lifecycle. | Logout/account switch, stale cache, denied request, offline and reconnect; cached content cannot display another account's data or grant access |
| F15 | API errors, cancellation and validation are part of UX. Prefer existing `customFetch`/API helpers after inspecting their behavior. | Aborted work does not show a false network error; 401/403/429/5xx are handled meaningfully; malformed data cannot crash a whole route or silently appear successful |
| F16 | Shared business facts must agree across pricing, checkout, receipt/history, counters, quotas and copy. | Review both frontend and backend contract consumers; pending referral differs from verified reward; display formatting never changes server policy |
| F17 | Treat generated content, URLs and browser events as untrusted input. Client checks improve UX but cannot grant server authority. | Output rendered safely; links/HTML handled in their actual context; no service secret in browser code; do not invent a backend permission to make a button work |
| F18 | Measure performance rather than asserting it. Avoid avoidable rerenders, oversized eager imports and invisible background work. | Relevant bundle/network/profile evidence before/after; preserve lazy boundaries and pause unnecessary work on hidden screens. No arbitrary performance score without a measured baseline |
| F19 | Verify behavior in a browser when changing rendered behavior. Tests must challenge failures, not only search implementation strings. | Relevant behavior tests plus browser evidence; screenshots for visual changes; no claim that typecheck, source assertions or automated accessibility scanning proves full usability |
| F20 | Maintain the wiring and explain the effect in the same change. | Updated domains/map/contracts/change record; exact commands and outcomes; separate committed, merged, CI-passed, browser-verified and deployed states |

## Required frontend verification matrix

Use the relevant rows; record an evidence-backed reason for exclusions. A rules-only change needs document/path/map validation, not fabricated application screenshots.

| Dimension | Cases to exercise for an affected screen |
|---|---|
| Request lifecycle | First load; warm cache; slow response; empty; malformed/error; retry; refresh with existing content |
| Identity/access | Guest; signed-in; expired session; denied operation; logout/account switch during pending work |
| Interaction | Keyboard; mouse/touch; double click; rapid filter/tab switch; type while response returns; open/close/reopen overlay |
| Presentation | Phone approximately 360–390 CSS px; tablet approximately 768; desktop approximately 1440; relevant light/dark themes; long content; text zoom |
| Accessibility | Accessible names and errors; focus order/return; background isolation for modal; reduced motion; no essential hover-only controls |
| Recovery | Offline/reconnect; failed save preserves draft; late result cannot overwrite newer state; lazy-chunk failure has recovery |
| Navigation | Direct link; refresh; Back/Forward; share route; active tab; scroll restoration |

The example widths are review starting points, not universal device coverage. Test actual supported browsers/devices when known. Record the browser, viewport, state, action, expected result and observed result; attach before/after evidence for visual changes. Do not mark unexecuted checks as passed.

## Workflow to follow every time

1. Read root `AGENTS.md`, these rules, the frontend map and relevant domains. Record the request, evidence, starting commit and acceptance cases.
2. Run `npm run map:impact -- <paths>`. Inspect the whole journey, named browser-event peers and non-import relationships. Search dynamic names and CSS/context consumers manually.
3. Explain which screen/state will change and where the effect must also appear. Resolve only material unknown product choices with the user.
4. Implement a bounded change and any necessary sibling updates; retain drafts, identity boundaries and recovery paths. Add meaningful regression coverage when useful.
5. Run relevant existing tests, `npm run test:map`, `npm run map:generate`, `npm run map:check`, `npm run lint` and the configured build. Honor root refactor checks and disclose unavailable host tools. For runtime UI changes, execute the relevant browser matrix.
6. Update frontend rules when a general lesson is discovered, domain membership when relationships change, strategy when a gap is resolved, and the change record every time. Generated outputs are never hand-edited.
7. Report the observable result and exact delivery status. List remaining evidence gaps without presenting them as completed work.

Referral input rule (2026-10-09): editable referral drafts must not force capitalization or apply the 20-character code limit to a full share URL. Parse the entire same-site link before normalization; validate rather than strip/truncate. Keep full unique aliases in share/copy output and normalize case only at the code/API boundary. Both checkout steps share `ui/ReferralCodeField`; see `changes/referral-link-input.md`.

Performance evidence rule (2026-10-24): budget the complete statically imported JS closure using the built manifest and actual output bytes. Named entry size or a raised chunk-warning limit is not a speed fix. Keep closed terminal/dialog modules dynamic, with a visible cancellable loading state and recoverable failure. Measure missing timings as missing; retain slow visits, label the sample count, and never call navigation load-time percentiles INP/LCP. CDN headers, real-device profiles and deployed revision need their own evidence. See changes/performance-startup.md.

Calendar feedback rule (2026-10-25): a completed saved-history read with pending document checks is a successful read with a diagnostic notice. Do not emit a second identical error/retry panel. Distinguish structured auth denial from a proxy HTML response, preserve server guards, and never automatically retry a shared mutation after an uncertain response.
