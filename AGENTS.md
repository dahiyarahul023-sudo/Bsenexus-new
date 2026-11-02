# Project Operating Rules & Guardrails

## Preserve clean installations
Keep `package-lock.json` tracked during source synchronization. Dependency updates must update the manifest and lockfile together, regenerate the source maps, and pass a fresh `npm ci` plus application checks. A source sync must preserve existing security limits and tests; reconcile intentional new behavior rather than discarding either side.

## File Deletion & Refactoring Rules (Standing Directive)
1. **Pre-Deletion Trace**: Before deleting or renaming ANY file, scan the entire codebase (`src/`, `server/`, etc.) for all static imports, dynamic `import()`, re-exports, and string path references.
2. **Zero Dangling References**: Never delete any module that is still referenced or imported anywhere in the project. Decouple and update all consuming components first.
3. **Mandatory Post-Action Verification**: After any deletion, renaming, or refactoring, always run `compile_applet` and `lint_applet` to verify that the build succeeds with zero errors.

## Before every change
Read `rule/README.md` and the relevant `rule/domains.json` entries. For frontend work read `rule/FRONTEND_RULES.md`, `rule/FRONTEND_MAP.md` and `rule/FRONTEND_STRATEGY.md`; for backend work read `rule/BACKEND_RULES.md`. Read both when changing an API contract. Run `npm run map:impact -- <path>` before editing; inspect API/UI/storage/cache/job/copy consumers beyond imports. Update the change record and regenerate/check the map in the same commit. For referrals, also read `rule/REFERRALS.md`: ownership, pending applications, verified rewards and legacy cutover are separate contracts. Never claim a local test or commit is a deployed migration. If required host checks are unavailable, explicitly record that fact.


## Assignment scope and truthful handoff
The user clarified on 2026-10-07 that the current assignment is the FRONTEND equivalent of the backend engineering strategy: researched rules, actual component/state/event/style wiring, impact analysis and continuous maintenance. The earlier backend-only restriction was an assistant misunderstanding and is superseded. Preserve existing backend protections. Work on frontend behavior, layout and styling when the user's requested frontend change calls for it; do not invent an unrelated redesign or alter backend business policy.

Read `rule/WORKFLOW.md` for the shared evidence protocol and `rule/FRONTEND_RULES.md` for frontend verification. Inspect imports, browser-event peers and semantic domains, then manually trace CSS inheritance, context/state, navigation and async behavior. Explain each relevant consumer as changed, reviewed-and-compatible, or blocked with evidence. Keep rules, map and change record current in the same commit. Report committed, merged, checks passed, browser-verified and deployed separately.

## Full frontend consistency requirement
For frontend strategy or implementation also read `rule/FRONTEND_COMPLETION_GUIDE.md`. Identify every entry point and required effect of an affected action, its state owner, dependent screens, design tokens and recovery cases. Record each consumer as changed, reviewed-and-compatible or blocked. Follow the guide's design adoption and action-map specifications when implementing them. Keep specified, implemented, tested, browser-verified, merged and deployed statuses distinct; rules and a generated file graph do not prove complete runtime consistency.
