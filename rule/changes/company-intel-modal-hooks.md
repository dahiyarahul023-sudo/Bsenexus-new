# Change: fix conditional hooks in CompanyIntelligenceModal (dormant React invariant violation)

- Starting commit: 2fafd9fa14c7c2ee1bdcd4ab907b59a1cd7a6b7e (main HEAD 2026-10-19)
- User objective and acceptance cases: weekly autonomous code-health scan (2026-10-24). Sentry logged BSENEXUS-7/8 "Rendered more hooks than during the previous render" (15–16 Oct). A scope-aware static scan of 220+ components found one genuine violation: `src/components/CompanyIntelligenceModal.tsx:227` early-returns (`if (!isOpen) return null;`) with two `useMemo` calls after it (lines 267, 316). Acceptance: (1) every hook in the component runs unconditionally on every render; (2) rendered output identical for all prop/state combos (null when closed, modal when open); (3) `npm run lint` clean; (4) no new test failures.
- Verified facts (file + symbol):
  - `src/components/CompanyIntelligenceModal.tsx:227`: `if (!isOpen) return null;`
  - `useMemo` at :267 (`filingFacts`) and :316 (`activityTrend`) run only when `isOpen` is true — 14 hooks (useAuth, 11× useState, useAiQuota, useEffect) run before the return. Toggling `isOpen` on a mounted instance would throw "Rendered more hooks than during the previous render".
  - Sole mount site `src/components/Layout.tsx:906-907` conditionally mounts (`{isIntelModalOpen && (<CompanyIntelligenceModal .../>)}`), so the bug is currently dormant — a mounted instance never sees `isOpen` flip. Fix removes the landmine without behavior change.
  - Everything between the early return and the JSX return (derived consts + the two useMemos) is pure computation from props/state — no side effects, no isOpen-dependent hook deps.
- Assumptions/unknowns and how they will be resolved: whether BSENEXUS-7/8 were actually caused by this component is unconfirmable (no stack traces; Sentry free plan drops events). The violation is real regardless; the fix is behavior-preserving so it is safe either way.
- Changed source of truth: `src/components/CompanyIntelligenceModal.tsx` only — the `if (!isOpen) return null;` line moves from above the derived values to directly above the JSX `return (`.
- Impact command and affected semantic domains: `npm run map:impact -- src/components/CompanyIntelligenceModal.tsx` — import consumers: src/App.tsx, src/components/Layout.tsx, src/main.tsx (mount sites only). No domain contract change.
- Related consumers: API, UI, storage/RPC, jobs, caches, manual copy: none — pure render-order change inside one component.
- For each relevant consumer: changed / reviewed-and-compatible / blocked, with evidence:
  - Layout.tsx mount site: reviewed-and-compatible — still conditionally mounts; component now additionally null-guards.
  - Rendered output: reviewed-and-compatible — identical (null when `!isOpen`, full modal when open); the moved line runs the same condition, just later.
- Assignment scope: frontend / bug fix; no visual or behavior change.
- Frontend: routes: company intel modal opened from watchlist/company views; state owner: `isIntelModalOpen` in Layout; no style/token changes.
- UI state/device matrix: no browser verification possible in this run (detached); change is render-order-only, verified by lint + static reasoning. No browser behavior claimed.
- Expected user-visible effect: none (dormant bug). If any future call path mounts the modal persistently and toggles `isOpen`, it no longer crashes.
- Failure/security/concurrency cases relevant to this change: none — pure functions moved after hook calls; memo deps unchanged.
- Implementation and coordinated updates: see files; map regenerated in same push.
- Commands actually run and results:
  - `npm run map:impact -- src/components/CompanyIntelligenceModal.tsx` — consumers: src/App.tsx, src/components/Layout.tsx, src/main.tsx (mount sites).
  - `npm run lint` (tsc --noEmit) — clean.
  - `npm run build` — ok (verifies the modal compiles in the app bundle).
  - Static check: zero hook calls (`useState|useEffect|useMemo|useCallback|useRef|useContext|useAuth|useAiQuota`) textually after the moved early return.
- Required checks unavailable (reason; do not mark passed): browser open/close interaction (detached run, no live browser); dormant bug has no user-visible symptom to screenshot.
- Deployment/migration requirements and rollback: revert commit; needs Rahul's AI Studio sync + Republish. No migration.
- Remaining risks and next bounded step: none identified.
- Graph/domain/documentation refreshed: `npm run map:generate` in same push.

- Delivery status: commit / merge / CI / deployment, reported separately.

## Frontend action and consistency record (when applicable)

- Entry points: watchlist "360° intel" button, company view intel trigger → Layout `isIntelModalOpen`.
- Required effects: modal opens/closes; unchanged.
- Evidence status: source-traced + implemented; browser verification not available this run.
