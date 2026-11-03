import { EXAMPLE_DATA_COPY } from '../../shared/productFacts';
import React, { useState } from 'react';
import { 
  Clock, ArrowUpRight, ArrowRight, CheckCircle2 
} from 'lucide-react';
import { CompanyLogo, type CompanySymbol } from './CompanyLogos';
import { AiIntelligenceLogo } from '../ui/AiIntelligenceLogo';
import { CalendarDateBadge3D } from '../ui/CalendarDateBadge3D';

interface UpcomingCatalystsGridProps {
  onEnterTerminal: (tab?: string) => void;
}

interface CatalystEvent {
  id: string;
  symbol: CompanySymbol;
  scripCode: string;
  name: string;
  sector: string;
  month: string;
  date: string;
  day: string;
  time: string;
  agenda: string;
  regulationTag: string;
  impactTag: 'High Conviction' | 'Index Weight' | 'Market Catalyst';
  impactColor: string;
  keyHighlights: string[];
}

const CATALYST_EVENTS: CatalystEvent[] = [
  {
    id: 'cat-1',
    symbol: 'RELIANCE',
    scripCode: '500325',
    name: 'Reliance Industries Limited',
    sector: 'Conglomerate & Energy',
    month: 'OCT',
    date: '24',
    day: 'Thursday',
    time: '03:30 PM IST',
    agenda: 'Board to consider and approve Q2 FY27 Unaudited Financial Results and Interim Dividend declaration.',
    regulationTag: 'LODR REG 29',
    impactTag: 'Index Weight',
    impactColor: 'text-sky-700 dark:text-sky-300 bg-sky-50/90 dark:bg-sky-950/60 border-sky-400/30',
    keyHighlights: ['Jio 5G ARPU trend', 'O2C refining margins', 'Retail festive expansion']
  },
  {
    id: 'cat-2',
    symbol: 'TCS',
    scripCode: '532540',
    name: 'Tata Consultancy Services',
    sector: 'Enterprise Software & Cloud',
    month: 'OCT',
    date: '27',
    day: 'Monday',
    time: '04:15 PM IST',
    agenda: 'Meeting of the Board of Directors to approve Unaudited Financial Results and declare 2nd Interim Dividend.',
    regulationTag: 'FINANCIAL RESULTS',
    impactTag: 'High Conviction',
    impactColor: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50/90 dark:bg-emerald-950/60 border-emerald-400/30',
    keyHighlights: ['AI Topaz deal conversions', 'Attrition stabilization', 'BFSI geography demand']
  },
  {
    id: 'cat-3',
    symbol: 'HDFCBANK',
    scripCode: '500180',
    name: 'HDFC Bank Limited',
    sector: 'Banking & Financials',
    month: 'OCT',
    date: '29',
    day: 'Wednesday',
    time: '02:00 PM IST',
    agenda: 'Board meeting to review Half-Yearly Consolidated Earnings, Net Interest Margin (NIM) trajectory & capital adequacy.',
    regulationTag: 'REG 30 DISCLOSURE',
    impactTag: 'Market Catalyst',
    impactColor: 'text-indigo-700 dark:text-indigo-300 bg-indigo-50/90 dark:bg-indigo-950/60 border-indigo-400/30',
    keyHighlights: ['Post-merger CD ratio', 'NIM margin compression/rebound', 'Retail loan growth']
  },
  {
    id: 'cat-4',
    symbol: 'INFY',
    scripCode: '500209',
    name: 'Infosys Limited',
    sector: 'IT Services & Consulting',
    month: 'OCT',
    date: '31',
    day: 'Friday',
    time: '04:00 PM IST',
    agenda: 'Board of Directors to consider Q2 FY27 Financial Results, Capital Allocation Policy, and Interim Dividend.',
    regulationTag: 'LODR REG 29',
    impactTag: 'High Conviction',
    impactColor: 'text-purple-700 dark:text-purple-300 bg-purple-50/90 dark:bg-purple-950/60 border-purple-400/30',
    keyHighlights: ['Large contract TCV wins', 'Operating margin guidance', 'Generative AI client adoption']
  }
];

export function UpcomingCatalystsGrid({ onEnterTerminal }: UpcomingCatalystsGridProps) {
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'results' | 'dividend'>('all');

  const filteredEvents = selectedFilter === 'all' 
    ? CATALYST_EVENTS 
    : CATALYST_EVENTS.filter(evt => {
        if (selectedFilter === 'dividend') return evt.agenda.toLowerCase().includes('dividend');
        return evt.agenda.toLowerCase().includes('results');
      });

  return (
    <section 
      className="relative py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
      aria-label="Upcoming Corporate Catalysts Calendar"
    >
      {/* Ambient background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-gradient-to-tr from-sky-500/10 via-emerald-500/10 to-indigo-500/5 blur-[140px] pointer-events-none -z-10" />

      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 sm:mb-14">
        <div className="max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/60 text-xs font-semibold text-slate-800 dark:text-slate-200 shadow-xs">
            <AiIntelligenceLogo size={16} />
            <span>Exchange Regulatory Calendar</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.12]">
            Explore Board Meetings &amp; Catalysts
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 font-normal leading-relaxed">
            {EXAMPLE_DATA_COPY}. Open the calendar for current board meetings, results dates and dividend agendas.
          </p>
        </div>

        {/* Action button */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onEnterTerminal('results-calendar')}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs sm:text-sm font-bold transition-all shadow-md hover:shadow-lg flex items-center gap-2 active:scale-95 cursor-pointer"
          >
            <span>Open Complete Calendar</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Multi-Company Expansive Catalyst Grid with 3D Red Calendar Badges */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
        {filteredEvents.map((event) => (
          <div
            key={event.id}
            onClick={() => onEnterTerminal('results-calendar')}
            className="group rounded-3xl bg-white/95 dark:bg-slate-900/85 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800/80 p-6 sm:p-8 hover:border-sky-500/50 dark:hover:border-sky-500/50 shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer flex flex-col justify-between space-y-6 hover:-translate-y-0.5"
          >
            {/* Top row: 3D Red Calendar Badge + Company Brand & Scrip + Conviction Tag */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4 min-w-0">
                {/* Authentic Apple 3D Red Calendar Badge */}
                <CalendarDateBadge3D 
                  month={event.month} 
                  date={event.date} 
                  day={event.day} 
                />

                {/* Company Name, Official Brand Logo & Sector */}
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2.5">
                    <CompanyLogo symbol={event.symbol} size={34} />
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors truncate">
                      {event.name}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                      BSE {event.scripCode}
                    </span>
                    <span className="text-slate-300 dark:text-slate-600">·</span>
                    <span className="truncate">{event.sector}</span>
                  </div>
                </div>
              </div>

              {/* Impact conviction tag */}
              <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${event.impactColor} self-start shrink-0 shadow-xs`}>
                {event.impactTag}
              </span>
            </div>

            {/* Middle: Agenda & Scheduled Time in Frosted Glass Panel */}
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2.5">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pb-1.5 border-b border-slate-200/60 dark:border-slate-700/50">
                  <span className="uppercase font-semibold tracking-wider text-slate-600 dark:text-slate-300">
                    Meeting Purpose
                  </span>
                  <span className="text-sky-600 dark:text-sky-400 font-bold tracking-wide">
                    {event.regulationTag}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                  {event.agenda}
                </p>

                <div className="flex items-center gap-2 text-xs text-slate-500 pt-1">
                  <Clock className="w-3.5 h-3.5 text-sky-500" />
                  <span>Scheduled Time: <strong className="text-slate-800 dark:text-slate-100 font-semibold">{event.time}</strong></span>
                </div>
              </div>

              {/* Key watchlist catalyst highlights (clean inline metadata, no clunky pills) */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono uppercase tracking-wider">
                  Watch:
                </span>
                {event.keyHighlights.map((item, idx) => (
                  <span 
                    key={idx}
                    className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-lg bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/70"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500/70" />
                    <span>{item}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Bottom Row: Terminal Action */}
            <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Exchange Notice Logged</span>
              </span>
              <span className="group-hover:translate-x-1 transition-transform flex items-center gap-1 text-sky-600 dark:text-sky-400 font-bold">
                <span>View historical filings</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
