import { CalendarDateBadge3D } from './ui/CalendarDateBadge3D';
import React, { useState } from 'react';
import { 
  Zap, Send, Shield, Terminal, ArrowRight, ArrowUpRight, 
  Sparkles, CheckCircle2, ChevronRight, Sun, Moon, Lock, 
  ExternalLink, BarChart3, Clock, Filter, Eye, Activity,
  LogIn, User,
  Calendar as CalendarIcon
} from 'lucide-react';
import { BseNexusLogo } from './ui/BseNexusLogo';
import { MarketClock } from './ui/MarketClock';
import { MarketTickerTape } from './ui/MarketTickerTape';
import { UpcomingCatalystsGrid } from './landing/UpcomingCatalystsGrid';
import { ResultsScrollDeck } from './landing/ResultsScrollDeck';
import { CoreCapabilitiesBento } from './landing/CoreCapabilitiesBento';
import { CommunitySocialBanner } from './landing/CommunitySocialBanner';
import { LandingFooterAbout } from './landing/LandingFooterAbout';
import { PRO_PLAN_LIST, getLowestPlanPrice } from '../config/plans';
import { PlanCard } from './ui/PlanCard';
import ParticleRibbons from './ui/ParticleRibbons';
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
      
      {/* Living Ambient Particle Canvas (flowing ribbons & cursor bloom) */}
      <ParticleRibbons />

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
              <span>BSE FEED 0.8s</span>
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
              className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-1 sm:gap-1.5 cursor-pointer shrink-0"
            >
              <Terminal className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">Launch</span> <span>Terminal</span>
            </button>
          </div>
        </div>
      </header>

      {/* 3. SLEEK HERO SECTION WITH WIDE SPACIOUS RHYTHM */}
      <section className="relative pt-16 sm:pt-24 pb-16 sm:pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-gradient-to-r from-sky-500/10 via-blue-500/15 to-emerald-500/10 blur-[130px] pointer-events-none -z-10" />

        <div className="max-w-4xl mx-auto space-y-6">
          {/* Subtle live indicator badge */}
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-full text-left bg-white/80 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/60 text-xs font-semibold text-slate-800 dark:text-slate-200 shadow-xs">
            <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-emerald-500" />
            <span>Sub-Second Exchange Disclosures &amp; Earnings Intelligence</span>
          </div>

          {/* Master Headline (Apple typography: negative tracking, tight leading) */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 dark:text-white tracking-[-0.03em] leading-[1.12]">
            Real-time BSE filings.<br />
            <span className="bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Sub-second Telegram alerts.
            </span><br />
            Instant AI analysis.
          </h1>

          {/* Lead paragraph */}
          <p className="max-w-2xl mx-auto text-sm sm:text-lg text-slate-600 dark:text-slate-400 font-normal leading-relaxed">
            The ultra-low-latency market intelligence terminal for Indian equities. 
            Catch Regulation 30 announcements, quarterly results, and catalysts before they hit broker feeds.
          </p>

          {/* Primary & Secondary Call to Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-2">
            <button
              onClick={() => onEnterTerminal('dashboard')}
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-sky-500 hover:bg-sky-600 active:scale-98 text-white font-extrabold text-sm sm:text-base shadow-lg shadow-sky-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Open Live Feed Terminal</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => onEnterTerminal('results-calendar')}
              className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-white/90 dark:bg-slate-900/90 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-98 text-slate-900 dark:text-white border border-slate-200/90 dark:border-slate-800 font-bold text-sm sm:text-base shadow-xs transition-all flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <span aria-hidden="true"><CalendarDateBadge3D month="CAL" date="24" size="icon" /></span>
              <span>Explore Earnings Calendar</span>
            </button>
          </div>

          {/* Clear Member Sign In / Log In option */}
          <div className="pt-2 flex items-center justify-center gap-1.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            <span>Already have an account?</span>
            <button
              type="button"
              onClick={handleOpenAuth}
              className="font-bold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5 inline" />
              <span>Log in to your account &rarr;</span>
            </button>
          </div>

          {/* Clean trust statement with authentic brand marks */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs text-slate-500 font-medium">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Direct BSE regulatory connection</span>
            </span>

            {/* Authentic Telegram mark */}
            <span className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-[#2AABEE] to-[#229ED9] flex items-center justify-center shrink-0 shadow-xs">
                <svg viewBox="0 0 24 24" width={10} height={10} fill="white" aria-hidden="true">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                </svg>
              </div>
              <span className="font-semibold text-slate-700 dark:text-slate-300">Instant Telegram bot alerts</span>
            </span>

            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Zero clutter, no ad spam</span>
            </span>
          </div>
        </div>
      </section>

      {/* 4. EXPANSIVE MULTI-COMPANY CATALYSTS GRID (Wide spacing, rich agendas, zero sticky voids) */}
      <UpcomingCatalystsGrid onEnterTerminal={onEnterTerminal} />

      {/* 5. INTERACTIVE QUARTERLY RESULTS DECK (TCS, Reliance, Infosys, HDFC Bank) */}
      <ResultsScrollDeck onEnterTerminal={onEnterTerminal} />

      {/* 6. STREAMLINED 4-PILLAR BENTO GRID */}
      <CoreCapabilitiesBento onEnterTerminal={onEnterTerminal} />

      {/* 7. TRANSPARENT PRO PRICING OVERVIEW (Distinct Tiers, Zero 299 Duplicates) */}
      <section className="relative py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-200/80 dark:border-slate-800/80" aria-label="Subscription Plans">
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-4">
            <AiIntelligenceLogo size={16} />
            <span>Transparent Access</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.15]">
            Institutional speed.<br />
            <span className="bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 bg-clip-text text-transparent">
              Starting at just ₹{lowestPrice}
            </span>
          </h2>
          <p className="mt-4 text-sm sm:text-base text-slate-600 dark:text-slate-400 font-normal leading-relaxed">
            Every plan unlocks sub-second Telegram alerts, unlimited AI earnings breakdowns, and deep historical disclosure archives.
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
              'Sub-second Telegram push alerts',
              'AI Earnings & Concall PDF summaries',
              'Fast 7-day trial access'
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
              'Sub-second Telegram push alerts',
              'AI Earnings & Concall PDF summaries',
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
              'Priority sub-second Telegram pipeline',
              'Deep 5-year historical filings archive',
              'Direct API & custom bot access'
            ]}
            ctaLabel="Get Annual Pro (Save 40%)"
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
