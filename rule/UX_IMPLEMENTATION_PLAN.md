# Approved UX audit implementation — ordered batches

Approved by the owner on 3 November 2026 after reviewing BSE_Nexus_UX_Audit_2026-11-03.md. Complete a bounded batch, its sibling consumers, maps and checks before starting the next. Do not repeat the original full-site audit or reskin unrelated screens while fixing shared state.

| Batch | Coherent scope | Audit IDs / state |
|---|---|---|
| 1. Truthful status and recovery | Access-source display across auth/billing/profile, inbox read recovery, declared company result status | Merged in PR #62. Batch 2 adds the underlying oversized-receipt-read repair for F02; production publication and live recovery must still be verified separately. |
| 2. Relevant information and claims | Exact company matching in news, Radar event meaning, shared plan/latency copy and clearly labelled public examples | F04–F07/F13 merged in PR #63 with inbox transport regression and consumer checks in changes/ux-relevance-notifications.md. Existing prices, grants and quotas preserved. |
| 3. Stock monitoring | Personal Home order and detail access, compact Watchlist rows, exact 30-day filing navigation, Company Hub loading badges | F08/F09 and Company Hub portion of F12; F14–F16 on Watchlist. See changes/ux-stock-monitoring.md. |
| 4. Account and research | Saved research/help destinations, text-first notes, profile counts, billing content order | F10/F11, profile portion of F12, F21. See changes/ux-account-research.md. |
| 5. Calendar and filing operations | Separate daily filters and operations, explicit bulk selection scope, contextual help | F18–F20. See changes/ux-calendar-operations.md. |
| 6. Public discovery and shared presentation | Public detail/context, directory and landing clarity, readable shared typography and effective-theme controls | F16/F17 and F22–F26. See changes/ux-public-presentation.md. |
| 7. Release verification | Per-role UI, real device/zoom/keyboard, auth recovery, persistence/export, provider sandbox, delivery and measured usage | Local application, map, build and synthetic Chromium evidence is recorded in the change records. Release verification found and repaired the retry blocker in changes/checkout-gateway-recovery.md. GitHub publication of batches 3–6 is gated on approval for the generated-map payload. Hosted checks, production publication, physical devices and provider verification remain separate. Do not claim the Supabase egress cause from UI observations. |

Standing acceptance: no invented data or expiry; no loss of account isolation; a failed read is not empty success; the same fact agrees everywhere; named actions preserve issuer and scope. Record remaining gaps explicitly. Already merged mobile/result-history work at upstream 860a03b must be preserved.
