import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, useReducedMotion, useInView } from 'framer-motion';
import * as motion from 'framer-motion/m';
import {
  ArrowUpRight, Check, Clock,
} from 'lucide-react';
import {
  FilingsIcon, ResultsCalendarIcon, AiSummariesIcon, TelegramAlertsIcon,
} from './FeatureIcons';
import { CompanyLogo, type CompanySymbol } from './CompanyLogos';
import { ActionButton } from './ActionButton';

interface FeatureTabsProps {
  onEnterTerminal: (tab?: string) => void;
}

type TabId = 'filings' | 'results' | 'ai' | 'telegram';

const TABS: Array<{
  id: TabId; icon: React.ComponentType<{ className?: string }>; title: string; desc: string;
  cta: string; terminalTab: string;
}> = [
  { id: 'filings', icon: FilingsIcon, title: 'Live Filings Feed', desc: 'Every BSE announcement the second it drops — filtered by your watchlist, searchable by company.', cta: 'Open live feed', terminalTab: 'dashboard' },
  { id: 'results', icon: ResultsCalendarIcon, title: 'Results Calendar', desc: 'Earnings dates, board meetings and dividend agendas — never miss a catalyst again.', cta: 'View calendar', terminalTab: 'results-calendar' },
  { id: 'ai', icon: AiSummariesIcon, title: 'AI Summaries', desc: 'Dense PDFs condensed into YoY trends, risks and key numbers in plain English.', cta: 'Try AI digest', terminalTab: 'dashboard' },
  { id: 'telegram', icon: TelegramAlertsIcon, title: 'Telegram Alerts', desc: 'Instant filing pings on your phone, tuned to exactly the stocks you track.', cta: 'Set up alerts', terminalTab: 'alerts' },
];

const AUTO_MS = 6000;
const METRICS: Record<TabId, { value: string; label: string; path: string }> = {
  filings: { value: '4 filings', label: 'Company disclosures', path: 'M2,28 L16,28 L16,22 L44,22 L44,16 L72,16 L72,8 L88,8' },
  results: { value: '5 dates', label: 'Upcoming events', path: 'M2,28 L16,12 L30,28 L44,8 L58,28 L72,16 L88,28' },
  ai: { value: '+7.8%', label: 'INFY revenue YoY', path: 'M2,28 L16,24 L30,26 L44,16 L58,18 L72,8 L88,10' },
  telegram: { value: '3 alerts', label: 'Watchlist updates', path: 'M2,28 L16,28 L30,18 L44,18 L58,10 L72,10 L88,4' },
};

/* ---------------- sample panel data (labeled SAMPLE — never real market data) ---------------- */

const FEED_ROWS: Array<{ symbol: CompanySymbol; tag: string; color: string; headline: string; time: string }> = [
  { symbol: 'RELIANCE', tag: 'BOARD MEETING', color: '#2563eb', headline: 'Board to consider Q1 results & dividend (sample)', time: '2m' },
  { symbol: 'INFY', tag: 'RESULTS', color: '#059669', headline: 'Q1 revenue +7.8% YoY, PAT +9.4% YoY (sample)', time: '18m' },
  { symbol: 'HDFCBANK', tag: 'REG 30', color: '#d97706', headline: 'Bond issuance disclosure under Reg 30 (sample)', time: '42m' },
  { symbol: 'TCS', tag: 'DIVIDEND', color: '#7c3aed', headline: 'Interim dividend record date announced (sample)', time: '1h' },
];

const EVENT_DAYS = [3, 9, 14, 21, 27];

const AI_POINTS = [
  'Revenue grew on strong domestic volumes…',
  'Margins expanded 140 bps on cost control…',
  'Watch: rising receivables vs cash flow…',
];

const AI_CHIPS = ['Rev +7.8% YoY', 'PAT +9.4% YoY', 'Margin +140 bps'];

const TG_NOTIFS: Array<{ symbol: CompanySymbol; title: string; body: string; time: string }> = [
  { symbol: 'INFY', title: 'INFY', body: 'Q1 results filed — AI digest ready (sample)', time: 'now' },
  { symbol: 'RELIANCE', title: 'RELIANCE', body: 'Board meeting intimation (sample)', time: '12m' },
  { symbol: 'TCS', title: 'TCS', body: 'Dividend record date announced (sample)', time: '38m' },
];

/* ---------------- panels ---------------- */

function FilingsPanel() {
  const reduced = useReducedMotion();
  return (
    <div>
      <div className="flex justify-between items-center mb-3.5">
        <b className="text-[13px] text-slate-900 dark:text-white">Live feed</b>
        <span className="text-[10px] text-emerald-600 font-bold">● streaming (sample)</span>
      </div>
      {FEED_ROWS.map((r, i) => (
        <motion.div
          key={r.symbol}
          initial={reduced ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-3 p-[13px] rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-100 dark:border-white/10 mb-2.5"
        >
          <CompanyLogo symbol={r.symbol} />
          <div className="flex-1 min-w-0">
            <div className="flex gap-2 items-center">
              <b className="text-[11px] font-mono text-slate-900 dark:text-white">{r.symbol}</b>
              <span className="text-[8px] font-extrabold px-2 py-[3px] rounded-full bg-slate-100 dark:bg-white/10 whitespace-nowrap" style={{ color: r.color }}>{r.tag}</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap overflow-hidden text-ellipsis">{r.headline}</div>
          </div>
          <span className="text-[10px] text-slate-400 font-semibold shrink-0">{r.time}</span>
        </motion.div>
      ))}
    </div>
  );
}

function ResultsPanel() {
  const reduced = useReducedMotion();
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <b className="text-[13px] text-slate-900 dark:text-white">October 2026</b>
        <span className="text-[10px] text-slate-400">(sample)</span>
      </div>
      <div className="grid grid-cols-7 gap-1.5 mt-4 text-center">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={i} className="text-[11px] font-extrabold text-slate-500">{d}</div>
        ))}
        {/* October 1, 2026 is Thursday in this Monday-first sample grid. */}
        {Array.from({ length: 3 }, (_, i) => <div key={`empty-${i}`} aria-hidden="true" />)}
        {Array.from({ length: 31 }, (_, i) => {
          const day = i + 1;
          const ev = EVENT_DAYS.includes(day);
          return (
            <motion.div
              key={day}
              initial={!reduced && ev ? { scale: 0.6, opacity: 0 } : false}
              animate={ev ? { scale: 1, opacity: 1 } : {}}
              transition={{ delay: 0.15 + i * 0.015, type: 'spring', bounce: 0.4 }}
              className={`aspect-square rounded-[10px] flex items-center justify-center text-[11px] font-semibold relative ${
                ev ? 'bg-sky-100 dark:bg-sky-500/15 text-slate-900 dark:text-white font-extrabold border border-sky-200 dark:border-sky-400/30' : 'text-slate-400'
              }`}
            >
              {day}
              {ev && <span className="absolute bottom-1 w-[7px] h-[7px] rounded-full bg-sky-500" />}
            </motion.div>
          );
        })}
      </div>
      <div className="mt-3.5 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5" /> 5 board meetings &amp; results this month (sample)
      </div>
    </div>
  );
}

function AiPanel() {
  const reduced = useReducedMotion();
  return (
    <div>
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-[38px] h-[38px] shrink-0">
          <AiSummariesIcon className="w-full h-full" />
        </div>
        <div>
          <b className="text-[13px] text-slate-900 dark:text-white">AI Digest</b>
          <div className="text-[10px] text-slate-400">INFY Q1 results (sample)</div>
        </div>
        <span className="ml-auto"><CompanyLogo symbol="INFY" /></span>
      </div>
      {AI_POINTS.map((t, i) => (
        <motion.div
          key={t}
          initial={reduced ? false : { opacity: 0, y: -16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: i * 0.12, type: 'spring', bounce: 0.35 }}
          className="rounded-2xl bg-white dark:bg-white/[0.05] border border-slate-200 dark:border-white/10 p-3.5 mb-3 shadow-[0_14px_30px_-12px_rgba(2,32,71,0.25)]"
        >
          <div className="flex gap-2.5 text-xs text-slate-600 dark:text-slate-300">
            <Check className="w-4 h-4 text-emerald-500 font-extrabold shrink-0" /><span>{t}</span>
          </div>
        </motion.div>
      ))}
      <div className="flex gap-2 mt-1.5 flex-wrap">
        {AI_CHIPS.map((c, i) => (
          <motion.span
            key={c}
            initial={reduced ? false : { opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 + i * 0.1, type: 'spring', bounce: 0.5 }}
            className="text-[10px] font-extrabold px-3 py-1.5 rounded-full bg-[#eefbce] dark:bg-lime-400/10 text-[#3f6212] dark:text-lime-300 border border-[#d4f565] dark:border-lime-400/30"
          >
            {c}
          </motion.span>
        ))}
      </div>
    </div>
  );
}

function TelegramPanel() {
  const reduced = useReducedMotion();
  return (
    <div>
      <div className="flex items-center gap-2.5 mb-4">
        <TelegramAlertsIcon className="w-6 h-6 shrink-0" />
        <b className="text-[13px] text-slate-900 dark:text-white">Telegram alerts</b>
        <span className="text-[10px] text-slate-400">(sample)</span>
      </div>
      {TG_NOTIFS.map((n, i) => (
        <motion.div
          key={n.title + n.time}
          initial={reduced ? false : { opacity: 0, y: -16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: i * 0.15, type: 'spring', bounce: 0.35 }}
          className="rounded-2xl bg-white dark:bg-white/[0.05] border border-slate-200 dark:border-white/10 p-3.5 mb-3 shadow-[0_14px_30px_-12px_rgba(2,32,71,0.25)]"
        >
          <div className="flex gap-2.5 items-center">
            <CompanyLogo symbol={n.symbol} />
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center">
                <b className="text-[11px] font-mono text-slate-900 dark:text-white">{n.title}</b>
                <span className="text-[10px] text-slate-400">{n.time}</span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{n.body}</div>
            </div>
          </div>
        </motion.div>
      ))}
      <div className="text-center text-[11px] font-bold text-sky-600 mt-2">Instant pings • zero noise • your stocks only</div>
    </div>
  );
}

/**
 * FeatureTabs — approved v3 "Core Features".
 * Selectable feature list (auto-advances every 6s, pauses on hover) driving
 * an animated Mac-style preview window per feature, with a floating lime
 * metric card. All mock content is labeled SAMPLE.
 */
export function FeatureTabs({ onEnterTerminal }: FeatureTabsProps) {
  const [active, setActive] = useState<TabId>('filings');
  const [paused, setPaused] = useState(false);
  const [playing, setPlaying] = useState(false);
  const reduced = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { amount: 0.2 });
  useEffect(() => {
    if (!playing || paused || reduced || !inView) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      const ids = TABS.map(t => t.id);
      setActive(cur => ids[(ids.indexOf(cur) + 1) % ids.length]);
    }, AUTO_MS);
    return () => window.clearInterval(timer);
  }, [playing, paused, reduced, inView, active]);
  const select = (id: TabId) => { setActive(id); setPlaying(false); };
  const activeTab = TABS.find((t) => t.id === active)!;
  const metric = METRICS[active];

  return (
    <>
      <section ref={sectionRef} id="core-features" tabIndex={-1} className="bg-white dark:bg-[#12131C] transition-colors scroll-mt-24 focus:outline-none">
        <div className="max-w-[1180px] mx-auto px-6 py-20">
          <div className="flex justify-between text-[11px] font-semibold tracking-[2px] text-slate-400 uppercase">
            <span>/ Core Features /</span>
          </div>
          <h2 className="font-serif text-[clamp(30px,4.8vw,52px)] font-semibold tracking-[-1px] leading-[1.15] text-slate-900 dark:text-white mt-4">
            Built for investors <em className="font-medium">and</em><br />active traders
          </h2>

          <div
            className="grid grid-cols-1 lg:grid-cols-[5fr_7fr] gap-10 mt-11 items-start"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocusCapture={() => setPaused(true)}
            onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false); }}
          >
            <div className="min-w-0">
              {TABS.map((t) => {
                const Icon = t.icon;
                const on = t.id === active;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => select(t.id)}
                    aria-pressed={on}
                    className="feat-icon-parent w-full text-left block px-1 py-[18px] bg-transparent border-0 border-b border-slate-100 dark:border-white/10 cursor-pointer relative"
                  >
                    <span className="flex items-center gap-3 text-[15px] font-bold text-slate-900 dark:text-white">
                      <span className={`w-[34px] h-[34px] shrink-0 transition-transform duration-200 ${on ? 'scale-[1.12]' : ''}`}>
                        <Icon className="feat-icon w-full h-full" />
                      </span>
                      {t.title}
                    </span>
                    <span className="block text-[13px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed max-w-[420px]">{t.desc}</span>
                    {on && playing && !reduced && (
                      <span
                        key={`bar-${t.id}-${paused ? 'p' : 'r'}`}
                        className="absolute left-0 -bottom-px h-[2px] w-full bg-slate-900 dark:bg-[#d4f565] origin-left animate-[tabfill_6s_linear_forwards]"
                        style={{ animationPlayState: paused ? 'paused' : 'running' }}
                      />
                    )}
                  </button>
                );
              })}
              <ActionButton
                onAction={() => onEnterTerminal(activeTab.terminalTab)}
                className="mt-[26px] bg-slate-900 dark:bg-[#d4f565] text-white dark:text-slate-900 text-[13px] font-bold px-6 py-[13px] rounded-full transition-transform duration-150 hover:scale-105 active:scale-95"
              >
                {activeTab.cta} <ArrowUpRight className="w-4 h-4" />
              </ActionButton>
              {!reduced && <button type="button" onClick={() => setPlaying(p => !p)} aria-pressed={playing} className="block mt-3 min-h-11 text-xs font-semibold underline underline-offset-4">{playing ? 'Pause preview' : 'Play feature tour'}</button>}
            </div>

            <div className="relative min-w-0">
              <div className="rounded-[22px] overflow-hidden bg-white dark:bg-[#101B2E] border-[3px] border-[#bfe3fa] dark:border-white/10 shadow-[0_40px_80px_-30px_rgba(2,32,71,0.4)]">
                <div className="flex items-center gap-2.5 px-[18px] py-3.5 bg-[#eaf6fe] dark:bg-white/[0.04] border-b border-[#d3ebfb] dark:border-white/10">
                  <span className="flex gap-[7px]">
                    <span className="w-[13px] h-[13px] rounded-full bg-rose-400" />
                    <span className="w-[13px] h-[13px] rounded-full bg-amber-400" />
                    <span className="w-[13px] h-[13px] rounded-full bg-emerald-400" />
                  </span>
                  <span className="flex-1 text-[11px] font-mono text-slate-500 bg-white dark:bg-white/10 rounded-full px-4 py-1.5 border border-[#d3ebfb] dark:border-white/10 whitespace-nowrap overflow-hidden text-ellipsis">
                    bsenexus.in — sample preview
                  </span>
                </div>
                <div className="p-3 sm:p-[22px] min-h-[380px]" aria-label={`${activeTab.title} sample preview`}>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={active}
                      initial={reduced ? false : { opacity: 0, y: 26, scale: 0.985 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -14, scale: 0.99 }}
                      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    >
                      {active === 'filings' && <FilingsPanel />}
                      {active === 'results' && <ResultsPanel />}
                      {active === 'ai' && <AiPanel />}
                      {active === 'telegram' && <TelegramPanel />}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>

              <motion.div
                key={`metric-${active}`}
                className="relative mt-4 lg:absolute z-[5] lg:-left-6 lg:bottom-[-36px] w-fit mx-auto"
                initial={reduced ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45 }}
              >
                <div className="bg-[#eefbce] dark:bg-lime-400/10 border-2 border-[#d4f565] rounded-[18px] px-[18px] py-3.5 shadow-[0_24px_50px_-16px_rgba(101,163,13,0.5)] text-center">
                  <div className="font-serif text-[26px] font-bold text-[#3f6212] dark:text-lime-300">{metric.value}</div>
                  <div className="text-[10px] font-bold text-[#65a30d] dark:text-lime-400">{metric.label}</div>
                  <svg className="w-[90px] h-[34px] mt-1.5 mx-auto" viewBox="0 0 90 34" aria-hidden="true">
                    <motion.path d={metric.path} initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduced ? 0 : 0.9 }} fill="none" stroke="#65a30d" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                  <div className="text-[10px] font-bold text-[#65a30d] dark:text-lime-400">Best insights (sample)</div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats band */}
      <section className="bg-white dark:bg-[#12131C] transition-colors">
        <div className="mx-6 sm:mx-6 rounded-[32px] bg-[#0d1526] px-6 py-[60px] text-center relative overflow-hidden">
          <h3 className="font-serif text-white text-[clamp(26px,4.2vw,44px)] font-semibold tracking-[-1px]">
            Market intelligence, <em className="text-[#d4f565] font-medium">at machine speed.</em>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-7 max-w-[900px] mx-auto mt-10">
            {[
              { n: <>20<em className="italic text-[#d4f565]">s</em></>, l: 'Feed refresh' },
              { n: <>100<em className="italic text-[#d4f565]">%</em></>, l: 'Official BSE source' },
              { n: <>24<em className="italic text-[#d4f565]">×7</em></>, l: 'Alert monitoring' },
            ].map((s) => (
              <div key={s.l}>
                <div className="font-serif text-[clamp(38px,5vw,58px)] font-bold text-white">{s.n}</div>
                <div className="text-xs text-slate-400 font-semibold mt-2 tracking-[1px] uppercase">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-center py-[26px] px-4 text-[11px] text-slate-400 font-semibold tracking-[1px]">
          SAMPLE PREVIEW — MOCKUPS SHOWN WITH SAMPLE DATA, NOT REAL MARKET FIGURES
        </p>
      </section>
    </>
  );
}
