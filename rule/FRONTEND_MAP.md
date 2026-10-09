# Frontend spider web: where changes travel

Source inspected at main `d1df67a462fc4ec4222b9c1944a6ebff93fabeb9` on 2026-10-07. This is a code-based navigation guide, not proof of live browser behavior. Update it with related source changes; use the generated map for exact current import/call-site locations.

## Layers and owners

| Layer | Actual source | What depends on it |
|---|---|---|
| Boot | `src/main.tsx`, `src/lib/sentry.ts`, `src/index.css` | StrictMode, error boundary, app mounting, global theme/font/style inheritance |
| Routing and shell | `src/App.tsx`, `src/components/Layout.tsx`, `src/utils/shareUrls.ts` | Public routes, tab selection, lazy screens, detail links, checkout-return overlay, header/navigation and global overlays |
| Shared state | `src/context/AuthContext.tsx`, `ToastContext.tsx`, `IntelModalContext.tsx`, `NoteEditorContext.tsx` | Identity/profile/preferences, messages, company-intelligence opening, shared note editor. These files are under `src/context/` |
| Request boundary | `src/api.ts::customFetch`, `src/api/notesApi.ts` | Token/error/cancellation handling and network-status events; every caller's loading/error/retry behavior |
| Browser persistence | `src/utils/cache.ts`, `scrollState.ts`, `cookieConsent.ts`, `src/context/AuthContext.tsx`, `public/sw.js` | Different cache, scroll, consent, session and service-worker lifecycles; do not treat them as one interchangeable store |
| Shared presentation | `src/index.css`, `src/utils/motionTokens.ts`, `src/components/ui/`, `src/styles/`, `src/components/notes/notes.css` | Theme, dimensions, animation, controls and overlays. CSS inheritance is not an import edge |
| Overlay lifecycle | `src/hooks/useBodyScrollLock.ts`, `usePaymentDialog.ts`, `src/components/notes/useNoteDialog.ts` | Nested focus/scroll ownership, Escape, keyboard viewport and restoration. Similar-looking dialogs do not prove identical behavior |

## User journeys and connected effects

| Journey | Entry and state owner | Connected consumers to inspect | Verification anchor and limitation |
|---|---|---|---|
| Navigate or share | `App.tsx::AppContent`, `Layout.tsx`, `shareUrls.ts` | URL/tab sync → lazy panel or FilingPage/ResultsPage → suspense/error fallback → scroll restoration | `routeResolution.test.ts`; browser Back/Forward, focus and lazy loading need separate checks |
| Sign in / expire / sign out | AuthModal/Login → `AuthContext.tsx` → `api.ts` | Shell identity, preferences, permission-dependent controls, cached private state and pending operations | `recaptchaUiState.test.ts`, `apiCancellation.test.ts`; not full browser session coverage |
| Change a preference | SettingsTab → AuthContext → `preferenceSaveQueue.ts` | Optimistic value → serialized save → sync status/rollback → every profile consumer | `preferenceSaveQueue.test.ts`; verify rendered status and account switch |
| Read and filter filings | HomeForYou / Announcements / WatchlistManager | Filters/density → request/feed transforms → cards → company/detail/share/AI actions; refresh must preserve usable content | `core.test.ts`, `auditData.test.ts`; filters/scroll/late responses need browser checks |
| Results and news | ResultsCalendar / QuarterlyResultsLedger / NewsPortal | Company identity, date/session formatting, cache freshness and detail navigation | Data/route tests are candidates, not proof of visual date/table behavior |
| Save or edit a note | SaveNoteButton → NoteEditorContext → NoteEditor → notesApi | Draft/save status → `notes-changed` → SavedNotesScreen and Settings counts; deletion and failure must stay consistent | `notes.test.ts` covers API behavior; editor and focus require browser evidence |
| Purchase or restore access | PricingPage / ProUpgradeModal → ProCheckoutView → cashfree helper → App return handler | Auth/profile refresh → ProReceiptView, PaymentHistory, SubscriptionCard and progress; pending differs from success | Pricing, referral-contract and subscription-progress tests; provider sandbox/browser return still separate |
| Use or manage referrals | Settings event → Layout → ReferralDashboardModal | Applied code, stream snapshot/reconnect, pending/confirmed totals, checkout discount and stale indicator | `referralContract.test.ts`; read `REFERRALS.md`, do not infer deployment from UI source |
| Request AI summary | AiSummaryViewer / CompanyIntelligenceModal → `aiQuota.ts` → API | Loading/cancel/error → output → quota meter / upgrade entry / SaveNoteButton | `aiQuotaFrontend.test.ts`, `apiCancellation.test.ts`; streaming, cancellation and draft interactions need browser checks |
| Receive notification | NotificationInbox / Layout / push prompt | Badge/list/read state, preferences, permissions, background delivery and deep link | Backend delivery tests do not validate the inbox DOM or browser permission UX |
| Lose network / reconnect | `api.ts`, retry/cache helpers, service worker | `network-status` → Layout banner; cached content, retry, sync status and stale timestamps | `pwaOfflineSync.test.ts`; real service-worker lifecycle and account isolation need browser checks |
| Change theme or shared control | App/theme state, global CSS, UI primitive | Every affected screen, portal, loading skeleton and overlay; inspect selector/token users, not only imports | No complete visual regression suite established in package scripts |
| Read public pages | LandingPage, GuidesPage, CompaniesPage, TrustPages | CTA/navigation, responsive composition, server discovery content and public claims | `searchEngineDiscovery.test.ts`; no proof of responsive rendering or interaction |

## Browser events: real non-import connections

The generated JSON contains `browserEvents` with file, line, global target, dispatch/listen/remove kind, literal name (or null), and expression. The CLI returns `eventRelatedFiles`; the HTML viewer has a browser-event peer card and call-site table. Matching is one hop and requires the same target plus literal name and opposite dispatch/listen roles. A window event is not automatically a document event. Removal sites are shown for cleanup review but do not create peer edges.

| Event | Producer evidence | Consumer evidence / required review |
|---|---|---|
| `notes-changed` | `src/components/notes/NoteEditor.tsx` | SavedNotesScreen and SettingsTab listeners; list/count consistency after save |
| `network-status` | `src/api.ts` | Layout listener; distinguish failed network, cancelled request and successful refresh |
| `open-referral-modal` | `src/components/SettingsTab.tsx` | Layout listener owns opening the referral overlay |
| `app-toast` | `src/context/ToastContext.tsx` | Same context's global listener; content must reflect confirmed state |
| `open-company-intel` | Search generated dispatch call sites | `src/context/IntelModalContext.tsx` listener; verify requested company and overlay lifecycle |
| `bse_ai_quota_changed` | `src/utils/aiQuota.ts` | Same utility's subscribed quota consumers; account and refresh semantics still need manual checks |

Event constants such as `EVENT_NAME` / `SYNC_EVENT_NAME`, aliases, bubbling, third-party dispatch and events constructed elsewhere are deliberately unresolved, not guessed. Search their definitions/callers. A listener match is a review relationship, not proof it runs on the same mounted page or has a compatible payload.

## How to read and maintain the web

- `npm run map:impact -- src/components/notes/NoteEditor.tsx` shows imports plus the disconnected notes listeners.
- `npm run map:impact -- src/hooks/usePaymentDialog.ts src/styles/payment.css` covers code consumers and the reviewed style/commerce domains.
- Open `rule/generated/spider-map.html`, search/select a file and filter a `Frontend:` domain. Lists contain full candidate sets; the diagram limits visible nodes for readability and draws imports separately from semantic peers.
- Run `npm run map:watch` while editing and refresh the viewer after regeneration. Commit JSON, HTML, changed domain entries and the change explanation together.
- Record each relevant consumer as changed, compatible with evidence, or blocked. Global CSS changes require checking all affected screens even if a seed domain lists only representative owners.

The map does not execute the UI, inspect production traffic, prove context correctness or certify accessibility. See `FRONTEND_RULES.md` for behavior/browser evidence requirements.


2026-10-08 alert follow-through: SettingsTab and both Layout entry points share AlertRulesModal. Preset drafts → one durable PUT → confirmed rules/switches; custom create/edit/toggle/delete → owner-scoped API → same list/count. Presets are excluded from the custom count. Session/open lifecycle aborts obsolete requests and retains failed-save drafts; explicit channel selections feed recipient-specific monitor decisions. See `changes/alert-reliability.md` for tests and remaining browser/runtime gates.

2026-10-09 referral input repair: App link capture and ProCheckoutView apply use `utils/referralInput.ts`; plan/pay forms share `ui/ReferralCodeField.tsx`. Dashboard derives copy/social/manual share from one full lowercase link and exposes a wrapping full code/URL. Case formatting does not change backend aliases or unique ownership. Custom-code drafts preserve typing and match the server 3–20 limit. See `changes/referral-link-input.md` for acceptance and browser evidence limits.


## Home Market News (2026-10-09)

`App.activeTab` → `HomeForYou.isActive` → `HomeMarketNews` owns one account-scoped `HomeNewsFeed`. Visible Home fetches `/api/news` on entry, every 60 seconds and on eligible visibility return; the server retains its three-minute shared RSS cache. `Feed checked` describes a successful client read, not a publisher update. Hidden screen/document and identity changes cancel obsolete requests. Background changes queue until the user chooses Show updates; errors retain existing cards. `homeNews.ts` validates links, distinguishes unknown dates, ranks and deduplicates at most three entries. Text cards link to the original publisher; no images or article scraping.

Home news appears before a two-item watchlist preview and results. Existing NewsPortal keeps its complete feed/filter behavior. Mobile dock opens the existing News route; top gear/profile still open Settings. Scoped `home-news.css` adopts existing emerald/light-dark/density values, full headline wrapping and reduced motion. Phone is one column, tablet a full-width lead plus two supports, wide desktop a lead beside stacked supports. Automated behavior/SSR checks are distinct from outstanding browser/device acceptance; see `changes/home-market-news.md`.


2026-10-09 mobile follow-up: Home uses shared ActionButton for All news/Refresh/Show updates and shared ShareActionMenu/SaveNoteButton per article; the card is an article with separate original links, not an anchor wrapping buttons. Notes open a linked draft in the global NoteEditorProvider; no save-success claim until the editor confirms. Shared share `contentKind=news` preserves the original article URL and uses original-article copy, while all default disclosure consumers retain previous behavior. Full NewsPortal search wraps below title/filter controls on phones; card actions wrap and use larger touch targets, Telegram/AI preserve existing handlers through ActionButton. Separate Story and engine status/toggle removed from shell header; obsolete header-only staleness polling removed. Logo Story, CommandPalette engine controls and Settings theme remain. Phone branding/eligible Pro restored; quick theme toggle desktop/tablet only. Browser evidence is separate; see `changes/news-mobile-controls.md`.


2026-10-09 minimal-action follow-up: full NewsPortal footer now contains only AI icon, shared Share menu and Notes. Original article remains reachable from the headline; manual direct Telegram dispatch handler/state and duplicate external link removed. AI retains authentication/quota/network error feedback through its own aiError state. Share menu still offers Telegram. Home preview removes its duplicate Read footer action and keeps compact share/note icons. Settings removes news-feed from search registry/tool group; dedicated navigation remains authoritative. Automatic Telegram news preferences and server dispatch route are unchanged. See changes/news-minimal-actions.md.


2026-10-09 keyword guides: shared static English article records supply server catalogue and frontend fallback. Native links open full server-rendered API/shareholding drafts with code, semantic tables, eight FAQs/schema and exact metadata. Pending review is explicit; getIndexableMarketGuides excludes them from discovery/sitemap/IndexNow. Existing guide modal and backend business rules remain compatible. See changes/keyword-guides.md for tests and separate browser/deployment limits.


## Filings refresh verification — 2026-10-09

Cache initialization and every refresh share publication-date sorting and seven-day pruning. Historical backfill cannot outrank current filings through ingestion time. Cached/unverified, failed, blocked, empty and historical feeds have explicit status; the header offers refresh. `server/tests/announcementFeed.test.ts` covers data ordering, corrected records, IST parsing and status policy. Fresh production browser showed today’s filings before this change; the screenshot’s old session was not reproduced. Post-change device/reconnect verification remains a deployment audit item. See `changes/filings-freshness.md`.
