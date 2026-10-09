# Change: accept full referral links without truncating or forcing capitals

- Starting commit: `7fbceabd3be23f5ba8916a0042c12bf041865dc4`.
- Request/evidence: Rahul's three screenshots show a pasted referral link reduced to `HTTPS://BSENEXUS.IN/`, a clipped referral-link input and uppercase custom-code editing.
- Verified cause: both `ProCheckoutView` inputs have maxLength=20, uppercase onChange, autoCapitalize=characters and a CSS uppercase transform; Apply forwards the whole draft as a code. `ReferralDashboardModal` displays a long URL in a narrow one-line input and custom editing has maxLength=16 despite the server's 3–20 contract.
- Scope: frontend input parsing, link presentation and draft handling; preserve backend uppercase aliases, unique owner mapping, old links, payment attribution and reward rules.
- Impact command: `npm run map:impact -- src/components/ProCheckoutView.tsx src/components/ReferralDashboardModal.tsx src/App.tsx`; commerce/referrals/design/navigation reviewed, plus semantic peers reached through App/Layout. No unrelated screen redesign.
- Proposed contract: one parser accepts a 3–20-character code or a same-site HTTP(S) URL containing exactly one ref query; validates the complete candidate before uppercase normalization for the API. Preserve raw typing; disable capitalization/correction; full paste extracts the code. Both checkout steps share a field. Referrer sees a wrapping lowercase URL and a distinct full code; Copy/social share use the exact same full URL. Short custom codes remain server-claimed, never fabricated by dropping a uniqueness suffix.

| Action/entry | Owner and effects | Disposition |
| --- | --- | --- |
| referral.apply: plan/pay forms and stored candidate on checkout open | draft → parser → authenticated apply API → confirmed applied code/discount → durable checkout attribution | Changed parsing/field; API/payment business contract compatible |
| referral.capture: shared-link landing | URL candidate → validated local candidate and approximate visit analytics; checkout revalidates | Changed parser and candidate-only copy; opening a link does not claim confirmed discount |
| referral.share: Copy/WhatsApp/Telegram/X/manual selection | data.code → one lowercase presentation URL; retain entire unique alias | Changed wrapping/selectable display; clipboard failure preserves manual recovery |
| referral.customize | raw draft → normalized 3–20 code → authenticated unique-claim API → confirmed dashboard refresh | Changed keyboard/case/length hints; old aliases and collision behavior compatible |
| receipt/history/payment/free-day/reward/SSE | confirmed backend ownership and immutable order attribution | Reviewed-and-compatible: normalization remains uppercase, no schema/payment/stream policy change |
| Settings/Layout referral entry points and payment overlays | same modal/checkout owners; existing focus/scroll hook | Reviewed-and-compatible; no new overlay lifecycle or global event |

- Presentation: retain current emerald/teal sharing card and payment tokens. Scoped URL/code wrapping prevents clipped value; both light/dark variants retained. No added motion.
- Acceptance: Rahul's full URL produces `RAHULDAH_6C93BAE8` at API boundary; direct lowercase typing stays lowercase in draft; old uppercase/full and lowercase links identify the same alias; 20-character custom code accepted; missing/duplicate ref, foreign/credentialed/malformed URLs and invalid/oversized codes rejected without removing characters into another owner's code.
- Failure/recovery: invalid candidate shows a code-or-link error before request; existing server rejects self/inactive/conflicting ownership; server failure retains draft; clipboard failure offers manual selection. Browser entry/store remains a candidate, not authority.
- Verification: `npx tsc --noEmit` passed; full backend test suite passed 286/286 (30 suites), including four new parser/field behavior tests; `npm run build` passed with the existing chunk warning; `npm run test:map` passed 6/6. No actual payment, notification or migration was used. Cached dependencies reused; no fresh npm ci. Build-only version bump restored.
- Browser evidence: an isolated harness using the actual React checkout/dashboard components and fixture API/storage was built and served on port 4173. Cloud-browser navigation to http://127.0.0.1:4173 returned ERR_CONNECTION_REFUSED; no usable rendered preview was available. Local Chromium/Firefox binaries were unavailable. New layout, real DOM paste/clipboard, keyboard, 390/768/desktop layouts, dark/light, focus and actual iPhone checks remain NOT RUN. Handler/SSR tests are not a substitute for browser evidence. Muse handoff requests those exact cases.
- Map/diff: regenerated current map and reviewed full source/doc/style diff; record final map check and byte verification in delivery status.
- Host checks: compile_applet/lint_applet unavailable. Local TypeScript/build and relevant tests will be recorded.
- Delivery/rollback: source push separate from AI Studio Pull/Republish and live verification. Revert this frontend change if needed; no DB rollback.
- Full site action registry/design migration remains outside this bounded repair. No claim that all frontend actions or devices are verified.
