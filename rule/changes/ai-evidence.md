# Broader AI reads, required branding and factual calendar HTML
Date:21 Oct2026 IST. Starting commit:fea85addd4e2f69496a614fe4715b6c009943b1c.
User request: confirm merge; optimize other connector operations similarly; logo is a mandatory requirement; make the data easier for AI search to assess accurately.
Verified PR4 merged and main push39499264754 green.

Source facts:
- market.resultsData maps the first8 rows of getStockResultsHistory. That history deliberately includes future notices and even infers isOutcome from a past NSE meeting; valid original PDF/outcome evidence must gate declared-result output.
- market.filingsData trusts source array order and sends up to4000 summary chars per item. before timestamp alone cannot disambiguate same-timestamp page boundaries.
- company_lookup returns the full directory entry for exact matches although a compact identity is enough.
- Notes are text-only, bounded by the note contract; notifications already project fields; account/alert flags and mutation receipts are bounded. SQL watchlist mutations return stockCount without items; preserve their semantics and replay/authorization.
- The /results-calendar initial SPA HTML is the generic index preloader with sample announcements/hidden generic copy, not the actual current calendar rows. The dynamic website UI remains unchanged.
- Branding is advertised in MCP initialize but mandatory asset/required-release status should be recorded and checked. Client UI display remains controlled by the host.
- No prompt, hidden text or self-described accuracy score establishes source correctness or search preference.

Bounded implementation:
1. Compact/explicit brief/full read summaries, chronological filing ordering, typed range/paging with stable timestamp+id cursor, provenance and source-backed declared results. Preserve source calls and unrelated financial business rules.
2. A synchronous public-only cached calendar snapshot for initial HTML; no network/database request or refresh on the page path. Render same visible source/time/coverage for human and bot, source links and escaped JSON-LD. Public cache bounded around IST midnight, not the generic tab HTML cache.
3. Mandatory BSE Nexus branding gate with PNG asset validation and SDK metadata. Do not invent an MCP 'force logo' field.
4. Review remaining tools as compatible; keep OAuth, scopes, quotas, paid summary generation, SQL, PWA and private account data unchanged.
5. Browser/no-JS checks for the public preview; focused source/order/cursor/branding/escaping/privacy regressions; full CI/maps/build before merge. No claim of improved ranking, actual billed token savings or live publication.

Rules: AGENTS and unchanged frontend/backend/contract rules reviewed from current sources; map:impact required before source edits. Local execution unavailable; runner workflow is temporary, no production credentials. compile_applet/lint_applet unavailable; npm/fresh Bun/type/build checks are the available substitute. Record deployed/client-rendered states separately.
