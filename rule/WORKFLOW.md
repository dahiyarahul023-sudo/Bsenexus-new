# Shared workflow: inspect, explain, implement, verify

This is the shared operating procedure. The current assignment is frontend strategy; use `FRONTEND_RULES.md`, `FRONTEND_MAP.md` and `FRONTEND_STRATEGY.md` for its concrete requirements. Start with `README.md`, the rules for the actual assignment, the relevant `domains.json` entries and current source. Do not replace existing rules with a generic checklist.

## Scope

Frontend work includes screens, components, shared controls, React state/context, routes, browser events, API consumers, storage/cache behavior, themes, responsive layout, accessibility and motion. Backend work includes APIs, authorization, business rules, persistence and jobs. Follow the user's actual requested scope. Trace across the boundary when a contract changes; preserve unrelated work and existing backend protections.

## Before code: create an evidence record

Use `CHANGE_TEMPLATE.md` in `rule/changes/`. Record the actual starting commit and requested observable outcome. Split statements into verified facts, hypotheses and unknowns. Every verified statement needs a source path plus symbol, test output or dated runtime observation. A comment, historical audit or green test with mocked storage is not proof of production database behavior.

Run `npm run map:impact -- <changed-source-path>`. The map traces reverse imports to their transitive consumers, then includes literal browser-event peers and selects semantic domains containing the resulting review seeds. `viaFiles` explains each selected domain. Related domains are review candidates, not instructions to edit everything. Do not recursively expand from semantic peers: shared files would otherwise drag almost the whole repository into every change.

Search independently for exported symbols, endpoint strings, storage/RPC names, trigger effects, job schedules, cache keys, feature flags and public copy. Computed imports and external systems need manual inspection. For renames/deletions inspect the base map as well. Documentation paths are not source-map nodes: trace the source files whose behavior they describe.

## Close each relevant dependency

| Boundary | Question to answer | Evidence to record |
|---|---|---|
| Entry and identity | Who may perform this operation, and where is identity verified? | Route mount, middleware and ownership checks |
| State and business rules | Which durable fact changes? What must remain true? | DAO/RPC, schema constraint, amount/expiry/identity invariant |
| Consumers | Which readers, sibling paths or displays use that fact? | Direct and transitive consumers; reviewed semantic peers |
| Failure and retries | What happens after timeout, duplicate delivery or partial failure? | Idempotency, transaction, compensation and outage behavior |
| Cache and background work | How do other instances and delayed jobs observe the change? | Key, invalidation, reconciliation, deduplication and restart checks |
| Delivery | What must be installed or migrated before runtime changes? | Deployment order, rehearsal evidence and rollback plan |

For every relevant consumer, write one disposition: **changed**, **reviewed-and-compatible**, or **blocked**. Give a brief reason with evidence. No need to edit a compatible consumer; no permission to ignore it silently. For frontend edits also trace CSS selectors/tokens, context consumers, browser events, focus/scroll ownership, device sizes and all async states. Use the frontend state/browser matrix; unit tests do not prove rendered behavior. If a shared helper reaches many domains, explicitly assess which ones use the changed behavior and explain exclusions.

Example: changing a referral validator can reach the referral API and payment checkout. Review code ownership, pending intent, immutable order attribution, paid settlement and owner dashboard reconciliation. A successful code application alone cannot prove a paid reward. Read `REFERRALS.md` before changing any part of that flow.

## Explain the effect to the user

Before implementation, describe the observed failure, proposed change, connected features and intended checks in plain English. After implementation, state what now happens and where. Example: “Changing this helper affects checkout validation. I also checked payment recovery because it reads the same stored order.” Explain meaningful effects rather than dumping filenames without context.

Ask a question only when evidence cannot resolve a product choice that changes correctness, money, access or irreversible data. Do not repeatedly ask for decisions already established in the session or current source. Do not infer prices, reward policies or deployment state from conflicting old documents.

## Verify and maintain

For a functional bug, reproduce the observable failure and add an independent regression test when useful. Check success, denial, outage, retry and concurrency where applicable. Map-tool changes need fixtures that demonstrate the missed dependency before the fix and retain cycle/non-recursion guarantees afterward.

Run the checks in `README.md`; honor `AGENTS.md` refactor checks. Regenerate both map outputs in the same change. Update affected domain entries only when the business relationships actually change. Update strategy and contracts when an old blocker is resolved. Record exact commands, failures, unavailable tools and untested boundaries. Never relabel a blocked check as passing.

Report these delivery states separately: **committed**, **merged to main**, **CI checks passed**, **deployed**, **live behavior verified**. Include commit/PR links and evidence where available. A merged change is not a migration or deployment. Future assistants must repeat this procedure; the presence of these documents cannot itself force every tool to follow them.
