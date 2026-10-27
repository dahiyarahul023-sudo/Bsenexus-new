# Backend rules and acceptance criteria

These are project engineering requirements, not claims that every control already passes. Their research motivation is in `RESEARCH.md`.

| ID | Rule | Evidence required for a relevant change |
|---|---|---|
| R01 | No invented facts, functions, endpoints, tables, SDK options or package names. Read definitions and callers first. | Exact file/symbol or official documentation; explicitly named unknowns. Verify any new dependency in its official registry, review publisher/version and lock it. |
| R02 | Trace both directions and across boundaries before editing. Include sibling features representing the same business fact. | Import impact plus semantic domains; HTTP producer/consumer, mount guards, table/RPC, job, cache, copy and tests considered. |
| R03 | Authenticate at the server. Derive ownership from verified identity; treat client role, email, UID, price and quota as untrusted. | No-token, expired/revoked token where applicable, wrong user, ordinary user/admin and durable-store outage cases. Firebase identity and server JWT revocation are separate mechanisms. |
| R04 | Paid entitlement is separate from ordinary profile edits. Never report a payment grant without durable confirmation. | Server plan amount/currency; verified provider status/signature; raw webhook body ordering; owner binding; webhook/verify/recover/claim parity; duplicate and concurrent calls. |
| R05 | A timeout is an unknown outcome, not proof a write failed. Retrying side effects needs a stable idempotency key and durable deduplication. | Timeout-after-commit, repeated webhook, concurrent orders for one UID, process restart and retry tests. In-memory locks only protect one process. |
| R06 | Schema and code are one contract. Add forward migrations without rewriting applied history. | Tables, constraints, indexes, privileges, RPC arguments/return shape, deployment order, backfill and rollback/forward-recovery plan. Test on an isolated database before production. |
| R07 | Service-role credentials never enter browser code or logs. Because service-role access bypasses RLS, server ownership filters are mandatory. | Cross-user read/write/delete denial; privileged functions inaccessible to anon/authenticated roles where intended; no secrets in bundles/reports. |
| R08 | Validate request type, length, enum, range and identifiers at trust boundaries. Encode output for its actual context. | Malformed/oversized inputs; allowlisted document URLs, redirects, private network rejection, download limits and cancellation; SSR text/attribute encoding. |
| R09 | Preserve trial, paid and free-demo distinctions; keep limits, reset times and public copy consistent. | Server enforcement and client display tested together; exhausted quota, expiry, concurrent consumption, refund/release and IST date-boundary cases. |
| R10 | Cache entries need explicit ownership, key, TTL, invalidation and stale-data behavior. | Mutation updates/invalidation reach all consumers; personalized responses cannot leak across users; source timestamps remain distinct from fetch time. |
| R11 | Background work needs bounded concurrency, timeouts, backoff and a defined multi-instance/deduplication strategy. | Restart, overlapping runs, upstream 429/5xx, partial progress, poison item and backlog recovery; no duplicate recipient delivery from retries. |
| R12 | Do not use fallback storage to silently weaken a domain's durability contract. | Supabase failure and restart tests per DAO. Payment/entitlement failures stay visible; local JSON/cache availability is not durable success. |
| R13 | Every stateful UI consumer must handle loading, success, empty, denied, retry and stale state consistently. | API shape changes propagated to `src/api.ts`, contexts, relevant screens and offline/service-worker behavior; no success toast on unconfirmed writes. |
| R14 | AI responses and fetched documents are untrusted. Backend authorization and budgets remain outside model decisions. | Prompt-injection content cannot grant authority; provider failures, model availability, output shape, provenance and quota accounting tested without real paid calls in routine CI. |
| R15 | Logs should identify operation/request and safe error category without tokens, keys, document contents or personal payloads. | Redacted failure examples and appropriate error status; alerts/runbook for repeated failures. Avoid swallowing errors as successful empty results. |
| R16 | Tests must challenge the change: positive, denied, outage and concurrency paths when relevant. | A reproduced bug fails before and passes after; independent expected behavior; no weakened assertion, broad catch or mocked success to make CI green. |
| R17 | Keep the graph and explanation in the same change. Preserve standing deletion/refactor checks in `AGENTS.md`. | Fresh map check; updated domain membership; change record; no dangling references; exact checks and unavailable tools disclosed. |
| R18 | Report scope honestly and preserve recoverability. | Separate inspected/tested/deployed; reviewed diff; no real charges, notifications or live migrations during local verification; record rollback and unresolved release blockers. |

## Minimum review matrix

| Change | Review together | Adversarial acceptance cases |
|---|---|---|
| Plan price/duration | Backend catalogue, frontend catalogue, all grant paths, receipt/history, manual copy, pricing test | Client-supplied price ignored; wrong amount/currency rejected; duplicate grant does not extend twice |
| Auth/role/session | Firebase verification, JWT issuance/verification, mounted route guards, durable profile, client cache | Wrong UID, stale claims, expired credentials, database down; cached Pro cannot authorize |
| Schema/DAO | SQL, all readers/writers/RPCs, local fallback, indexes, caches, migration notes | New install and upgrade; partially unavailable service; no lost write or privilege expansion |
| Trial/AI allowance | Grant logic, durable quota, API error shape, frontend meter/paywall, pricing/help copy | IST rollover, concurrent calls, free-demo replay, provider failure, expired subscription |
| Alert/inbox | Monitor, preferences/watchlists, rules, audience selection, delivery, receipts/clear cutoff, UI | Wrong recipient, duplicate event, restart, muted user, out-of-order read/clear |

Use the relevant cases; do not claim all were executed merely because this checklist exists.

Result-history evidence (2026-10-25): elapsed scheduled meetings stay Past Meeting; only a matching result filing can declare a quarter. Publication time is distinct from ingestion and meeting time. Read failures cannot become confirmed zero history; public history must not depend on an unspecified user watchlist. Archive starts return receipts, polling does not start new work, and completed/failed receipts prevent read-triggered retry loops. See changes/result-history-timing.md.

Result-title coverage follow-up (2026-10-25): do not require the literal word financial when the official disclosure says Results For Quarter/Q1 or Outcome - Results. Ancillary presentations/newspapers/voting results remain excluded. A generic board outcome requires identity-bound document evidence. Confirmation must verify newly written proof, not merely the pre-existing filing ID. Archive storage success and unresolved PDF checks remain separate facts; no PDF content is persisted beyond a bounded proof excerpt. See changes/calendar-result-evidence.md.
