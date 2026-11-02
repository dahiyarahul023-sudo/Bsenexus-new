import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { 
  BarChart3, Sparkles, TrendingUp, TrendingDown, ArrowUpRight, 
  ChevronRight, ChevronLeft, FileText, CheckCircle2, Eye, ShieldCheck,
  Building2, Layers
} from 'lucide-react';
import { CompanyLogo, type CompanySymbol } from './CompanyLogos';
import { springStandard, springSnappy } from '../../utils/motionTokens';

interface ResultsScrollDeckProps {
  onEnterTerminal: (tab?: string) => void;
}

interface QuarterResultCard {
  symbol: CompanySymbol;
  name: string;
  quarter: string;
  revenue: string;
  revenueYoY: string;
  revenueTrend: 'up' | 'down';
  pat: string;
  patYoY: string;
  patTrend: 'up' | 'down';
  ebitdaMargin: string;
  marginChange: string;
  eps: string;
  aiExecutiveSummary: string;
  pdfPages: string;
  filingTime: string;
}

const QUARTER_RESULTS: QuarterResultCard[] = [
  {
    symbol: 'TCS',
    name: 'Tata Consultancy Services',
    quarter: 'Q1 FY27',
    revenue: '₹62,613 Cr',
    revenueYoY: '+5.4%',
    revenueTrend: 'up',
    pat: '₹12,040 Cr',
    patYoY: '+8.7%',
    patTrend: 'up',
    ebitdaMargin: '24.1%',
    marginChange: '+110 bps',
    eps: '₹33.20',
    aiExecutiveSummary: 'Operating margin expanded 110 bps to 24.1% on cloud transformation and AI-led deal migrations. Order book total contract value stood robust at $8.3 Billion.',
    pdfPages: '42 Pages',
    filingTime: 'Today, 11:24 AM'
  },
  {
    symbol: 'RELIANCE',
    name: 'Reliance Industries',
    quarter: 'Q1 FY27',
    revenue: '₹2,48,200 Cr',
    revenueYoY: '+9.8%',
    revenueTrend: 'up',
    pat: '₹19,650 Cr',
    patYoY: '+11.2%',
    patTrend: 'up',
    ebitdaMargin: '17.6%',
    marginChange: '+60 bps',
    eps: '₹29.08',
    aiExecutiveSummary: 'Jio 5G subscriber base crossed 500M milestone with ARPU scaling to ₹198/mo. Retail footfall expanded 18% with steady O2C downstream margins.',
    pdfPages: '86 Pages',
    filingTime: 'Yesterday, 04:30 PM'
  },
  {
    symbol: 'INFY',
    name: 'Infosys Limited',
    quarter: 'Q1 FY27',
    revenue: '₹40,890 Cr',
    revenueYoY: '+7.8%',
    revenueTrend: 'up',
    pat: '₹6,840 Cr',
    patYoY: '+9.4%',
    patTrend: 'up',
    ebitdaMargin: '21.5%',
    marginChange: '+80 bps',
    eps: '₹16.40',
    aiExecutiveSummary: 'Generative AI Topaz enterprise deals contributed $380M in large contract wins. Attrition stabilized at 12.1% with operating margin expansion.',
    pdfPages: '54 Pages',
    filingTime: '2 days ago'
  },
  {
    symbol: 'HDFCBANK',
    name: 'HDFC Bank Limited',
    quarter: 'Q1 FY27',
    revenue: '₹84,200 Cr',
    revenueYoY: '+16.2%',
    revenueTrend: 'up',
    pat: '₹16,810 Cr',
    patYoY: '+18.5%',
    patTrend: 'up',
    ebitdaMargin: '3.6% NIM',
    marginChange: '+12 bps',
    eps: '₹22.10',
    aiExecutiveSummary: 'Post-merger loan-to-deposit ratio calibrated downward to 98%. Net Interest Margin expanded to 3.62% with gross NPA stable at 1.24%.',
    pdfPages: '68 Pages',
    filingTime: '3 days ago'
  }
];

export function ResultsScrollDeck({ onEnterTerminal }: ResultsScrollDeckProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const reducedMotion = useReducedMotion();

  const nextSlide = () => {
    setActiveIndex((prev) => (prev + 1) % QUARTER_RESULTS.length);
  };

  const prevSlide = () => {
    setActiveIndex((prev) => (prev - 1 + QUARTER_RESULTS.length) % QUARTER_RESULTS.length);
  };

  // Subtle auto-advance when not hovered
  useEffect(() => {
    if (!isAutoPlaying) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % QUARTER_RESULTS.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [isAutoPlaying]);

  const current = QUARTER_RESULTS[activeIndex];

  return (
    <section 
      className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
      onMouseEnter={() => setIsAutoPlaying(false)}
      onMouseLeave={() => setIsAutoPlaying(true)}
      aria-label="Quarterly Results Analysis Showcase"
    >
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-4">
          <BarChart3 className="w-3.5 h-3.5 text-emerald-500" />
          <span>Interactive Quarterly Earnings Deck</span>
        </div>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.15]">
          80-page financial disclosure.<br />
          <span className="bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 bg-clip-text text-transparent">
            Condensed into 4 key YoY numbers in seconds.
          </span>
        </h2>
        <p className="mt-4 text-base sm:text-lg text-slate-600 dark:text-slate-400 font-normal leading-relaxed">
          Stop digging through complex footnotes and unaudited financial schedules. 
          BSE Nexus extracts verified Revenue, PAT, and EBITDA margins with immediate year-over-year comps.
        </p>

        {/* Company Quick-Select Tabs */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-8">
          {QUARTER_RESULTS.map((item, idx) => {
            const isActive = activeIndex === idx;
            return (
              <button
                key={item.symbol}
                onClick={() => setActiveIndex(idx)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 border ${
                  isActive
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 shadow-sm'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <CompanyLogo symbol={item.symbol} size={24} />
                <span>{item.symbol}</span>
                <span className="text-[10px] font-mono opacity-60">· {item.quarter}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Results Presentation Card */}
      <div className="relative max-w-4xl mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.symbol}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.98 }}
            transition={springStandard}
            className="rounded-3xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-10 shadow-2xl relative overflow-hidden"
          >
            {/* Top metadata row */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <CompanyLogo symbol={current.symbol} size={36} />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">{current.name}</h3>
                    <span className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/20">
                      {current.quarter}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                    <span>{current.filingTime}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1 font-mono text-slate-400">
                      <FileText className="w-3 h-3" />
                      {current.pdfPages}
                    </span>
                  </div>
                </div>
              </div>

              {/* Navigation arrows */}
              <div className="flex items-center gap-2">
                <button
                  onClick={prevSlide}
                  aria-label="Previous company"
                  className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono text-slate-400 px-1">
                  {activeIndex + 1} / {QUARTER_RESULTS.length}
                </span>
                <button
                  onClick={nextSlide}
                  aria-label="Next company"
                  className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 4 Essential Financial Metrics Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 my-6">
              {/* Metric 1: Revenue */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800/80">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Total Revenue</span>
                <span className="block text-lg sm:text-2xl font-black text-slate-900 dark:text-white tabular-nums">{current.revenue}</span>
                <div className="flex items-center gap-1 mt-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>{current.revenueYoY} YoY</span>
                </div>
              </div>

              {/* Metric 2: PAT */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800/80">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Net Profit (PAT)</span>
                <span className="block text-lg sm:text-2xl font-black text-slate-900 dark:text-white tabular-nums">{current.pat}</span>
                <div className="flex items-center gap-1 mt-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>{current.patYoY} YoY</span>
                </div>
              </div>

              {/* Metric 3: EBITDA Margin */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800/80">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Operating Margin</span>
                <span className="block text-lg sm:text-2xl font-black text-slate-900 dark:text-white tabular-nums">{current.ebitdaMargin}</span>
                <div className="flex items-center gap-1 mt-1 text-xs font-bold text-sky-600 dark:text-sky-400">
                  <span>{current.marginChange}</span>
                </div>
              </div>

              {/* Metric 4: Diluted EPS */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800/80">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Basic / Diluted EPS</span>
                <span className="block text-lg sm:text-2xl font-black text-slate-900 dark:text-white tabular-nums">{current.eps}</span>
                <div className="flex items-center gap-1 mt-1 text-xs font-semibold text-slate-500">
                  <span>Face Value ₹1.00</span>
                </div>
              </div>
            </div>

            {/* AI Executive Summary Banner */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-sky-500/5 border border-emerald-500/30 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                <Sparkles className="w-4 h-4 text-emerald-500" />
                <span>AI Operating Takeaway</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                {current.aiExecutiveSummary}
              </p>
            </div>

            {/* Bottom CTA */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 text-xs">
              <span className="text-slate-500">
                Sample interactive extraction • Live terminal covers all BSE-listed entities
              </span>
              <button
                onClick={() => onEnterTerminal('dashboard')}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-semibold transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <span>Track Live Results Feed</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
