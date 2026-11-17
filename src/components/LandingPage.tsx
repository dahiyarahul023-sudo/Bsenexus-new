import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Check,
  Sun,
  Moon,
  Sparkles,
  ChevronDown,
  Radio,
  ArrowRight,
  ArrowUpRight,
  Building2,
} from 'lucide-react';
import { BseNexusLogo } from './ui/BseNexusLogo';
import { AiIntelligenceLogo } from './ui/AiIntelligenceLogo';
import { CalendarDateBadge3D } from './ui/CalendarDateBadge3D';
import { MarketTickerTape } from './ui/MarketTickerTape';
import { ParticleRibbons } from './ui/ParticleRibbons';
import { CoreCapabilitiesBento } from './landing/CoreCapabilitiesBento';
import { CommunitySocialBanner } from './landing/CommunitySocialBanner';
import { LandingFooterAbout } from './landing/LandingFooterAbout';
import {
  CompanyLogo,
  GoogleGLogo,
  type CompanySymbol,
} from './landing/CompanyLogos';
import {
  AiSummariesIcon,
  WatchlistsIcon,
  TelegramAlertsIcon,
} from './landing/FeatureIcons';
import { PlanCard } from './ui/PlanCard';
import { PRO_PLAN_LIST, getPlanDisplay } from '../config/plans';
import { AI_ALLOWANCE_COPY } from '../shared/productFacts';
import { triggerTapHaptic, triggerStageHaptic } from '../utils/haptics';

interface LandingPageProps {
  onEnterTerminal: (tab?: string) => void;
  onSignIn?: () => void;
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  bseHealth?: { status?: string; latency?: number };
  telegramHealth?: { status?: string };
  onSelectCompany?: (symbol: string) => void;
  onNavigate?: (path: string) => void;
}

interface FeaturedCompanyCard {
  symbol: CompanySymbol;
  name: string;
  shortInfo: string;
  code: string;
  exchange: string;
  detailSummary: string;
}

const FEATURED_COMPANIES: FeaturedCompanyCard[] = [
  {
    symbol: 'RELIANCE',
    name: 'Reliance Industries',
    shortInfo: 'Reg 33 Financial Results & O2C / Jio Updates',
    code: '500325',
    exchange: 'BSE & NSE Listed',
    detailSummary: 'Consolidated quarterly results, retail/telecom operating metrics, and board disclosures.',
  },
  {
    symbol: 'TCS',
    name: 'Tata Consultancy Services',
    shortInfo: 'Board Outcome, Order Book & Dividend Filings',
    code: '532540',
    exchange: 'BSE & NSE Listed',
    detailSummary: 'Q2 board outcome, interim dividend declarations, and deal TCV press releases.',
  },
  {
    symbol: 'HDFCBANK',
    name: 'HDFC Bank',
    shortInfo: 'Pillar 3 Disclosures, NIM & Deposit Updates',
    code: '500180',
    exchange: 'BSE & NSE Listed',
    detailSummary: 'Standalone & consolidated banking results, CASA ratio, and quarterly business updates.',
  },
  {
    symbol: 'INFY',
    name: 'Infosys',
    shortInfo: 'Quarterly Earnings, Guidance & Record Dates',
    code: '500209',
    exchange: 'BSE & NSE Listed',
    detailSummary: 'Constant-currency revenue guidance, large deal signings, and dividend record dates.',
  },
  {
    symbol: 'ICICIBANK',
    name: 'ICICI Bank',
    shortInfo: 'Quarterly Results & Investor Presentations',
    code: '532174',
    exchange: 'BSE & NSE Listed',
    detailSummary: 'Net interest income, asset quality (GNPA/NNPA) tables, and earnings call schedules.',
  },
  {
    symbol: 'SBIN',
    name: 'State Bank of India',
    shortInfo: 'Central Board Outcomes & Capital Filings',
    code: '500112',
    exchange: 'BSE & NSE Listed',
    detailSummary: 'PSU banking quarterly earnings, bond issuances, and executive board resolutions.',
  },
  {
    symbol: 'BHARTIARTL',
    name: 'Bharti Airtel',
    shortInfo: 'ARPU Metrics, Spectrum & Capex Disclosures',
    code: '532454',
    exchange: 'BSE & NSE Listed',
    detailSummary: 'Telecom KPI tables, India mobile ARPU trends, and subsidiary corporate filings.',
  },
  {
    symbol: 'LT',
    name: 'Larsen & Toubro',
    shortInfo: 'Reg 30 Order Inflows & EPC Project Wins',
    code: '500510',
    exchange: 'BSE & NSE Listed',
    detailSummary: 'Major domestic and international infrastructure contract awards and order book updates.',
  },
];

const LANDING_STAGES = [
  { id: 'stage-overview', num: '01', label: 'Overview', title: 'Live Terminal Overview' },
  { id: 'stage-preview', num: '02', label: 'Preview', title: 'Calendar & Reg 33 Deck' },
  { id: 'stage-features', num: '03', label: 'Capabilities', title: '6-Pillar Architecture' },
  { id: 'stage-pricing', num: '04', label: 'Plans', title: 'Pro Access & Trial' },
] as const;

const FREE_TIER_FEATURES = [
  'Live BSE corporate announcements stream',
  'Upcoming earnings & board meeting calendar',
  'Official exchange PDF viewer & scrip search',
  'Personal watchlist & foundational filters',
] as const;

const PRO_TIER_FEATURES = [
  AI_ALLOWANCE_COPY,
  'Reg 33 structured financial table extraction',
  'Impact Radar historical reaction context',
  'Instant priority alerts & full archive search',
] as const;

let cachedExamplesComponent: React.ComponentType<{ onEnterTerminal: (tab?: string) => void }> | null = null;
let examplesLoadPromise: Promise<React.ComponentType<{ onEnterTerminal: (tab?: string) => void }>> | null = null;

function loadExamplesModule() {
  if (cachedExamplesComponent) return Promise.resolve(cachedExamplesComponent);
  if (!examplesLoadPromise) {
    examplesLoadPromise = import('./landing/LandingExamples')
      .then(mod => {
        cachedExamplesComponent = mod.default;
        return mod.default;
      })
      .catch(err => {
        examplesLoadPromise = null;
        throw err;
      });
  }
  return examplesLoadPromise;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onEnterTerminal,
  onSignIn,
  theme,
  setTheme,
  bseHealth,
  onSelectCompany,
}) => {
  const [selectedLandingPlan, setSelectedLandingPlan] = useState<string>('pro_monthly');
  const [showExamples, setShowExamples] = useState(false);
  const [Examples, setExamples] = useState<React.ComponentType<{ onEnterTerminal: (tab?: string) => void }> | null>(
    () => cachedExamplesComponent
  );
  const [exampleError, setExampleError] = useState(false);
  const [touchRipplesCount, setTouchRipplesCount] = useState(0);
  const [activeStageIdx, setActiveStageIdx] = useState(0);
  const [stagePulseBanner, setStagePulseBanner] = useState<string | null>(null);
  const [expandedCompanySymbol, setExpandedCompanySymbol] = useState<CompanySymbol | null>(null);
  const hasInteractedRef = useRef(false);
  const lastStageIdxRef = useRef(0);

  const activePlan = getPlanDisplay(selectedLandingPlan);

  const preloadExamples = useCallback(() => {
    if (Examples) return;
    void loadExamplesModule()
      .then(comp => setExamples(() => comp))
      .catch(() => {});
  }, [Examples]);

  useEffect(() => {
    if (!showExamples || Examples) return;
    let active = true;
    setExampleError(false);
    loadExamplesModule()
      .then(comp => {
        if (active) setExamples(() => comp);
      })
      .catch(() => {
        if (active) setExampleError(true);
      });
    return () => {
      active = false;
    };
  }, [showExamples, Examples]);

  // Observe stages so scrolling between sections gives tactile haptic + visual stage feedback
  useEffect(() => {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return;
    const elements = LANDING_STAGES.map(s => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    if (!elements.length) return;

    let bannerTimer: number | null = null;
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (!visible.length) return;
        const topId = visible[0].target.id;
        const idx = LANDING_STAGES.findIndex(s => s.id === topId);
        if (idx !== -1 && idx !== lastStageIdxRef.current) {
          lastStageIdxRef.current = idx;
          setActiveStageIdx(idx);
          if (hasInteractedRef.current) {
            triggerStageHaptic(idx);
            const stage = LANDING_STAGES[idx];
            setStagePulseBanner(`Stage ${stage.num} · ${stage.title}`);
            if (bannerTimer) window.clearTimeout(bannerTimer);
            bannerTimer = window.setTimeout(() => setStagePulseBanner(null), 1600);
          }
        }
      },
      { threshold: [0.25, 0.55], rootMargin: '-12% 0px -35% 0px' }
    );

    elements.forEach(el => observer.observe(el));
    return () => {
      observer.disconnect();
      if (bannerTimer) window.clearTimeout(bannerTimer);
    };
  }, []);

  /**
   * Require explicit Sign In / Auth modal when clicking gated terminal destinations on the pre-login page
   * so visitors aren't silently dropped into Guest Mode from Earnings Calendar / Company Profiles.
   */
  const handleGatedDestination = (
    e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>,
    tab: string
  ) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    hasInteractedRef.current = true;
    triggerTapHaptic();
    onEnterTerminal(tab);
  };

  const jumpToStage = (idx: number) => {
    hasInteractedRef.current = true;
    triggerStageHaptic(idx);
    setActiveStageIdx(idx);
    const stage = LANDING_STAGES[idx];
    setStagePulseBanner(`Stage ${stage.num} · ${stage.title}`);
    if (stage.id === 'stage-preview' && !showExamples) {
      preloadExamples();
    }
    const el = document.getElementById(stage.id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div
      onPointerDown={() => {
        hasInteractedRef.current = true;
        setTouchRipplesCount(c => c + 1);
      }}
      className="landing-ambient min-h-screen min-h-[100dvh] bg-slate-50 dark:bg-[#060a10] text-slate-900 dark:text-slate-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-700 dark:selection:text-emerald-200 overflow-x-hidden transition-colors duration-300 relative"
    >
      {/* Interactive Touch & Pointer Live Background (Adapts to Light & Dark Mode) */}
      <ParticleRibbons theme={theme} />

      {/* Haptic Stage Transition Feedback Pill */}
      {stagePulseBanner && (
        <div
          aria-live="polite"
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 pointer-events-none px-4 py-2 rounded-full bg-slate-900/92 dark:bg-white/95 text-white dark:text-slate-950 text-xs font-mono font-bold tracking-wide shadow-[0_8px_30px_rgba(0,0,0,0.3)] border border-emerald-500/40 flex items-center gap-2 transition-all duration-200"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 dark:bg-emerald-600 animate-ping" />
          <span>{stagePulseBanner}</span>
        </div>
      )}

      {/* Top Navigation Bar (Mobile-safe: Sign In button never clips on 320px-390px screens) */}
      <header className="sticky top-0 z-50 border-b border-slate-200/85 dark:border-slate-800/85 bg-white/88 dark:bg-[#060a10]/88 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2">
          <div
            className="flex items-center gap-2 sm:gap-3 cursor-pointer group min-w-0 flex-1"
            onClick={() => {
              triggerTapHaptic();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            <BseNexusLogo size="sm" className="sm:w-9 sm:h-9" />
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-extrabold text-[15px] sm:text-lg tracking-[-0.03em] text-slate-900 dark:text-white leading-none font-display truncate">
                  BSE <span className="text-emerald-600 dark:text-emerald-400">NEXUS</span>
                </span>
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Terminal
                </span>
              </div>
              <span className="hidden sm:block text-[10px] font-mono uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                Corporate Filings &amp; Earnings
              </span>
            </div>
          </div>

          {/* Interactive Haptic Stage Stepper on Desktop */}
          <nav
            aria-label="Public navigation"
            className="hidden md:flex items-center gap-1 p-1 rounded-full bg-slate-100/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shrink-0"
          >
            {LANDING_STAGES.map((stage, idx) => {
              const isCurrent = activeStageIdx === idx;
              return (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => jumpToStage(idx)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                    isCurrent
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs ring-1 ring-emerald-500/30'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-bold tabular-nums">
                    {stage.num}
                  </span>
                  <span>{stage.label}</span>
                </button>
              );
            })}
            <a
              href="/results-calendar"
              onClick={e => handleGatedDestination(e, 'results-calendar')}
              className="px-3 py-1.5 rounded-full text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors inline-flex items-center gap-1.5"
            >
              <span>Calendar</span>
            </a>
          </nav>

          {/* Right Controls: Theme + Unclipped Material 3 Sign In */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <button
              type="button"
              onPointerDown={triggerTapHaptic}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800 transition-all active:scale-[0.94] cursor-pointer shrink-0"
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            {/* Google Material Design 3 (M3) Filled Button for Sign In */}
            <button
              type="button"
              onPointerDown={triggerTapHaptic}
              onClick={() => (onSignIn ? onSignIn() : onEnterTerminal())}
              data-testid="landing-google-m3-signin"
              className="group relative h-9 sm:h-10 pl-2 pr-3.5 sm:pl-2.5 sm:pr-4 rounded-full bg-[#0b57d0] hover:bg-[#0842a0] active:bg-[#062e6f] dark:bg-[#a8c7fa] dark:hover:bg-[#8ab4f8] dark:active:bg-[#669df6] text-white dark:text-[#062e6f] text-xs sm:text-sm font-semibold tracking-[0.01em] shadow-[0_1px_2px_rgba(0,0,0,0.24),0_3px_10px_rgba(11,87,208,0.30)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.45),0_2px_10px_rgba(168,199,250,0.25)] inline-flex items-center justify-center gap-1.5 sm:gap-2 transition-all duration-150 active:scale-[0.96] cursor-pointer overflow-hidden shrink-0 whitespace-nowrap"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-full bg-white/0 group-hover:bg-white/[0.08] group-active:bg-white/[0.14] dark:group-hover:bg-slate-950/[0.06] dark:group-active:bg-slate-950/[0.12] transition-colors"
              />
              <span className="relative z-10 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white flex items-center justify-center shadow-2xs shrink-0">
                <GoogleGLogo size={13} />
              </span>
              <span className="relative z-10">Sign In</span>
            </button>
          </div>
        </div>

        <MarketTickerTape bseLatency={bseHealth?.latency} />
      </header>

      <main className="relative z-10">
        {/* Mobile Stage Stepper Pill Bar */}
        <div className="md:hidden sticky top-14 z-40 px-3 py-2 bg-slate-50/90 dark:bg-[#060a10]/90 backdrop-blur-md border-b border-slate-200/70 dark:border-slate-800/70 flex items-center justify-between gap-1 overflow-x-auto no-scrollbar">
          {LANDING_STAGES.map((stage, idx) => {
            const isCurrent = activeStageIdx === idx;
            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => jumpToStage(idx)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all shrink-0 flex items-center gap-1 cursor-pointer active:scale-95 ${
                  isCurrent
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-white/85 dark:bg-slate-900/85 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-800'
                }`}
              >
                <span className="font-mono text-[10px] opacity-80 tabular-nums">{stage.num}</span>
                <span>{stage.label}</span>
              </button>
            );
          })}
        </div>

        {/* STAGE 01: Hero Section */}
        <section
          id="stage-overview"
          className="max-w-6xl mx-auto px-3 sm:px-6 pt-4 sm:pt-10 pb-6 sm:pb-10 scroll-mt-24"
        >
          <div
            className={`rounded-3xl border bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl p-4 sm:p-8 lg:p-10 transition-all duration-300 ${
              activeStageIdx === 0
                ? 'border-emerald-500/35 dark:border-emerald-400/30 shadow-[0_14px_40px_-16px_rgba(16,185,129,0.14)] dark:shadow-[0_20px_56px_-16px_rgba(0,0,0,0.65)]'
                : 'border-slate-200/85 dark:border-slate-800/85 shadow-xs'
            }`}
          >
            {/* Top Status & Official Exchange Logos Row (Single clean pill on mobile) */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[11px] sm:text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                <Radio size={13} className="text-emerald-500 animate-pulse shrink-0" />
                <span>BSE &amp; NSE Corporate Filings</span>
                <span className="inline-flex items-center -space-x-1 ml-0.5">
                  <CompanyLogo symbol="BSE" size={18} className="rounded-md p-0.5" />
                  <CompanyLogo symbol="NSE" size={18} className="rounded-md p-0.5" />
                </span>
              </div>

              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100/90 dark:bg-slate-800/85 border border-slate-200/80 dark:border-slate-700/80 text-[11px] font-medium text-slate-600 dark:text-slate-300 tabular-nums">
                <AiIntelligenceLogo size={13} className="text-sky-500 shrink-0" />
                <Sparkles size={12} className="text-sky-500 shrink-0" />
                <span>
                  Interactive live canvas
                  {touchRipplesCount > 0 ? ` · ${touchRipplesCount} touch pulses` : ' · Touch or move anywhere'}
                </span>
              </span>
            </div>

            <h1 className="text-[26px] sm:text-5xl lg:text-[54px] font-extrabold tracking-[-0.03em] text-slate-900 dark:text-white leading-[1.14] sm:leading-[1.06] font-display max-w-4xl">
              BSE filings and earnings, in one place
            </h1>

            <p className="mt-3 sm:mt-4 max-w-2xl text-[14px] sm:text-base lg:text-[17px] text-slate-600 dark:text-slate-300 leading-[1.6] font-normal">
              Track official exchange PDFs, upcoming board meetings, quarterly results, and source-linked AI summaries ({AI_ALLOWANCE_COPY} on Pro) without switching tabs.
            </p>

            {/* Primary Material 3 & Balanced Mobile Action Grid */}
            <div className="mt-5 sm:mt-7 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5 sm:gap-3">
              {/* Primary Material Design 3 Filled Button (Full width on mobile for easy thumb reach) */}
              <button
                type="button"
                onPointerDown={triggerTapHaptic}
                onClick={() => onEnterTerminal()}
                className="w-full sm:w-auto min-h-11 px-5 sm:px-6 py-2.5 rounded-full bg-[#0b57d0] hover:bg-[#0842a0] active:bg-[#062e6f] dark:bg-[#a8c7fa] dark:hover:bg-[#8ab4f8] dark:active:bg-[#669df6] text-white dark:text-[#062e6f] text-sm font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.24),0_4px_12px_rgba(11,87,208,0.28)] dark:shadow-[0_2px_10px_rgba(168,199,250,0.22)] inline-flex items-center justify-center gap-2.5 transition-all duration-150 active:scale-[0.97] cursor-pointer"
              >
                <span className="w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-2xs shrink-0">
                  <GoogleGLogo size={14} />
                </span>
                <span>Open Terminal</span>
                <ArrowRight size={16} />
              </button>

              {/* Secondary Quick-Actions: Clean 2-column grid on mobile, inline pills on desktop */}
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-3">
                <a
                  href="/results-calendar"
                  onClick={e => handleGatedDestination(e, 'results-calendar')}
                  className="min-h-11 inline-flex items-center justify-center sm:justify-start gap-2 px-3 sm:px-4 py-2 rounded-2xl sm:rounded-full border border-slate-300/90 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs sm:text-sm font-semibold shadow-2xs transition-all active:scale-[0.97]"
                >
                  <CalendarDateBadge3D month="NOV" date="17" size="icon" />
                  <span>Earnings calendar</span>
                </a>

                <button
                  type="button"
                  onClick={e => handleGatedDestination(e, 'watchlist')}
                  className="min-h-11 inline-flex items-center justify-center sm:justify-start gap-2 px-3 sm:px-4 py-2 rounded-2xl sm:rounded-full border border-slate-200/90 dark:border-slate-700/90 bg-white/95 dark:bg-slate-900/95 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs sm:text-sm font-semibold shadow-2xs transition-all active:scale-[0.97] cursor-pointer"
                >
                  <WatchlistsIcon className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
                  <span>Watchlist</span>
                </button>

                <a
                  href="/companies"
                  onClick={e => handleGatedDestination(e, 'companies')}
                  className="col-span-2 sm:col-span-1 min-h-11 inline-flex items-center justify-center sm:justify-start gap-2.5 px-3.5 sm:px-4 py-2 rounded-2xl sm:rounded-full border border-slate-200/90 dark:border-slate-800 bg-slate-100/90 dark:bg-slate-800/80 hover:bg-slate-200/75 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold transition-all active:scale-[0.97]"
                >
                  <span className="inline-flex items-center -space-x-1.5">
                    <CompanyLogo symbol="RELIANCE" size={20} className="rounded-md p-0.5" />
                    <CompanyLogo symbol="TCS" size={20} className="rounded-md p-0.5" />
                    <CompanyLogo symbol="HDFCBANK" size={20} className="rounded-md p-0.5" />
                  </span>
                  <span>Company profiles</span>
                </a>
              </div>
            </div>

            {/* Expandable Company Cards Section:
                - Default: Logo + Full Company Name + Short Info (NO scrip number, NO truncated names)
                - On Click: Card expands inline to reveal BSE Scrip Code, Exchange status, and Dossier action */}
            <div className="mt-6 sm:mt-8 pt-5 border-t border-slate-200/80 dark:border-slate-800/80">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-3.5">
                <div className="flex items-center gap-2">
                  <Building2 size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-display">
                    Major Listed Companies
                  </h2>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Tap any company card to expand its filing status &amp; scrip code
                </span>
              </div>

              <div className="grid grid-cols-1 min-[460px]:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
                {FEATURED_COMPANIES.map(company => {
                  const isExpanded = expandedCompanySymbol === company.symbol;
                  return (
                    <div
                      key={company.symbol}
                      className={`rounded-2xl border transition-all duration-200 ${
                        isExpanded
                          ? 'min-[460px]:col-span-2 bg-white dark:bg-slate-900 border-emerald-500/60 dark:border-emerald-400/60 ring-2 ring-emerald-500/15 shadow-md p-3.5 sm:p-4'
                          : 'bg-slate-50/95 dark:bg-slate-950/65 border-slate-200/85 dark:border-slate-800/85 hover:border-emerald-500/40 dark:hover:border-emerald-400/40 hover:bg-white dark:hover:bg-slate-900 p-2.5 sm:p-3'
                      }`}
                    >
                      <button
                        type="button"
                        data-testid={`landing-company-card-${company.symbol}`}
                        aria-expanded={isExpanded}
                        onPointerDown={triggerTapHaptic}
                        onClick={() =>
                          setExpandedCompanySymbol(prev =>
                            prev === company.symbol ? null : company.symbol
                          )
                        }
                        className="w-full text-left flex items-center justify-between gap-2.5 cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                          <CompanyLogo
                            symbol={company.symbol}
                            size={isExpanded ? 42 : 36}
                            className="shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            {/* Full Company Name — never truncated to RE... or HD... */}
                            <div className="text-[13.5px] sm:text-sm font-bold text-slate-900 dark:text-white leading-snug">
                              {company.name}
                            </div>
                            <div className="mt-0.5 text-[11.5px] sm:text-xs text-slate-500 dark:text-slate-400 leading-snug">
                              {company.shortInfo}
                            </div>
                          </div>
                        </div>

                        <ChevronDown
                          size={16}
                          className={`text-slate-400 shrink-0 transition-transform duration-200 ${
                            isExpanded ? 'rotate-180 text-emerald-500' : ''
                          }`}
                        />
                      </button>

                      {/* Expanded Card View: Reveals Ticker, Board Outcome Headline, BSE Scrip Number, Details, and Open Dossier Button */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-slate-200/80 dark:border-slate-800/80 space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {company.symbol} · {company.shortInfo}
                            </span>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                                <span>BSE Scrip: {company.code}</span>
                              </span>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-sky-500/10 text-[11px] font-semibold text-sky-700 dark:text-sky-300">
                                {company.exchange}
                              </span>
                            </div>
                          </div>

                          <p className="text-xs sm:text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed">
                            {company.detailSummary}
                          </p>

                          <div className="flex items-center justify-between gap-2 pt-0.5">
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              Official PDF + AI Summary
                            </span>
                            <button
                              type="button"
                              onPointerDown={triggerTapHaptic}
                              onClick={() => {
                                if (onSelectCompany) onSelectCompany(company.symbol);
                                else onEnterTerminal('announcements');
                              }}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0b57d0] dark:bg-[#a8c7fa] text-white dark:text-[#062e6f] text-xs font-bold shadow-xs hover:opacity-95 transition-all cursor-pointer active:scale-95"
                            >
                              <span>Open {company.symbol} Dossier</span>
                              <ArrowUpRight size={14} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* STAGE 02: Expandable Interactive Preview Section (Calendar + Filing Analysis) */}
        <div
          id="stage-preview"
          className="px-3 sm:px-6 max-w-6xl mx-auto scroll-mt-24"
        >
          <details
            onToggle={event => {
              const nextOpen = event.currentTarget.open;
              setShowExamples(nextOpen);
              if (hasInteractedRef.current) {
                triggerStageHaptic(1);
              }
            }}
            className={`group rounded-3xl border bg-white/90 dark:bg-slate-900/85 backdrop-blur-xl overflow-hidden transition-all duration-300 ${
              activeStageIdx === 1 || showExamples
                ? 'border-emerald-500/40 dark:border-emerald-400/35 shadow-lg'
                : 'border-slate-200/90 dark:border-slate-800/90 shadow-xs'
            }`}
          >
            <summary
              onMouseEnter={preloadExamples}
              onTouchStart={preloadExamples}
              onFocus={preloadExamples}
              onPointerDown={triggerTapHaptic}
              className="min-h-14 cursor-pointer px-4 sm:px-6 py-3.5 text-sm font-semibold flex items-center justify-between gap-3 list-none [&::-webkit-details-marker]:hidden hover:bg-slate-100/65 dark:hover:bg-slate-800/55 transition-colors select-none"
            >
              <span className="inline-flex items-center gap-2.5 sm:gap-3 text-slate-900 dark:text-white font-bold min-w-0">
                <CalendarDateBadge3D month="OCT" date="28" size="icon" />
                <AiSummariesIcon className="w-6 h-6 sm:w-7 sm:h-7 -ml-1.5 shrink-0" />
                <span className="text-[13px] sm:text-sm leading-snug">
                  Preview the calendar and filing analysis
                </span>
              </span>

              <span className="inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 shrink-0">
                <span className="hidden sm:inline-flex items-center -space-x-1.5 mr-1">
                  <CompanyLogo symbol="RELIANCE" size={22} className="rounded-md p-0.5" />
                  <CompanyLogo symbol="TCS" size={22} className="rounded-md p-0.5" />
                  <CompanyLogo symbol="HDFCBANK" size={22} className="rounded-md p-0.5" />
                  <CompanyLogo symbol="INFY" size={22} className="rounded-md p-0.5" />
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold">
                  <span>{showExamples ? 'Hide' : 'Expand'}</span>
                  <ChevronDown
                    size={14}
                    className="transition-transform duration-200 group-open:rotate-180"
                  />
                </span>
              </span>
            </summary>

            {showExamples &&
              (Examples ? (
                <div className="border-t border-slate-200/80 dark:border-slate-800/80">
                  <Examples onEnterTerminal={onEnterTerminal} />
                </div>
              ) : exampleError ? (
                <div className="p-5 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-600 dark:text-slate-300">
                    Preview could not be loaded right now.
                  </span>
                  <button
                    type="button"
                    onPointerDown={triggerTapHaptic}
                    className="min-h-10 px-4 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold cursor-pointer"
                    onClick={() => {
                      setExampleError(false);
                      void loadExamplesModule()
                        .then(comp => setExamples(() => comp))
                        .catch(() => setExampleError(true));
                    }}
                  >
                    Retry preview
                  </button>
                </div>
              ) : (
                <div
                  role="status"
                  className="p-6 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300"
                >
                  <span className="w-4 h-4 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin shrink-0" />
                  <span>Loading preview…</span>
                </div>
              ))}
          </details>
        </div>

        {/* STAGE 03: Core Capabilities Bento Grid */}
        <div id="stage-features" className="scroll-mt-20">
          <CoreCapabilitiesBento onEnterTerminal={onEnterTerminal} />
        </div>

        {/* STAGE 04: Pricing Section */}
        <section
          id="stage-pricing"
          aria-labelledby="pricing-heading"
          className="py-8 sm:py-14 px-3 sm:px-6 max-w-6xl mx-auto scroll-mt-20"
        >
          <div id="pricing" className="mb-6 sm:mb-8">
            <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
              Stage 04 · Transparent Access Tiers
            </span>
            <h2
              id="pricing-heading"
              className="mt-1 text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-[-0.025em] font-display"
            >
              Simple, transparent pricing
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              7-day Pro trial on sign-up. No auto-debit or recurring charge.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
            <div className="lg:col-span-4 rounded-3xl border border-slate-200/90 dark:border-slate-800/90 bg-white/90 dark:bg-slate-900/80 backdrop-blur-md p-5 sm:p-6 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-display">
                  Free Forever
                </h3>
                <BseNexusLogo size="xs" />
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white my-2.5 sm:my-3 font-mono tabular-nums">
                ₹0
              </div>
              <ul className="space-y-2.5 mb-5 sm:mb-6">
                {FREE_TIER_FEATURES.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-xs sm:text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed"
                  >
                    <Check size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onPointerDown={triggerTapHaptic}
                onClick={() => onEnterTerminal()}
                className="w-full min-h-11 rounded-full border border-slate-300 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800/80 hover:bg-slate-200/80 dark:hover:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white transition-all active:scale-[0.97] cursor-pointer"
              >
                Start Free
              </button>
            </div>

            <div className="lg:col-span-8 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                {PRO_PLAN_LIST.map(plan => (
                  <PlanCard
                    key={plan.id}
                    title={plan.label}
                    price={String(plan.price)}
                    wasPrice={plan.wasPrice ? String(plan.wasPrice) : undefined}
                    priceSuffix={`${plan.days} days`}
                    sub={plan.sub}
                    tag={plan.tag}
                    selectable
                    selected={selectedLandingPlan === plan.id}
                    onSelect={() => {
                      triggerTapHaptic();
                      setSelectedLandingPlan(plan.id);
                    }}
                  />
                ))}
              </div>

              <PlanCard
                title={activePlan.label}
                subtitle="Full Indian corporate intelligence terminal access"
                price={String(activePlan.price)}
                wasPrice={activePlan.wasPrice ? String(activePlan.wasPrice) : undefined}
                priceSuffix={`${activePlan.days} days`}
                sub={activePlan.sub}
                tag={activePlan.tag}
                features={[...PRO_TIER_FEATURES]}
                ctaLabel="Start 7-Day Free Trial"
                onCta={() => {
                  triggerTapHaptic();
                  onEnterTerminal();
                }}
              />
            </div>
          </div>
        </section>

        <CommunitySocialBanner />
      </main>

      <LandingFooterAbout onEnterTerminal={onEnterTerminal} />
    </div>
  );
};
