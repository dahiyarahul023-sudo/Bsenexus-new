# Frontend completion guide: interactions, design and the living map

## Purpose and scope

The user's requirement is that a frontend change is understood across every relevant place: a button with several responsibilities must preserve all of them; shared design and motion must remain consistent; a selectable map must explain the connections; and every future AI must maintain this knowledge.

This document is the implementation specification for the gaps identified on 2026-10-07. It is not evidence that the gaps are fixed. This assignment updates strategy and instructions. Runtime changes follow the user's authorized implementation scope and the procedure below. Preserve backend protections and coordinate API dependencies without silently changing business policy.

Read in order: root `AGENTS.md` → `rule/README.md` → `FRONTEND_RULES.md` → `FRONTEND_STRATEGY.md` → this guide → `FRONTEND_MAP.md` and relevant `domains.json` entries → current source. Use `FRONTEND_RESEARCH.md` for the existing research basis. If descriptions disagree with source, record the disagreement, inspect it and update the documentation; do not invent behavior to make the documents agree.

## 1. Establish what is complete

| Area | Established foundation | Remaining acceptance gate |
|---|---|---|
| AI instructions | Root instructions link frontend rules, strategy and map | Evidence on each change that affected consumers and failure cases were reviewed |
| Shared actions | Contexts, helpers and browser events exist; journeys are documented | Inventory every entry point, identify owners and prove all required effects work |
| Design | Shared controls, CSS and motion utilities exist | Inspect actual adoption, record approved values/variants and verify every relevant consumer |
| Interactive map | Searchable file viewer with imports, consumers, domains and event peers | Action-level nodes, typed effects, coverage reporting and safe automatic refresh |
| Maintenance | Generation/watch and freshness checking exist | Extend checks to action/design metadata when implemented; keep coverage honest |
| Runtime quality | Some utility/API/contract tests exist | Browser behavior, visual, keyboard and recovery evidence for the affected journeys |

Maintain separate status dimensions: documentation specified; source traced; implemented; automated checks passed; browser verified; merged; deployed; live verified. Each status needs a commit/date and supporting evidence. A merged rulebook cannot advance runtime status. Recheck evidence after relevant code changes.

## 2. Inventory the entire interaction surface

Start from current routing and shell in `src/App.tsx` and `src/components/Layout.tsx`, then visit every reachable screen and overlay. Include public routes, signed-in views, denied states, mobile navigation, lazy routes, detail/share views and conditional controls. Reconcile this inventory with rendered screens; searching `onClick` alone misses form submit, links, keyboard shortcuts, context callbacks and event-driven controls.

For each screen record route/tab, entry conditions, source component, state owners, controls/actions, dialogs, loading/empty/error variants, design dependencies and evidence status. For each action record every entry surface, even when several surfaces share a component. Record known omissions and the reason; do not report a complete inventory while screens remain unreviewed.

Use stable semantic action IDs, for example `notes.save`, with distinct IDs for operations that have different contracts. Labels like "Save" or component names alone are not unique identifiers. Keep action IDs stable across file renames and map them to current source symbols.

Required action record:

| Field | Required content |
|---|---|
| Identity and source | Stable ID, purpose, screen/route, source path and handler/component symbol |
| Entry points | Every button, form, shortcut, menu, deep link or other trigger; visibility/access conditions |
| Inputs | Entity/account identity, payload shape, validation, draft source and defaults supported by code |
| Owner | Authoritative server fact, client synchronization owner and separate draft/optimistic state |
| Effects | Ordered required effects; conditional effects with exact conditions; optional effects |
| Connections | Handler → command/helper → API/state → events/cache → readers → rendered result |
| Consistency | Which lists, counts, badges, details, labels and permission displays must agree, and when |
| Lifecycle | Idle/loading/success/failure/retry, cancel, unmount, navigation and remount behavior |
| Concurrency | Double click, delayed response, rapid edits, duplicate event, account switch and competing requests |
| Presentation | Primitive, variant, theme tokens, focus behavior, motion and reduced-motion alternative |
| Evidence | Source references, meaningful tests, browser observations, unknowns and dispositions |
| Maintenance | Source revision, last review, relevant domains and record of the latest change |

These are required metadata fields for the planned action registry. No machine-readable action registry is created or claimed by this document. When implementing it, define and validate its schema first; integrate with the existing map rather than build a conflicting second map.

## 3. Make shared behavior reliable

A shared visual button is not automatically a shared business action. Locate the actual command/state owner before changing it. Reuse one operation for entry points with the same semantics. Explicit variants may differ in presentation or permitted behavior; document those differences. Do not merge unrelated actions merely because both buttons have the same label.

For each operation:

1. Capture the user's current entity, account and draft. Validate without destroying input.
2. Start one coherent pending state and prevent or safely handle duplicate submissions.
3. Perform the authoritative operation; define cancellation and uncertain-timeout reconciliation.
4. Reconcile the confirmed result with shared state/cache. Identify every affected reader.
5. Notify or invalidate other consumers through the established mechanism. Validate event payloads and identity; clean up listeners.
6. Show success only for the confirmed outcome. Keep failures recoverable and drafts intact.
7. Ensure later-mounted screens read fresh state even if they missed a transient event.
8. Ensure stale responses and work from an old account cannot overwrite newer state.

Inspect existing context/helper/event contracts before choosing a synchronization mechanism. Do not introduce a new global store merely to satisfy this guide. Cross-tab synchronization is a separate requirement: window events alone do not prove it. Record whether it is supported, out of scope or an unresolved product need.

Classify multi-effect operations: required core effects must complete or recover coherently; optional presentation effects must not turn a successful server operation into a false failure. A frontend cannot make several independent server writes atomic; identify backend coordination needs instead of pretending a shared handler provides transactions.

### Worked contract: saving a note

Source-traced foundation: `src/components/notes/NoteEditor.tsx` dispatches `notes-changed`; `src/components/notes/SavedNotesScreen.tsx` and `src/components/SettingsTab.tsx` register listeners. `src/context/NoteEditorContext.tsx` and `src/api/notesApi.ts` belong to the journey. These links alone do not prove correct runtime reconciliation.

Required acceptance cases:

- Create a note: confirmed saved state, exactly one list entry and the correct count after navigation.
- Edit an existing note: updated content everywhere; no duplicate entry or count increment.
- Delete: correct list/count and no resurrection from a delayed load; inspect the actual deletion handler separately.
- Failed save: preserve the draft, show retry, avoid false success and avoid changing confirmed count.
- Rapid/double save: no duplicate operation or older response replacing newer content.
- Navigate before completion: cleanup is safe; re-entering the list/settings obtains current data.
- Switch accounts during pending work: no note, toast or count leaks into the next account.
- Keyboard/mobile: editor actions remain reachable; focus and scroll restore correctly.

These are acceptance requirements, not assertions that current source passes or fails. For each list/count/editor consumer record changed, reviewed-and-compatible, or blocked with evidence.

## 4. Establish one documented design system

Inventory actual styles first: `src/index.css`, `src/styles/`, `src/components/ui/`, `src/components/notes/notes.css` and `src/utils/motionTokens.ts`. Record which components consume each source. Existing `ui/ActionButton` and `landing/ActionButton` have distinct ownership; inspect their semantics before consolidation.

Create an approved design contract from the existing visual direction. Do not invent a new theme or arbitrary values as part of a consistency task. Record exact current/approved values, source token, intended usage and exceptions for:

- Semantic colors: surfaces, text hierarchy, borders, accent, danger, success, disabled and focus; theme variants.
- Typography: family, weights, size/line-height roles, numeric/table formatting and long-content behavior.
- Layout: spacing scale, control sizes, radii, borders, shadows, container widths, breakpoints and density variants.
- Components: button hierarchy, inputs/selects, menus, cards, tables, tabs, badges, toasts, skeletons and dialogs.
- Layering: header, dropdown, overlay, modal and toast stacking; portal/theme inheritance and scroll ownership.
- Interaction: hover, pressed, focused, disabled, pending, empty, error and success treatments.
- Motion: semantic purpose, duration/easing or spring token, entry/exit, interruption and reduced-motion fallback.

Shared tokens define values; reusable components define presentation and accessible behavior; feature commands define business effects. Keep these responsibilities understandable. "One place" means a navigable source of truth for each concern, not one enormous component.

Migrate one control family or token group at a time. Enumerate all consumers; retain justified variants; replace duplicate implementations only after behavior comparison. Review screenshots across representative sizes/themes, then test all affected interactions. Document exceptions with a reason and scope rather than quietly adding local overrides.

Do not claim smooth animation from CSS alone: check interrupted transitions, rapid navigation, scrolling and low-performance conditions when relevant. Motion must not delay saving or block input. Reduced motion must retain state feedback.

## 5. Extend the spider map to actions and effects

Current viewer: `rule/generated/spider-map.html`, produced from `scripts/spider-view.html` and `scripts/spider-map.mjs`. It is a source snapshot with selectable file nodes. The watch command regenerates files; the page currently needs refresh.

Target user journey: search a screen or action → tap/select the action → see all entry points, owner, ordered/conditional effects, related screens, style dependencies, candidate tests and verification gaps → select a related node to inspect its evidence.

Required implementation features:

| Capability | Acceptance condition |
|---|---|
| Node types | Screen, action, component, state owner, API, event, cache/store, design token and test are distinguishable |
| Edge meaning | Imports, invokes, reads, writes, dispatches, listens, invalidates, navigates and styles have explicit labels/direction |
| Evidence | Each manual relationship includes source/symbol and review status; inferred edges are visibly identified |
| Impact view | Shows upstream entry points and downstream effects, why each is included, and unknown connections |
| Filters | Screen/action/domain and relationship filters, search, reset and an accessible list alternative |
| Navigation | Mouse, touch and keyboard selection; visible focus; usable phone layout and long names |
| Coverage | Inventory totals, reviewed/unreviewed actions and known unresolved connections; no invented completeness percentage |
| Freshness | Source revision/digest and generation time; visible stale/error state |
| Safety | Escape untrusted labels; no secrets, session tokens, private notes or production payloads embedded |
| Scale | Cycle-safe traversal, bounded diagram, full results in lists and explicit truncation |
| Maintenance | Source rename/deletion and changed action records invalidate stale evidence and fail appropriate checks |

Automatic refresh means refreshing generated map data after source saves while preserving selection/filter where possible. Define a local development delivery mechanism before implementation; static HTML alone does not watch the filesystem. Validate malformed/partial generation, removed selected nodes and watcher failure. Show stale data explicitly rather than silently claiming freshness.

Runtime tracing is optional future work, separate from an automatically refreshed source map. If later authorized, keep it development-only by default, capture metadata rather than private payloads, and distinguish observed execution from possible source connections. Neither runtime sampling nor static analysis proves every possible path.

Preserve existing graph safeguards: import closure, one-hop literal event peers and bounded semantic expansion. Do not turn a shared global node into an unexplained whole-repository dependency explosion. Dynamic events, context semantics, CSS selectors and conditional effects remain explicit manual evidence until supported by validated analysis.

## 6. Execution order and completion gates

| Phase | Deliverable | Gate to advance |
|---|---|---|
| A: discover | Current screen/action inventory and unknowns | Every reachable screen accounted for; sampling clearly identified |
| B: contracts | Owner/effects/recovery records for affected actions | All relevant consumers have evidence-backed dispositions |
| C: coordinated behavior | Shared operations and state reconciliation where needed | Success, failure, stale response, remount and identity cases pass |
| D: design adoption | Approved token/primitive contracts and bounded migration | Relevant consumers and intentional exceptions checked across themes/sizes |
| E: map upgrade | Validated registry, action view and automatic refresh | Fixtures plus actual mouse/touch/keyboard viewer checks pass |
| F: enforcement | Registry freshness/schema/source checks and useful regressions | A deliberately stale/broken fixture fails; corrected fixture passes |
| G: handoff | Updated strategy, map, evidence and exact delivery state | No open mandatory case described as complete |

Phases may be interleaved for one coherent feature; do not wait for a speculative full redesign before fixing a known bounded issue. Use the priorities in `FRONTEND_STRATEGY.md` to choose the first runtime journey. Do not mark A–G complete from this document.

Automation to add when implementing registry/design enforcement: unique IDs; valid source references; valid edge endpoints/types; no missing required fields; explicit dynamic/unresolved records; freshness includes manual registry changes; useful changed-owner/consumer tests. A text assertion that a handler exists is not an interaction test. Branch protection and CI configuration must be inspected before claiming checks are mandatory.

## 7. Required change and handoff record

Use `rule/CHANGE_TEMPLATE.md` plus the action fields above. Include request, starting SHA, inspected sources, action IDs/entry points, before/after contract, design dependencies, every consumer disposition, unknowns, actual commands and results, browser matrix and rollback. Update records with implementation in the same change.

Before editing explain: "This action changes X; these screens read X; these checks will show they remain consistent." After editing explain the observed behavior, not just filenames. If blocked, record the exact missing environment/evidence and the next concrete verification step.

Documentation-only changes require document/link/source-reference review and existing map checks; do not fabricate browser evidence or create tests that merely mirror prose. Runtime changes follow F19 and the full relevant verification matrix. Host-only checks that are unavailable remain explicitly unavailable.

Definition of completion for the user's full frontend objective: all inventoried required actions have coherent shared behavior or justified variants; all required effects are verified; design adoption and exceptions are recorded; action-level map and refresh work; rules and metadata are current; and implementation, browser verification, merge and deployment status are reported independently. Until those gates pass, say exactly which layer is complete.
