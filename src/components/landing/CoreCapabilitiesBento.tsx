import React, { useState } from 'react';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import { CalendarDateBadge3D } from '../ui/CalendarDateBadge3D';
import {
  FilingsIcon,
  AiSummariesIcon,
  TelegramAlertsIcon,
  WatchlistsIcon,
  AlertRulesIcon,
} from './FeatureIcons';
import { CompanyLogo, type CompanySymbol } from './CompanyLogos';
import { triggerTapHaptic } from '../../utils/haptics';

interface CoreCapabilitiesBentoProps {
  onEnterTerminal: (tab?: string) => void;
}

interface PillarItem {
  id: string;
  tab: string;
  tag: string;
  title: string;
  desc: string;
  highlight: string;
  accent: string;
  logos: CompanySymbol[];
  renderIcon: () => React.ReactNode;
}

const PILLARS: PillarItem[] = [
  {
    id: 'filings',
    tab: 'announcements',
    tag: 'Reg 30 · Live Exchange Feed',
    title: 'Direct BSE & NSE Filings Stream',
    desc: 'Every corporate announcement, board outcome, order win, and PDF disclosure indexed with exact BSE scrip-code verification.',
    highlight: 'Official Exchange PDFs',
    accent: 'hover:border-blue-500/45 dark:hover:border-blue-400/40',
    logos: ['BSE', 'NSE', 'RELIANCE', 'TCS'],
    renderIcon: () => <FilingsIcon className="w-11 h-11 shrink-0 drop-shadow-xs" />,
  },
  {
    id: 'calendar',
    tab: 'results-calendar',
    tag: 'Board Meetings & Declarations',
    title: 'Results & Catalyst Calendar',
    desc: 'Track upcoming quarterly earnings dates, dividend record dates, and confirmed Reg 33 outcomes across F&O and Watchlist stocks.',
    highlight: '210+ F&O & Curated Stocks',
    accent: 'hover:border-rose-500/45 dark:hover:border-rose-400/40',
    logos: ['HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN'],
    renderIcon: () => (
      <span className="inline-flex items-center justify-center shrink-0">
        <CalendarDateBadge3D month="NOV" date="17" day="TUE" size="sm" />
      </span>
    ),
  },
  {
    id: 'ai-summaries',
    tab: 'announcements',
    tag: 'Gemini Grounded Extraction',
    title: 'AI Earnings & Filing Summaries',
    desc: 'Condense 60-page regulatory PDFs into structured Revenue, EBITDA, PAT, and Margin tables with direct source citations.',
    highlight: '100 AI Summaries / Day on Pro',
    accent: 'hover:border-violet-500/45 dark:hover:border-violet-400/40',
    logos: ['TCS', 'LT', 'MARUTI', 'BAJFINANCE'],
    renderIcon: () => <AiSummariesIcon className="w-11 h-11 shrink-0 drop-shadow-xs" />,
  },
  {
    id: 'watchlist',
    tab: 'watchlist',
    tag: 'Personal Equity Radar',
    title: 'Custom Watchlist & Dossiers',
    desc: 'Isolate your portfolio companies, track 30-day filing velocity, and open complete Stock 360 intelligence hubs.',
    highlight: 'Multi-List Portfolio Sync',
    accent: 'hover:border-amber-500/45 dark:hover:border-amber-400/40',
    logos: ['RELIANCE', 'BHARTIARTL', 'ITC', 'TATAMOTORS'],
    renderIcon: () => <WatchlistsIcon className="w-11 h-11 shrink-0 drop-shadow-xs" />,
  },
  {
    id: 'telegram',
    tab: 'settings',
    tag: 'Instant Dispatch',
    title: 'Telegram & Push Notifications',
    desc: 'Receive high-priority watchlist alerts and earnings declarations directly on Telegram with one-tap PDF links.',
    highlight: '@BseNexusOfficial Bot',
    accent: 'hover:border-sky-500/45 dark:hover:border-sky-400/40',
    logos: ['SUNPHARMA', 'TITAN', 'WIPRO', 'BEL'],
    renderIcon: () => <TelegramAlertsIcon className="w-11 h-11 shrink-0 drop-shadow-xs" />,
  },
  {
    id: 'radar',
    tab: 'home',
    tag: 'Historical Session Context',
    title: 'Impact Radar & Alert Rules',
    desc: 'Compare material disclosures against observed NSE session volatility ranges and configure custom priority filters.',
    highlight: 'Company-Relative Volatility',
    accent: 'hover:border-emerald-500/45 dark:hover:border-emerald-400/40',
    logos: ['NTPC', 'ONGC', 'COALINDIA', 'HINDALCO'],
    renderIcon: () => <AlertRulesIcon className="w-11 h-11 shrink-0 drop-shadow-xs" />,
  },
];

export function CoreCapabilitiesBento({ onEnterTerminal }: CoreCapabilitiesBentoProps) {
  const [activePillarId, setActivePillarId] = useState<string>('filings');

  return (
    <section
      id="features"
      aria-labelledby="capabilities-heading"
      className="py-10 sm:py-14 px-4 sm:px-6 max-w-6xl mx-auto"
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-7 sm:mb-9">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Core Terminal Architecture</span>
          </span>
          <h2
            id="capabilities-heading"
            className="mt-1 text-2xl sm:text-3xl lg:text-[34px] font-bold text-slate-900 dark:text-white tracking-[-0.025em] leading-[1.12] font-display"
          >
            Built for Indian equity research
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-md leading-relaxed">
          Tap any module to preview or sign in. Every workflow connects directly to official BSE/NSE disclosures.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {PILLARS.map(pillar => {
          const isSelected = activePillarId === pillar.id;
          return (
            <button
              key={pillar.id}
              type="button"
              onPointerDown={() => {
                triggerTapHaptic();
                setActivePillarId(pillar.id);
              }}
              onClick={() => onEnterTerminal(pillar.tab)}
              className={`group text-left rounded-3xl border bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl p-5 sm:p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98] flex flex-col justify-between gap-4 cursor-pointer ${
                isSelected
                  ? 'border-emerald-500/50 dark:border-emerald-400/50 ring-2 ring-emerald-500/15 shadow-md'
                  : 'border-slate-200/90 dark:border-slate-800/90 shadow-xs'
              } ${pillar.accent}`}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    {pillar.renderIcon()}
                    <span className="text-[10px] font-mono font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700/70">
                      {pillar.tag}
                    </span>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0 mt-1" />
                </div>

                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-[-0.015em] mb-1.5 font-display">
                  {pillar.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {pillar.desc}
                </p>
              </div>

              <div className="pt-3.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                {/* Official Brand Logo Stack */}
                <div className="flex items-center -space-x-1.5">
                  {pillar.logos.map(sym => (
                    <CompanyLogo
                      key={sym}
                      symbol={sym}
                      size={26}
                      className="rounded-lg ring-2 ring-white dark:ring-slate-900"
                    />
                  ))}
                </div>

                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[11px] font-mono font-semibold text-emerald-700 dark:text-emerald-400 truncate">
                    {pillar.highlight}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
