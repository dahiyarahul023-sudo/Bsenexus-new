# Start here: safe frontend and backend changes

Read `AGENTS.md`, this file and the relevant entries in `domains.json` before editing. Frontend work starts with `FRONTEND_RULES.md`, `FRONTEND_MAP.md` and `FRONTEND_STRATEGY.md`. Backend work starts with `BACKEND_RULES.md`. Contract changes need both. The repository source is evidence; old reports and generated maps are navigation aids. When they disagree, inspect the implementation and update the explanation. Never silently infer production state from repository files.

For the shared evidence ledger and plain-English handoff, read `WORKFLOW.md`. The current assignment is frontend strategy and rules; the previous backend-only restriction was a misunderstanding.

## Required change sequence

1. State the requested behavior and acceptance cases in `rule/changes/<short-name>.md` using `CHANGE_TEMPLATE.md`. Record facts with file/symbol evidence and label unknowns. Record the starting commit.
2. Run `npm run map:impact -- <path> [other paths]`. Inspect direct dependencies, transitive consumers, relevant semantic domains, routes, storage/RPC calls, environment names and tests. Search exported symbols, URL strings, jobs, cache keys and manual copy too. For deleted/renamed files, use the BASE revision map as well as the new map.
3. Explain to the user what will change, which connected features could change, and what checks will establish the result. Ask only when an unresolved product choice affects correctness, money, access or irreversible data.
4. Implement a bounded change. Preserve unrelated work. For a bug, first reproduce its observable failure and add a behavior-level regression test where useful. Test the consumers and failure paths, not merely implementation text.
5. Update affected semantic domains, this documentation, contract examples and the change record in the SAME commit as the implementation. `npm run map:generate` refreshes the generated spider map. Never hand-edit generated outputs.
6. Run `npm run map:check`, `npm run test:map`, applicable frontend and backend tests, `npm run lint` and the build. Record actual commands, outcomes and limitations; do not treat historical audit results as current validation.
7. Review the diff and report observable behavior, affected areas, validation, remaining risks and rollback. Do not describe a commit or passing unit tests as a deployed/production-tested backend.

## The living spider web

- `domains.json`: reviewed cross-file contracts that static imports cannot establish.
- `generated/spider-map.json`: source fingerprints, imports, reverse imports, route declarations, HTTP calls, store/RPC calls, environment NAMES and semantic domains.
- `generated/spider-map.html`: open locally in a browser; search/select a file to see its immediate connections, transitive import consumers and related domain members. No hosted service or secret is required.
- `npm run map:impact -- server/config/plans.ts`: print affected import consumers, domains reached by those consumers, related domain files and candidate tests. Each domain includes `viaFiles` explaining why it was selected. Domain expansion is one step from the import closure plus its literal browser-event peers; semantic peers do not recursively pull in other domains. These are review candidates, not proof every listed file must change.
- `npm run map:watch`: regenerate after saved source changes while working; keep the local HTML open and refresh it to view the new map.
- `npm run map:check`: fail if committed generated outputs are stale, domain paths are missing, or literal local imports cannot resolve.

The graph is conservative and incomplete: computed URLs/imports, runtime flags, SQL trigger effects, dependency injection and deployed infrastructure need manual tracing. Route entries show LOCAL middleware; inspect `USE` mounts before judging authorization. SQL resources appear as source files and domain members; code store/RPC call sites are not proof that those objects exist in the deployed database.

## Other documentation

`docs/CHANGE_MAP.md` retains domain-specific copy checklists. `docs/audit/` contains dated historical evidence, not a current production certification. `RESEARCH.md` explains the research-to-rule reasoning. `BACKEND_STRATEGY.md` records implementation priorities and what remains unverified.

## Enforcement boundary

The root `AGENTS.md` directs future assistants here. This cannot force every AI tool to comply. CI checks map freshness and tests; a reviewer must still assess business meaning and require the checks in repository branch protection if desired. Do not invent a passing result when a required environment-specific tool is unavailable.


## Frontend wiring and verification

Nine `frontend-*` domains cover navigation, sessions, shared design, feed/detail, notes, commerce, AI, offline/privacy and public content. Use `npm run map:impact -- src/components/notes/NoteEditor.tsx` to inspect a frontend change. In addition to import consumers, `eventRelatedFiles` finds one-hop senders/listeners for literal global browser events. Domain `viaFiles` includes those event peers. The HTML viewer shows them in a separate card and the contract table; event peers are NOT drawn as import arrows.

`npm run map:watch` regenerates on saved source/domain changes; refresh the local viewer. This is a maintained source map, not live user telemetry. Computed event names (including named constants), target aliases, bubbling, global CSS, context value meaning and state transitions still require the manual frontend map. Existing CI checks structure and freshness, not actual usability. Follow the browser evidence matrix in `FRONTEND_RULES.md` before claiming a screen works.

## Detailed frontend completion specification

Read [FRONTEND_COMPLETION_GUIDE.md](FRONTEND_COMPLETION_GUIDE.md) for the user's complete requirement and its remaining implementation gates. It explains action ownership and every connected effect, shared design/motion adoption, the planned action-level map, automatic refresh, coverage and truthful AI handoff. Use it with the existing rules and journey map; it does not certify runtime completion.

## Directory counts and IndexNow operations

`src/config/companyDirectory.ts` owns curated membership/order and displayed counts; keep the BSE_26_COMPANIES compatibility export until its consumers migrate. Adding a profile must update this single list, never a separate hardcoded count. IndexNow uses the existing server primary, INDEXNOW_KEY server env (public verification-file bootstrap if unset) and INDEXNOW_SUBMITTER=server/cloudflare/off. Check actual Cloudflare Crawler Hints before selecting another primary. The additive service-only URL ledger migration must precede runtime release. Its claims reserve 24 hours before HTTP; no indexing work is awaited from filing ingestion. See changes/directory-loading-indexnow.md for current schema/source evidence and publication gates.

## MCP directory release boundaries

Use docs/MCP_DIRECTORY_REVIEW.md for the 21 October connector checklist, reviewer fixtures and remaining submission gates. Human titles and complete write annotations must agree with actual wire registration, not only a source list. PDF analysis must not promote a legacy heuristic to document evidence or consume quota after a failed generation. Shared stockIdentity pins verified code/name repairs across resolver, Watchlist/Story/F&O fallback consumers. /ai-docs and the shared privacy disclosure describe actual limited coverage and processing; a working connector and local SDK tests do not prove exchange redistribution permission or a clean Claude directory-review flow. Reviewer overrides require a dedicated, expiring server UID and never grant Pro.

## Retained panels and operator identity

Closing a dialog must not discard its confirmed same-owner snapshots: check the mounting parent as well as the child reset effect. NotificationInbox stays owner-keyed under Layout while closed and keeps ephemeral filter snapshots; account switches remount and clear them. Unknown watchlists render the shared content skeleton until an actual response, including confirmed empty. Pull indicators must sit below controls that stay stable. BSE equity has no BSE security code; 540025 is Advanced Enzyme. Keep public company render, intelligence, legacy evidence projection, ingestion symbol/source and IndexNow identity aligned through shared exact matchers and verified master pins. See changes/brand-refresh-inbox.md.

## Deep security audit repair — release prerequisite

See changes/deep-audit-repair.md before deploying its branch. The forward migration requires the verified modern payment contract; payment/trial/reconcile and shared auth counters are service-only transactions. Do not auto-promote profile plan fields to paid provenance. Owner administration needs a same-UID PIN elevation valid for 15 minutes. Personal Telegram linking is bot-proven with expiring one-use challenges; an old typed chat ID cannot authorize a send. The runtime is not deployed. Following explicit approval, the staging migration and rolled-back service-role checks passed on 25 October 2026 IST; production rollout is pending.
