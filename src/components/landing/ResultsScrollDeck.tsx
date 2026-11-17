import React, { useState, useEffect, useRef } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  ArrowUpRight,
  Layers,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface ResultShowcaseCard {
  id: string;
  symbol: string;
  companyName: string;
  scripCode: string;
  logoUrl: string;
  quarter: string;
  filingType: string;
  filingTime: string;
  sentiment: 'Bullish' | 'Strong Beat' | 'Resilient';
  headline: string;
  metrics: {
    label: string;
    value: string;
    yoy: string;
    qoq: string;
    positive: boolean;
  }[];
  aiTakeaways: string[];
  pdfPages: number;
}

const SHOWCASE_CARDS: ResultShowcaseCard[] = [
  {
    id: 'reliance-q2',
    symbol: 'RELIANCE',
    companyName: 'Reliance Industries Limited',
    scripCode: '500325',
    logoUrl: '/company-logos/reliance.svg',
    quarter: 'Q2 FY27 Consolidated',
    filingType: 'SEBI Reg 33 · Unaudited Financial Results',
    filingTime: 'Example filing · 48 pages',
    sentiment: 'Strong Beat',
    headline:
      'Record Jio & Retail operating leverage drives 14.2% YoY EBITDA expansion; O2C margins stabilize.',
    metrics: [
      { label: 'Revenue', value: '₹2,48,200 Cr', yoy: '+11.4% YoY', qoq: '+3.8% QoQ', positive: true },
      { label: 'Net Profit (PAT)', value: '₹21,940 Cr', yoy: '+16.8% YoY', qoq: '+6.2% QoQ', positive: true },
      { label: 'EBITDA', value: '₹46,180 Cr', yoy: '+14.2% YoY', qoq: '+4.9% QoQ', positive: true },
      { label: 'EBITDA Margin', value: '18.6%', yoy: '+45 bps YoY', qoq: '+20 bps QoQ', positive: true },
    ],
    aiTakeaways: [
      'Digital Services (Jio) ARPU rose to ₹204.5 with 5G subscriber additions accelerating across Tier-2 cities.',
      'Reliance Retail footfalls grew 19% YoY; operating EBITDA margin expanded 60 bps to 8.5%.',
      'Net debt-to-EBITDA improved to 0.58x following disciplined capex moderation in telecom rollout.',
    ],
    pdfPages: 48,
  },
  {
    id: 'tcs-q2',
    symbol: 'TCS',
    companyName: 'Tata Consultancy Services Ltd',
    scripCode: '532540',
    logoUrl: '/company-logos/tcs.svg',
    quarter: 'Q2 FY27 Consolidated',
    filingType: 'SEBI Reg 33 · Audited Quarterly Results',
    filingTime: 'Example filing · 34 pages',
    sentiment: 'Bullish',
    headline:
      'BFSI recovery in North America and $9.8B Order Book TCV power operating margin expansion to 25.4%.',
    metrics: [
      { label: 'Revenue', value: '₹64,980 Cr', yoy: '+7.9% YoY', qoq: '+2.6% QoQ', positive: true },
      { label: 'Net Profit (PAT)', value: '₹12,840 Cr', yoy: '+11.2% YoY', qoq: '+4.1% QoQ', positive: true },
      { label: 'Operating EBIT', value: '₹16,505 Cr', yoy: '+10.6% YoY', qoq: '+3.9% QoQ', positive: true },
      { label: 'Operating Margin', value: '25.4%', yoy: '+65 bps YoY', qoq: '+30 bps QoQ', positive: true },
    ],
    aiTakeaways: [
      'Total Contract Value (TCV) stood at $9.8 Billion with 3 mega-deals in AI-led cloud modernization.',
      'Interim dividend of ₹11.00 per equity share declared; cash conversion ratio exceeded 104% of PAT.',
      'LTM IT Services attrition cooled further to 11.8%, supporting utilization gains.',
    ],
    pdfPages: 34,
  },
  {
    id: 'hdfc-q2',
    symbol: 'HDFCBANK',
    companyName: 'HDFC Bank Limited',
    scripCode: '500180',
    logoUrl: '/company-logos/hdfc-bank.svg',
    quarter: 'Q2 FY27 Standalone',
    filingType: 'SEBI Reg 33 · Banking Disclosure & Pillar 3',
    filingTime: 'Example filing · 39 pages',
    sentiment: 'Resilient',
    headline:
      'CASA deposits surge ₹68,000 Cr QoQ while Gross NPA holds pristine at 1.24%; NIM expands 8 bps.',
    metrics: [
      { label: 'Net Interest Income', value: '₹31,420 Cr', yoy: '+13.8% YoY', qoq: '+3.4% QoQ', positive: true },
      { label: 'Net Profit (PAT)', value: '₹17,650 Cr', yoy: '+15.4% YoY', qoq: '+4.6% QoQ', positive: true },
      { label: 'Core NIM', value: '3.56%', yoy: '+10 bps YoY', qoq: '+8 bps QoQ', positive: true },
      { label: 'Gross NPA', value: '1.24%', yoy: '-10 bps YoY', qoq: '-6 bps QoQ', positive: true },
    ],
    aiTakeaways: [
      'Credit-Deposit (CD) ratio improved by 190 bps sequentially as retail term and CASA deposits outpaced loan growth.',
      'Provision Coverage Ratio (PCR) remains strong at 72.4% with contingent buffers intact.',
      'CRAR (Capital Adequacy Ratio) stands at 19.6% under Basel III norms.',
    ],
    pdfPages: 39,
  },
];

interface ResultsScrollDeckProps {
  onEnterTerminal: () => void;
}

export const ResultsScrollDeck: React.FC<ResultsScrollDeckProps> = ({ onEnterTerminal }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % SHOWCASE_CARDS.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [isPaused]);

  const activeCard = SHOWCASE_CARDS[activeIndex];

  const goPrev = () => {
    setIsPaused(true);
    setActiveIndex(prev => (prev - 1 + SHOWCASE_CARDS.length) % SHOWCASE_CARDS.length);
  };

  const goNext = () => {
    setIsPaused(true);
    setActiveIndex(prev => (prev + 1) % SHOWCASE_CARDS.length);
  };

  return (
    <section
      className="relative py-8 sm:py-12 px-3 sm:px-6 lg:px-8 overflow-hidden border-t border-slate-200/80 dark:border-slate-800/80"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onPointerDown={() => setIsPaused(true)}
      onTouchStart={e => {
        setIsPaused(true);
        touchStartX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={e => {
        if (touchStartX.current === null) return;
        const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
        const deltaX = endX - touchStartX.current;
        touchStartX.current = null;
        if (Math.abs(deltaX) > 42) {
          if (deltaX < 0) goNext();
          else goPrev();
        }
      }}
    >
      <div className="max-w-7xl mx-auto relative z-10">
        {/* Section Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 mb-7 sm:mb-9">
          <div className="max-w-2xl min-w-0">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-700 dark:text-sky-300 text-xs font-semibold mb-3 shadow-xs">
              <Layers size={13} className="text-sky-500 shrink-0" />
              <span>Demo · Quarterly Earnings Deck</span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight font-display">
              48-page exchange PDFs distilled into{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-600 via-emerald-500 to-indigo-600 dark:from-sky-400 dark:via-emerald-300 dark:to-indigo-400">
                structured financial intelligence.
              </span>
            </h2>
            <p className="mt-2.5 text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
              Example output showing how BSE Nexus extracts Revenue, PAT, EBITDA, YoY/QoQ deltas, and executive takeaways from a Reg 33 filing.
            </p>
          </div>

          {/* Company Switcher Pills + Prev/Next Controls */}
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
            {SHOWCASE_CARDS.map((card, idx) => {
              const isActive = idx === activeIndex;
              return (
                <button
                  key={card.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => {
                    setIsPaused(true);
                    setActiveIndex(idx);
                  }}
                  className={`min-h-10 flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-bold transition-all duration-150 active:scale-[0.97] cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                      : 'bg-slate-100/90 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/70 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                  }`}
                >
                  <img
                    src={card.logoUrl}
                    alt={card.symbol}
                    width={16}
                    height={16}
                    loading="lazy"
                    decoding="async"
                    className="w-4 h-4 object-contain rounded-xs shrink-0"
                    onError={e => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <span>{card.symbol}</span>
                </button>
              );
            })}

            <div className="inline-flex items-center gap-1 ml-1">
              <button
                type="button"
                onClick={goPrev}
                aria-label="Previous company filing example"
                className="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 inline-flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-[0.95] transition-all cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={goNext}
                aria-label="Next company filing example"
                className="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 inline-flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-[0.95] transition-all cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Main Showcase Deck Container */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-7 items-stretch">
          {/* Left Column: Raw PDF vs Structured Pipeline Visual */}
          <div className="lg:col-span-4 flex flex-col justify-between rounded-2xl bg-slate-50/90 dark:bg-slate-900/75 border border-slate-200/90 dark:border-slate-800/90 p-5 sm:p-6 shadow-xs min-w-0">
            <div>
              <div className="flex items-center justify-between gap-2 mb-5">
                <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                  Source Ingestion Pipeline
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Example Pipeline
                </span>
              </div>

              {/* Step 1: Raw BSE Filing */}
              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800/80 mb-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 shrink-0 mt-0.5">
                    <FileText size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        BSE_{activeCard.scripCode}_Q2FY27.pdf
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 shrink-0">
                        {activeCard.pdfPages}p
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {activeCard.filingType}
                    </p>
                    <div className="mt-1.5 flex items-center gap-1.5 text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 size={11} className="shrink-0" />
                      <span>{activeCard.filingTime}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Connector */}
              <div className="flex items-center justify-center my-1.5">
                <div className="h-5 w-px bg-gradient-to-b from-emerald-500/50 to-sky-500/50" />
              </div>

              {/* Step 2: Gemini Flash Extraction */}
              <div className="p-3.5 rounded-xl bg-gradient-to-br from-emerald-500/10 via-sky-500/5 to-indigo-500/10 border border-emerald-500/25">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0 shadow-xs">
                    <Sparkles size={17} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">
                      Structured Table &amp; Note Synthesis
                    </span>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                      Normalizes standalone vs. consolidated tables, auditor notes, and segment margins.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
                <span>Direct BSE PDF citation linked</span>
              </div>
              <button
                type="button"
                onClick={onEnterTerminal}
                className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <span>Try Live</span>
                <ArrowUpRight size={13} />
              </button>
            </div>
          </div>

          {/* Right Column: Animated Result Card Deck */}
          <div className="lg:col-span-8 min-w-0">
            <AnimatePresence mode="wait">
              <m.div
                key={activeCard.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
                className="h-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 p-5 sm:p-7 shadow-sm flex flex-col justify-between relative overflow-hidden min-w-0"
              >
                <div>
                  {/* Card Top Header */}
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-5 pb-4 border-b border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 p-2 flex items-center justify-center shrink-0">
                        <img
                          src={activeCard.logoUrl}
                          alt={activeCard.symbol}
                          width={32}
                          height={32}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-contain"
                          onError={e => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight break-words">
                            {activeCard.companyName}
                          </h3>
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300">
                            BSE: {activeCard.scripCode}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                          {activeCard.quarter} · {activeCard.filingType}
                        </p>
                      </div>
                    </div>

                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-xs font-bold shrink-0">
                      <TrendingUp size={13} />
                      {activeCard.sentiment}
                    </span>
                  </div>

                  {/* Headline Summary */}
                  <p className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug mb-5">
                    “{activeCard.headline}”
                  </p>

                  {/* 4-Metric Financial Grid (Responsive across 360px, 768px, 1440px) */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5 mb-6">
                    {activeCard.metrics.map(mItem => (
                      <div
                        key={mItem.label}
                        className="p-3 sm:p-3.5 rounded-xl bg-slate-50/90 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800/80 min-w-0"
                      >
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block truncate">
                          {mItem.label}
                        </span>
                        <span className="text-sm sm:text-base xl:text-lg font-extrabold text-slate-900 dark:text-white mt-1 block font-mono tracking-tight tabular-nums break-words">
                          {mItem.value}
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded font-mono">
                            {mItem.yoy}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                            {mItem.qoq}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* AI Executive Takeaways */}
                  <div className="rounded-xl bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/70 p-4">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-2.5">
                      <Sparkles size={13} className="shrink-0" />
                      <span>Key Filing Takeaways</span>
                    </div>
                    <ul className="space-y-2">
                      {activeCard.aiTakeaways.map((point, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 shrink-0" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Deck Footer Progress Indicators */}
                <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {SHOWCASE_CARDS.map((c, idx) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setIsPaused(true);
                          setActiveIndex(idx);
                        }}
                        aria-label={`View ${c.companyName} result showcase`}
                        className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                          idx === activeIndex
                            ? 'w-8 bg-emerald-500'
                            : 'w-2.5 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    {activeIndex + 1} / {SHOWCASE_CARDS.length} · Swipe or tap to switch
                  </span>
                </div>
              </m.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
};
