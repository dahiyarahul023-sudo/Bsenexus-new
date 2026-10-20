# Change: approved layered visual treatments

- Starting commit: `e98fa409454ac1f860cfede0466db0b9c711504a`.
- User approved both numbered mockup sheets (01–12) on 2026-10-10. Frontend only; preserve all company logos, actual prices, reward policies and existing workflows.
- Acceptance: coherent layered icons, Earnings date tiles, Notes/Watchlist empty states, Pro access, checkout plans, receipt/progress, referral, push prompt, inbox, semantic badges and action states; readable English UI; stable controls across phone/tablet/desktop and both themes; reduced-motion feedback.
- Verified source: Layout::renderNavIcon is shared by three navigation surfaces; HeliosPill supplies feed/status badges; PlanCard supplies pricing/upgrade cards; payment/referral CSS and dialog hooks own overlay geometry and lifecycle; NotesIllustration supplies empty-state action. Company identity renderers are independent and remain untouched.
- Impact: `npm run map:impact -- src/components/Layout.tsx src/components/ui/ActionButton.tsx src/components/ResultsCalendar.tsx src/components/WatchlistManager.tsx src/components/Announcements.tsx src/components/notes/NoteCharacter.tsx src/components/ProCheckoutView.tsx src/components/ProReceiptView.tsx src/components/ReferralDashboardModal.tsx src/components/PushNotificationPrompt.tsx src/components/NotificationInbox.tsx`.
- Source of truth: shared `src/styles/rich-ui.css`, decorative `ui/RichVisual.tsx`; documented adoption and exceptions. No new API, storage, timer or business-state owner.
- Relevant domains: frontend-design/navigation/feed/notes/commerce/offline-privacy. Relevant consumers and verification results will be recorded below after implementation.
- Risks: CSS inheritance/specificity (including softglass), long labels, narrow viewports, small-height keyboard viewport, focus visibility and disabled states. Existing modal focus/scroll hooks and event listeners remain owned by their existing components.
- Delivery and browser status: implementation in progress; no deployment or production verification claimed.


## Consumer dispositions and contracts

| Treatment / consumer | Disposition | Actual wiring / exception |
|---|---|---|
| 01 navigation | Changed | Layout::renderNavIcon feeds desktop navigation, menu and phone dock; 22px icon frame, teal selected surface. Route, Back, eligibility and profile ring owners unchanged. |
| 02 Earnings | Changed | ResultsCalendar renders RichDateTile from existing parseMeetingDateTile result; selected/today outline/text preserved; no new dates. |
| 03 Notes | Changed | NotesIllustration decorative purple notebook, teal bookmark and existing clay character; pointer tilt keeps mouse/reduced-motion guard. SavedNotesScreen/NoteEditor adopt shared input/CTA. NoteEditorContext/notesApi continue to own drafts/writes/errors. |
| 04 Watchlist | Changed | Empty companies use decorative layered buildings; search-no-match retains Search icon. Existing add-company suggestions, tabs, search and HTTP access handling preserved. Active tab counts corrected for light/dark contrast. |
| 05 Pro access | Changed | Watchlist gate gets gold lock/CTA; shared PlanCard gets gold crown and teal CTA. Paid eligibility/AuthContext and actual catalogue unchanged. |
| 06 checkout | Changed | ProCheckoutView::move still owns choose/review/back; selected plus next plan remain based on reviewBaseId; highest plan still single. Review heading/selected surface/gold marks/Pay restyled. ReferralCodeField/parseReferralInput/handleApplyReferral unchanged; no tax or new backend discount rule. |
| 07 receipt/progress | Changed | Success vector appears only where the existing confirmed receipt/trial success state renders. Receipt's real amount and thermal/reprint/tear/copy/email flows stay intact; Continue still closes via setReceipt(null). Existing access-track uses real subscription-derived width. Old receipt never asserts current Pro eligibility. |
| 08 referrals | Changed | Stable actual Invite Friends/Creator/Verified tabs keep role/keyboard/selectTab/SSE cleanup; violet identity mark, creator illustration, toned metrics/selected state. Payouts stay inside Creator; no invented verification or sample ledger. |
| 09 push | Changed | Compact bell banner, short English copy, 44px Allow alerts/dismiss, English iOS instructions. Actual OneSignal permission/subscription/dismissal state unchanged. |
| 10 inbox | Changed | Quiet opaque card surfaces; unread has dot + thin left accent; HIGH/category icon colors still semantic. Full title and metadata wrap. Existing click/read/filter/mute/error owners unchanged. |
| 11 badges/filings | Changed | HeliosPill data-tone preserves labels/dots; Helios cards receive subtle edge/surface; existing filing/search/filter responsive fixes remain, inputs get soft inset/focus. |
| 12 shared controls | Changed | ui/ActionButton retains busy/cooldown/async/error semantics, now honors reduced motion for tap. SlidingTabList keeps roles/onChange/counts; PlanCard CTA uses min-height and padding instead of fixed height for long labels. |
| Other ui/ActionButton, Helios, PlanCard consumers | Reviewed and compatible | Home/news/Settings/admin/detail/pricing/upgrade/SubscriptionCard use shared styling without handler edits. Destructive, ghost and neutral actions retain variants. landing/ActionButton is independent and unchanged. |
| Company identity/assets | Reviewed and compatible | BseNexusLogo and all company-logo renderers/assets/URLs unchanged. Native illustrations are decorative app feature art, not replacement logos. No generic img/logo selector. |
| Softglass | Explicit exception | Existing light warm-card/suggestion/dropdown language stays; approved new panels/actions receive scoped warm surfaces/teal action hooks. No new paid theme setting. |
| Runtime/device acceptance | Blocked | Actual-component fixture compiled, but cloud browser blocked file:// by URL security policy. Local HTTP preview separately returned ERR_CONNECTION_REFUSED. No bypass or alternate browser surface attempted after policy denial. |

Tokens are centralized --rich-surface/soft/ink/muted/border/edge/shadow/focus/selected/selected-ink/selected-border/emerald/gold and explicit tone classes. No API/storage/browser-event additions or new business-state owner. Input focus, decorative aria-hidden icons, real date text, semantic labels/selected state, disabled/cooldown behavior remain distinguishable without color. CSS breakpoints include 540px, 359px and 500px height; payment/referral/mobile repair styles continue to own overflow, scroll, safe areas and keyboard geometry. These are source-reviewed rules, not actual-device evidence.

## Verification

- `npm run lint`: passed TypeScript.
- `npm run build`: passed tsc/Vite/server bundling; existing >1200kB chunk warning remains. Build's automatic version bump restored to starting version so release metadata is not silently changed. Final follow-up `npm run build` also passed after the contrast/count/title-wrap corrections; version restored again.
- `npm run test:map` equivalent `node --test scripts/spider-map.test.mjs`: 6 passed.
- `npm run map:generate` + `npm run map:check`: passed 325 files, 880 imports, 21 domains, no computed-import gap. Rechecked after final source changes. Generated JSON/HTML maintained together.
- Existing pricingSync/subscriptionProgress/referralInput/calendarScope/notes/oneSignal/routeResolution selection: initial 40/41 passed; route server-render case required JWT_SECRET test configuration. Test-only rerun of routeResolution: 7/7 passed. Thus all 41 selected cases passed across runs; no production secret or server policy change.
- TS AST comparison: all event-handler attributes unchanged in 20 modified TSX files against pinned baseline. Cashfree/catalogue/AuthContext/dialog/referral parser/brand-logo files byte-identical. This is source evidence, not executed interactions.
- Sampled CTA gradient stops: teal 4.79:1, gold 6.10:1, violet 5.70:1, sky 5.17:1 minimum for specified ink. Not a full rendered/accessibility certification.
- `compile_applet`/`lint_applet` unavailable in this host; configured build/lint used.
- Browser/physical-device acceptance, virtual keyboard, text zoom, actual softglass rendering, focus containment and real providers are NOT marked passed. Browser preview was blocked; no screenshot or fixture data is presented as live app evidence. No real payment/payout/push permission action performed.
- Source implementation and local checks complete; GitHub push tracked separately from CI/deployment. No deployment or production behavior claim.

## Risk and rollback

Remaining risk is CSS/runtime presentation (especially narrow review-plan labels, legacy softglass specificity and receipt vertical fit) until device verification. Roll back this bounded commit to restore previous presentation; shared handlers and backend contracts have not changed. No migration, dependencies, deletion or file rename.
