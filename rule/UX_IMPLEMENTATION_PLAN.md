# Approved UX audit implementation — ordered batches

Approved by the owner on 3 November 2026 after reviewing BSE_Nexus_UX_Audit_2026-11-03.md. Complete a bounded batch, its sibling consumers, maps and checks before starting the next. Do not repeat the original full-site audit or reskin unrelated screens while fixing shared state.

| Batch | Coherent scope | Audit IDs / state |
|---|---|---|
| 1. Truthful status and recovery | Access-source display across auth/billing/profile, inbox read recovery, declared company result status | F01/F03 source fixes; F02 error/empty/retry presentation implemented. Production inbox request failure and interactive verification remain open. See changes/ux-status-consistency.md. |
| 2. Relevant information and claims | Exact company matching in news, Radar event meaning, shared plan/latency copy and clearly labelled public examples | F04–F07, F13. Prove matching/classification cases before changing rules. Do not change quotas or pricing policy. |
| 3. Navigation and task flow | Personal Home order, exact filing-count destinations, saved research/help, text-first notes, loading counts, filter/operations separation, bulk scope, calendar help, billing content order, public detail/context | F08–F12, F18–F23. Keep explicit action/owner/reader records; avoid separate one-off versions of the same action. |
| 4. Shared presentation | One teal accent family, readable metadata/type roles, compact watchlist rows, restrained cards and consistent effective-theme controls | F14–F17, F24–F26. Define tokens once, then migrate affected screens together; preserve useful features and backend guards. |
| 5. Release verification | Per-role UI, real device/zoom/keyboard, auth recovery, persistence/export, provider sandbox, delivery and measured usage | Separate source, automated checks, browser verification, merge and live deployment states. Do not claim the Supabase egress cause from UI observations. |

Standing acceptance: no invented data or expiry; no loss of account isolation; a failed read is not empty success; the same fact agrees everywhere; named actions preserve issuer and scope. Record remaining gaps explicitly. Already merged mobile/result-history work at upstream 860a03b must be preserved.
