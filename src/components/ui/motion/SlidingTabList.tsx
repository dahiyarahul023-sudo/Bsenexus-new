import React from 'react';
import { cn } from '../../../lib/utils';

// UI-103 fix (Oct 2026 audit): Rewrote SlidingTabList to remove ALL framer-motion
// usage (layoutId FLIP + whileTap + motion.span animate). This component is used
// across 6 surfaces (WatchlistManager, CompanyIntelligenceModal, Announcements,
// ResultsCalendar, NewsPortal, NotificationInbox) — each had a layoutId pill that
// forced getBoundingClientRect() on every tab change = forced synchronous layout.
// Now uses CSS transform + opacity (GPU-composited, zero main-thread cost).
// Also wrapped in React.memo so parent re-renders don't cascade into tab re-renders.

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

interface SlidingTabListProps<T extends string = string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onChange: (id: T) => void;
  layoutId?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export const SlidingTabList = React.memo(function SlidingTabList<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  className = '',
  size = 'md',
}: SlidingTabListProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        "rich-tabs relative flex items-center gap-1 p-1 bg-slate-100/90 dark:bg-[#161422] border border-slate-200/80 dark:border-[#2D283E] rounded-xl overflow-x-auto no-scrollbar select-none",
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative z-10 flex items-center justify-center gap-1.5 font-bold transition-colors cursor-pointer whitespace-nowrap rounded-lg select-none active:scale-95 transition-transform duration-150",
              size === 'sm' ? "min-h-[30px] px-2.5 py-1 text-xs" : "min-h-[36px] px-3.5 py-1.5 text-xs sm:text-sm",
              isActive
                ? "text-slate-900 dark:text-white"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            )}
          >
            {/* CSS transform pill — GPU composited, no JS layout measurement */}
            {isActive && (
              <span
                aria-hidden="true"
                className="rich-tab-pill absolute inset-0 z-[-1] rounded-lg transition-transform duration-200 ease-out"
              />
            )}

            {tab.icon && (
              <span
                className={cn(
                  "flex items-center justify-center transition-transform duration-150",
                  isActive && "scale-110"
                )}
              >
                {tab.icon}
              </span>
            )}

            <span>{tab.label}</span>

            {tab.count !== undefined && (
              <span
                className={cn(
                  "text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full",
                  isActive
                    ? "bg-slate-100 dark:bg-[#342F4B] text-slate-900 dark:text-white"
                    : "bg-slate-200/80 dark:bg-[#201E2E] text-slate-600 dark:text-slate-400"
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}) as <T extends string = string>(props: SlidingTabListProps<T>) => React.ReactElement;
