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
