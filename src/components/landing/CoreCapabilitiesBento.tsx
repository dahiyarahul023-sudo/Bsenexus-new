import React from 'react';
import { 
  Zap, Filter, ChevronRight, Activity, Radio
} from 'lucide-react';
import { AiIntelligenceLogo } from '../ui/AiIntelligenceLogo';

interface CoreCapabilitiesBentoProps {
  onEnterTerminal: (tab?: string) => void;
}

export function CoreCapabilitiesBento({ onEnterTerminal }: CoreCapabilitiesBentoProps) {
  return (
    <section 
      className="relative py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
      aria-label="Core Capabilities Grid"
    >
      <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/60 text-xs font-semibold text-slate-800 dark:text-slate-200 mb-4 shadow-xs">
          <Activity className="w-3.5 h-3.5 text-sky-500" />
          <span>Four Pillars of Exchange Edge</span>
        </div>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.15]">
          Built for speed.<br />
          <span className="bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Engineered for serious market intelligence.
          </span>
        </h2>
        <p className="mt-4 text-sm sm:text-base text-slate-600 dark:text-slate-400 font-normal leading-relaxed">
          Four interconnected systems deliver exchange filings to your screen faster than broker terminal news feeds.
        </p>
      </div>

      {/* Asymmetric 4-card Apple-Style Frosted Glass Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Card 1: 0.8s BSE Direct Scraper (Spans 7 cols) */}
        <div 
          onClick={() => onEnterTerminal('dashboard')}
          className="group md:col-span-7 rounded-3xl bg-white/95 dark:bg-slate-900/85 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800/80 shadow-lg hover:shadow-2xl p-7 sm:p-10 transition-all duration-300 flex flex-col justify-between cursor-pointer relative overflow-hidden hover:-translate-y-0.5"
        >
          <div className="space-y-4">
            {/* 3D Glass Emblem Tile */}
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-transparent border border-amber-500/30 text-amber-500 flex items-center justify-center font-bold shadow-md shadow-amber-500/10 group-hover:scale-105 transition-transform">
              <Zap className="w-6 h-6 fill-amber-500/20" />
            </div>

            <div>
              <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                Sub-Second Pipeline
              </span>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                Direct Exchange Ingestion Engine
              </h3>
            </div>

            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed max-w-lg font-normal">
              Low-latency continuous connection to BSE India servers. Captures Regulation 30 announcements, 
              board meetings, and financial filings within milliseconds of publication.
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Real-Time Ingestion Active (0.8s)</span>
            </span>
            <span className="group-hover:translate-x-1 transition-transform flex items-center gap-1 text-sky-500 font-bold">
              <span>Explore live stream</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>

        {/* Card 2: Authentic Official Telegram Push (Spans 5 cols) */}
        <div 
          onClick={() => onEnterTerminal('alerts')}
          className="group md:col-span-5 rounded-3xl bg-white/95 dark:bg-slate-900/85 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800/80 shadow-lg hover:shadow-2xl p-7 sm:p-10 transition-all duration-300 flex flex-col justify-between cursor-pointer relative overflow-hidden hover:-translate-y-0.5"
        >
          <div className="space-y-4">
            {/* Authentic Official Telegram Logo Badge */}
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#2AABEE] to-[#229ED9] flex items-center justify-center shadow-lg shadow-sky-500/25 group-hover:scale-105 transition-transform">
              <svg viewBox="0 0 24 24" width={26} height={26} fill="white" aria-hidden="true" className="shrink-0">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
              </svg>
            </div>

            <div>
              <span className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
                Official Telegram Integration
              </span>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                Sub-Second Telegram Push
              </h3>
            </div>

            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed font-normal">
              Connect your private Telegram channel or direct bot. Filter by your custom watchlists so you only receive alerts for what you trade.
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
              <span>Official Bot Delivery</span>
            </span>
            <span className="group-hover:translate-x-1 transition-transform flex items-center gap-1 text-sky-500 font-bold">
              <span>Configure alerts</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>

        {/* Card 3: AI Financial Summaries (Spans 5 cols) */}
        <div 
          onClick={() => onEnterTerminal('dashboard')}
          className="group md:col-span-5 rounded-3xl bg-white/95 dark:bg-slate-900/85 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800/80 shadow-lg hover:shadow-2xl p-7 sm:p-10 transition-all duration-300 flex flex-col justify-between cursor-pointer relative overflow-hidden hover:-translate-y-0.5"
        >
          <div className="space-y-4">
            {/* 3D Glass Emblem Tile with AiIntelligenceLogo */}
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-purple-500/20 via-purple-500/10 to-transparent border border-purple-500/30 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold shadow-md shadow-purple-500/10 group-hover:scale-105 transition-transform">
              <AiIntelligenceLogo size={26} />
            </div>

            <div>
              <span className="text-xs font-mono font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                Document Intelligence
              </span>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                AI Earnings &amp; PDF Summaries
              </h3>
            </div>

            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed font-normal">
              Turn heavy scanned PDF reports into concise 5-bullet takeaways. Highlights operating margins, debt levels, capex plans, and raw YoY trends.
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
            <span>Multi-Page Filing Extraction</span>
            <span className="group-hover:translate-x-1 transition-transform flex items-center gap-1 text-purple-500 font-bold">
              <span>View summaries</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>

        {/* Card 4: Custom Alert Rules & Watchlists (Spans 7 cols) */}
        <div 
          onClick={() => onEnterTerminal('watchlists')}
          className="group md:col-span-7 rounded-3xl bg-white/95 dark:bg-slate-900/85 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800/80 shadow-lg hover:shadow-2xl p-7 sm:p-10 transition-all duration-300 flex flex-col justify-between cursor-pointer relative overflow-hidden hover:-translate-y-0.5"
        >
          <div className="space-y-4">
            {/* 3D Glass Emblem Tile */}
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-emerald-500/10 to-transparent border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold shadow-md shadow-emerald-500/10 group-hover:scale-105 transition-transform">
              <Filter className="w-6 h-6 fill-emerald-500/20" />
            </div>

            <div>
              <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                Precision Filtering
              </span>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                Smart Custom Alert Rules &amp; Watchlists
              </h3>
            </div>

            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed max-w-lg font-normal">
              Set multi-tier alert triggers: only notify for Order Wins exceeding ₹100 Cr, 
              Special Interim Dividends, or SEBI Investigation notices. Zero alert fatigue.
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
            <span>Granular Keyword &amp; Value Triggers</span>
            <span className="group-hover:translate-x-1 transition-transform flex items-center gap-1 text-emerald-500 font-bold">
              <span>Manage watchlists</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>

      </div>
    </section>
  );
}
