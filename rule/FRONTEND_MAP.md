# Frontend spider web: where changes travel

2026-10-21 MCP directory follow-up: AiPluginPage Advanced help → /ai-docs SSR guide; OAuth discovery links to that guide. src/shared/aiDataDisclosure supplies React TrustPages, server privacy and public docs. src/shared/stockIdentity supplies the server resolver and Watchlist/Story/F&O fallback code; current Eternal presets retain Zomato as an alias. No personal list rewrite or plan grant occurs. See changes/mcp-directory-checklist.md for wire/SQL/browser evidence and external release gates.

2026-10-21 directory/loading follow-up: Settings tool-row actions → App.handleTabChange → history/currentRoute → existing PageSkeleton → CompaniesPage/AiPluginPage. Existing popstate owns Back/Forward; full-page href remains only the standalone Settings fallback. companyDirectory owns the ordered list, description and badge; client filters, Settings subtitle, landing links, SSR schema/meta, curated company identity and dynamic sitemap consume it. See changes/directory-loading-indexnow.md for browser and IndexNow boundaries.

2026-10-21 screenshot follow-up: ResultsCalendar keeps internal BSE identities while replacing numeric primary labels with company names. Date separators span list/grid columns and stick below the measured toolbar. Home's latestWatchlistUpdates projection chooses the newest filing per exact active-list security before its two-card limit. App retains silent scroll restoration. Stories retain focus/clock/gesture owners with a visible progress track and direct Previous/Pause/Next controls. AI grant cards have separate content/action columns and readable permission rows. Generic initial HTML shows neutral loading; the announcements-only marker and source-backed public calendar SSR remain separate. Shared exchangeCompanies supplies public BSE/NSE profiles, correct listing labels and directory/landing/sitemap links without expanding intake. See changes/calendar-story-ui-followup.md for verification and release state.

2026-10-21 calendar scopes: ResultsCalendar reuses its toolbar for All / F&O Stocks / Watchlist, with independent existing date tabs. The per-account browser preference restores the last selected scope; first visit is All. A keyed inner view isolates account changes. Account/scope/list cache keys, AbortController and request sequence/key guards prevent old responses from replacing a newer selection; server membership is authoritative even during search. Counts derive from the same returned items. Calendar-only intake retains supplied BSE codes and uses the uploaded 211-security universe; F&O-only membership does not expand announcements, history jobs or automatic Telegram delivery. See changes/calendar-fno.md for checks and the separate browser/hosting limits.

2026-10-20 Settings discovery correction: `indexGroups` now includes the existing `ai-plugin` definition once in Tools & Discovery. Default/search views share its `/plugin` action; guest/user/admin render and handler checks pass. Browser executable is unavailable; see changes/ai-settings-entry.md.

2026-10-17 Impact Radar follow-up: HomeForYou mounts a two-card ImpactRadar preview alongside the original three-card HomeMarketNews. See more opens RadarWindow, a native modal dashboard with All events / Watchlist Radar, timing/category filters and 12-at-a-time display. Whole-card primary buttons open detail immediately inside that window; detail never extends Home. RadarWindow owns inert background, focus containment, scroll position and return focus. RadarMovementPanel reads a separately validated NSE daily-report endpoint; publication, sourced event and earliest recorded announcement dates remain distinct. The Home owner refreshes watchlists on navigation refresh and explicit retry, aborting obsolete identity/refresh reads. Existing durable event-follow ownership is unchanged. See changes/impact-radar-follow-up.md for verification limits.

2026-10-11 startup audit: App feed/home lazy imports, immediate main error boundary and dynamically configured Sentry. Shared nav/tab indicators avoid layout tracking; screen transitions animate direct children after paint scheduling. See changes/performance-security-audit.md for linked consumers and unverified browser gates.

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


## Approved material visuals — 2026-10-10

Shared `styles/rich-ui.css` owns light/dark surfaces, semantic accents, layered edges and explicit action/focus/pressed/disabled states. `ui/RichVisual` supplies small decorative native vectors and real Earnings date tiles. Navigation retains one `renderNavIcon` across desktop, menu and phone dock; the active footprint is fixed. Helios badges preserve semantic tone and text, and shared ActionButton/PlanCard/SlidingTabList distribute the approved treatment to existing consumers.

Notes/Watchlist empty illustrations, locked Pro, checkout selected/next plans, confirmed receipt, referral metrics/stable tabs, compact push prompt, quiet inbox unread accents and filing controls adopt the system. Logos and company identity are excluded. Cashfree prices/verification, expiry, referral drafts/SSE/payouts, notes writes, watchlist search and modal ownership remain with their existing modules. Legacy softglass is an explicit warm-light exception, not a new app theme. Browser execution was blocked by the environment; source/build evidence does not certify rendered/device behavior. See `changes/rich-visual-system.md`.


## Original profile avatars — 2026-10-10

`profile.avatar.select` is a draft in inline AvatarPicker, entered through Account Profile or Settings Edit Profile; selection changes only its preview. `profile.avatar.save` goes through AuthContext/createAvatarSaveController to existing Firebase Auth updateProfile. Confirmed writes update profile/cache/header; denial, outage and account changes preserve existing display and permit retry. Account photo restores the identity provider photo or initials. Firebase photoURL, including an explicit null, is authoritative during hydration and name-update response merging. No server profile whitelist or paid rights changes.

UserAvatar shares 96/256/512 transparent WebP sources across header, profile and Settings. The grid auto-fits, selection does not alter label geometry, existing overlays own scroll/focus, English labels and shared theme/focus tokens remain. Company logos are excluded. Save-controller/SSR/asset tests establish source behavior; real-device rendering and live Firebase save remain unverified in this environment. See changes/profile-avatars.md.


2026-10-10 avatar follow-up: Settings index Account & Identity and its Profile row now render the selected shared UserAvatar. Account section exposes direct Change avatar with the existing inline picker; Edit Profile keeps its picker. Avatar/photo/character search terms discover profile controls. Section/sheet/account changes dismiss draft UI. Persistence and other consumers remain unchanged; browser/device acceptance is unverified. See changes/settings-avatar-entry.md.

2026-10-17 Radar integrity follow-up: company-first display uses a strict master projection; unknown legacy names remain explicitly pending. Category options come from the private server registry with a failed-request fallback. Source age and failure have separate copy; followed closed records survive partial refresh failure. Detail separates order/publication/recorded-news times, links original investor evidence, explains case lookup and shows verified daily close separately from low/high. Existing Home preview, normal news, modal focus/scroll, themes and motion are retained; browser acceptance remains unverified. See changes/impact-radar-integrity.md.

2026-10-17 source-independent Radar intake: explicit RSS times normalize to UTC; private DB terms admit material news-only and independent reports without a named authority. Cards/timelines carry publisher and source type, related-topic reports remain distinct without an exact proceeding reference. Earliest news preserves price anchor; selected final NSE sessions persist as private duplicate-safe numeric snapshots. Existing Home/dashboard/follow/modal behavior is retained. See changes/radar-material-intake.md for actual validation and release limits.

2026-10-17 focused Radar scope: normal acquisitions/mergers and statutory compliance or purchase-order noise are excluded from Radar, with ordinary News/Announcements unchanged. The stable deals category now reads Insolvency & disputes. Source-derived company-first headings replace generic synthetic development updates; legacy records are hidden consistently at DAO list/detail/following reads without deleting evidence or follows. See changes/radar-focused-events.md for exact verification and deployment limits.

2026-10-18 Radar coverage/compact detail: source filing identity repairs legacy numeric names; report-day history remains visible for future hearings. Movement records carry explicit NSE/BSE provenance and optional exchange symbol; private proxy-aware report downloads and bounded queuing avoid dropped requests. Sparse detail omits missing FAQs, reduces missing prices to one retry row, and collapses source history/method/verification behind native details controls. See changes/radar-coverage-compact.md for tests and actual browser/upstream limits.


2026-10-18 content-led Stories: Home and Layout retain the shared TodayMarketStoryModal callbacks. A pure validated adapter generates readable variable-length chapters from the unchanged public feed. Neutral topic identities replace bank logos/links for FII/DII and other aggregates; official company logos remain untouched. Typed news/metric/comparison/chart/list views replace mandatory nested hero/badge/bullet blocks. Cache precedence, stable selection, explicit request states, content-based duration, pause-safe chart/hold/menu/visibility behavior, reduced motion and portal focus/scroll ownership are documented in STORIES.md. Automated/render/build evidence and the blocked browser/device gate are recorded separately in changes/clean-market-stories.md; no merge or deployment is implied.


2026-10-18 bounded Company news follow-up: one chapter has at most seven screens total and at most two per company, with related pages/company groups kept together and recent distinct companies prioritized. Chapter-wide progress includes a current/total count and never resets on an article sequence. Generic/continuation updates can be clean text; relevant sector art is capped and non-repeating, and only unambiguous awarded-order amounts use a source-backed metric. Other chapters, company identity/actions, existing read cache and API remain compatible. See changes/bounded-company-stories.md for regression evidence and separate browser/merge/deployment status.

2026-10-18 shared Radar prices: security aliases reuse private snapshots across reports. Previous session (blue, explicitly before report), up to three event-window sessions and latest company context are distinct. Small selectable up/down bars expose exact dates/prices/sources; refresh keeps usable observations. Boot/watchdog and authenticated cron await bounded capture without browser visits; storage/source failures are separately logged. Targeted company-report links show latest reports from old detail without joining unrelated proceedings. See changes/radar-price-context.md for checks and hosting/browser limits.


2026-10-18 notification startup repair: verified Firebase readiness gates Layout's account-scoped unread controller; guest/invalid server sessions receive 401 from unread-count, and its successful responses are private/no-store. Header, inbox and profile share one confirmed count; owner/sequence guards block late responses and read actions refresh after confirmation. Native browser permission and SDK subscription remain separate: granted permission hides the banner across reload/login even with a late/blocked SDK, with permission/subscription/focus changes reconciled. Web SDK PushSubscription uses its correct namespace; the original worker URL migrates scope only to /push/onesignal/, with auto-resubscription and no automatic permission prompt. Preview cleanup preserves push workers. Free for All copy is removed. See changes/notification-startup.md for tests and separate browser/provider/deployment limits.


2026-10-19 Telegram results policy: Settings personal and server AI labels now describe financial-results-only replies and one company/period summary. Existing switch state/save handlers, Pro scope, summary-language control and site-requested AI are unchanged. Backend durable claims enforce the behavior across BSE/NSE copies. This is a copy-only UI edit; automated checks do not establish browser/device rendering. See changes/telegram-results-delivery.md for evidence and release state.


2026-10-19 watchlist/alerts/Radar repair: responsive WatchlistEditor replaces duplicated fixed-height management panels, exact active-list identities replace Home substring matches, named BSE metadata survives save/priority/undo, and account-keyed caches/remount isolate private state. Unread-first inbox, explicit read labels, confirmed writes and optional App Badging share the existing count owner. Settings and alert rules retain DeviceNotificationControl with confirmed provider On/Off and saved opt-out; native permission alone is not delivery success. Contained shared switches and persistent Save changes remove the softglass icon-switch artifact. Radar groups company reports for presentation while preserving proceedings/follows; a private seven-day scan ledger removes process-local freshness assumptions. See changes/watchlist-alert-radar-repair.md for tests, migration and separate browser/provider/hosting verification limits.


2026-10-20 AI connection setup: Settings owns the sole visible entry. Canonical/legacy plugin routes and OAuth deep links remain. AiPluginPage separates selected provider, public URL copy, approved grants and external-client completion; account/request-keyed data and action guards prevent stale feedback, while same-owner refresh retains content. Provider-specific instructions and scoped wrapping controls replace duplicate pills and generic platform cards. See changes/ai-connection-usability.md for security and browser/deployment limits.

2026-10-20 AI connection verification follow-up: eight Chromium scenario groups pass on the actual component/CSS with test-only API/auth adapters, including 320–1440 CSS widths, manual copy, dark mode, 200% CSS zoom, keyboard focus, account isolation, retry/revoke and opt-in consent. This does not certify live OAuth, storage or physical iOS/Android devices. See changes/ai-connection-usability.md for concurrent-main integration and separate CI/merge/hosting status.


## Public results-calendar initial document (21 Oct2026)
server.ts dev/prod SPA owners call services/publicCalendar.renderPublicCalendarShell for /results-calendar. The synchronous readCachedResultsCalendar owner supplies only existing public calendar facts; no refresh or account read occurs on this path. Public source/time/coverage cards and same visible JSON-LD replace this route's generic initial body. The React App/createRoot, account-specific ResultsCalendar UI, auth/context/state and CSS files are unchanged. Existing critical preloader classes plus scoped inline layout preserve a responsive public first paint; renderer bounds cache around IST midnight and bypasses static tabHtmlCache. Synthetic no-JS browser evidence and actual post-publish/hydrated-app/device checks are distinct; see changes/ai-evidence.md.


2026-10-22 brand/refresh/inbox follow-up: App preserves For You across ordinary authentication; generic landing launches share that default while explicit deep links retain intent. Original BseNexusLogo/icon.svg replaces green text tiles in directory, guides, not-found and initial document. Layout keeps the owner-keyed inbox mounted while closed; NotificationInbox owns ephemeral per-filter snapshots (All/Watchlist/Results), background refresh and confirmed read/clear reconciliation. The read action sits right below filters. Watchlist readiness distinguishes cold/failed from confirmed empty; three pull indicators sit below their respective toolbars. Settings combines quiet device vibration with visible pressed/focus/active states. Radar retains server intake policy and resumes client checks on visible/online/pageshow. Public exchange pages now share ordinary intelligence/render caching, exact venue identity and verified stored filings; legacy static rendering is no longer the route owner. See changes/brand-refresh-inbox.md for current tests/browser/merge/publication evidence.
