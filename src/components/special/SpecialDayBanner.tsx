import React, { useState, useEffect } from 'react';
import { Sparkles, Clock, ChevronRight, X } from 'lucide-react';
import { 
  getActiveSpecialDay, 
  isSpecialDayDismissed, 
  setSpecialDayDismissed,
  type SpecialDayConfig 
} from '../../config/specialDay';

interface SpecialDayBannerProps {
  onOpenStory: (config: SpecialDayConfig) => void;
}

export function SpecialDayBanner({ onOpenStory }: SpecialDayBannerProps) {
  const [config, setConfig] = useState<SpecialDayConfig | null>(() => getActiveSpecialDay());
  const [dismissed, setDismissed] = useState<boolean>(() => {
    const active = getActiveSpecialDay();
    return active ? isSpecialDayDismissed(active.id) : false;
  });

  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isLive: boolean;
    hasPassed: boolean;
  }>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isLive: false,
    hasPassed: false
  });

  // Calculate live countdown to sessionDate
  useEffect(() => {
    if (!config) return;

    const sessionTime = new Date(config.sessionDate).getTime();
    const endTime = new Date(config.endsAt).getTime();

    const updateCountdown = () => {
      const now = Date.now();

      // Check auto-hide if session endsAt has passed
      if (now > endTime) {
        setTimeLeft(prev => ({ ...prev, hasPassed: true }));
        setConfig(null);
        return;
      }

      const diff = sessionTime - now;

      if (diff <= 0) {
        // Session is live today
        setTimeLeft({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          isLive: true,
          hasPassed: false
        });
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        setTimeLeft({
          days,
          hours,
          minutes,
          seconds,
          isLive: false,
          hasPassed: false
        });
      }
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [config]);

  if (!config || dismissed || timeLeft.hasPassed) {
    return null;
  }

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSpecialDayDismissed(config.id, true);
    setDismissed(true);
  };

  return (
    <aside
      aria-label={`${config.title} Announcement`}
      onClick={() => onOpenStory(config)}
      className="relative z-30 w-full bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border-b border-indigo-500/20 shadow-xs cursor-pointer select-none transition-all group overflow-hidden"
    >
      {/* Subtle background glow sheen */}
      <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-emerald-500/10 to-indigo-500/5 opacity-70 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-1.5 sm:py-2 flex items-center justify-between gap-2.5 sm:gap-4 text-xs">
        
        {/* Left: Badge & Title */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-xs shrink-0">
            <Sparkles size={11} className="shrink-0 fill-current" />
            <span className="hidden min-[420px]:inline">{config.badgeText}</span>
            <span className="min-[420px]:hidden">SPECIAL</span>
          </span>

          <p className="font-semibold text-slate-100 truncate text-[11px] sm:text-xs">
            <span className="font-bold text-white">{config.shortTitle}</span>
            <span className="hidden md:inline text-slate-300"> — {config.bannerNotice}</span>
          </p>
        </div>

        {/* Center / Right: Live Countdown Clock & CTA */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Live Countdown Display */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/10 dark:bg-black/30 border border-white/10 text-[10.5px] sm:text-[11px] font-mono font-bold text-amber-300">
            <Clock size={12} className="shrink-0 text-amber-400" />
            {timeLeft.isLive ? (
              <span className="text-emerald-400 animate-pulse">SESSION LIVE NOW</span>
            ) : (
              <span>
                {timeLeft.days > 0 && `${timeLeft.days}d `}
                {String(timeLeft.hours).padStart(2, '0')}h{' '}
                {String(timeLeft.minutes).padStart(2, '0')}m{' '}
                <span className="hidden sm:inline">{String(timeLeft.seconds).padStart(2, '0')}s</span>
              </span>
            )}
          </div>

          {/* CTA Link */}
          <div className="hidden sm:flex items-center gap-1 text-[11px] font-bold text-emerald-400 group-hover:text-emerald-300 transition-colors">
            <span>{config.ctaText}</span>
            <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" />
          </div>

          {/* Dismiss Button */}
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss special day notice"
            title="Dismiss notice"
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
