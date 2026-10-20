# Change: Bank Q2 FY27 results guide (Oct 17 triple-header, reported numbers)

- Starting commit: 6fe14c9
- User objective and acceptance cases: Same-day results playbook (TCS Oct 8 pattern): all three banks' actuals verified from 2+ independent sources each, guide shipped with reported numbers (preview never published, so no separate preview publish), push + AI Studio publish + live-verify.
- Verified facts (file + symbol): server/services/marketGuidesService.ts, new entry id/slug 'bank-q2-fy27-results-preview'. HDFC PAT Rs 19,510 cr +4.7% / NII Rs 34,620 cr +9.7% / NIM 3.16% / GNPA 1.11% / NNPA 0.37% / advances +16.3% / deposits +18.8% / CASA ratio 31.6% (Business Standard + Business Today + LiveMint + TradingView). Axis PAT Rs 7,003 cr +38% / NII Rs 15,371 cr +12% / NIM 3.36% (3.47% ex-FCNR(B)) / GNPA 1.16% / NNPA 0.35% / advances +23% / deposits +21% / CASA 36% (Business Standard + LiveMint + Times Now + Fortune). ICICI PAT Rs 14,843 cr +20.1% / NII Rs 25,339 cr +17.7% / NIM 4.18% / GNPA 1.20% / NNPA 0.30% / advances +30% (24.1% ex-FCNR(B)) / deposits +27.1% (17% ex-FCNR(B)) / avg CASA 35.8% (ET + Business Today + CNBC-TV18). Consensus reference: Business Standard Oct 9 (HDFC 19,918 / ICICI 14,323 / Axis 7,160). Axis Q1 NIM 3.46% (Moneycontrol + Business Today). Single-source items explicitly attributed in copy: Axis Ananth Narayanan appointment (Business Standard), ICICI Sinha continuation + call commentary (NDTV Profit live blog / ScanX), HDFC Rs 19,610 cr variant (IANS wire) flagged as minority figure.
- Assumptions/unknowns and how they will be resolved: No dividend announced alongside results in coverage reviewed (stated as such, not asserted as a filing fact). HDFC provisions carried as ~Rs 3,570 cr (BS/BT) vs Rs 3,574 cr (TradingView) — immaterial rounding/reporting difference.
- Changed source of truth: FALLBACK_MARKET_GUIDES in marketGuidesService.ts (append-only, one new entry).
- Impact command and affected semantic domains: `npm run map:impact -- server/services/marketGuidesService.ts` — consumers: GuidesPage / MarketGuidesSection / guideIndexNow (auto-IndexNow pickup on boot). No API/storage/cache contract change.
- Related consumers: API, UI, storage/RPC, jobs, caches, manual copy: UI guides list/detail render the new entry; guideIndexNow boot diff picks up the new slug automatically; no storage/RPC/job/cache changes.
- For each relevant consumer: changed / reviewed-and-compatible / blocked, with evidence: Guides rendering — reviewed-and-compatible (same entry shape as TCS/Wipro entries, same fields). IndexNow — reviewed-and-compatible (create-only dedupe logic unchanged). No consumer changed.
- Assignment scope: backend content data (guide entry); no visual/behavior change.
- Frontend: routes, state owner, events, styles/tokens, focus/scroll and related screens: /guides/bank-q2-fy27-results-preview renders via existing guide detail route; no style/token changes.
- UI state/device matrix: actual browser checks, screenshots and untested cases: live-verify via AI Studio publish + browser check of the live URL (see deployment notes); no device matrix run — same rendering path as prior guides.
- Expected user-visible effect: new guide visible on /guides listing and at its URL with reported Q2 numbers and actuals-vs-consensus.
- Failure/security/concurrency cases relevant to this change: none — static content append; no user input, no secrets.
- Implementation and coordinated updates: single-file content append + this change record.
- Commands actually run and results: (filled at commit time) tsc / map:check / tests.
- Required checks unavailable (reason; do not mark passed): none expected; AI Studio publish step is separate from repo checks.
- Deployment/migration requirements and rollback: push to Bsenexus-new main → AI Studio GitHub pull → Publish → live-verify URL. Rollback: revert commit + republish.
- Remaining risks and next bounded step: publish + live-verify pending at commit time.
- Graph/domain/documentation refreshed: change record added in same commit; spider map regenerated/checked per commands below.

- Delivery status: commit / merge / CI / deployment, reported separately.
