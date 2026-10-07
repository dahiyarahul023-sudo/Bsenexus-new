# Start here: safe backend changes

Read `AGENTS.md`, this file, `BACKEND_RULES.md`, and the relevant entries in `domains.json` before editing. The repository source is evidence; old reports and generated maps are navigation aids. When they disagree, inspect the implementation and update the explanation. Never silently infer production state from repository files.

## Required change sequence

1. State the requested behavior and acceptance cases in `rule/changes/<short-name>.md` using `CHANGE_TEMPLATE.md`. Record facts with file/symbol evidence and label unknowns. Record the starting commit.
2. Run `npm run map:impact -- <path> [other paths]`. Inspect direct dependencies, transitive consumers, relevant semantic domains, routes, storage/RPC calls, environment names and tests. Search exported symbols, URL strings, jobs, cache keys and manual copy too. For deleted/renamed files, use the BASE revision map as well as the new map.
3. Explain to the user what will change, which connected features could change, and what checks will establish the result. Ask only when an unresolved product choice affects correctness, money, access or irreversible data.
4. Implement a bounded change. Preserve unrelated work. For a bug, first reproduce its observable failure and add a behavior-level regression test where useful. Test the consumers and failure paths, not merely implementation text.
5. Update affected semantic domains, this documentation, contract examples and the change record in the SAME commit as the implementation. `npm run map:generate` refreshes the generated spider map. Never hand-edit generated outputs.
6. Run `npm run map:check`, `npm run test:map`, applicable backend tests, `npm run lint` and the build. Record actual commands, outcomes and limitations; do not treat historical audit results as current validation.
7. Review the diff and report observable behavior, affected areas, validation, remaining risks and rollback. Do not describe a commit or passing unit tests as a deployed/production-tested backend.

## The living spider web

- `domains.json`: reviewed cross-file contracts that static imports cannot establish.
- `generated/spider-map.json`: source fingerprints, imports, reverse imports, route declarations, HTTP calls, store/RPC calls, environment NAMES and semantic domains.
- `generated/spider-map.html`: open locally in a browser; search/select a file to see its immediate connections, transitive import consumers and related domain members. No hosted service or secret is required.
- `npm run map:impact -- server/config/plans.ts`: print affected import consumers, semantic domain files and candidate tests. These are review candidates, not proof every listed file must change.
- `npm run map:watch`: regenerate after saved source changes while working; keep the local HTML open and refresh it to view the new map.
- `npm run map:check`: fail if committed generated outputs are stale, domain paths are missing, or literal local imports cannot resolve.

The graph is conservative and incomplete: computed URLs/imports, runtime flags, SQL trigger effects, dependency injection and deployed infrastructure need manual tracing. Route entries show LOCAL middleware; inspect `USE` mounts before judging authorization. SQL resources appear as source files and domain members; code store/RPC call sites are not proof that those objects exist in the deployed database.

## Other documentation

`docs/CHANGE_MAP.md` retains domain-specific copy checklists. `docs/audit/` contains dated historical evidence, not a current production certification. `RESEARCH.md` explains the research-to-rule reasoning. `BACKEND_STRATEGY.md` records implementation priorities and what remains unverified.

## Enforcement boundary

The root `AGENTS.md` directs future assistants here. This cannot force every AI tool to comply. CI checks map freshness and tests; a reviewer must still assess business meaning and require the checks in repository branch protection if desired. Do not invent a passing result when a required environment-specific tool is unavailable.
