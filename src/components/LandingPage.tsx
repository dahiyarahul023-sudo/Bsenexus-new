import { AI_ALLOWANCE_COPY } from '../shared/productFacts';
import React, { useState } from 'react';
import { Terminal, ArrowRight, Sun, Moon, LogIn } from 'lucide-react';
import { BseNexusLogo } from './ui/BseNexusLogo';
import { MarketTickerTape } from './ui/MarketTickerTape';
import { UpcomingCatalystsGrid } from './landing/UpcomingCatalystsGrid';
import { ResultsScrollDeck } from './landing/ResultsScrollDeck';
import { CoreCapabilitiesBento } from './landing/CoreCapabilitiesBento';
import { CommunitySocialBanner } from './landing/CommunitySocialBanner';
import { LandingFooterAbout } from './landing/LandingFooterAbout';
import { PRO_PLAN_LIST, getLowestPlanPrice } from '../config/plans';
import { PlanCard } from './ui/PlanCard';
import { AiIntelligenceLogo } from './ui/AiIntelligenceLogo';

interface LandingPageProps {
  onEnterTerminal: (tab?: string) => void;
  onSignIn?: () => void;
  theme: string;
  setTheme: (theme: string) => void;
  bseHealth?: { status: string; latency?: number };
  telegramHealth?: { status: string; latency?: number };
}

export function LandingPage({
  onEnterTerminal,
  onSignIn,
  theme,
  setTheme,
  bseHealth,
  telegramHealth
}: LandingPageProps) {
  const [showExamples, setShowExamples] = useState(false);
  const lowestPrice = getLowestPlanPrice();
  const proWeekly = PRO_PLAN_LIST.find(p => p.id === 'pro_weekly') || PRO_PLAN_LIST[0];
  const proMonthly = PRO_PLAN_LIST.find(p => p.id === 'pro_monthly') || PRO_PLAN_LIST[1];
  const proAnnual = PRO_PLAN_LIST.find(p => p.id === 'pro_yearly') || PRO_PLAN_LIST[2];

  const handleOpenAuth = () => {
    if (onSignIn) {
      onSignIn();
    } else {
      onEnterTerminal();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#080d1a] text-slate-900 dark:text-slate-100 font-sans selection:bg-sky-500/20 selection:text-sky-600 dark:selection:text-sky-300 transition-colors relative overflow-x-hidden">
      
      {/* 1. TOP MARKET TICKER TAPE (Single-row hardware accelerated, replaces 30-stock clutter) */}
      <div className="w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-950/70 backdrop-blur-md sticky top-0 z-40">
        <MarketTickerTape />
      </div>

      {/* 2. TRANSLUCENT APPLE-STYLE FLOATING NAV */}
      <header className="sticky top-[37px] z-30 w-full max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-2 sm:py-3">
        <div className="flex items-center justify-between px-3 sm:px-5 py-2.5 sm:py-3 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 shadow-sm transition-all">
          {/* Brand lockup */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <BseNexusLogo size="sm" className="w-7 h-7 sm:w-9 sm:h-9" />
            <div className="flex flex-col">
              <span className="text-sm sm:text-base font-black tracking-tight text-slate-900 dark:text-white leading-tight font-display">
                BSE<span className="text-emerald-500">NEXUS</span>
              </span>
              <span className="text-[9px] sm:text-[10px] hidden sm:block text-slate-500 font-mono -mt-0.5">
                EXCHANGE INTELLIGENCE
              </span>
            </div>
          </div>

          {/* Quick status & links */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <div className="hidden md:flex items-center gap-2 text-xs font-mono text-slate-500 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>BSE FILINGS</span>
            </div>

            <a
              href="/plugin"
              className="hidden md:inline-flex text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 transition-colors px-2 py-1"
            >
              AI Plugin
            </a>

            {/* Theme switcher */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-1.5 sm:p-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0 cursor-pointer"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            </button>

            {/* Theme-Matched Sign In Button */}
            <button
              type="button"
              onClick={handleOpenAuth}
              className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl border border-sky-500/30 dark:border-sky-400/30 hover:border-sky-500/50 bg-sky-500/10 dark:bg-sky-500/15 hover:bg-sky-500/25 text-sky-600 dark:text-sky-300 text-xs sm:text-sm font-bold shadow-2xs hover:shadow-sm transition-all flex items-center gap-1 sm:gap-1.5 cursor-pointer shrink-0"
              title="Sign in to your Bsenexus account"
            >
              <LogIn className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
              <span>Sign In</span>
            </button>

            {/* Primary Action Button */}
            <button
              onClick={() => onEnterTerminal('dashboard')}
              className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs sm:text-sm font-bold shadow-sm transition-all flex items-center gap-1 sm:gap-1.5 cursor-pointer shrink-0"
            >
              <Terminal className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Open terminal</span>
            </button>
          </div>
        </div>
      </header>

      {/* 3. SLEEK HERO SECTION WITH WIDE SPACIOUS RHYTHM */}
      <section className="relative pt-9 sm:pt-16 pb-8 sm:pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-gradient-to-r from-sky-500/10 via-blue-500/15 to-emerald-500/10 blur-[130px] pointer-events-none -z-10" />

        <div className="max-w-4xl mx-auto space-y-4">
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
            BSE filings and earnings, in one place
          </h1>

          {/* Lead paragraph */}
          <p className="max-w-2xl mx-auto text-sm sm:text-lg text-slate-600 dark:text-slate-400 font-normal leading-relaxed">
            Follow exchange disclosures, watchlist alerts and quarterly results for Indian equities.
          </p>

          {/* Primary & Secondary Call to Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-2">
            <button
              type="button"
              onClick={() => onEnterTerminal('dashboard')}
              className="w-full sm:w-auto min-h-11 px-6 py-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Open terminal</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <a href="/results-calendar"
              className="w-full sm:w-auto min-h-11 px-6 py-3 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-900 font-semibold text-sm flex items-center justify-center gap-2">
              Earnings calendar
            </a>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">Sign in or continue as a guest to open the terminal.</p>
        </div>
      </section>

      <details onToggle={event => setShowExamples(event.currentTarget.open)} className="mx-4 sm:mx-auto max-w-5xl rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold">Preview the calendar and filing analysis</summary>
        {showExamples && <>
          <UpcomingCatalystsGrid onEnterTerminal={onEnterTerminal} />
          <ResultsScrollDeck onEnterTerminal={onEnterTerminal} />
        </>}
      </details>

      <CoreCapabilitiesBento />

      {/* 7. TRANSPARENT PRO PRICING OVERVIEW (Distinct Tiers, Zero 299 Duplicates) */}
      <section className="relative py-9 sm:py-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-200/80 dark:border-slate-800/80" aria-label="Subscription Plans">
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-4">
            <AiIntelligenceLogo size={16} />
            <span>Transparent Access</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-bold tracking-tight">Plans and pricing</h2>
          <p className="mt-2 text-sm font-semibold text-teal-700 dark:text-teal-300">Starting at ₹{lowestPrice}</p>
          <p className="mt-4 text-sm sm:text-base text-slate-600 dark:text-slate-400 font-normal leading-relaxed">
            Every Pro plan includes personal Telegram alerts, {AI_ALLOWANCE_COPY.toLowerCase()}, and historical disclosure research.
          </p>
        </div>

        {/* Distinct 3-Tier Pricing Comparison Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto">
          {/* Tier 1: Weekly Pro */}
          <PlanCard
            title={proWeekly.label}
            subtitle={proWeekly.sub}
            price={String(proWeekly.price)}
            priceSuffix={`/${proWeekly.days} days`}
            features={[
              'Personal Telegram filing alerts',
              AI_ALLOWANCE_COPY,
              '7 days of Pro access'
            ]}
            ctaLabel="Get Weekly Pass"
            onCta={() => onEnterTerminal('plans')}
            className="bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800/80 shadow-md hover:shadow-xl transition-all"
          />

          {/* Tier 2: Monthly Pro (Most Popular) */}
          <PlanCard
            title={proMonthly.label}
            subtitle={proMonthly.sub}
            price={String(proMonthly.price)}
            priceSuffix={`/${proMonthly.days} days`}
            wasPrice={proMonthly.wasPrice ? String(proMonthly.wasPrice) : undefined}
            tag={proMonthly.tag || 'Most Popular'}
            features={[
              'Personal Telegram filing alerts',
              AI_ALLOWANCE_COPY,
              'Unlimited custom watchlist tracking',
              'LODR Regulation 30 & Board Meeting alerts'
            ]}
            ctaLabel="Get Monthly Pro"
            onCta={() => onEnterTerminal('plans')}
            className="bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl border border-sky-500/50 dark:border-sky-500/50 ring-2 ring-sky-500/30 shadow-lg hover:shadow-xl transition-all"
          />

          {/* Tier 3: Annual Pro (Best Value) */}
          <PlanCard
            title={proAnnual.label}
            subtitle={proAnnual.sub}
            price={String(proAnnual.price)}
            priceSuffix={`/${proAnnual.days} days`}
            wasPrice={proAnnual.wasPrice ? String(proAnnual.wasPrice) : undefined}
            tag={proAnnual.tag || 'Best Value'}
            features={[
              'All Pro Monthly capabilities included',
              AI_ALLOWANCE_COPY,
              'Deep 5-year historical filings archive',
              'Direct API & custom bot access'
            ]}
            ctaLabel="Get Annual Pro"
            onCta={() => onEnterTerminal('plans')}
            className="bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl border border-emerald-500/50 dark:border-emerald-500/50 ring-2 ring-emerald-500/30 shadow-lg hover:shadow-xl transition-all"
          />
        </div>
      </section>

      {/* 8. THEME-MATCHED COMMUNITY & OFFICIAL SOCIAL CHANNELS */}
      <CommunitySocialBanner />

      {/* 9. CONSOLIDATED AUTHORITATIVE ABOUT, FAQ & QUIET FOOTER */}
      <LandingFooterAbout onEnterTerminal={onEnterTerminal} />

    </div>
  );
}
