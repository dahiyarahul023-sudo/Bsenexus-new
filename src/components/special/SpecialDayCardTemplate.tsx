import React from 'react';
import { 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  CheckCircle2, 
  CalendarDays, 
  ShieldCheck, 
  ArrowRight,
  Info
} from 'lucide-react';
import type { SpecialDayCard } from '../../config/specialDay';

interface SpecialDayCardTemplateProps {
  card: SpecialDayCard;
  currentIndex: number;
  totalCards: number;
  onActionClick?: (tabId?: string) => void;
  disclaimer: string;
}

export function SpecialDayCardTemplate({
  card,
  currentIndex,
  totalCards,
  onActionClick,
  disclaimer
}: SpecialDayCardTemplateProps) {
  const toneClasses = {
    purple: {
      accentBg: 'bg-purple-500/10 dark:bg-purple-500/20',
      accentText: 'text-purple-600 dark:text-purple-400',
      accentBorder: 'border-purple-500/30',
      statGlow: 'from-purple-500/10 via-purple-500/5 to-transparent',
      pillBg: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30'
    },
    amber: {
      accentBg: 'bg-amber-500/10 dark:bg-amber-500/20',
      accentText: 'text-amber-600 dark:text-amber-400',
      accentBorder: 'border-amber-500/30',
      statGlow: 'from-amber-500/10 via-amber-500/5 to-transparent',
      pillBg: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
    },
    emerald: {
      accentBg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
      accentText: 'text-emerald-600 dark:text-emerald-400',
      accentBorder: 'border-emerald-500/30',
      statGlow: 'from-emerald-500/10 via-emerald-500/5 to-transparent',
      pillBg: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
    },
    blue: {
      accentBg: 'bg-sky-500/10 dark:bg-sky-500/20',
      accentText: 'text-sky-600 dark:text-sky-400',
      accentBorder: 'border-sky-500/30',
      statGlow: 'from-sky-500/10 via-sky-500/5 to-transparent',
      pillBg: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30'
    },
    rose: {
      accentBg: 'bg-rose-500/10 dark:bg-rose-500/20',
      accentText: 'text-rose-600 dark:text-rose-400',
      accentBorder: 'border-rose-500/30',
      statGlow: 'from-rose-500/10 via-rose-500/5 to-transparent',
      pillBg: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
    }
  }[card.themeTone || 'purple'];

  return (
    <div className="w-full h-full flex flex-col justify-between p-5 sm:p-7 select-none overflow-y-auto no-scrollbar">
      {/* Top Meta Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md text-slate-700 dark:text-slate-300 shadow-2xs">
            <Sparkles size={13} className={toneClasses.accentText} />
            <span>{card.tag}</span>
          </div>

          <span className="text-[11px] font-mono font-semibold text-slate-500 dark:text-slate-400">
            {currentIndex + 1} of {totalCards}
          </span>
        </div>

        {/* Title and Subtitle */}
        <div className="space-y-1.5">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-snug font-display">
            {card.title}
          </h2>
          {card.subtitle && (
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {card.subtitle}
            </p>
          )}
        </div>

        {/* Headline Stat Box (if present) */}
        {card.headlineStat && (
          <div className={`relative overflow-hidden rounded-2xl border p-4 sm:p-5 bg-gradient-to-br ${toneClasses.statGlow} ${toneClasses.accentBorder} bg-white/50 dark:bg-slate-900/60 shadow-xs backdrop-blur-sm`}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white font-mono">
                {card.headlineStat.value}
              </span>
              {card.headlineStat.trend === 'up' && (
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                  <TrendingUp size={15} />
                  <span>Elevated</span>
                </span>
              )}
              {card.headlineStat.trend === 'down' && (
                <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 text-xs font-bold">
                  <TrendingDown size={15} />
                  <span>Lower</span>
                </span>
              )}
              {card.headlineStat.trend === 'neutral' && (
                <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-xs font-medium">
                  <Minus size={15} />
                  <span>Standard</span>
                </span>
              )}
            </div>
            <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-400">
              {card.headlineStat.label}
            </p>
          </div>
        )}

        {/* Key Takeaways & Points */}
        <div className="space-y-2.5 pt-1">
          {card.points.map((point, idx) => (
            <div 
              key={idx}
              className="flex items-start gap-3 p-3 rounded-xl bg-slate-100/70 dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/5"
            >
              <div className="shrink-0 mt-0.5">
                {point.tag ? (
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold uppercase tracking-wider border ${toneClasses.pillBg}`}>
                    {point.tag}
                  </span>
                ) : (
                  <CheckCircle2 size={16} className={toneClasses.accentText} />
                )}
              </div>
              <div className="space-y-0.5 min-w-0 flex-1">
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight">
                  {point.title}
                </h3>
                <p className="text-[11.5px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  {point.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Area: Action button & Disclaimer */}
      <div className="mt-6 pt-3 border-t border-slate-200/70 dark:border-white/10 space-y-3">
        {card.actionLabel && (
          <button
            type="button"
            data-story-interactive="true"
            onClick={(e) => {
              e.stopPropagation();
              onActionClick?.(card.actionTab);
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>{card.actionLabel}</span>
            <ArrowRight size={14} />
          </button>
        )}

        {/* Required Market Data Disclaimer */}
        <div className="flex items-start gap-1.5 px-1 text-[10px] text-slate-500 dark:text-slate-500 leading-normal">
          <Info size={12} className="shrink-0 mt-0.5 text-slate-400 dark:text-slate-500" />
          <p>{disclaimer}</p>
        </div>
      </div>
    </div>
  );
}
