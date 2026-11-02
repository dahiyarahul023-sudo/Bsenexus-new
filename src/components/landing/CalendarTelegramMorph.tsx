import React, { useState, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { 
  Calendar as CalendarIcon, Send, Sparkles, Bell, ArrowRight,
  Clock, CheckCircle2, ChevronRight, Zap, ExternalLink, ShieldCheck, 
  Smartphone, Eye
} from 'lucide-react';
import { CompanyLogo, type CompanySymbol } from './CompanyLogos';
import { springStandard, springSnappy } from '../../utils/motionTokens';

interface CalendarTelegramMorphProps {
  onEnterTerminal: (tab?: string) => void;
}

interface CalendarEventItem {
  id: string;
  symbol: CompanySymbol;
  name: string;
  date: string;
  day: string;
  time: string;
  purpose: string;
  tag: string;
}

const UPCOMING_EVENTS: CalendarEventItem[] = [
  {
    id: 'evt-1',
    symbol: 'RELIANCE',
    name: 'Reliance Industries',
    date: 'OCT 24',
    day: 'Thursday',
    time: '03:30 PM',
    purpose: 'Q2 FY27 Financial Results & Interim Dividend Agenda',
    tag: 'Board Meeting'
  },
  {
    id: 'evt-2',
    symbol: 'TCS',
    name: 'Tata Consultancy Services',
    date: 'OCT 27',
    day: 'Monday',
    time: '04:15 PM',
    purpose: 'Approval of Unaudited Financial Results for Q2',
    tag: 'Financial Results'
  },
  {
    id: 'evt-3',
    symbol: 'INFY',
    name: 'Infosys Limited',
    date: 'OCT 29',
    day: 'Wednesday',
    time: '02:00 PM',
    purpose: 'Consideration of Buyback & Capital Allocation Policy',
    tag: 'Special Resolution'
  }
];

export function CalendarTelegramMorph({ onEnterTerminal }: CalendarTelegramMorphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeMode, setActiveMode] = useState<'calendar' | 'telegram'>('calendar');
  const [selectedEventIndex, setSelectedEventIndex] = useState(0);
  const reducedMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start']
  });

  // Smooth scroll transformations for the kinetic morph
  const morphScale = useTransform(scrollYProgress, [0.15, 0.45, 0.65], [0.95, 1, 0.98]);
  const morphOpacity = useTransform(scrollYProgress, [0.1, 0.25], [0.5, 1]);

  const activeEvent = UPCOMING_EVENTS[selectedEventIndex];

  return (
    <section 
      ref={containerRef}
      className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto overflow-hidden"
      aria-label="Interactive Calendar to Telegram Feature Showcase"
    >
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-gradient-to-tr from-emerald-500/10 via-sky-500/10 to-indigo-500/5 blur-[120px] pointer-events-none -z-10" />

      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-4">
          <Sparkles className="w-3.5 h-3.5 text-sky-500" />
          <span>From Catalysts to Real-Time Push</span>
        </div>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.15]">
          Calendar catalyst booked.<br />
          <span className="bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-500 bg-clip-text text-transparent">
            Instant Telegram ping delivered.
          </span>
        </h2>
        <p className="mt-4 text-base sm:text-lg text-slate-600 dark:text-slate-400 font-normal leading-relaxed">
          Never miss a crucial board meeting, earnings date, or dividend announcement. 
          BSE Nexus tracks the scheduled meeting and pings your private Telegram channel the split second the PDF drops.
        </p>

        {/* Interactive Mode Segmented Switcher (Apple style) */}
        <div className="inline-flex items-center p-1 mt-8 bg-slate-200/70 dark:bg-slate-800/80 backdrop-blur-md rounded-2xl border border-slate-300/60 dark:border-slate-700/60 shadow-inner">
          <button
            onClick={() => setActiveMode('calendar')}
            className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
              activeMode === 'calendar'
                ? 'text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {activeMode === 'calendar' && (
              <motion.div
                layoutId="activeMorphTab"
                className="absolute inset-0 bg-white dark:bg-slate-900 rounded-xl"
                transition={springSnappy}
              />
            )}
            <CalendarIcon className="w-4 h-4 relative z-10 text-sky-500" />
            <span className="relative z-10">1. Results Calendar</span>
          </button>

          <button
            onClick={() => setActiveMode('telegram')}
            className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
              activeMode === 'telegram'
                ? 'text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {activeMode === 'telegram' && (
              <motion.div
                layoutId="activeMorphTab"
                className="absolute inset-0 bg-white dark:bg-slate-900 rounded-xl"
                transition={springSnappy}
              />
            )}
            <Send className="w-4 h-4 relative z-10 text-emerald-500" />
            <span className="relative z-10">2. Instant Telegram Push</span>
          </button>
        </div>
      </div>

      {/* Main Kinetic Morph Card Showcase */}
      <motion.div 
        style={reducedMotion ? undefined : { scale: morphScale, opacity: morphOpacity }}
        className="relative max-w-4xl mx-auto rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xl p-6 sm:p-10 transition-colors"
      >
        <AnimatePresence mode="wait">
          {activeMode === 'calendar' ? (
            /* ================= VIEW 1: CALENDAR VIEW ================= */
            <motion.div
              key="calendar-view"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={springStandard}
              className="space-y-6"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold">
                    <CalendarIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Upcoming BSE Catalyst Calendar</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Live board meetings scheduled with BSE regulatory exchange</p>
                  </div>
                </div>

                <button
                  onClick={() => onEnterTerminal('results-calendar')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline"
                >
                  <span>Open Full Calendar</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Event selection list */}
              <div className="grid gap-3 sm:gap-4">
                {UPCOMING_EVENTS.map((evt, idx) => {
                  const isSelected = selectedEventIndex === idx;
                  return (
                    <div
                      key={evt.id}
                      onClick={() => setSelectedEventIndex(idx)}
                      className={`group relative p-4 sm:p-5 rounded-2xl border cursor-pointer transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        isSelected
                          ? 'bg-sky-50/80 dark:bg-sky-950/20 border-sky-500/40 shadow-sm'
                          : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Date badge */}
                        <div className="flex-shrink-0 w-14 text-center rounded-xl bg-white dark:bg-slate-900 p-2 border border-slate-200 dark:border-slate-800">
                          <span className="block text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">{evt.date.split(' ')[0]}</span>
                          <span className="block text-lg font-black text-slate-900 dark:text-white leading-tight">{evt.date.split(' ')[1]}</span>
                        </div>

                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <CompanyLogo symbol={evt.symbol} size={28} />
                            <span className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">{evt.name}</span>
                            <span className="text-xs font-mono text-slate-400">({evt.symbol})</span>
                          </div>
                          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium line-clamp-1">{evt.purpose}</p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
                            <span>{evt.day} · {evt.time} IST</span>
                            <span>·</span>
                            <span className="text-sky-600 dark:text-sky-400 font-semibold">{evt.tag}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-end sm:justify-start gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEventIndex(idx);
                            setActiveMode('telegram');
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                        >
                          <span>Simulate Push</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ) : (
            /* ================= VIEW 2: TELEGRAM ALERT MORPH ================= */
            <motion.div
              key="telegram-view"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={springStandard}
              className="space-y-6"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                    <Send className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Simulated Telegram Alert</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Instant notification ping delivered in ~0.8 seconds from BSE release</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                    <Zap className="w-3 h-3" />
                    <span>0.8s Sub-Second Dispatch</span>
                  </span>
                </div>
              </div>

              {/* Realistic Telegram Message Preview Bubble */}
              <div className="max-w-xl mx-auto rounded-2xl bg-[#0f1926] text-white p-5 sm:p-6 shadow-xl border border-sky-500/30 font-sans space-y-3.5">
                <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-sky-500 flex items-center justify-center text-white">
                      <Send className="w-3.5 h-3.5 -rotate-12" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-sky-400">BSE Nexus Dispatcher Bot</div>
                      <div className="text-[10px] text-slate-400">Official Channel · Delivered instantly</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">Just now</span>
                </div>

                {/* Telegram Message Content */}
                <div className="space-y-2 text-xs sm:text-sm">
                  <div className="font-extrabold text-white text-base flex items-center gap-2">
                    <span>🚨 {activeEvent.symbol} — {activeEvent.tag.toUpperCase()}</span>
                  </div>

                  <p className="text-slate-300 leading-relaxed font-normal">
                    <strong className="text-white">{activeEvent.name}</strong> has just submitted a regulatory disclosure to the exchange.
                  </p>

                  <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 space-y-1.5 text-xs">
                    <div className="text-slate-400 font-mono text-[11px]">SUBJECT / AGENDA</div>
                    <div className="text-slate-200 font-medium">{activeEvent.purpose}</div>
                    <div className="text-[11px] text-sky-400 font-semibold pt-1">
                      Target Meeting: {activeEvent.date}, {activeEvent.day} ({activeEvent.time} IST)
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <span>SEBI Reg 29 / 30 Compliance</span>
                    <span className="text-emerald-400 font-mono font-semibold">Verified Exchange Timestamp</span>
                  </div>
                </div>

                {/* Inline Action Buttons inside Telegram bubble */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    onClick={() => onEnterTerminal('dashboard')}
                    className="py-2 px-3 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-xs font-semibold text-center transition-colors flex items-center justify-center gap-1"
                  >
                    <span>Read AI Summary</span>
                    <Sparkles className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => onEnterTerminal('alerts')}
                    className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold text-center transition-colors flex items-center justify-center gap-1"
                  >
                    <span>Connect My Telegram</span>
                    <Send className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Bottom toggle back hint */}
              <div className="text-center pt-2">
                <button
                  onClick={() => setActiveMode('calendar')}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  ← Back to Calendar Events
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </section>
  );
}
