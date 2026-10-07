# Project Operating Rules & Guardrails

## File Deletion & Refactoring Rules (Standing Directive)
1. **Pre-Deletion Trace**: Before deleting or renaming ANY file, scan the entire codebase (`src/`, `server/`, etc.) for all static imports, dynamic `import()`, re-exports, and string path references.
2. **Zero Dangling References**: Never delete any module that is still referenced or imported anywhere in the project. Decouple and update all consuming components first.
3. **Mandatory Post-Action Verification**: After any deletion, renaming, or refactoring, always run `compile_applet` and `lint_applet` to verify that the build succeeds with zero errors.

## Before every change
Read `rule/README.md`, `rule/BACKEND_RULES.md` and the relevant `rule/domains.json` entries. Run `npm run map:impact -- <path>` before editing; inspect API/UI/storage/cache/job/copy consumers beyond imports. Update the change record and regenerate/check the map in the same commit. For referrals, also read `rule/REFERRALS.md`: ownership, pending applications, verified rewards and legacy cutover are separate contracts. Never claim a local test or commit is a deployed migration. If required host checks are unavailable, explicitly record that fact.


## Backend scope and truthful handoff
The current assignment is backend engineering. Read client code to trace API consumers, but do not redesign screens, styling, navigation or animations. A necessary client contract change must be explained as part of the backend change; preserve unrelated frontend work.

Read `rule/WORKFLOW.md` for the impact/evidence protocol. Inspect both transitive import consumers and their semantic domains. Explain each relevant consumer as changed, reviewed-and-compatible, or blocked with evidence; an unexplained omission is not a completed impact review. Keep rules, map and change record current in the same commit. Report committed, merged, checks passed and deployed as separate statuses.
