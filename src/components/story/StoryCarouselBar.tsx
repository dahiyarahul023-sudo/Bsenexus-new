import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  Sparkles, 
  Zap, 
  CalendarDays, 
  Building2, 
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Activity
} from 'lucide-react';
import { 
  getISTMarketSession, 
  getStorySessionStorageKey,
  fetchLiveStoryChapters,
  getInitialStoryChapters,
  StoryChapter
} from './storyData';
import { CompanyBrandLogo } from './StoryVisuals';
import { springSnappy, buttonTap } from '../../utils/motionTokens';

interface StoryCarouselBarProps {
  onOpenStory: (chapterId?: string) => void;
  className?: string;
}

interface StoryCapsule {
  id: string;
  chapterId: string;
  title: string;
  subtitle: string;
  badge?: string;
  iconType: 'pulse' | 'movers' | 'announcements' | 'results' | 'fiidii';
  symbol?: string;
  scripCode?: string;
  accentGradient: string;
  statPeek?: {
    value: string;
    isPositive?: boolean;
  };
}

export const StoryCarouselBar: React.FC<StoryCarouselBarProps> = ({ 
  onOpenStory,
  className = ''
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [hasSeenStory, setHasSeenStory] = useState(false);
  const [liveData, setLiveData] = useState<{
    sensexChange?: number;
    sensexPct?: number;
    topGainer?: { symbol: string; changePercent: number; scripCode: string };
    todayMeetingsCount?: number;
    fiiNet?: number;
    freshAnnCount?: number;
  }>(() => {
    const init = getInitialStoryChapters();
    const pSlide = init[0]?.slides?.[0];
    const mSlide = init[0]?.slides?.[1];
    const fSlide = init[1]?.slides?.[0];
    const rSlide = init[2]?.slides?.[0];
    const aSlide = init[3]?.slides?.[0];
    const topM = mSlide?.movers?.[0] || pSlide?.movers?.[0];
    return {
      sensexPct: pSlide?.indicesSummary?.sensex?.changePercent,
      topGainer: topM ? {
        symbol: topM.symbol,
        changePercent: topM.changePercent,
        scripCode: topM.scripCode
      } : undefined,
      fiiNet: fSlide?.fiiDiiData?.netBalance,
      todayMeetingsCount: rSlide?.upcomingResults?.length,
      freshAnnCount: aSlide?.corporateActions?.length
    };
  });

  const session = getISTMarketSession();
  const storageKey = getStorySessionStorageKey();

  // Check viewed state
  useEffect(() => {
    try {
      const viewed = localStorage.getItem(storageKey);
      if (viewed === 'true') {
        setHasSeenStory(true);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [storageKey]);

  // Fetch quick live stats for carousel peek
  useEffect(() => {
    let isMounted = true;
    fetchLiveStoryChapters().then((chapters: StoryChapter[]) => {
      if (!isMounted || !chapters || chapters.length === 0) return;

      const pSlide = chapters[0]?.slides?.[0];
      const mSlide = chapters[0]?.slides?.[1];
      const fSlide = chapters[1]?.slides?.[0];
      const rSlide = chapters[2]?.slides?.[0];
      const aSlide = chapters[3]?.slides?.[0];

      const sensexPct = pSlide?.indicesSummary?.sensex?.changePercent;
      const topMover = mSlide?.movers?.[0] || pSlide?.movers?.[0];
      const fiiNet = fSlide?.fiiDiiData?.netBalance;
      const resultsCount = rSlide?.upcomingResults?.length;
      const annCount = aSlide?.corporateActions?.length;

      setLiveData({
        sensexPct,
        topGainer: topMover ? {
          symbol: topMover.symbol,
          changePercent: topMover.changePercent,
          scripCode: topMover.scripCode
        } : undefined,
        fiiNet,
        todayMeetingsCount: resultsCount,
        freshAnnCount: annCount
      });
    }).catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  const handleCapsuleClick = (chapterId: string) => {
    try {
      localStorage.setItem(storageKey, 'true');
      setHasSeenStory(true);
    } catch {}
    onOpenStory(chapterId);
  };

  // 5 Story Capsules
  const capsules: StoryCapsule[] = [
    {
      id: 'capsule-pulse',
      chapterId: 'market-pulse',
      title: 'Market Pulse',
      subtitle: liveData.sensexPct !== undefined 
        ? `Sensex ${liveData.sensexPct >= 0 ? '+' : ''}${liveData.sensexPct.toFixed(2)}%`
        : 'Dalal St. Wrap',
      iconType: 'pulse',
      symbol: 'SENSEX',
      accentGradient: 'from-emerald-500 via-teal-500 to-cyan-500',
      statPeek: liveData.sensexPct !== undefined ? {
        value: `${liveData.sensexPct >= 0 ? '+' : ''}${liveData.sensexPct.toFixed(2)}%`,
        isPositive: liveData.sensexPct >= 0
      } : undefined
    },
    {
      id: 'capsule-movers',
      chapterId: 'market-pulse',
      title: 'Top Movers',
      subtitle: liveData.topGainer 
        ? `${liveData.topGainer.symbol} +${liveData.topGainer.changePercent.toFixed(1)}%`
        : 'Gainers & Dips',
      iconType: 'movers',
      symbol: liveData.topGainer?.symbol || 'TATAMOTORS',
      scripCode: liveData.topGainer?.scripCode || '500570',
      accentGradient: 'from-blue-500 via-indigo-500 to-violet-500',
      statPeek: liveData.topGainer ? {
        value: `+${liveData.topGainer.changePercent.toFixed(1)}%`,
        isPositive: true
      } : undefined
    },
    {
      id: 'capsule-announcements',
      chapterId: 'corporate-actions',
      title: 'Order Wins',
      subtitle: 'SEBI Reg 30',
      badge: 'BSE Live',
      iconType: 'announcements',
      symbol: 'LT',
      scripCode: '500510',
      accentGradient: 'from-amber-500 via-orange-500 to-rose-500'
    },
    {
      id: 'capsule-results',
      chapterId: 'earnings-radar',
      title: 'Results Radar',
      subtitle: liveData.todayMeetingsCount ? `${liveData.todayMeetingsCount} meetings` : 'Q3 Meetings',
      badge: 'Calendar',
      iconType: 'results',
      symbol: 'TCS',
      scripCode: '532540',
      accentGradient: 'from-purple-500 via-pink-500 to-rose-500'
    },
    {
      id: 'capsule-fiidii',
      chapterId: 'institutional-flows',
      title: 'FII / DII Flow',
      subtitle: liveData.fiiNet !== undefined 
        ? `${liveData.fiiNet >= 0 ? '+' : ''}₹${Math.round(liveData.fiiNet).toLocaleString('en-IN')} Cr`
        : 'Smart Cash',
      iconType: 'fiidii',
      symbol: 'HDFCBANK',
      scripCode: '500180',
      accentGradient: 'from-teal-500 via-emerald-500 to-green-600',
      statPeek: liveData.fiiNet !== undefined ? {
        value: `${liveData.fiiNet >= 0 ? '+' : ''}₹${Math.round(liveData.fiiNet)} Cr`,
        isPositive: liveData.fiiNet >= 0
      } : undefined
    }
  ];

  return (
    <div className={`w-full ${className}`}>
      {/* Top Header Label */}
      <div className="flex items-center justify-between px-1 mb-2">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
            Market Stories
          </span>
          <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded-sm bg-slate-100 dark:bg-[#1E1B2E] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
            {session.editionLabel}
          </span>
        </div>

        <button
          type="button"
          onClick={() => handleCapsuleClick('market-pulse')}
          className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5 cursor-pointer"
        >
          <span>Watch all</span>
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {/* Horizontal Scrollable Carousel Row (Groww / Instagram style) */}
      <div 
        ref={scrollContainerRef}
        className="flex items-center gap-3 sm:gap-4 overflow-x-auto no-scrollbar py-1 px-1 scroll-smooth snap-x overscroll-x-contain"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {capsules.map((capsule) => {
          return (
            <motion.button
              key={capsule.id}
              type="button"
              whileTap={{ scale: 0.94 }}
              transition={springSnappy}
              onClick={() => handleCapsuleClick(capsule.chapterId)}
              className="flex flex-col items-center gap-1.5 shrink-0 group cursor-pointer focus:outline-hidden select-none"
              style={{ width: '74px' }}
            >
              {/* Story Ring Avatar Container */}
              <div 
                className={`relative rounded-full p-[2.5px] transition-all duration-300 ${
                  hasSeenStory
                    ? 'border-2 border-slate-300/80 dark:border-slate-700/80 bg-transparent'
                    : `bg-gradient-to-tr ${capsule.accentGradient} shadow-sm group-hover:shadow-md group-hover:scale-105`
                }`}
              >
                {/* White / Dark inner ring separator */}
                <div className="w-[54px] h-[54px] rounded-full bg-white dark:bg-[#131120] p-1 flex items-center justify-center overflow-hidden transition-transform">
                  {/* Clean Icon or Brand Logo */}
                  {capsule.symbol ? (
                    <CompanyBrandLogo 
                      symbol={capsule.symbol} 
                      scripCode={capsule.scripCode}
                      size="md"
                      className="w-full h-full object-contain pointer-events-none"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200">
                      <TrendingUp className="w-5 h-5 text-emerald-500" />
                    </div>
                  )}
                </div>

                {/* Live / Unread Pulse Dot */}
                {!hasSeenStory && (
                  <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#131120] flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  </span>
                )}

                {/* Tiny Stat Peek Pill on capsule corner */}
                {capsule.statPeek && (
                  <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-black px-1.5 py-0.2 rounded-full whitespace-nowrap shadow-xs border border-white/40 dark:border-slate-900/40 ${
                    capsule.statPeek.isPositive 
                      ? 'bg-emerald-500 text-white' 
                      : 'bg-rose-500 text-white'
                  }`}>
                    {capsule.statPeek.value}
                  </div>
                )}
              </div>

              {/* Capsule Text Labels */}
              <div className="text-center w-full min-w-0">
                <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate leading-tight group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors">
                  {capsule.title}
                </p>
                <p className="text-[9px] font-medium text-slate-400 dark:text-slate-400 truncate leading-tight mt-0.5">
                  {capsule.subtitle}
                </p>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};
