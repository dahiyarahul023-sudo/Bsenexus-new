import React, { useState } from 'react';
import { Clock, TrendingUp, ArrowUpRight, Filter } from 'lucide-react';
import { CalendarDateBadge3D } from '../ui/CalendarDateBadge3D';
import { CompanyLogo, CompanySymbol } from './CompanyLogos';
import { WatchlistsIcon, TelegramAlertsIcon } from './FeatureIcons';
import { EXAMPLE_DATA_COPY } from '../../shared/productFacts';
import { triggerTapHaptic } from '../../utils/haptics';

interface CatalystCardItem {
  symbol: CompanySymbol;
  companyName: string;
  scripCode: string;
  month: string;
  date: string;
  day: string;
  eventTitle: string;
  purposeBadge: string;
  category: 'results' | 'dividend';
  badgeTone: 'emerald' | 'blue' | 'violet' | 'amber';
  timingLabel: string;
  historicalMove: string;
}

const UPCOMING_CATALYSTS: CatalystCardItem[] = [
  {
    symbol: 'RELIANCE',
    companyName: 'Reliance Industries Ltd',
    scripCode: '500325',
    month: 'OCT',
    date: '19',
    day: 'MON',
    eventTitle: 'Q2 FY27 Unaudited Financial Results',
    purposeBadge: 'Quarterly Results',
    category: 'results',
    badgeTone: 'emerald',
    timingLabel: 'Post-Market · ~19:15 IST',
    historicalMove: '±2.8% Avg 1D Move',
  },
  {
    symbol: 'INFY',
    companyName: 'Infosys Limited',
    scripCode: '500209',
    month: 'OCT',
    date: '22',
    day: 'THU',
    eventTitle: 'Q2 Earnings & Interim Dividend Board Meet',
    purposeBadge: 'Results + Dividend',
    category: 'dividend',
    badgeTone: 'blue',
    timingLabel: 'After Market · ~16:30 IST',
    historicalMove: '±3.4% Avg 1D Move',
  },
  {
    symbol: 'HDFCBANK',
    companyName: 'HDFC Bank Limited',
    scripCode: '500180',
    month: 'OCT',
    date: '24',
    day: 'SAT',
    eventTitle: 'Q2 FY27 Standalone & Consolidated Results',
    purposeBadge: 'Quarterly Results',
    category: 'results',
    badgeTone: 'violet',
    timingLabel: 'Weekend Filing · ~14:00 IST',
    historicalMove: '±2.1% Avg 1D Move',
  },
  {
    symbol: 'TCS',
    companyName: 'Tata Consultancy Services',
    scripCode: '532540',
    month: 'OCT',
    date: '28',
    day: 'WED',
    eventTitle: 'Board Meeting · Q2 Results & Special Dividend',
    purposeBadge: 'Board Outcome',
    category: 'dividend',
    badgeTone: 'amber',
    timingLabel: 'Post-Market · ~17:45 IST',
    historicalMove: '±2.5% Avg 1D Move',
  },
  {
    symbol: 'ICICIBANK',
    companyName: 'ICICI Bank Limited',
    scripCode: '532174',
    month: 'OCT',
    date: '30',
    day: 'FRI',
    eventTitle: 'Q2 FY27 Financial Results & Pillar 3 Disclosures',
    purposeBadge: 'Quarterly Results',
    category: 'results',
    badgeTone: 'emerald',
    timingLabel: 'Post-Market · ~18:00 IST',
    historicalMove: '±2.4% Avg 1D Move',
  },
  {
    symbol: 'SBIN',
    companyName: 'State Bank of India',
    scripCode: '500112',
    month: 'NOV',
    date: '03',
    day: 'TUE',
    eventTitle: 'Central Board Meeting · Q2 Earnings & Capital Plan',
    purposeBadge: 'Board Outcome',
    category: 'dividend',
    badgeTone: 'blue',
    timingLabel: 'Market Hours · ~13:45 IST',
    historicalMove: '±3.1% Avg 1D Move',
  },
];

const BADGE_STYLES: Record<CatalystCardItem['badgeTone'], string> = {
  emerald:
    'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
  blue: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25',
  violet:
    'bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/25',
  amber:
    'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25',
};

export function UpcomingCatalystsGrid({
  onEnterTerminal,
}: {
  onEnterTerminal: (tab?: string) => void;
}) {
  const [activeFilter, setActiveFilter] = useState<'all' | 'results' | 'dividend'>('all');
  const [selectedSymbol, setSelectedSymbol] = useState<CompanySymbol>('RELIANCE');

  const visibleCatalysts =
    activeFilter === 'all'
      ? UPCOMING_CATALYSTS
      : UPCOMING_CATALYSTS.filter(item => item.category === activeFilter);

  const selectedCatalyst =
    UPCOMING_CATALYSTS.find(item => item.symbol === selectedSymbol) || UPCOMING_CATALYSTS[0];

  return (
    <section className="py-8 sm:py-12 px-3 sm:px-6 lg:px-8 max-w-6xl mx-auto">
      {/* Section Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-[11px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
              <CalendarDateBadge3D month="NOV" date="17" size="icon" />
              <span>Results &amp; Catalyst Calendar</span>
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
              <WatchlistsIcon className="w-4 h-4" />
              <span>Watchlist Ready</span>
            </span>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {EXAMPLE_DATA_COPY}
            </p>
          </div>
          <h2 className="text-xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight font-display">
            Never miss an earnings date or board meeting.
          </h2>
          <p className="mt-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-xl leading-relaxed">
            Filter upcoming Reg 29 board meetings, dividend record dates, and historical earnings-day reaction bands.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Filter example catalysts"
            className="inline-flex items-center p-1 rounded-xl bg-slate-200/75 dark:bg-slate-800/80 border border-slate-300/60 dark:border-slate-700/70"
          >
            {(
              [
                ['all', 'All (6)'],
                ['results', 'Results'],
                ['dividend', 'Dividends & Board'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onPointerDown={triggerTapHaptic}
                onClick={() => setActiveFilter(id)}
                aria-pressed={activeFilter === id}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeFilter === id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onPointerDown={triggerTapHaptic}
            onClick={() => onEnterTerminal('results-calendar')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:opacity-90 transition-all cursor-pointer shrink-0 active:scale-[0.98]"
          >
            <span>Open Calendar</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Responsive Catalyst Cards Grid (1 col mobile, 2 col tablet, 3 col desktop) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
        {visibleCatalysts.map(item => {
          const isSelected = selectedSymbol === item.symbol;
          return (
            <div
              key={item.symbol}
              role="button"
              tabIndex={0}
              onPointerDown={triggerTapHaptic}
              onClick={() => setSelectedSymbol(item.symbol)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedSymbol(item.symbol);
                }
              }}
              className={`group relative rounded-2xl bg-white/95 dark:bg-slate-900/90 backdrop-blur-md border p-4 sm:p-5 transition-all duration-200 cursor-pointer flex flex-col justify-between text-left ${
                isSelected
                  ? 'border-emerald-500/70 dark:border-emerald-400/70 ring-2 ring-emerald-500/15 shadow-lg'
                  : 'border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs'
              }`}
            >
              {/* Top Row: Company Identity + 3D Apple Calendar Badge */}
              <div className="flex items-start justify-between gap-3 mb-3.5">
                <div className="flex items-center gap-3 min-w-0">
                  <CompanyLogo symbol={item.symbol} size={42} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-black text-sm sm:text-base text-slate-900 dark:text-white tracking-tight">
                        {item.symbol}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                        {item.scripCode}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-snug line-clamp-1">
                      {item.companyName}
                    </p>
                  </div>
                </div>

                {/* 3D Red Tear-Off Calendar Component */}
                <CalendarDateBadge3D
                  month={item.month}
                  date={item.date}
                  day={item.day}
                  size="sm"
                  className="shrink-0"
                />
              </div>

              {/* Middle: Purpose Pill & Event Title */}
              <div className="mb-3.5">
                <span
                  className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md border mb-2 ${BADGE_STYLES[item.badgeTone]}`}
                >
                  {item.purposeBadge}
                </span>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug">
                  {item.eventTitle}
                </h3>
              </div>

              {/* Footer: Expected Timing & Historical Reaction */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-medium">
                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{item.timingLabel}</span>
                </div>
                <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <TrendingUp className="w-3 h-3 shrink-0" />
                  <span>{item.historicalMove}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Catalyst Action Strip */}
      <div className="mt-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/75 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <CompanyLogo symbol={selectedCatalyst.symbol} size={34} />
          <div className="min-w-0 text-xs sm:text-sm">
            <span className="font-bold text-slate-900 dark:text-white">
              {selectedCatalyst.companyName} ({selectedCatalyst.symbol})
            </span>
            <span className="text-slate-600 dark:text-slate-300">
              {' '}
              — {selectedCatalyst.eventTitle} · {selectedCatalyst.timingLabel}
            </span>
          </div>
        </div>
        <button
          type="button"
          onPointerDown={triggerTapHaptic}
          onClick={() => onEnterTerminal('results-calendar')}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer shrink-0 active:scale-[0.98]"
        >
          <TelegramAlertsIcon className="w-4 h-4" />
          <span>Track {selectedCatalyst.symbol} in Terminal</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </section>
  );
}
