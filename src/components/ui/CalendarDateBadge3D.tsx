import React from 'react';

interface CalendarDateBadge3DProps {
  month: string;
  date: string;
  day?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * CalendarDateBadge3D — Authentic Apple/iOS-Style 3D Desk Calendar Icon
 * 
 * Features:
 * - Rich crimson-red header bar with 3D gloss and embossed month text
 * - Metallic dual binder rings at the top
 * - Tactile tear-off white/frosted paper pad with soft inner depth
 * - Heavy bold tabular date number with crisp contrast
 * - Subtle day label at the base
 * - Physically grounded 3D drop shadow and bottom paper stack bevel
 */
export function CalendarDateBadge3D({
  month,
  date,
  day,
  className = '',
  size = 'md'
}: CalendarDateBadge3DProps) {
  const isSm = size === 'sm';
  const isLg = size === 'lg';

  const widthClass = isSm ? 'w-12 h-14' : isLg ? 'w-18 h-20' : 'w-15 sm:w-16 h-17 sm:h-18';
  const monthTextClass = isSm ? 'text-[9px]' : isLg ? 'text-xs' : 'text-[10px] sm:text-[11px]';
  const dateTextClass = isSm ? 'text-lg' : isLg ? 'text-3xl' : 'text-xl sm:text-2xl';
  const dayTextClass = isSm ? 'text-[8px]' : 'text-[9px] sm:text-[9.5px]';

  return (
    <div
      aria-label={`${month} ${date}${day ? `, ${day}` : ''}`}
      className={`relative flex flex-col rounded-2xl overflow-hidden shrink-0 select-none shadow-[0_8px_20px_-4px_rgba(220,38,38,0.28),0_4px_8px_-2px_rgba(0,0,0,0.08)] border border-red-500/30 transition-transform duration-200 group-hover:scale-105 ${widthClass} ${className}`}
    >
      {/* 3D Binder Rings (Metallic Spiral Pins) */}
      <div className="absolute top-1 left-2.5 sm:left-3 w-1.5 h-2.5 rounded-full bg-gradient-to-b from-slate-200 via-white to-slate-400 shadow-xs z-20 pointer-events-none" />
      <div className="absolute top-1 right-2.5 sm:right-3 w-1.5 h-2.5 rounded-full bg-gradient-to-b from-slate-200 via-white to-slate-400 shadow-xs z-20 pointer-events-none" />

      {/* Crimson Red Top Header Bar */}
      <div className="relative bg-gradient-to-r from-red-600 via-rose-600 to-red-700 py-1 sm:py-1.2 px-1 text-center shadow-xs z-10 border-b border-red-700/60">
        {/* Subtle top gloss highlight */}
        <div className="absolute inset-x-0 top-0 h-[1px] bg-white/40" />
        <span className={`block font-black uppercase tracking-wider text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)] leading-tight ${monthTextClass}`}>
          {month.slice(0, 3)}
        </span>
      </div>

      {/* Tear-Off White / Frosted Paper Body */}
      <div className="flex-1 bg-gradient-to-b from-white via-slate-50 to-slate-100 dark:from-slate-800 dark:via-slate-850 dark:to-slate-900 flex flex-col items-center justify-center p-1 relative border-t border-slate-100/80 dark:border-slate-750">
        {/* Subtle horizontal micro-perforations */}
        <div className="absolute top-0 inset-x-0 h-[1.5px] bg-slate-200/60 dark:bg-slate-700/60" />

        {/* Big Bold Date */}
        <span className={`font-black text-slate-950 dark:text-white tabular-nums tracking-tight leading-none my-0.5 ${dateTextClass}`}>
          {date}
        </span>

        {/* Day label */}
        {day && (
          <span className={`font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 leading-none ${dayTextClass}`}>
            {day.slice(0, 3)}
          </span>
        )}

        {/* Bottom 3D Paper Stack Shadow Bevel */}
        <div className="absolute bottom-0 inset-x-0 h-[2px] bg-slate-300 dark:bg-slate-950/80" />
      </div>
    </div>
  );
}
