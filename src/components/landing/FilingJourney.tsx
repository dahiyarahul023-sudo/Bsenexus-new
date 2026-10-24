import { useRef, useState } from 'react';
import { AnimatePresence, useMotionValueEvent, useReducedMotion, useScroll } from 'framer-motion';
import * as motion from 'framer-motion/m';
import { ArrowRight, Bell, Check, FileText, Sparkles, TrendingUp } from 'lucide-react';
import { CompanyLogo } from './CompanyLogos';

const STEPS = [
  { title: 'A filing arrives', text: 'Start with the official company disclosure.', icon: FileText },
  { title: 'AI finds the signal', text: 'Read key figures and risks alongside the source.', icon: Sparkles },
  { title: 'Numbers become context', text: 'See revenue and profit trends in one view.', icon: TrendingUp },
  { title: 'Your watchlist connects', text: 'Carry the same company into a relevant alert.', icon: Bell },
];

/** One illustrative filing drives every stage; no market or delivery claims. */
export function FilingJourney() {
  const ref = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start center', 'end center'] });
  useMotionValueEvent(scrollYProgress, 'change', progress => {
    if (!reduced && window.matchMedia('(min-width: 1024px)').matches) {
      setActive(Math.min(3, Math.floor(progress * 4)));
    }
  });
  return (
    <section ref={ref} className="bg-slate-50 dark:bg-[#0B0F17] border-y border-slate-200 dark:border-white/10">
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6 py-16 lg:py-24">
        <p className="text-xs uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400 font-bold">One filing. A connected view.</p>
        <h2 className="font-serif text-3xl sm:text-5xl tracking-tight mt-4 max-w-2xl">Follow the signal,<br /><em>from source to insight.</em></h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-4">Interactive sample · Illustrative figures and alerts.</p>
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 mt-10 items-start">
          <div className="space-y-3 lg:space-y-0">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return <div key={step.title} className="lg:min-h-[32vh] flex items-center">
                <button type="button" onClick={() => setActive(i)} aria-pressed={active === i} aria-controls="filing-journey-preview"
                  className={`w-full text-left p-5 sm:p-6 rounded-3xl border transition-colors focus-visible:outline-2 focus-visible:outline-emerald-500 ${active === i ? 'bg-white dark:bg-white/[0.06] border-emerald-400 shadow-lg shadow-emerald-900/5' : 'border-slate-200 dark:border-white/10'}`}>
                  <span className="flex items-center gap-3"><span className="text-xs font-mono text-emerald-600 dark:text-emerald-400">0{i + 1}</span><Icon className="w-5 h-5" /><span className="font-bold text-base sm:text-xl">{step.title}</span><ArrowRight className="w-4 h-4 ml-auto shrink-0" /></span>
                  <span className="block text-sm text-slate-500 dark:text-slate-400 mt-3">{step.text}</span>
                </button>
              </div>;
            })}
          </div>
          <div id="filing-journey-preview" className="lg:sticky lg:top-28 min-w-0 rounded-[28px] bg-[#0d1526] text-white p-5 sm:p-8 shadow-xl" role="region" aria-label="Connected filing sample">
            <div className="flex items-center gap-3"><CompanyLogo symbol="INFY" /><div><p className="font-bold">INFY · Q1 results</p><p className="text-xs text-slate-400">Same illustrative filing at every step</p></div></div>
            <div className="flex items-center gap-2 my-6" aria-hidden="true">
              {STEPS.map((step, i) => <div key={step.title} className="flex items-center gap-2 flex-1 last:flex-none"><motion.span animate={{ backgroundColor: i <= active ? '#d4f565' : '#334155', scale: i === active && !reduced ? 1.12 : 1 }} className="rounded-full w-7 h-7 shrink-0 flex items-center justify-center text-xs font-bold text-slate-900">{i + 1}</motion.span>{i < 3 && <div className="h-0.5 flex-1 bg-slate-700 overflow-hidden"><motion.div className="h-full bg-[#d4f565] origin-left" animate={{ scaleX: i < active ? 1 : 0 }} /></div>}</div>)}
            </div>
            <div className="min-h-[320px] sm:min-h-[340px]">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={active} initial={reduced ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduced ? 0 : -12 }} transition={{ duration: reduced ? 0 : 0.3 }}>
                  <p className="text-xs font-mono text-lime-300 mb-4">{STEPS[active].title}</p>
                  {active === 0 && <div className="rounded-2xl border border-white/15 p-5 bg-white/5"><FileText className="w-10 h-10 text-sky-300 mb-6" /><h3 className="text-lg font-bold">Quarterly financial results</h3><p className="text-sm leading-relaxed text-slate-300 mt-3">Company disclosure → source PDF → structured filing card.</p><p className="text-xs text-slate-400 mt-6">Sample source document</p></div>}
                  {active === 1 && <div className="space-y-3">{['Revenue +7.8% YoY', 'PAT +9.4% YoY', 'Watch: receivables and cash flow'].map((text, i) => <motion.div key={text} initial={{ opacity: 0, x: reduced ? 0 : 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: reduced ? 0 : i * 0.12 }} className="rounded-2xl p-4 bg-white/5 border border-white/15 flex gap-3 text-sm"><Check className="w-4 h-4 text-lime-300 shrink-0" />{text}</motion.div>)}</div>}
                  {active === 2 && <div><div className="flex flex-wrap gap-4 text-sm mb-5"><span>Revenue <b className="text-lime-300">+7.8%</b></span><span>PAT <b className="text-sky-300">+9.4%</b></span></div><svg viewBox="0 0 320 180" className="w-full" role="img" aria-label="Illustrative revenue trend, rising to plus 7.8 percent YoY">{[30,70,110,150].map(y => <path key={y} d={`M12 ${y} H308`} stroke="#334155" />)}<motion.path d="M12 148 L70 128 L128 136 L186 86 L244 70 L300 36" fill="none" stroke="#d4f565" strokeWidth="4" strokeLinecap="round" initial={{ pathLength: reduced ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduced ? 0 : 1.1 }} /><motion.circle cx="300" cy="36" r="6" fill="#d4f565" initial={{ opacity: reduced ? 1 : 0 }} animate={{ opacity: 1 }} transition={{ delay: reduced ? 0 : 1 }} /></svg><p className="text-xs text-slate-400">Illustrative trend · no price forecast</p></div>}
                  {active === 3 && <div className="rounded-2xl bg-white/5 border border-white/15 p-5"><Bell className="w-8 h-8 text-sky-300 mb-5" /><p className="font-bold">INFY · results digest ready</p><p className="text-sm text-slate-300 mt-3 leading-relaxed">The same filing and its key figures appear in a sample watchlist alert.</p><div className="mt-6 inline-flex gap-2 items-center text-xs text-lime-300"><Check className="w-4 h-4" />Sample alert preview</div></div>}
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="flex gap-2 mt-5">{STEPS.map((step,i) => <button key={step.title} type="button" aria-label={`Show step ${i + 1}: ${step.title}`} aria-pressed={active === i} onClick={() => setActive(i)} className={`min-h-11 flex-1 rounded-xl text-sm font-bold ${active === i ? 'bg-[#d4f565] text-slate-900' : 'bg-white/10 text-white'}`}>{i + 1}</button>)}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
