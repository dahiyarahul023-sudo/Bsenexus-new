import { parseReferralInput } from './utils/referralInput';
import { safeSessionGetItem } from './utils/safeStorage';
import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { PageSkeleton } from './components/ui/PageSkeleton';
import { useScreenTransition } from './hooks/useScreenTransition';
import { AuthProvider, useAuth } from './context/AuthContext';
import { IntelModalProvider } from './context/IntelModalContext';
import { NoteEditorProvider, useNoteEditor } from './context/NoteEditorContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { customFetch } from './api';
import { verifyProPayment, clearPendingOrderId, getPlanDisplayFromOrderId, isValidPlanId } from './utils/cashfree';
import { useVisibilityInterval } from './hooks/useVisibilityInterval';
import { usePaymentDialog } from './hooks/usePaymentDialog';
import type { DesignTheme } from './types';

const LandingPage = lazyWithRetry(() => import('./components/LandingPage').then(m => ({ default: m.LandingPage })));

/**
 * Wraps dynamic React.lazy imports with automated retry logic to seamlessly recover
 * from transient network dropouts, Vite dev-server restarts, or stale module caches.
 */
function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  retries = 3,
  interval = 800
): React.LazyExoticComponent<T> {
  return lazy(() =>
    new Promise<{ default: T }>((resolve, reject) => {
      const attempt = (remaining: number) => {
        factory()
          .then(resolve)
          .catch((error: any) => {
            const isFetchError =
              !error ||
              error?.name === 'TypeError' ||
              error?.message?.includes('Failed to fetch dynamically imported module') ||
              error?.message?.includes('error loading dynamically imported module') ||
              error?.message?.includes('Importing a module script failed');

            if (remaining > 0 && isFetchError) {
              setTimeout(() => {
                attempt(remaining - 1);
              }, interval);
            } else {
              if (!import.meta.env.DEV && typeof window !== 'undefined' && isFetchError) {
                try {
                  const flag = 'bse_chunk_retry_reload';
                  const last = sessionStorage.getItem(flag);
                  const now = Date.now();
                  if (!last || now - Number(last) > 10000) {
                    sessionStorage.setItem(flag, String(now));
                    window.location.reload();
                    return;
                  }
                } catch {}
              }
              reject(error);
            }
          });
      };
      attempt(retries);
    })
  );
}

const Announcements = lazyWithRetry(() => import('./components/Announcements'));
const HomeForYou = lazyWithRetry(() => import('./components/HomeForYou').then(m => ({ default: m.HomeForYou })));
// Route-level code splitting: heavy tab/route panels load on first visit,
// keeping feed and home code out of the landing page's initial download.
const WatchlistManager = lazyWithRetry(() => import('./components/WatchlistManager').then(m => ({ default: m.WatchlistManager })));
const ResultsCalendar = lazyWithRetry(() => import('./components/ResultsCalendar').then(m => ({ default: m.ResultsCalendar })));
const NewsPortal = lazyWithRetry(() => import('./components/NewsPortal').then(m => ({ default: m.NewsPortal })));
const StorageManager = lazyWithRetry(() => import('./components/StorageManager').then(m => ({ default: m.StorageManager })));
const AdminDiagnostics = lazyWithRetry(() => import('./components/AdminDiagnostics').then(m => ({ default: m.AdminDiagnostics })));
const LogsTab = lazyWithRetry(() => import('./components/LogsTab').then(m => ({ default: m.LogsTab })));
const SettingsTab = lazyWithRetry(() => import('./components/SettingsTab').then(m => ({ default: m.SettingsTab })));
const SeoStudio = lazyWithRetry(() => import('./components/seo/SeoStudio').then(m => ({ default: m.SeoStudio })));

// Minimal route-level suspense fallback: matches the app's existing loading
// language; visible only while a tab's chunk loads on first visit.
function TabFallback() {
  return (
    <div className="flex items-center justify-center py-16" aria-label="Loading section">
      <div className="h-8 w-8 rounded-full border-2 border-slate-200 dark:border-slate-700 border-t-slate-500 dark:border-t-slate-300 animate-spin" />
    </div>
  );
}

// A lazy import only saves startup work when no eager import reaches the same
// module. Keep the entire terminal shell and closed dialogs outside the public
// landing dependency graph. Each boundary preserves the existing page and gives
// a failed chunk the same reload/recovery path as a failed tab.
function deferredComponent<Props extends object>(
  label: string,
  load: () => Promise<{ default: React.ComponentType<Props> }>,
  overlay = false,
) {
  const Content = lazyWithRetry(load);
  return function DeferredComponent(props: Props) {
    const cancel = useDeferredCancel(label);
    return (
      <TabErrorBoundary label={label} overlay={overlay} onBack={overlay ? cancel : undefined} backLabel="Close">
        <Suspense fallback={overlay ? <PendingOverlay label={label} /> : <PageSkeleton page="home" />}>
          <Content {...props} />
        </Suspense>
      </TabErrorBoundary>
    );
  };
}

function useDeferredCancel(label: string) {
  const { setIsAuthModalOpen, setIsProModalOpen, setIsAdminPinModalOpen, setIsCheckoutOpen, setReceipt } = useAuth();
  const { closeNoteEditor } = useNoteEditor();
  return () => {
    if (label === 'sign in') setIsAuthModalOpen(false);
    else if (label === 'plans') setIsProModalOpen(false);
    else if (label === 'admin access') setIsAdminPinModalOpen(false);
    else if (label === 'checkout') setIsCheckoutOpen(false);
    else if (label === 'receipt') setReceipt(null);
    else closeNoteEditor();
  };
}

function PendingOverlay({ label }: { label: string }) {
  const cancel = useDeferredCancel(label);
  const dialog = usePaymentDialog(true, cancel);
  return (
    <div ref={dialog} className="fixed inset-0 z-[150] grid place-items-center bg-slate-950/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Opening ${label}`}>
      <div className="rounded-2xl bg-white dark:bg-slate-900 px-8 py-5 text-sm text-slate-700 dark:text-slate-200">
        <div role="status" aria-label={label === 'sign in' ? 'Loading sign in' : `Opening ${label}`} className="flex items-center gap-3">
          <span aria-hidden="true" className="h-5 w-5 rounded-full border-2 border-current border-t-transparent animate-spin motion-reduce:animate-none" />
          {label !== 'sign in' && <span>Opening {label}…</span>}
        </div>
        <button type="button" onClick={cancel} className="mt-4 min-h-11 rounded-full px-4 border border-slate-300 dark:border-slate-600">Cancel</button>
      </div>
    </div>
  );
}

const Layout = deferredComponent('terminal', () => import('./components/Layout').then(m => ({ default: m.Layout })));
const AuthModal = deferredComponent('sign in', () => import('./components/AuthModal').then(m => ({ default: m.AuthModal })), true);
const ProUpgradeModal = deferredComponent('plans', () => import('./components/ProUpgradeModal').then(m => ({ default: m.ProUpgradeModal })), true);
const AdminPinModal = deferredComponent('admin access', () => import('./components/AdminPinModal').then(m => ({ default: m.AdminPinModal })), true);
const ProCheckoutView = deferredComponent('checkout', () => import('./components/ProCheckoutView').then(m => ({ default: m.ProCheckoutView })), true);
const ProReceiptView = deferredComponent('receipt', () => import('./components/ProReceiptView').then(m => ({ default: m.ProReceiptView })), true);
const FilingPage = deferredComponent('filing', () => import('./components/filing/FilingPage').then(m => ({ default: m.FilingPage })));
const ResultsPage = deferredComponent('results', () => import('./components/results/ResultsPage').then(m => ({ default: m.ResultsPage })));
const NoteEditorChunk = deferredComponent('note editor', () => import('./components/notes/NoteEditor').then(m => ({
  default: function LoadedNoteEditor({ onReady }: { onReady: () => void }) {
    useEffect(onReady, [onReady]);
    return <m.NoteEditorHost />;
  },
})), true);

function NoteEditorHost() {
  const { isOpen } = useNoteEditor();
  // Retain only a host that actually mounted. Cancelling its first cold load
  // must remove the fallback, including any later load failure.
  const [hasMounted, setHasMounted] = useState(false);
  const onReady = useCallback(() => { setHasMounted(true); }, []);
  return isOpen || hasMounted ? <NoteEditorChunk onReady={onReady} /> : null;
}

function PaymentOverlays() {
  const { isCheckoutOpen, receipt } = useAuth();
  return <>
    {isCheckoutOpen && <ProCheckoutView />}
    {receipt && <ProReceiptView />}
  </>;
}
import { useScrollRestoration } from './hooks/useScrollRestoration';
import { TabErrorBoundary } from './components/ui/TabErrorBoundary';
import { saveScrollPosition } from './utils/scrollState';
import { parseShareablePath } from './utils/shareUrls';
const PricingPage = lazy(() => import('./components/PricingPage').then(m => ({ default: m.PricingPage })));
const GuidesPage = lazy(() => import('./components/GuidesPage').then(m => ({ default: m.GuidesPage })));
const CompaniesPage = lazy(() => import('./components/CompaniesPage').then(m => ({ default: m.CompaniesPage })));
const TrustPage = lazy(() => import('./components/TrustPages').then(m => ({ default: m.TrustPage })));
const AiPluginPage = lazy(() => import('./components/AiPluginPage').then(m => ({ default: m.AiPluginPage })));
const GiftActivationPage = lazy(() => import('./components/GiftActivationPage').then(m => ({ default: m.GiftActivationPage })));
const NotFoundPage = lazy(() => import('./components/NotFoundPage').then(m => ({ default: m.NotFoundPage })));

function getAppPathRoute(): 'home' | 'pricing' | 'guides' | 'companies' | 'about' | 'contact' | 'privacy' | 'terms' | 'disclaimer' | 'plugin' | 'gift' | '404' {
  if (typeof window === 'undefined') return 'home';
  const path = window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
  if (path === '/' || path === '') return 'home';
  if (path === '/pricing' || path === '/plans') return 'pricing';
  if (path === '/guides' || path === '/market-guides') return 'guides';
  if (path === '/companies' || path === '/company-directory') return 'companies';
  if (path === '/activate-gift') return 'gift';
  if (path === '/about') return 'about';
  if (path === '/contact') return 'contact';
  if (path === '/plugin' || path === '/ai-plugin') return 'plugin';
  if (path === '/privacy-policy') return 'privacy';
  if (path === '/privacy') {
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '/privacy-policy' + window.location.search);
    }
    return 'privacy';
  }
  if (
    path.startsWith('/faq') ||
    path.startsWith('/company/') ||
    path.startsWith('/stock/') ||
    path.startsWith('/guides/') ||
    path.startsWith('/announcement/') ||
    path.startsWith('/announcements') ||
    path.startsWith('/filing/') ||
    path.startsWith('/results/') ||
    path === '/settings' ||
    path === '/live' ||
    path.startsWith('/results-calendar') ||
    path.startsWith('/watchlist') ||
    path.startsWith('/watchlists') ||
    path.startsWith('/embed/')
  ) {
    return 'home';
  }
  return '404';
}

function Dashboard({ bseHealth, telegramHealth, isRunning, handleToggle, isActive = true }: any) {
  return (
    <div className="space-y-2">
      {/* Main Announcements Feed */}
      <Suspense fallback={<PageSkeleton page="announcements" />}><Announcements
        isActive={isActive}
        isRunning={isRunning}
        onToggleEngine={handleToggle}
        bseHealth={bseHealth}
        telegramHealth={telegramHealth}
      /></Suspense>
    </div>
  );
}

/**
 * Handles the return from Cashfree checkout: /?cf_order_id=...
 * Verifies the payment with OUR server (source of truth — never trusts the
 * redirect alone), refreshes the profile, and shows the result.
 * Runs on every route so a payment return always lands in the React app.
 */
function CashfreeReturnHandler() {
  const { user, refreshProfile, setReceipt, setIsAuthModalOpen, isAuthModalOpen } = useAuth();
  const { success, warning } = useToast();
  const handledRef = useRef<string | null>(null);
  // While our server confirms the payment with Cashfree, show a processing
  // overlay so the screen never sits blank before the invoice appears.
  const [verifying, setVerifying] = useState(false);
  // UI-001 (1 Oct 2026 audit): Tracks the case where a payment return URL lands
  // without an active Firebase session (incognito, different browser, session
  // expiry). Previously the boot splash painted forever and the user had no
  // path forward — the payment was already deducted. Now we drop the splash and
  // surface an explicit "sign in to confirm" prompt.
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let orderId: string | null = null;
    try {
      orderId = new URLSearchParams(window.location.search).get('cf_order_id');
    } catch { return; }
    if (!orderId || handledRef.current === orderId) return;

    // UI-001 fix: If no user after auth has resolved, drop the splash and show
    // the sign-in prompt. Stash the orderId so we can re-verify after login.
    if (!user) {
      try {
        document.getElementById('cf-boot-splash')?.remove();
      } catch { /* non-fatal */ }
      try {
        sessionStorage.setItem('cf_pending_order_id', orderId);
      } catch { /* non-fatal */ }
      setNeedsLogin(true);
      return;
    }
    handledRef.current = orderId;
    (async () => {
      // React has booted: drop the instant boot splash (see index.html) and
      // continue with the in-app processing overlay — one seamless handoff.
      try {
        document.getElementById('cf-boot-splash')?.remove();
      } catch { /* non-fatal */ }
      setNeedsLogin(false);
      setVerifying(true);
      const v = await verifyProPayment(orderId as string);
      clearPendingOrderId();
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('cf_order_id');
        window.history.replaceState({}, '', url.pathname + url.search + url.hash);
      } catch { /* non-fatal */ }
      setVerifying(false);
      if (v.paid) {
        await refreshProfile();
        // Open the invoice screen instead of a plain toast.
        if (v.receipt) {
          setReceipt(v.receipt);
        } else {
          const planLabel = getPlanDisplayFromOrderId(orderId).label;
          success(`${planLabel} activated — welcome!`);
        }
      } else {
        warning(v.error || 'Payment not confirmed yet. If money was debited, it will reflect shortly.');
      }
    })();
  }, [user]);

  // UI-001: When user signs in after seeing the needs-login prompt, re-trigger
  // verification using the stashed orderId.
  useEffect(() => {
    if (user && needsLogin) {
      const stashed = safeSessionGetItem('cf_pending_order_id');
      if (stashed) {
        sessionStorage.removeItem('cf_pending_order_id');
        setNeedsLogin(false);
        // Re-run the main effect by clearing the handled guard.
        handledRef.current = null;
        // Force re-render via state toggle.
        setVerifying(false);
      }
    }
  }, [user, needsLogin]);

  if (needsLogin) {
    // Preserve recovery intent while the sign-in dialog owns focus/visibility.
    // Cancelling sign-in exposes this prompt again; no payment is confirmed here.
    if (isAuthModalOpen) return null;
    return (
      <div
        className="payment-ui payment-overlay" style={{ zIndex: 96 }}
        role="dialog"
        aria-modal="true"
        aria-label="Sign in to confirm payment"
      >
        <div className="payment-restore-sheet text-center">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-4 text-2xl" aria-hidden="true">🔐</div>
          <h2 className="text-lg font-semibold text-inherit mb-2">Sign in to confirm your payment</h2>
          <p className="text-sm payment-muted mb-6">Sign in to the same account that placed the order so we can confirm its status and retrieve your receipt.</p>
          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="w-full px-5 py-3 rounded-full bg-slate-950 text-white font-medium hover:bg-slate-800 transition-colors"
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  if (!verifying) return null;
  return (
    <div
      className="payment-ui payment-overlay" style={{ zIndex: 96 }}
      role="status"
      aria-live="polite"
      aria-label="Confirming payment"
    >
      <div className="payment-restore-sheet flex flex-col items-center text-center">
        <span className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-slate-950 animate-spin" aria-hidden="true" />
        <h2 className="mt-5 text-[16px] font-black text-inherit">Confirming your payment…</h2>
        <p className="mt-2 text-[12px] font-medium payment-muted leading-relaxed">
          We're verifying it with Cashfree and preparing your invoice. One moment.
        </p>
      </div>
    </div>
  );
}

function AppContent() {
  const [currentRoute, setCurrentRoute] = useState<'home' | 'pricing' | 'guides' | 'companies' | 'about' | 'contact' | 'privacy' | 'terms' | 'disclaimer' | 'plugin' | 'gift' | '404'>(() => getAppPathRoute());
  // Shareable deep-link route (/filing/:symbol/:newsId, /results/:symbol/:quarterKey).
  // Rendered as standalone public pages; must survive the tab-sync pushState logic.
  // Legacy /announcement/:newsId URLs 301-redirect server-side, so only the two
  // canonical kinds become share routes here.
  const sharePathFor = (pathname: string) => {
    const p = parseShareablePath(pathname);
    return p && (p.kind === 'filing' || p.kind === 'results') ? p : null;
  };
  const [shareRoute, setShareRoute] = useState(() => sharePathFor(window.location.pathname));
  const [settingsNotes, setSettingsNotes] = useState(() => {
    const path = window.location.pathname.toLowerCase().replace(/\/+$/, '');
    return path === '/settings' && new URLSearchParams(window.location.search).get('section') === 'notes';
  });
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        const pathname = window.location.pathname.toLowerCase().replace(/\/+$/, '');
        if (pathname === '/announcements') return 'dashboard';
        if (pathname === '/live') return 'dashboard';
        if (pathname === '/settings') return 'settings';
        if (pathname === '/results-calendar') return 'results-calendar';
        if (pathname === '/watchlist' || pathname === '/watchlists') return 'watchlists';

        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        const hasShared = params.get('text') || params.get('title') || params.get('url') || params.get('q');
        if (hasShared || tab === 'announcements' || tab === 'dashboard') return 'dashboard';
        if (tab === 'watchlist' || tab === 'watchlists') return 'watchlists';
        if (tab === 'results' || tab === 'results-calendar') return 'results-calendar';
        if (tab === 'news') return 'news';
        if (tab === 'settings') return 'settings';
      } catch {}
    }
    return 'home';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (window.location.hostname && window.location.hostname.indexOf('ai.studio') !== -1) {
        let robotsMeta = document.querySelector('meta[name="robots"]');
        if (robotsMeta) {
          robotsMeta.setAttribute('content', 'noindex, nofollow');
        } else {
          robotsMeta = document.createElement('meta');
          robotsMeta.setAttribute('name', 'robots');
          robotsMeta.setAttribute('content', 'noindex, nofollow');
          document.head.appendChild(robotsMeta);
        }
        window.location.replace('https://bsenexus.in' + window.location.pathname + window.location.search);
        return;
      }
    } catch {}
    const path = window.location.pathname.toLowerCase();
    if (path.includes('/announcement/') && path.includes('batch_test_')) {
      let metaRobots = document.querySelector('meta[name="robots"]');
      if (!metaRobots) {
        metaRobots = document.createElement('meta');
        metaRobots.setAttribute('name', 'robots');
        document.head.appendChild(metaRobots);
      }
      metaRobots.setAttribute('content', 'noindex, nofollow');
    }
  }, []);

  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(() => new Set(['home', activeTab]));
  const [theme, setTheme] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        return localStorage.getItem('theme') || 'dark';
      }
    } catch {}
    return 'dark';
  });
  const [settings, setSettings] = useState<any>({});
  const [logs, setLogs] = useState([]);
  const [watchlists, setWatchlists] = useState<any[]>([]);
  const [watchlistDataOwner, setWatchlistDataOwner] = useState('');
  const [health, setHealth] = useState({ bse: { status: 'unknown', latency: 0 }, telegram: { status: 'unknown', latency: 0 } });
  
  const { user, profile, authLoading, isAdmin, isPro, adminUnlocked, logout, 
    setIsAuthModalOpen, setIsProModalOpen, setCheckoutPlanId,
    isAuthModalOpen, isProModalOpen, isAdminPinModalOpen,
    isPaidProActive, updateNotificationPreferences, openCheckout
  } = useAuth();
  const { showToast } = useToast();
  const watchlistsRequest = useRef<AbortController | null>(null);
  const watchlistAccount = user?.uid || profile?.uid || 'guest';
  const watchlistOwner = useRef(watchlistAccount); watchlistOwner.current = watchlistAccount;
  const [serverAuth, setServerAuth] = useState<{ isAuthenticated: boolean; hasPin: boolean } | null>(null);

  // Capture ?ref=CODE referral links across all entry points
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const clean = parseReferralInput(window.location.href);
      if (clean) {
        localStorage.setItem('bse_referral_code', clean);
        fetch('/api/referrals/track-visit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: clean }),
        }).catch(() => {});
        showToast({
          title: 'Referral link saved',
          message: 'Your code will be checked when you open checkout.',
          type: 'info',
        });
      }
    } catch {}
  }, [showToast]);

  // Terminal-entry intent: when a logged-out visitor taps "Launch Terminal" (or any
  // terminal entry) on the landing page, we open the auth modal instead of entering
  // silently — guest sessions are ONLY ever created by the dedicated guest button
  // inside that modal. After a successful explicit login, we complete the entry.
  const pendingTerminalTabRef = useRef<string | null>(null);
  const pendingCheckoutPlanRef = useRef<string | null>(null);
  const choosePaidPlan = (planId: string) => {
    setCheckoutPlanId(planId);
    if (!user || user.isAnonymous) {
      pendingCheckoutPlanRef.current = planId;
      setIsAuthModalOpen(true);
    } else openCheckout(planId);
  };
  useEffect(() => {
    if (user && !user.isAnonymous && pendingCheckoutPlanRef.current) {
      const planId = pendingCheckoutPlanRef.current;
      pendingCheckoutPlanRef.current = null;
      setIsAuthModalOpen(false);
      openCheckout(planId);
    }
  }, [user]);
  const prevAuthModalOpenRef = useRef(false);
  useEffect(() => {
    // If the modal was closed without a successful login, drop the pending intent
    // so a later unrelated sign-in doesn't unexpectedly jump into the terminal.
    if (prevAuthModalOpenRef.current && !isAuthModalOpen && !user) {
      pendingTerminalTabRef.current = null;
      pendingCheckoutPlanRef.current = null;
    }
    prevAuthModalOpenRef.current = isAuthModalOpen;
  }, [isAuthModalOpen, user]);

  const tabMotion = useScreenTransition(activeTab);

  // Apple-Grade Scroll State & Restoration System ("Scroll is state")
  const { scrollToTop } = useScrollRestoration({
    activeKey: tabMotion.displayedKey,
    enabled: true
  });

  const handleTabChange = (requestedTab: string) => {
    const openNotes = requestedTab === 'saved-notes';
    const newTab = openNotes ? 'settings' : requestedTab === 'announcements' ? 'dashboard' : requestedTab;
    // Watchlist is Pro-only: free users get the upgrade sheet instead (covers
    // deep links, profile-modal shortcut and in-app buttons).
    const canUseWatchlist = Boolean(isPro || isAdmin || adminUnlocked || profile?.tier === 'admin');
    if (newTab === 'watchlists' && !canUseWatchlist) {
      setIsProModalOpen(true);
      return;
    }
    if (newTab === activeTab && getAppPathRoute() === 'home' && (newTab !== 'settings' || settingsNotes === openNotes)) {
      // Tap active tab to scroll to top (like iOS / Twitter)
      scrollToTop();
      return;
    }
    if (newTab === 'companies' || newTab === 'plugin') {
      saveScrollPosition(tabMotion.displayedKey);
      window.history.pushState(null, '', newTab === 'companies' ? '/companies' : '/plugin');
      setCurrentRoute(newTab);
      window.scrollTo({ top: 0, behavior: 'instant' });
      return;
    }
    // Save previous tab scroll position immediately before switching
    saveScrollPosition(tabMotion.displayedKey);
    setActiveTab(newTab);
    if (newTab === 'settings') setSettingsNotes(openNotes);

    if (typeof window !== 'undefined') {
      let targetPath = '/';
      switch (newTab) {
        case 'dashboard':
          targetPath = '/announcements';
          break;
        case 'watchlists':
          targetPath = '/watchlist';
          break;
        case 'results-calendar':
          targetPath = '/results-calendar';
          break;
        case 'news':
          targetPath = '/?tab=news';
          break;
        case 'seo-suite':
          targetPath = '/?tab=seo-suite';
          break;
        case 'settings':
          targetPath = openNotes ? '/settings?section=notes' : '/settings';
          break;
        case 'home':
        default:
          targetPath = '/';
          break;
      }
      const currentUrl = window.location.pathname + window.location.search;
      if (currentUrl !== targetPath) {
        window.history.pushState(null, '', targetPath);
      }
    }
  };

  // Check URL query parameters on mount (Share Target API, shortcuts, and deep links)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const pathname = window.location.pathname.toLowerCase().replace(/\/+$/, '');
      if (pathname === '/announcements') {
        setActiveTab('dashboard');
      } else if (pathname === '/results-calendar') {
        setActiveTab('results-calendar');
      } else if (pathname === '/watchlist' || pathname === '/watchlists') {
        setActiveTab('watchlists');
      } else if (pathname === '/settings') {
        setActiveTab('settings');
      }

      const searchParams = new URLSearchParams(window.location.search);
      const tabParam = searchParams.get('tab');
      const actionParam = searchParams.get('action');
      const sharedTitle = searchParams.get('title') || '';
      const sharedText = searchParams.get('text') || '';
      const sharedUrl = searchParams.get('url') || '';
      const queryParam = searchParams.get('q') || searchParams.get('stock') || searchParams.get('scrip') || '';

      if (actionParam === 'checkout') {
        const planParam = searchParams.get('plan');
        if (isValidPlanId(planParam)) choosePaidPlan(planParam as string);
      }

      if (actionParam === 'upgrade' || actionParam === 'trial' || actionParam === 'pro') {
        // /pricing deep links pass ?plan=pro_yearly etc. — preselect it in checkout.
        const planParam = searchParams.get('plan');
        if (isValidPlanId(planParam)) setCheckoutPlanId(planParam as string);
        setIsProModalOpen(true);
      }

      if (tabParam) {
        if (tabParam === 'announcements' || tabParam === 'dashboard') {
          setActiveTab('dashboard');
        } else if (tabParam === 'watchlist' || tabParam === 'watchlists') {
          setActiveTab('watchlists');
        } else if (tabParam === 'results' || tabParam === 'results-calendar') {
          setActiveTab('results-calendar');
        } else if (tabParam === 'news') {
          setActiveTab('news');
        } else if (tabParam === 'seo' || tabParam === 'seo-suite' || tabParam === 'superseo') {
          if (isAdmin) {
            setActiveTab('seo-suite');
          }
        } else if (tabParam === 'settings') {
          setActiveTab('settings');
        }
      }

      const combinedShared = [sharedText, sharedTitle, sharedUrl, queryParam].filter(Boolean).join(' ').trim();
      if (combinedShared) {
        setActiveTab('dashboard');
        sessionStorage.setItem('bse_shared_query', combinedShared);
        window.dispatchEvent(new CustomEvent('bse-share-target', {
          detail: { title: sharedTitle, text: sharedText, url: sharedUrl, query: combinedShared }
        }));
      }
    } catch {}

    const handlePopState = () => {
      setCurrentRoute(getAppPathRoute());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (currentRoute === 'home') document.title = activeTab === 'dashboard' ? 'Live BSE Filings | Bsenexus' : 'Bsenexus — Stock Market Intelligence';
  }, [currentRoute, activeTab]);

  // Synchronize browser address bar with activeTab navigation without reloading
  const isFirstTabSyncRender = useRef(true);
  useEffect(() => {
    if (isFirstTabSyncRender.current) {
      isFirstTabSyncRender.current = false;
      return;
    }
    if (typeof window === 'undefined') return;

    if (parseShareablePath(window.location.pathname) || getAppPathRoute() !== 'home') return;

    let targetPath = '/';
    switch (activeTab) {
      case 'dashboard':
        // Keep /live stable as the shareable feed URL when the user is on it;
        // otherwise the dashboard tab canonicalizes to /announcements.
        targetPath = window.location.pathname.toLowerCase().replace(/\/+$/, '') === '/live'
          ? '/live'
          : '/announcements';
        break;
      case 'watchlists':
        targetPath = '/watchlist';
        break;
      case 'results-calendar':
        targetPath = '/results-calendar';
        break;
      case 'news':
        targetPath = '/?tab=news';
        break;
      case 'seo-suite':
        targetPath = '/?tab=seo-suite';
        break;
      case 'settings':
        targetPath = settingsNotes ? '/settings?section=notes' : '/settings';
        break;
      case 'home':
      default:
        targetPath = '/';
        break;
    }

    const currentUrl = window.location.pathname + window.location.search;
    if (currentUrl !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
  }, [activeTab, settingsNotes]);

  // Synchronize activeTab when navigating via browser Back / Forward buttons
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = () => {
      try {
        const pathname = window.location.pathname.toLowerCase().replace(/\/+$/, '');
        // Shareable filing/results pages survive back/forward navigation as standalone routes.
        const shared = sharePathFor(window.location.pathname);
        setShareRoute(shared);
        if (shared) return;
        if (pathname === '/announcements') {
          setActiveTab('dashboard');
          return;
        }
        if (pathname === '/settings') {
          setSettingsNotes(new URLSearchParams(window.location.search).get('section') === 'notes');
          setActiveTab('settings');
          return;
        }
        if (pathname === '/live') {
          setActiveTab('dashboard');
          return;
        }
        if (pathname === '/results-calendar') {
          setActiveTab('results-calendar');
          return;
        }
        if (pathname === '/watchlist' || pathname === '/watchlists') {
          setActiveTab('watchlists');
          return;
        }

        const searchParams = new URLSearchParams(window.location.search);
        const tabParam = searchParams.get('tab');

        if (tabParam) {
          if (tabParam === 'announcements' || tabParam === 'dashboard') {
            setActiveTab('dashboard');
          } else if (tabParam === 'watchlist' || tabParam === 'watchlists') {
            setActiveTab('watchlists');
          } else if (tabParam === 'results' || tabParam === 'results-calendar') {
            setActiveTab('results-calendar');
          } else if (tabParam === 'news') {
            setActiveTab('news');
          } else if (tabParam === 'seo' || tabParam === 'seo-suite' || tabParam === 'superseo') {
            if (isAdmin) {
              setActiveTab('seo-suite');
            }
          } else if (tabParam === 'settings') {
            setActiveTab('settings');
          } else {
            setActiveTab('home');
          }
        } else {
          setActiveTab('home');
        }
      } catch {}
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isAdmin]);

  useEffect(() => {
    setVisitedTabs(prev => prev.has(activeTab) ? prev : new Set(prev).add(activeTab));
    // Ensure body scroll is unlocked when navigating tabs
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  }, [activeTab]);

  // The home tab is For You. Authentication preserves it and any explicit URL/tab intent.

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  // --- Design theme: 'classic' (current Helios look) vs 'softglass' (PRO-only) ---
  // DEV-only visual-QA override: ?design=softglass forces the theme without PRO.
  const devDesignOverride: boolean = (() => {
    try {
      return import.meta.env.DEV && new URLSearchParams(window.location.search).get('design') === 'softglass';
    } catch { return false; }
  })();

  const [designTheme, setDesignThemeState] = useState<DesignTheme>(() => {
    try {
      if (typeof window !== 'undefined') {
        if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('design') === 'softglass') return 'softglass';
        const saved = localStorage.getItem('bse_design_theme');
        if (saved === 'softglass' || saved === 'classic') return saved;
      }
    } catch {}
    return 'classic';
  });

  const canUseSoftGlass = devDesignOverride || isPaidProActive;

  const setDesignTheme = useCallback(async (next: DesignTheme): Promise<boolean> => {
    if (next === 'softglass' && !canUseSoftGlass) {
      // PRO gate: trial/free users get the upgrade sheet instead.
      setIsProModalOpen(true);
      return false;
    }
    setDesignThemeState(next);
    try {
      localStorage.setItem('bse_design_theme', next);
      if (user?.uid) localStorage.setItem(`bse_design_theme_${user.uid}`, next);
    } catch {}
    // Cross-device persistence via the profile (fire-and-forget).
    if (user) {
      try { await updateNotificationPreferences({ designTheme: next }); } catch {}
    }
    return true;
  }, [canUseSoftGlass, user, setIsProModalOpen, updateNotificationPreferences]);

  // Apply the theme to <html>. Soft-glass is inherently light: while active the
  // dark class is forced off (the user's dark/light choice is kept and restored
  // when they switch back to Classic).
  useEffect(() => {
    const root = document.documentElement;
    if (designTheme === 'softglass') {
      root.dataset.designTheme = 'softglass';
      root.classList.remove('dark');
    } else {
      delete root.dataset.designTheme;
      if (theme === 'dark') root.classList.add('dark');
      else root.classList.remove('dark');
    }
  }, [designTheme, theme]);

  // Hydrate from the profile (cross-device) once auth resolves, and enforce the
  // PRO gate: a stored softglass choice without active PRO falls back to classic
  // (e.g. subscription expired, or another user on the same device).
  useEffect(() => {
    if (authLoading || devDesignOverride) return;
    const fromProfile = profile?.notificationPreferences?.designTheme;
    let fromLocal: string | null = null;
    try {
      fromLocal = localStorage.getItem(user?.uid ? `bse_design_theme_${user.uid}` : 'bse_design_theme');
    } catch {}
    const valid = (v: unknown): v is DesignTheme => v === 'classic' || v === 'softglass';
    let wanted: DesignTheme = 'classic';
    if (valid(fromProfile)) wanted = fromProfile;
    else if (valid(fromLocal)) wanted = fromLocal;
    if (wanted === 'softglass' && !isPaidProActive) wanted = 'classic';
    if (wanted !== designTheme) {
      setDesignThemeState(wanted);
      try { localStorage.setItem(user?.uid ? `bse_design_theme_${user.uid}` : 'bse_design_theme', wanted); } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.uid, profile?.notificationPreferences?.designTheme, isPaidProActive]);

  const fetchWatchlists = async () => {
    watchlistsRequest.current?.abort();
    if (!user && !profile) { setWatchlists([]); return; }
    const controller = new AbortController(); watchlistsRequest.current = controller;
    const requestedOwner = watchlistAccount;
    const current = () => !controller.signal.aborted && watchlistOwner.current === requestedOwner;
    try {
      const res = await customFetch('/api/watchlists', { signal: controller.signal });
      if (!res.ok) throw new Error('Watchlists unavailable');
      const data = await res.json();
      if (current()) { setWatchlists(Array.isArray(data) ? data : []); setWatchlistDataOwner(requestedOwner); }
    } catch { if (current()) setWatchlists([]); }
  };

  useEffect(() => {
    setWatchlists([]);
    void fetchWatchlists();
    const changed = () => { void fetchWatchlists(); };
    window.addEventListener('watchlists-changed', changed);
    return () => { watchlistsRequest.current?.abort(); window.removeEventListener('watchlists-changed', changed); };
  }, [watchlistAccount]);

  const checkAuth = async () => {
    try {
      const res = await customFetch('/auth/status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setServerAuth(data);
    } catch (e) {
      setServerAuth({ isAuthenticated: false, hasPin: false });
    }
  };

  useEffect(() => {
    checkAuth();
    const handleAuthExpired = () => {
      checkAuth();
    };
    window.addEventListener('auth-expired', handleAuthExpired);
    return () => window.removeEventListener('auth-expired', handleAuthExpired);
  }, [user]);

  const fetchSettings = async () => {
    try {
      const res = await customFetch('/api/settings');
      if (res.ok) setSettings(await res.json());
    } catch (e) {}
  };

  const isUserAdmin = Boolean(isAdmin || adminUnlocked || user?.isAdmin || profile?.tier === 'admin');

  const fetchLogs = async () => {
    if (!isUserAdmin) return;
    try {
      const res = await customFetch('/api/logs?limit=400');
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        if (data.bseHealth && data.telegramHealth) {
          setHealth({ bse: data.bseHealth, telegram: data.telegramHealth });
        }
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (user || activeTab !== 'home') {
      fetchSettings();
    }
  }, [ Boolean(user), activeTab === 'home' ]);

  // Pre-warm the Sign In modal and terminal shell chunks during browser idle
  // time so clicking "Sign in" or entering the app opens immediately without
  // flashing "Opening sign in…".
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void import('./components/AuthModal').catch(() => {});
      void import('./components/Layout').catch(() => {});
    }, 250);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isUserAdmin) {
      fetchLogs();
    }
  }, [isUserAdmin]);

  // Only poll /api/logs every 20s when the user is admin, with visibility gating
  useVisibilityInterval(fetchLogs, 20000, isUserAdmin);

  const handleLogout = async () => {
    await logout();
    setActiveTab('home');
    checkAuth();
  };

  const handleToggle = async () => {
    await customFetch('/api/toggle', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isRunning: !settings.isRunning })
    });
    fetchSettings();
  };

  // Render dedicated standalone routes with direct navigation, refresh, and SEO support

  // Leave a shareable page: drop the share route and return to the app home.
  const exitShareRoute = () => {
    window.history.pushState(null, '', '/');
    setShareRoute(null);
    setCurrentRoute('home');
    setActiveTab('home');
    window.scrollTo(0, 0);
  };

  // Shareable filing / results pages — public, standalone, no login to view.
  // Mounted here (before the landing guard) so tab-sync never clobbers the URL,
  // and with NoteEditorHost so Save-note + guest sign-in work outside Layout.
  if (shareRoute?.kind === 'filing') {
    return (
      <>
        <FilingPage onBack={exitShareRoute} />
        <NoteEditorHost />
        {isAuthModalOpen && <AuthModal />}
        {isProModalOpen && <ProUpgradeModal />}
      </>
    );
  }

  if (shareRoute?.kind === 'results') {
    return (
      <>
        <ResultsPage onBack={exitShareRoute} />
        <NoteEditorHost />
        {isAuthModalOpen && <AuthModal />}
        {isProModalOpen && <ProUpgradeModal />}
      </>
    );
  }

  if (currentRoute === 'gift') {
    return <><TabErrorBoundary label="gift invitation"><Suspense fallback={<TabFallback />}><GiftActivationPage /></Suspense></TabErrorBoundary>{isAuthModalOpen && <AuthModal />}</>;
  }

  if (currentRoute === 'pricing') {
    return <>
      <TabErrorBoundary label="pricing"><Suspense fallback={<TabFallback />}>
        <PricingPage onChoosePlan={choosePaidPlan} />
      </Suspense></TabErrorBoundary>
      {isAuthModalOpen && <AuthModal />}
      {isProModalOpen && <ProUpgradeModal />}
    </>;
  }

  if (currentRoute === 'guides') {
    return (
      <>
        <TabErrorBoundary label="guides">
        <Suspense fallback={<TabFallback />}>
          <GuidesPage
            onEnterTerminal={(tab) => {
              setCurrentRoute('home');
              if (tab) handleTabChange(tab);
              else setIsAuthModalOpen(true);
            }}
          />
        </Suspense>
        </TabErrorBoundary>
        {isAuthModalOpen && <AuthModal />}
        {isProModalOpen && <ProUpgradeModal />}
      </>
    );
  }

  if (currentRoute === 'companies') {
    return (
      <>
        <TabErrorBoundary label="companies">
        <Suspense fallback={<PageSkeleton page="companies" />}>
          <CompaniesPage
            onEnterTerminal={(tab) => {
              setCurrentRoute('home');
              if (tab) handleTabChange(tab);
              else setIsAuthModalOpen(true);
            }}
          />
        </Suspense>
        </TabErrorBoundary>
        {isAuthModalOpen && <AuthModal />}
        {isProModalOpen && <ProUpgradeModal />}
      </>
    );
  }

  if (
    currentRoute === 'about' ||
    currentRoute === 'contact' ||
    currentRoute === 'privacy' ||
    currentRoute === 'terms' ||
    currentRoute === 'disclaimer'
  ) {
    return (
      <>
        <TabErrorBoundary label="trust-page">
        <Suspense fallback={<TabFallback />}>
          <TrustPage
            type={currentRoute}
            onEnterTerminal={(tab) => {
              setCurrentRoute('home');
              if (tab) handleTabChange(tab);
              else setIsAuthModalOpen(true);
            }}
          />
        </Suspense>
        </TabErrorBoundary>
        {isAuthModalOpen && <AuthModal />}
        {isProModalOpen && <ProUpgradeModal />}
      </>
    );
  }

  if (currentRoute === 'plugin') {
    return (
      <>
        <TabErrorBoundary label="ai-plugin-page">
          <Suspense fallback={<PageSkeleton page="ai-connections" />}>
            <AiPluginPage
              onEnterTerminal={(tab) => {
                setCurrentRoute('home');
                if (tab) handleTabChange(tab);
                else setIsAuthModalOpen(true);
              }}
            />
          </Suspense>
        </TabErrorBoundary>
        {isAuthModalOpen && <AuthModal />}
        {isProModalOpen && <ProUpgradeModal />}
      </>
    );
  }

  if (currentRoute === '404') {
    return (
      <>
        <TabErrorBoundary label="not-found">
        <Suspense fallback={<TabFallback />}>
          <NotFoundPage
            onEnterTerminal={(tab) => {
              setCurrentRoute('home');
              if (tab) handleTabChange(tab);
              else setIsAuthModalOpen(true);
            }}
          />
        </Suspense>
        </TabErrorBoundary>
        {isAuthModalOpen && <AuthModal />}
        {isProModalOpen && <ProUpgradeModal />}
      </>
    );
  }

  // If user is not authenticated and on home route ('/'), show LandingPage
  if (!user && activeTab === 'home' && !authLoading) {
    return (
      <>
        <Suspense fallback={<PageSkeleton page="home" />}>
          <LandingPage
            onEnterTerminal={(tab) => {
              // No silent entry for logged-out visitors: open the auth modal so they
              // explicitly choose Sign in / Create account / Continue as Guest.
              if (!user) {
                pendingTerminalTabRef.current = tab || 'home';
                setIsAuthModalOpen(true);
                return;
              }
              if (tab) {
                const safeTab = (tab === 'diagnostics' || tab === 'logs' || tab === 'storage' || tab === 'seo-suite') && !isAdmin
                  ? 'dashboard'
                  : tab;
                handleTabChange(safeTab);
              } else {
                setIsAuthModalOpen(true);
              }
            }}
            onSignIn={() => {
              pendingTerminalTabRef.current = 'home';
              setIsAuthModalOpen(true);
            }}
            theme={theme}
            setTheme={setTheme}
            bseHealth={health.bse}
            telegramHealth={health.telegram}
          />
        </Suspense>
        {isAuthModalOpen && (
          <AuthModal
            onSuccess={() => {
              // Complete the pending terminal entry after an explicit login.
              const t = pendingTerminalTabRef.current;
              pendingTerminalTabRef.current = null;
              if (t) handleTabChange(t);
            }}
          />
        )}
        {isProModalOpen && <ProUpgradeModal />}
        {isAdminPinModalOpen && <AdminPinModal />}
      </>
    );
  }

  // If user is on home route during initial auth evaluation, show LandingPage immediately without blank spinner
  if (!user && activeTab === 'home') {
    return (
      <>
        <Suspense fallback={<PageSkeleton page="home" />}>
          <LandingPage
            onEnterTerminal={(tab) => {
              // No silent entry for logged-out visitors: open the auth modal so they
              // explicitly choose Sign in / Create account / Continue as Guest.
              if (!user) {
                pendingTerminalTabRef.current = tab || 'home';
                setIsAuthModalOpen(true);
                return;
              }
              if (tab) {
                const safeTab = (tab === 'diagnostics' || tab === 'logs' || tab === 'storage' || tab === 'seo-suite') && !isAdmin
                  ? 'dashboard'
                  : tab;
                handleTabChange(safeTab);
              } else {
                setIsAuthModalOpen(true);
              }
            }}
            onSignIn={() => {
              pendingTerminalTabRef.current = 'home';
              setIsAuthModalOpen(true);
            }}
            theme={theme}
            setTheme={setTheme}
            bseHealth={health.bse}
            telegramHealth={health.telegram}
          />
        </Suspense>
        {isAuthModalOpen && (
          <AuthModal
            onSuccess={() => {
              // Complete the pending terminal entry after an explicit login.
              const t = pendingTerminalTabRef.current;
              pendingTerminalTabRef.current = null;
              if (t) handleTabChange(t);
            }}
          />
        )}
        {isProModalOpen && <ProUpgradeModal />}
        {isAdminPinModalOpen && <AdminPinModal />}
      </>
    );
  }

  return (
    <>
      <Layout 
        activeTab={activeTab} 
        onTabChange={handleTabChange} 
        theme={theme}
        themeLocked={designTheme === 'softglass'}
        setTheme={setTheme} 
        onLogout={handleLogout}
        bseHealth={health.bse}
        telegramHealth={health.telegram}
        isRunning={settings.isRunning}
        onToggleEngine={handleToggle}
      >
        <div ref={tabMotion.ref} tabIndex={-1} className="outline-none" aria-label="Page content">
        {(visitedTabs.has('home') || activeTab === 'home') && (
          <div data-screen-page="home" hidden={tabMotion.displayedKey !== 'home'}>
            <TabErrorBoundary label="home"><Suspense fallback={<TabFallback />}><HomeForYou isActive={activeTab === 'home'} onNavigate={(tab) => handleTabChange(tab)} /></Suspense></TabErrorBoundary>
          </div>
        )}
        {(visitedTabs.has('dashboard') || activeTab === 'dashboard') && (
          <div data-screen-page="dashboard" hidden={tabMotion.displayedKey !== 'dashboard'}>
            <TabErrorBoundary label="announcements"><Dashboard
              isActive={tabMotion.displayedKey === 'dashboard'}
              bseHealth={health.bse} 
              telegramHealth={health.telegram} 
              isRunning={settings.isRunning} 
              handleToggle={handleToggle} 
            /></TabErrorBoundary>
          </div>
        )}
        {(visitedTabs.has('watchlists') || activeTab === 'watchlists') && (
          <div data-screen-page="watchlists" hidden={tabMotion.displayedKey !== 'watchlists'}>
            <TabErrorBoundary label="watchlists">
            <Suspense fallback={<PageSkeleton page="watchlists" />}>
              <WatchlistManager key={user?.uid || profile?.uid || 'guest'} isActive={tabMotion.displayedKey === 'watchlists'} />
            </Suspense>
            </TabErrorBoundary>
          </div>
        )}
        {(visitedTabs.has('results-calendar') || activeTab === 'results-calendar') && (
          <div data-screen-page="results-calendar" hidden={tabMotion.displayedKey !== 'results-calendar'}>
            <TabErrorBoundary label="results-calendar">
            <Suspense fallback={<PageSkeleton page="results-calendar" />}>
              <ResultsCalendar isActive={activeTab === 'results-calendar'} />
            </Suspense>
            </TabErrorBoundary>
          </div>
        )}
        {(visitedTabs.has('news') || activeTab === 'news') && (
          <div data-screen-page="news" hidden={tabMotion.displayedKey !== 'news'}>
            <TabErrorBoundary label="news">
            <Suspense fallback={<PageSkeleton page="news" />}>
              <NewsPortal
                watchlists={watchlistDataOwner === watchlistAccount ? watchlists : []}
                user={user}
                onOpenWatchlists={() => handleTabChange('watchlists')}
                onOpenSettings={() => handleTabChange('settings')}
              />
            </Suspense>
            </TabErrorBoundary>
          </div>
        )}
        {isAdmin && (visitedTabs.has('seo-suite') || activeTab === 'seo-suite') && (
          <div data-screen-page="seo-suite" hidden={tabMotion.displayedKey !== 'seo-suite'}>
            <TabErrorBoundary label="seo-suite">
            <Suspense fallback={<PageSkeleton page="seo-suite" />}>
              <SeoStudio />
            </Suspense>
            </TabErrorBoundary>
          </div>
        )}
        {isAdmin && (visitedTabs.has('storage') || activeTab === 'storage') && (
          <div data-screen-page="storage" hidden={tabMotion.displayedKey !== 'storage'}>
            <TabErrorBoundary label="storage">
            <Suspense fallback={<PageSkeleton page="storage" />}>
              <StorageManager />
            </Suspense>
            </TabErrorBoundary>
          </div>
        )}
        {isAdmin && (visitedTabs.has('diagnostics') || activeTab === 'diagnostics') && (
          <div data-screen-page="diagnostics" hidden={tabMotion.displayedKey !== 'diagnostics'}>
            <TabErrorBoundary label="diagnostics">
            <Suspense fallback={<PageSkeleton page="diagnostics" />}>
              <AdminDiagnostics />
            </Suspense>
            </TabErrorBoundary>
          </div>
        )}
        {isAdmin && (visitedTabs.has('logs') || activeTab === 'logs') && (
          <div data-screen-page="logs" hidden={tabMotion.displayedKey !== 'logs'}>
            <TabErrorBoundary label="logs">
            <Suspense fallback={<PageSkeleton page="logs" />}>
              <LogsTab logs={logs} onRefreshLogs={fetchLogs} />
            </Suspense>
            </TabErrorBoundary>
          </div>
        )}
        {(visitedTabs.has('settings') || activeTab === 'settings') && (
          <div data-screen-page="settings" hidden={tabMotion.displayedKey !== 'settings'}>
            <TabErrorBoundary label="settings" onBack={() => handleTabChange('home')}>
            <Suspense fallback={<PageSkeleton page="settings" />}>
              <SettingsTab
                settings={settings}
                setSettings={setSettings}
                fetchSettings={fetchSettings}
                theme={theme}
                setTheme={setTheme}
                designTheme={designTheme}
                setDesignTheme={setDesignTheme}
                canUseSoftGlass={canUseSoftGlass}
                openSavedNotes={settingsNotes}
                onNavigate={(tab: string) => handleTabChange(tab)}
              />
            </Suspense>
            </TabErrorBoundary>
          </div>
        )}
        </div>
      </Layout>

    </>
  );
}

function AppWithAccount() {
  const { user } = useAuth();
  return (
    <IntelModalProvider>
      <NoteEditorProvider owner={user && !user.isAnonymous ? user.uid : null}>
        <ToastProvider>
          <AppContent />
          <CashfreeReturnHandler />
          <PaymentOverlays />
        </ToastProvider>
      </NoteEditorProvider>
    </IntelModalProvider>
  );
}

export default function App() {
  return <AuthProvider><AppWithAccount /></AuthProvider>;
}
