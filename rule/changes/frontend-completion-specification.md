# Change: detailed frontend completion specification

- Starting commit: `48e19a17873997ea0c560b19bf5818595ce19010` on main; isolated branch `docs/frontend-complete-operating-strategy`.
- User objective: record all remaining frontend requirements deeply enough for future AIs to understand project ownership, current progress, coordinated changes and working instructions.
- Scope: documentation only. Added FRONTEND_COMPLETION_GUIDE and linked it from AGENTS, README and strategy; extended the change template.
- Verified facts: existing strategy explicitly leaves browser baseline/design consistency open; spider-view.html selects file nodes and states manual refresh; NoteEditor dispatches notes-changed and SavedNotesScreen/SettingsTab listen. These establish connections, not browser correctness.
- Pre-edit impact: `npm run map:impact -- src/components/notes/NoteEditor.tsx src/utils/motionTokens.ts` passed; reviewed existing frontend domains and workflow. No source/domain relationship changed.
- Required future work: full screen/action inventory, shared operations and all effects, design/token adoption, action-level map and automatic refresh, registry/enforcement checks and per-consumer browser evidence. Guide specifies fields, worked note cases, phases and acceptance gates. None is falsely marked implemented.
- Consumer dispositions: AI entry instructions/strategy/change template **changed**; existing runtime/map generator/backend contracts **reviewed-and-compatible** because this change contains Markdown instructions only; complete runtime verification **blocked/unexecuted** pending the implementation and browser work described in the guide.
- Unknowns: full action coverage, universal shared-design adoption and live behavior remain unverified. Resolve using guide phases A–G.
- Source-reference review: all 17 concrete source paths in the guide exist; AGENTS, README and strategy reference the new guide. Reviewed proposed documentation for conflicting completion claims.
- Validation: map generation and freshness check passed (304 source files, 828 import edges, 21 semantic domains); 6 map tests passed; `npm run lint` passed; `npm run build --ignore-scripts` passed. Build skips unrelated version bump; local missing-asset and bundle warnings remain. Full-checkout CI is the repository gate.
- Application test suite not rerun locally for Markdown-only changes; no runtime behavior changed. No new tests mirroring prose. No browser interaction/visual test or deployment claimed. Host-only compile_applet/lint_applet unavailable.
- Generated artifacts: regenerated locally; Markdown strategy files are outside generator source inputs, and no generated artifact is included in this documentation-only commit.
- Rollback: revert this documentation change; do not alter runtime files or undo unrelated frontend/backend work.
- Delivery at preparation: local documentation ready; commit/PR/CI/merge status must be obtained from GitHub. Deployment: none.
