import { sourceHealthLabel } from '../utils/sourceHealth';
import { CalendarDateBadge3D } from './ui/CalendarDateBadge3D';
import { triggerNavigationHaptic } from '../utils/haptics';
import { UserAvatar } from './ui/UserAvatar';
import '../styles/mobile-repairs.css';
import { RichIcon } from './ui/RichVisual';
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, Settings, List, Star,
  CalendarDays, Zap, Sparkles, Scale,
  User, Bell, ShieldAlert, Building2, BookOpen, ShieldCheck,
  AlertTriangle, X, WifiOff, Newspaper, Home,
  Flame, Layers,
  Search, Sun, Moon, RotateCcw
} from 'lucide-react';
import { MarketClock } from './ui/MarketClock';
import { BseNexusLogo } from './ui/BseNexusLogo';
import { MarketTickerTape } from './ui/MarketTickerTape';
import { SyncStatusBadge } from './ui/SyncStatusBadge';
import { ComponentSkeleton } from './ui/ComponentSkeleton';
import { ScrollProgressBar } from './ui/ScrollProgressBar';
import { BackToTop } from './ui/BackToTop';
import { SupportModal } from './ui/SupportFloat';
import { AutosaveIndicator } from './ui/AutosaveIndicator';
import { CommandPalette } from './ui/CommandPalette';
import { useAuth } from '../context/AuthContext';
import { useIntelModal } from '../context/IntelModalContext';
import { customFetch } from '../api';
import { useVisibilityInterval } from '../hooks/useVisibilityInterval';
import { useUnreadNotificationCount } from '../hooks/useUnreadNotificationCount';
import { notificationCountOwner } from '../utils/unreadNotificationCount';
import { safeGetItem } from '../utils/safeStorage';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  springSnappy, 
  springMorph, 
  springBouncy,
  springSmoothPill,
  tabIconBounceVariants,
  buttonTap, 
  subtleHover 
} from '../utils/motionTokens';

import { UserProfileModal } from './UserProfileModal';
import { AuthModal } from './AuthModal';
import { ProUpgradeModal } from './ProUpgradeModal';
import { SocialIconsRow } from './ui/SocialLinks';
import { AdminPinModal } from './AdminPinModal';
import { HelpModal } from './HelpModal';
import { TermsModal, LegalTabType } from './TermsModal';
import { SecurityAuditModal } from './SecurityAuditModal';
import { CookieConsentBanner } from './CookieConsentBanner';
import { NotificationInbox } from './NotificationInbox';
import { AlertRulesModal } from './AlertRulesModal';
import { CompanyIntelligenceModal } from './CompanyIntelligenceModal';
import { NoteEditorHost } from './notes/NoteEditor';
import { TodayMarketStoryModal } from './TodayMarketStoryModal';
import { PushNotificationBanner } from './PushNotificationPrompt';
import { ReferralDashboardModal } from './ReferralDashboardModal';
import { getStorySessionStorageKey, getISTMarketSession } from './story/storyData';
import { SpecialDayBanner } from './special/SpecialDayBanner';
import { SpecialDayStoryModal } from './special/SpecialDayStoryModal';
import type { SpecialDayConfig } from '../config/specialDay';

function preloadTabChunk(tabId: string) {
  if (tabId === 'settings') void import('./SettingsTab').catch(() => {});
  else if (tabId === 'dashboard') void import('./Announcements').catch(() => {});
  else if (tabId === 'home') void import('./HomeForYou').catch(() => {});
  else if (tabId === 'watchlists') void import('./WatchlistManager').catch(() => {});
  else if (tabId === 'results-calendar') void import('./ResultsCalendar').catch(() => {});
  else if (tabId === 'news') void import('./NewsPortal').catch(() => {});
}

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  theme: string;
  themeLocked?: boolean;
  setTheme: (theme: string) => void;
  onLogout: () => void;
  bseHealth?: { status: string; latency?: number };
  telegramHealth?: { status: string; latency?: number };
  isRunning?: boolean;
  onToggleEngine?: () => void;
}

export function Layout({ 
  children, 
  activeTab, 
  onTabChange, 
  theme,
  themeLocked = false,
  setTheme, 
  bseHealth = { status: 'unknown', latency: 0 },
  telegramHealth = { status: 'unknown', latency: 0 },
  isRunning = true,
  onToggleEngine
}: LayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [termsModalTab, setTermsModalTab] = useState<LegalTabType>('terms');
  const [securityAuditModalOpen, setSecurityAuditModalOpen] = useState(false);
  const [referralModalOpen, setReferralModalOpen] = useState(false);

  useEffect(() => {
    const handleOpenReferral = () => setReferralModalOpen(true);
    window.addEventListener('open-referral-modal', handleOpenReferral);
    return () => window.removeEventListener('open-referral-modal', handleOpenReferral);
  }, []);

  const handleOpenTermsModal = (tab: LegalTabType = 'terms') => {
    setTermsModalTab(tab);
    setTermsModalOpen(true);
  };
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [storyModalOpen, setStoryModalOpen] = useState(false);
  const [hasSeenStory, setHasSeenStory] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const sessionKey = getStorySessionStorageKey();
    return safeGetItem(sessionKey) === 'true';
  });

  // Periodically check if a fresh market story edition has arrived (9:00 AM or 3:00 PM IST)
  useEffect(() => {
    const checkFreshStory = () => {
      const sessionKey = getStorySessionStorageKey();
      const viewed = safeGetItem(sessionKey) === 'true';
      setHasSeenStory(viewed);
    };

    checkFreshStory();
    const interval = setInterval(checkFreshStory, 60000); // check every minute
    return () => clearInterval(interval);
  }, []);

  const handleStoryViewed = useCallback(() => {
    setHasSeenStory(true);
    try {
      const sessionKey = getStorySessionStorageKey();
      localStorage.setItem(sessionKey, 'true');
    } catch {
      // Ignore local storage error
    }
  }, []);

  // Advanced Features State
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [notificationInboxOpen, setNotificationInboxOpen] = useState(false);
  const [alertRulesModalOpen, setAlertRulesModalOpen] = useState(false);
  const [networkDisrupted, setNetworkDisrupted] = useState<boolean>(false);
  const [quotaExceeded, setQuotaExceeded] = useState<boolean>(false);
  const [quotaBannerDismissed, setQuotaBannerDismissed] = useState<boolean>(false);
  const [specialDayConfig, setSpecialDayConfig] = useState<SpecialDayConfig | null>(null);

  const { isIntelModalOpen, selectedStock, openIntelModal, closeIntelModal } = useIntelModal();

  const { 
    user, 
    profile, 
    loading: sessionLoading,
    authLoading,
    isAdmin, 
    isPro, 
    isPaidProActive,
    adminUnlocked,
    proDaysLeft,
    setIsAuthModalOpen, 
    setIsProModalOpen,
    isAuthModalOpen,
    isProModalOpen,
    isAdminPinModalOpen,
  } = useAuth();

  // Cached profile paint is not a verified session. Wait for the Firebase user
  // before reading a private count; anonymous visitors have no private inbox.
  const notificationOwner = notificationCountOwner(user, sessionLoading || authLoading);
  const { count: unreadNotifCount, refresh: fetchUnreadCount, beginRead: beginNotificationRead } = useUnreadNotificationCount(notificationOwner);

  // Listen to network disruptions
  useEffect(() => {
    const handleNetworkStatus = (e: any) => {
      if (e.detail) {
        setNetworkDisrupted(!e.detail.isOnline);
      }
    };
    window.addEventListener('network-status', handleNetworkStatus);
    const handleOnline = () => setNetworkDisrupted(false);
    const handleOffline = () => setNetworkDisrupted(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('network-status', handleNetworkStatus);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const checkQuotaStatus = async () => {
    try {
      const res = await customFetch('/api/storage/quota-mode');
      if (res.ok) {
        const data = await res.json();
        if (data.isQuotaExceeded) {
          setQuotaExceeded(true);
        } else {
          setQuotaExceeded(false);
        }
      }
    } catch {}
  };

  useEffect(() => {
    checkQuotaStatus();
  }, []);

  useVisibilityInterval(checkQuotaStatus, 30000);

  const handleOpenCompanyIntel = (scripCode?: string, symbol?: string, companyName?: string) => {
    openIntelModal({ scripCode, symbol, companyName });
  };

  const handleTabClick = (tabId: string) => {
    if (tabId === activeTab) {
      if (typeof window !== 'undefined' && window.scrollY > 20) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bse_nav_tab_refresh', { detail: { tab: tabId } }));
      }
      onTabChange(tabId);
      return;
    }
    onTabChange(tabId);
  };

  const renderNavIcon = (itemId: string, isActive: boolean) => {
    let iconElement: React.ReactNode = null;

    if (itemId === 'home') {
      iconElement = (
        <Home 
          className={cn(
            "w-4 h-4 sm:w-4.5 sm:h-4.5 transition-colors",
            isActive ? "text-amber-500 fill-amber-500/20" : "text-slate-400 group-hover:text-amber-500"
          )} 
        />
      );
    } else if (itemId === 'dashboard') {
      iconElement = (
        <Flame 
          className={cn(
            "w-4 h-4 sm:w-4.5 sm:h-4.5 transition-colors",
            isActive ? "fill-amber-500 text-amber-500" : "text-slate-400 group-hover:text-amber-500"
          )} 
        />
      );
    } else if (itemId === 'watchlists') {
      iconElement = (
        <Star 
          className={cn(
            "w-4 h-4 sm:w-4.5 sm:h-4.5 transition-colors",
            isActive ? "fill-amber-400 text-amber-400 drop-shadow-[0_1px_3px_rgba(251,191,36,0.35)]" : "text-slate-400 group-hover:text-amber-400"
          )} 
        />
      );
    } else if (itemId === 'results-calendar') {
      iconElement = <span aria-hidden="true"><CalendarDateBadge3D month="CAL" date={String(new Date().getDate())} size="icon" /></span>;
    } else if (itemId === 'news') {
      iconElement = (
        <Newspaper 
          className={cn(
            "w-4 h-4 sm:w-4.5 sm:h-4.5 transition-colors", 
            isActive ? "text-white" : "text-slate-400 group-hover:text-slate-200"
          )} 
        />
      );
    } else if (itemId === 'settings') {
      iconElement = (
        <Settings
          className={cn(
            "w-4 h-4 sm:w-4.5 sm:h-4.5 transition-colors",
            isActive ? "text-white" : "text-slate-400 group-hover:text-slate-200"
          )}
        />
      );
    } else if (itemId === 'seo-suite') {
      iconElement = (
        <Sparkles 
          className={cn(
            "w-4 h-4 sm:w-4.5 sm:h-4.5 transition-colors", 
            isActive ? "text-amber-400 fill-amber-400/20" : "text-slate-400 group-hover:text-amber-400"
          )} 
        />
      );
    } else {
      iconElement = <Activity className={cn("w-4 h-4 sm:w-4.5 sm:h-4.5", isActive ? "text-white" : "text-slate-400")} />;
    }

    return (
      <motion.div
        variants={tabIconBounceVariants}
        animate={isActive ? "active" : "idle"}
        className={`rich-nav-icon ${isActive ? 'is-active' : ''} flex items-center justify-center shrink-0`}
        data-nav={itemId}
      >
        {isActive ? <RichIcon tone="emerald" className="rich-nav-tile">{iconElement}</RichIcon> : iconElement}
      </motion.div>
    );
  };

  interface NavItem {
    id: string;
    label: string;
    shortLabel: string;
    icon: any;
    badge?: string | number;
  }

  // Watchlist is a Pro-only feature: hide the tab entirely for free users.
  const canUseWatchlist = Boolean(isPro || isAdmin);
  const navItems: NavItem[] = [
    { id: 'home', label: 'For You', shortLabel: 'For You', icon: Home },
    { id: 'dashboard', label: 'Filings', shortLabel: 'Filings', icon: Flame },
    { id: 'watchlists', label: 'My Watchlist', shortLabel: 'Watchlist', icon: Star },
    { id: 'results-calendar', label: 'Earnings Calendar', shortLabel: 'Earnings', icon: CalendarDays },
    { id: 'news', label: 'Market News', shortLabel: 'News', icon: Newspaper },
    { id: 'settings', label: 'Settings', shortLabel: 'Settings', icon: Settings },
  ].filter(i => i.id !== 'watchlists' || canUseWatchlist);

  // Mobile Bottom Bar: Clean 5 tabs strictly adhering to touch-friendly mobile design
  const mobileNavItems: NavItem[] = [
    { id: 'home', label: 'For You', shortLabel: 'For You', icon: Home },
    { id: 'dashboard', label: 'Filings', shortLabel: 'Filings', icon: Flame },
    { id: 'watchlists', label: 'Watchlist', shortLabel: 'Watchlist', icon: Star },
    { id: 'results-calendar', label: 'Earnings', shortLabel: 'Earnings', icon: CalendarDays },
    { id: 'news', label: 'Market News', shortLabel: 'News', icon: Newspaper },
  ].filter(i => i.id !== 'watchlists' || canUseWatchlist);

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#12131C] text-slate-800 dark:text-slate-200 flex flex-col font-sans transition-colors duration-200">
      {/* Accessibility: Skip to main content bypass link for keyboard & screen reader users (WCAG 2.4.1) */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2.5 focus:bg-emerald-600 focus:text-white focus:font-bold focus:text-xs focus:rounded-lg focus:shadow-xl focus:outline-none focus:ring-2 focus:ring-white"
      >
        Skip to main content
      </a>

      {/* Top Main Navigation Bar with Apple Frosted Chrome */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-[#12131C]/80 backdrop-blur-xl backdrop-saturate-180 border-b border-slate-200/60 dark:border-white/10 shadow-xs transition-colors">
        {/* Item 15: Slim Top Scroll Progress Bar */}
        <ScrollProgressBar />

        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          {/* Row 1: Brand Logo & Right Utility Controls */}
          <div className="flex flex-wrap min-h-14 sm:min-h-12 gap-x-2 gap-y-1 py-1 sm:py-0 items-center justify-between">
            
            {/* Brand Logo & Title with Circular Story Ring */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 select-none">
              <motion.button 
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={springSnappy}
                onClick={() => setStoryModalOpen(true)}
                className={cn(
                  "relative rounded-full cursor-pointer select-none group shrink-0 transition-all duration-300",
                  hasSeenStory 
                    ? "p-[2px] border-2 border-slate-300/80 dark:border-slate-700/80 shadow-2xs" 
                    : "p-[2.5px] bg-gradient-to-tr from-amber-500 via-rose-500 to-emerald-500 shadow-xs hover:shadow-md"
                )} 
                aria-label="View Today's Market Story (Daily Highlights)"
                title={hasSeenStory ? "Today's Story (Viewed) • Click to replay" : "View Today's Market Story • Live Highlights"}
              >
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#0B0F19] flex items-center justify-center overflow-hidden shadow-sm">
                  <BseNexusLogo className="w-7 h-7 sm:w-8 sm:h-8 transition-transform group-hover:scale-105 shrink-0" />
                </div>
              </motion.button>

              <button
                type="button"
                className="flex items-center gap-1.5 sm:gap-2 cursor-pointer select-none"
                onClick={() => handleTabClick('home')}
                aria-label="BSE Nexus home — For You"
              >
                <span className="font-black text-[15px] sm:text-[18px] tracking-tight text-slate-900 dark:text-white font-display">
                  BSE<span className="text-emerald-500">NEXUS</span>
                </span>
                {/* PRO badge — paid subscription active (or admin). Simple monochrome pill;
                    a one-time gold sheen sweeps across on mount, then it stays simple. */}
                {(isPaidProActive || profile?.subscriptionAccess?.gift && profile.subscriptionAccess.gift.expiresAt > Date.now()) && (
                  <span
                    className="relative overflow-hidden inline-flex items-center shrink-0 text-[10px] font-black tracking-[1.2px] px-2 py-[2.5px] rounded-md bg-slate-900/10 text-slate-900 dark:bg-white/10 dark:text-white border border-slate-900/15 dark:border-white/20"
                    aria-label="Pro subscriber"
                    title="Pro subscription active"
                  >
                    PRO
                    <motion.span
                      aria-hidden="true"
                      initial={{ x: '-140%', opacity: 1 }}
                      animate={{ x: '240%', opacity: 0 }}
                      transition={{ duration: 1.3, ease: 'easeInOut', delay: 0.5 }}
                      className="pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-amber-300/90 to-transparent"
                    />
                  </span>
                )}
              </button>
            </div>

            {/* Right Tools: Status, Clock, Theme, Profile */}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0 max-[359px]:w-full max-[359px]:justify-end">
              {/* Item 1: ⌘K Quick Search Trigger */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={buttonTap}
                transition={springSnappy}
                onClick={() => setCommandPaletteOpen(true)}
                aria-label="Search companies, filings, commands (Command + K)"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#252233] hover:bg-slate-200 dark:hover:bg-[#2F2B40] border border-slate-200/90 dark:border-[#352F48] text-slate-700 dark:text-slate-200 cursor-pointer select-none shadow-xs shrink-0 min-h-[36px] sm:min-h-[32px]"
                title="Search companies & commands (⌘K)"
              >
                <Search size={14} className="text-emerald-500 shrink-0" />
                <span className="text-xs font-semibold hidden md:inline">Search</span>
                <kbd className="hidden md:inline-flex items-center px-1.5 py-0.2 rounded bg-slate-200/80 dark:bg-[#352F48] text-[9px] font-mono font-bold text-slate-600 dark:text-slate-300">
                  ⌘K
                </kbd>
              </motion.button>

              {/* Item 6: Autosave Status Indicator */}
              <AutosaveIndicator className="hidden xl:inline-flex" />

              {/* Sync Status Badge (Desktop large screens) */}
              <SyncStatusBadge className="hidden xl:inline-flex" />

              {/* Realtime Market Clock - Visible on laptops and desktops (>= 1024px) */}
              <MarketClock className="hidden lg:flex shrink-0" />

              {/* Passive Alerts Status & In-App Notification Bell */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={buttonTap}
                transition={springSnappy}
                onClick={() => setNotificationInboxOpen(true)}
                aria-label={unreadNotifCount > 0 ? `In-app notifications (${unreadNotifCount} unread)` : "In-app notifications"}
                className="relative flex items-center justify-center p-2 sm:px-2.5 sm:py-1 rounded-lg bg-slate-100 dark:bg-[#252233] hover:bg-slate-200 dark:hover:bg-[#2F2B40] border border-slate-200/90 dark:border-[#352F48] text-slate-700 dark:text-slate-200 cursor-pointer select-none shadow-xs shrink-0 min-h-[36px] sm:min-h-[32px] min-w-[36px] sm:min-w-auto"
                title="In-App Notifications & Alerts"
              >
                <Bell size={15} className="text-slate-600 dark:text-slate-300 shrink-0" />
                <span className="hidden sm:inline text-xs font-semibold">Alerts</span>
                {unreadNotifCount !== null && unreadNotifCount > 0 && (
                  <span className="absolute -top-1 -right-1 sm:static sm:top-auto sm:right-auto flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-slate-900 dark:bg-white text-[9px] font-bold text-white dark:text-slate-900 leading-none">
                    {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
                  </span>
                )}
              </motion.button>

              {/* Refer & Earn Header Pill */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={buttonTap}
                transition={springSnappy}
                onClick={() => setReferralModalOpen(true)}
                aria-label="Refer and Earn partner dashboard"
                className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-700/80 text-emerald-700 dark:text-emerald-300 cursor-pointer select-none shadow-xs shrink-0 min-h-[32px]"
                title="Refer & Earn — Flat ₹100 OFF for friends & 25% commission"
              >
                <Sparkles size={13} className="text-emerald-500 shrink-0" />
                <span className="text-xs font-semibold">Refer &amp; Earn</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-600 text-white leading-none">
                  ₹100 Off
                </span>
              </motion.button>


              {/* Item 9: Quick Sun/Moon Dark Mode Toggle - Hidden on Settings tab to prevent duplicate appearance controls */}
              {activeTab !== 'settings' && !themeLocked && (
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={buttonTap}
                  transition={springSnappy}
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                  className="hidden sm:flex items-center justify-center p-2 sm:p-1.5 rounded-lg bg-slate-100 dark:bg-[#252233] hover:bg-slate-200 dark:hover:bg-[#2F2B40] border border-slate-200/90 dark:border-[#352F48] text-slate-700 dark:text-slate-200 cursor-pointer select-none shadow-xs shrink-0 min-w-[36px] sm:min-w-[32px] min-h-[36px] sm:min-h-[32px]"
                  title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                >
                  {theme === 'dark' ? (
                    <Sun size={15} className="text-amber-400" />
                  ) : (
                    <Moon size={15} className="text-slate-600" />
                  )}
                </motion.button>
              )}

              {/* Settings stays directly accessible after mobile News takes its dock slot */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={buttonTap}
                transition={springSnappy}
                onMouseEnter={() => preloadTabChunk('settings')}
                onFocus={() => preloadTabChunk('settings')}
                onClick={() => { triggerNavigationHaptic(); onTabChange('settings'); }}
                aria-pressed={activeTab === 'settings'}
                aria-label="Open Settings and Preferences"
                className="shell-settings-button flex items-center justify-center p-2 sm:p-1.5 rounded-lg bg-slate-100 dark:bg-[#252233] hover:bg-slate-200 dark:hover:bg-[#2F2B40] border border-slate-200/90 dark:border-[#352F48] text-slate-700 dark:text-slate-200 cursor-pointer select-none shadow-xs shrink-0 min-w-[44px] min-h-[44px] sm:min-w-[32px] sm:min-h-[32px]"
                title="Open Settings & Preferences"
              >
                <Settings size={15} className="text-slate-600 dark:text-slate-300" />
              </motion.button>

              {/* Pro Upgrade Quick Button for Free/Guest Users */}
              {!isPro && (
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={buttonTap}
                  transition={springSnappy}
                  onClick={() => (!user || user.isAnonymous) ? setIsAuthModalOpen(true) : setIsProModalOpen(true)}
                  aria-label="1-Week Free Pro with Google Login"
                  className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-[11px] font-bold shadow-xs cursor-pointer shrink-0 min-h-[32px]"
                  title="Sign in with Google to get 1 Week (7 Days) Free Pro Trial"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>7D Free Pro</span>
                </motion.button>
              )}

              {/* Circular User Avatar Button - Round shape, initial only ('G' or initial), story-ready */}
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={buttonTap}
                transition={springSnappy}
                onClick={() => (user || profile ? setProfileModalOpen(true) : setIsAuthModalOpen(true))}
                aria-label={user || profile ? `User: ${profile?.displayName || 'Guest User'}` : 'Guest Profile & Sign In'}
                className={cn(
                  "relative w-8.5 h-8.5 sm:w-8 sm:h-8 rounded-full flex items-center justify-center cursor-pointer select-none shrink-0 transition-all",
                  isPro ? "p-[2px] bg-gradient-to-tr from-emerald-500 via-teal-500 to-indigo-500 shadow-xs hover:shadow-md" : "p-[2px] bg-slate-200 dark:bg-slate-700"
                )}
                title={user || profile ? `${profile?.displayName || 'User'} (${isAdmin ? 'Admin' : isPro ? 'Pro' : 'Guest'})` : 'Guest / Sign In'}
              >
                <div className="w-full h-full rounded-full bg-white dark:bg-[#1E1B2E] flex items-center justify-center overflow-hidden">
                  <UserAvatar photoURL={profile?.photoURL} name={(user?.isAnonymous || (!user && !profile)) ? 'Guest' : profile?.displayName || profile?.email || 'User'} size={30} className="user-avatar-header" decorative />
                </div>

                {/* Story ready indicator status badge */}
                <span className={cn(
                  "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-[#1E1B2E]",
                  isAdmin ? "bg-purple-500" : isPro ? "bg-emerald-500" : "hidden"
                )} />
              </motion.button>
            </div>
          </div>

          {/* Row 2: Tabs with a transform-only active indicator */}
          <nav aria-label="Primary Navigation" className="hidden md:flex items-center gap-1 pb-2 pt-1 border-t border-slate-100 dark:border-[#2D283E]/60 overflow-x-auto no-scrollbar relative">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onMouseEnter={() => preloadTabChunk(item.id)}
                  onFocus={() => preloadTabChunk(item.id)}
                  onClick={() => handleTabClick(item.id)}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    "group relative flex items-center gap-2 px-3.5 py-1.5 text-xs rounded-lg whitespace-nowrap select-none cursor-pointer z-10 transition-colors",
                    isActive
                      ? "rich-nav-label-active font-bold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium"
                  )}
                >
                  <span aria-hidden="true" className={cn("rich-nav-surface absolute inset-0 rounded-lg -z-10 transition-[transform,opacity] duration-150 motion-reduce:transition-none", isActive ? "scale-100 opacity-100" : "scale-95 opacity-0")} />

                  {renderNavIcon(item.id, isActive)}
                  <span className="relative z-10">{item.label}</span>
                  {item.badge && (
                    <span className={cn(
                      "text-[8.5px] font-bold px-1.5 py-0.2 rounded-full relative z-10",
                      isActive
                        ? "bg-white/20 text-white dark:bg-white/15"
                        : "bg-slate-200 dark:bg-[#252233] text-slate-600 dark:text-slate-400"
                    )}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}

          </nav>
        </div>

        {/* Mobile Dropdown Menu with AnimatePresence */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={springMorph}
              className="md:hidden border-t border-slate-200 dark:border-[#2D283E] bg-white dark:bg-[#1A1926] px-4 pt-2 pb-4 space-y-1 overflow-hidden"
            >
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <motion.button
                    key={item.id}
                    whileTap={buttonTap}
                    onClick={() => {
                      handleTabClick(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors",
                      isActive
                        ? "rich-nav-surface rich-nav-label-active font-bold"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#222030] font-medium"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      {renderNavIcon(item.id, isActive)}
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full",
                        isActive ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-[#252233] text-slate-600 dark:text-slate-400"
                      )}>
                        {item.badge}
                      </span>
                    )}
                  </motion.button>
                );
              })}

              {!isPro && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setIsProModalOpen(true);
                  }}
                  className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-[#252233] dark:hover:bg-[#302B42] text-white rounded-lg text-xs font-bold border border-slate-700/60 dark:border-[#3E3854] shadow-2xs"
                >
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Pro Features (100% Free)</span>
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Network Offline Notice */}
      <AnimatePresence>
        {networkDisrupted && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springMorph}
            className="bg-rose-500/10 border-b border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs px-4 py-2 flex items-center justify-between z-30 overflow-hidden"
          >
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-rose-500 shrink-0" />
              <span>Connection offline. Viewing cached BSE filings.</span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (navigator.onLine) {
                  setNetworkDisrupted(false);
                } else {
                  customFetch('/api/health').then(() => setNetworkDisrupted(false)).catch(() => {});
                }
              }}
              className="px-2.5 py-0.5 rounded-md bg-rose-500 text-white text-[11px] font-bold hover:bg-rose-600 cursor-pointer transition-colors"
            >
              Retry
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Storage Quota Alert Banner */}
      <AnimatePresence>
        {quotaExceeded && !quotaBannerDismissed && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springMorph}
            role="status"
            aria-live="polite"
            className="bg-amber-500/10 border-b border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs px-4 py-2 flex items-center justify-between z-30 overflow-hidden"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Cloud storage limit reached — changes are currently cached locally and synced seamlessly.</span>
            </div>
            <button 
              onClick={() => setQuotaBannerDismissed(true)} 
              aria-label="Dismiss cloud storage notice"
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer"
              title="Dismiss notice"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Special Day Banner with Countdown, Slim-strip & Auto-hide */}
      <SpecialDayBanner onOpenStory={(cfg) => setSpecialDayConfig(cfg)} />

      {/* Live Market Ticker Tape - Responsive for Mobile and Desktop */}
      <MarketTickerTape bseLatency={bseHealth?.latency || 0} />

      {/* OneSignal Instant Web Push Banner */}
      <PushNotificationBanner />

      {/* Main Content Area with Smooth Layout Transition and Keyboard Focus Target */}
      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-3 pb-24 md:pb-6 transition-all duration-200 focus:outline-none">
        {children}
      </main>

      {/* Mobile bottom navigation with active indicator */}
      <nav aria-label="Mobile Navigation" className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#1A1926]/95 backdrop-blur-xl border-t border-slate-200/90 dark:border-[#2D283E] py-1 px-1 sm:px-2 safe-area-bottom shadow-[0_-4px_20px_rgba(0,0,0,0.25)]">
        <div className="flex items-center justify-around gap-1">
          {mobileNavItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <motion.button
                key={item.id}
                whileTap={isActive ? undefined : { scale: 0.88 }}
                transition={springBouncy}
                onClick={() => handleTabClick(item.id)}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  "relative flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 px-0.5 rounded-xl select-none touch-manipulation",
                  isActive
                    ? "text-slate-900 dark:text-white font-bold cursor-default"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium cursor-pointer"
                )}
              >
                <motion.div 
                  animate={isActive ? { scale: 1.05 } : { scale: 1 }}
                  transition={springSmoothPill}
                  className={cn(
                    "p-1.5 rounded-xl transition-all relative flex items-center justify-center min-w-[34px] min-h-[34px] pointer-events-none",
                    isActive && "rich-nav-surface rich-nav-label-active"
                  )}
                >
                  {renderNavIcon(item.id, isActive)}
                  {item.id === 'dashboard' && isRunning && (
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  )}
                  {item.badge && item.id !== 'dashboard' && (
                    <span className="absolute -top-1 -right-1 text-[8px] font-bold px-1 rounded-full text-white leading-tight bg-slate-700 dark:bg-[#3D3754]">
                      {item.badge}
                    </span>
                  )}
                </motion.div>
                <span className="text-[11px] font-medium tracking-tight mt-0.5 whitespace-nowrap pointer-events-none">
                  {item.shortLabel || item.label}
                </span>
                {isActive && (
                  <span
                    className="rich-nav-active-indicator w-5 h-1 rounded-full mt-0.5 pointer-events-none"
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </nav>

      {/* Global Modals */}
      {isAuthModalOpen && <AuthModal />}
      {isProModalOpen && <ProUpgradeModal />}
      {isAdminPinModalOpen && <AdminPinModal />}
      {profileModalOpen && (
        <UserProfileModal 
          unreadCount={unreadNotifCount}
          isOpen={profileModalOpen} 
          onClose={() => setProfileModalOpen(false)}
          onOpenSettings={() => onTabChange('settings')}
          onOpenSavedNotes={() => onTabChange('saved-notes')}
          onOpenWatchlist={() => onTabChange('watchlists')}
          onOpenAlertRules={() => setAlertRulesModalOpen(true)}
          onOpenHelp={() => setHelpModalOpen(true)}
          onOpenTerms={() => handleOpenTermsModal('terms')}
        />
      )}
      {helpModalOpen && (
        <HelpModal 
          isOpen={helpModalOpen} 
          onClose={() => setHelpModalOpen(false)}
          onOpenSettings={() => onTabChange('settings')}
        />
      )}
      {supportModalOpen && (
        <SupportModal
          isOpen={supportModalOpen}
          onClose={() => setSupportModalOpen(false)}
          onOpenHelp={() => {
            setSupportModalOpen(false);
            setHelpModalOpen(true);
          }}
        />
      )}
      {storyModalOpen && (
        <TodayMarketStoryModal
          isOpen={storyModalOpen}
          onClose={() => setStoryModalOpen(false)}
          onStoryViewed={handleStoryViewed}
          onOpenCompanyIntel={handleOpenCompanyIntel}
        />
      )}
      {specialDayConfig && (
        <SpecialDayStoryModal
          config={specialDayConfig}
          isOpen={Boolean(specialDayConfig)}
          onClose={() => setSpecialDayConfig(null)}
          onNavigateTab={(tab) => {
            setSpecialDayConfig(null);
            handleTabClick(tab);
          }}
        />
      )}
      {termsModalOpen && (
        <TermsModal 
          isOpen={termsModalOpen} 
          initialTab={termsModalTab}
          onClose={() => setTermsModalOpen(false)}
        />
      )}
      {securityAuditModalOpen && (
        <SecurityAuditModal
          isOpen={securityAuditModalOpen}
          onClose={() => setSecurityAuditModalOpen(false)}
        />
      )}
      {referralModalOpen && (
        <ReferralDashboardModal
          isOpen={referralModalOpen}
          onClose={() => setReferralModalOpen(false)}
        />
      )}
      <CookieConsentBanner 
        onOpenPrivacyPolicy={() => handleOpenTermsModal('privacy')}
        onOpenCookiePolicy={() => handleOpenTermsModal('cookies')}
      />
      {/* Keep confirmed same-owner inbox snapshots while its dialog is closed. */}
        <NotificationInbox
          key={user?.uid || profile?.uid || 'guest'}
          isOpen={notificationInboxOpen}
          onClose={() => setNotificationInboxOpen(false)}
          onOpenCompanyIntel={handleOpenCompanyIntel}
          onOpenAlertRules={() => {
            setNotificationInboxOpen(false);
            setAlertRulesModalOpen(true);
          }}
          unreadCount={unreadNotifCount}
          onRefreshCount={fetchUnreadCount}
          onBeginRead={beginNotificationRead}
        />
      {alertRulesModalOpen && (
        <AlertRulesModal
          isOpen={alertRulesModalOpen}
          onClose={() => setAlertRulesModalOpen(false)}
        />
      )}
      {isIntelModalOpen && (
        <CompanyIntelligenceModal
          isOpen={isIntelModalOpen}
          onClose={closeIntelModal}
          scripCode={selectedStock.scripCode}
          symbol={selectedStock.symbol}
          companyName={selectedStock.companyName}
          initialView={selectedStock.initialView}
        />
      )}
      {/* Global Saved-Notes editor (reel-style 2-step flow) */}
      <NoteEditorHost />

      {/* Reconnecting / Network Interruption Banner */}
      <AnimatePresence>
        {networkDisrupted && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={springMorph}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-amber-600 dark:bg-amber-700 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2.5 text-xs font-bold"
          >
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            <span>⚠️ Network connection lost. Reconnecting to Bsenexus live stream...</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modern Compact Footer with Grouped Help & Legal (Clean Instagram Style) */}
      <footer className="border-t border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-[#0F172A]/90 backdrop-blur-md py-3 text-xs text-slate-500 dark:text-slate-400 pb-24 md:pb-3 md:pr-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">{sourceHealthLabel(bseHealth).status}</span>
            <span className="text-slate-400 dark:text-slate-500 hidden sm:inline">{`• ${sourceHealthLabel(bseHealth).request}`}</span>
          </div>

          {/* Social Icons row */}
          <div className="flex items-center justify-center">
            <SocialIconsRow size={20} />
          </div>

          <div className="flex flex-wrap items-center justify-center md:justify-end gap-2.5 text-[11px]">
            <a
              href="/companies"
              className="hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-1 cursor-pointer font-medium"
            >
              <Building2 size={12} className="text-emerald-500" />
              <span>Companies</span>
            </a>

            <span className="text-slate-500 dark:text-slate-400" aria-hidden="true">&bull;</span>

            <a
              href="/about"
              className="hover:text-slate-900 dark:hover:text-white transition-colors font-medium"
            >
              About
            </a>

            <span className="text-slate-500 dark:text-slate-400" aria-hidden="true">&bull;</span>

            <a
              href="/contact"
              className="hover:text-slate-900 dark:hover:text-white transition-colors font-medium"
            >
              Contact
            </a>

            <span className="text-slate-500 dark:text-slate-400" aria-hidden="true">&bull;</span>

            <a
              href="/disclaimer"
              className="hover:text-slate-900 dark:hover:text-white transition-colors font-medium"
            >
              Disclaimer
            </a>

            <span className="text-slate-500 dark:text-slate-400" aria-hidden="true">&bull;</span>

            <a
              href="/privacy-policy"
              className="hover:text-slate-900 dark:hover:text-white transition-colors font-medium"
            >
              Privacy
            </a>

            <span className="text-slate-500 dark:text-slate-400" aria-hidden="true">&bull;</span>

            <a
              href="/terms"
              className="hover:text-slate-900 dark:hover:text-white transition-colors font-medium"
            >
              Terms
            </a>

            {isAdmin && (
              <>
                <span className="text-slate-500 dark:text-slate-400" aria-hidden="true">&bull;</span>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={buttonTap}
                  transition={springSnappy}
                  onClick={() => setSecurityAuditModalOpen(true)}
                  className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors flex items-center gap-1 cursor-pointer font-medium text-purple-600 dark:text-purple-400"
                >
                  <ShieldCheck size={12} />
                  <span>Admin Security</span>
                </motion.button>
              </>
            )}
          </div>
        </div>
      </footer>

      {/* Item 12: Tactile Floating Back to Top with Scroll Progress Ring */}
      <BackToTop />

      {/* Item 1: Global ⌘K Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        activeTab={activeTab}
        onTabChange={onTabChange}
        theme={theme}
        themeLocked={themeLocked}
        setTheme={setTheme}
        isRunning={isRunning}
        onToggleEngine={onToggleEngine}
        isAdmin={isAdmin}
      />
    </div>
  );
}

