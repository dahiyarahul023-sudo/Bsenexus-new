import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, Variants } from 'framer-motion';
import { 
  X, ChevronLeft, ChevronRight, Pause, Play, 
  ArrowUpRight, ArrowDownRight, RotateCw,
  TrendingUp, CalendarDays, Building2, Sparkles
} from 'lucide-react';
import { springSnappy, buttonTap } from '../utils/motionTokens';
import { 
  StoryChapter, 
  DEFAULT_STORY_CHAPTERS, 
  getInitialStoryChapters,
  getISTMarketSession,
  getAllSlides, 
  fetchLiveStoryChapters 
} from './story/storyData';
import { 
  CompanyBrandLogo, 
  GrowwStoryCardHero 
} from './story/StoryVisuals';

interface TodayMarketStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialChapterId?: string;
  onStoryViewed?: () => void;
  onOpenCompanyIntel?: (scripCode?: string, symbol?: string, companyName?: string) => void;
}

const SLIDE_DURATION_MS = 6500;

// Instagram / Groww Distinct Motion Transition Variants
// 1. Chapter Change (3D Cube / Depth Perspective Flip across chapters)
// 2. Intra-Chapter Slide (Smooth, lightweight horizontal lateral slide)
export interface SlideMotionState {
  type: 'intra-slide' | 'chapter-change';
  dir: 1 | -1;
  chapterTitle?: string;
  chapterIndex?: number;
}

const storyMotionVariants: Variants = {
  initial: (custom: SlideMotionState) => {
    if (custom.type === 'chapter-change') {
      return {
        opacity: 0,
        rotateY: custom.dir > 0 ? 55 : -55,
        x: custom.dir > 0 ? 80 : -80,
        scale: 0.84,
        transformOrigin: custom.dir > 0 ? 'left center' : 'right center',
        transformPerspective: 1200,
      };
    }
    // Intra-chapter slide: smooth linear translate without 3D rotation
    return {
      opacity: 0,
      rotateY: 0,
      x: custom.dir > 0 ? 36 : -36,
      scale: 0.99,
      transformOrigin: 'center center',
    };
  },
  animate: (custom: SlideMotionState) => ({
    opacity: 1,
    rotateY: 0,
    x: 0,
    scale: 1,
    transition: custom.type === 'chapter-change'
      ? {
          type: "spring",
          damping: 24,
          stiffness: 220,
          mass: 0.8,
        }
      : {
          duration: 0.2,
          ease: [0.16, 1, 0.3, 1] as const,
        }
  }),
  exit: (custom: SlideMotionState) => {
    if (custom.type === 'chapter-change') {
      return {
        opacity: 0,
        rotateY: custom.dir > 0 ? -55 : 55,
        x: custom.dir > 0 ? -80 : 80,
        scale: 0.84,
        transformOrigin: custom.dir > 0 ? 'right center' : 'left center',
        transformPerspective: 1200,
        transition: {
          duration: 0.22,
          ease: [0.32, 0, 0.67, 0] as const,
        }
      };
    }
    // Intra-chapter exit
    return {
      opacity: 0,
      rotateY: 0,
      x: custom.dir > 0 ? -36 : 36,
      scale: 0.99,
      transition: {
        duration: 0.16,
        ease: [0.32, 0, 0.67, 0] as const,
      }
    };
  }
};

export function TodayMarketStoryModal({ 
  isOpen, 
  onClose, 
  initialChapterId,
  onStoryViewed,
  onOpenCompanyIntel 
}: TodayMarketStoryModalProps) {
  const marketSession = useMemo(() => getISTMarketSession(), []);
  const [chapters, setChapters] = useState<StoryChapter[]>(() => getInitialStoryChapters());
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [tapFeedbackSide, setTapFeedbackSide] = useState<'left' | 'right' | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Instagram / Groww Chapter vs Intra-Slide Motion Tracking
  const [slideMotion, setSlideMotion] = useState<SlideMotionState>({ type: 'intra-slide', dir: 1 });
  const [showChapterToast, setShowChapterToast] = useState<boolean>(false);
  const chapterToastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activeCapsuleRef = useRef<HTMLButtonElement | null>(null);
  
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const elapsedBeforePauseRef = useRef<number>(0);

  // Touch swipe handling
  const touchStartXRef = useRef<number>(0);
  const touchStartYRef = useRef<number>(0);
  const touchStartTimeRef = useRef<number>(0);

  // Drag-to-dismiss motion value
  const dragY = useMotionValue(0);
  const modalOpacity = useTransform(dragY, [0, 200], [1, 0.4]);

  // Flattened slide list across all 4 chapters
  const allSlides = useMemo(() => getAllSlides(chapters), [chapters]);
  const currentSlide = allSlides[currentSlideIndex] || allSlides[0];

  // Current chapter calculation
  const currentChapter = useMemo(() => {
    if (!currentSlide) return chapters[0];
    return chapters.find(c => c.id === currentSlide.chapterId) || chapters[0];
  }, [chapters, currentSlide]);

  const currentChapterIndex = useMemo(() => {
    return chapters.findIndex(c => c.id === currentChapter?.id);
  }, [chapters, currentChapter?.id]);

  // Dynamic atmospheric themes for each chapter
  const chapterTheme = useMemo(() => {
    if (currentChapter?.id === 'chapter-market-moves') {
      return {
        bg: 'from-[#071B14] via-[#05110E] to-[#030806]',
        glow: 'from-emerald-500/20 via-teal-500/10 to-transparent',
        accentDot: 'bg-emerald-400',
        activeTab: 'bg-emerald-500/25 text-emerald-300 border-emerald-400/50 shadow-emerald-500/10',
        title: 'BSE Movers',
      };
    }
    if (currentChapter?.id === 'chapter-results-radar') {
      return {
        bg: 'from-[#1B1207] via-[#100C04] to-[#070502]',
        glow: 'from-amber-500/20 via-orange-500/10 to-transparent',
        accentDot: 'bg-amber-400',
        activeTab: 'bg-amber-500/25 text-amber-300 border-amber-400/50 shadow-amber-500/10',
        title: 'Earnings Radar',
      };
    }
    return {
      bg: 'from-[#141029] via-[#0B0917] to-[#05040B]',
      glow: 'from-indigo-500/20 via-violet-500/10 to-transparent',
      accentDot: 'bg-indigo-400',
      activeTab: 'bg-indigo-500/25 text-indigo-300 border-indigo-400/50 shadow-indigo-500/10',
      title: 'Market Pulse',
    };
  }, [currentChapter?.id]);

  // Current slide index relative to the current chapter
  const currentSlideInChapter = currentSlide?.slideIndexInChapter ?? 0;
  const chapterSlideCount = currentChapter?.slides?.length ?? 1;

  // Jump to initial chapter if provided on open
  useEffect(() => {
    if (isOpen && initialChapterId && allSlides.length > 0) {
      const targetIndex = allSlides.findIndex(s => s.chapterId === initialChapterId);
      if (targetIndex !== -1) {
        setCurrentSlideIndex(targetIndex);
      } else {
        setCurrentSlideIndex(0);
      }
      setProgress(0);
    } else if (isOpen) {
      setCurrentSlideIndex(0);
      setProgress(0);
    }
  }, [isOpen, initialChapterId, allSlides]);

  // Mark story viewed when modal is opened
  useEffect(() => {
    if (isOpen) {
      onStoryViewed?.();
    }
  }, [isOpen, onStoryViewed]);

  // Lock background body scroll completely while modal is open
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    const originalPosition = document.body.style.position;
    const originalTop = document.body.style.top;
    const originalWidth = document.body.style.width;

    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    return () => {
      document.body.style.position = originalPosition;
      document.body.style.top = originalTop;
      document.body.style.width = originalWidth;
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  // Fetch live chapters on open
  const loadFreshStory = useCallback(async (force = false) => {
    try {
      setIsRefreshing(true);
      const live = await fetchLiveStoryChapters(force);
      if (live && live.length > 0) {
        setChapters(live);
      }
    } catch (e) {
      console.warn("Could not load fresh story chapters:", e);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadFreshStory(false);
    }
  }, [isOpen, loadFreshStory]);

  // Trigger floating Instagram/Groww chapter indicator toast
  const triggerChapterToast = useCallback(() => {
    setShowChapterToast(true);
    if (chapterToastTimeoutRef.current) clearTimeout(chapterToastTimeoutRef.current);
    chapterToastTimeoutRef.current = setTimeout(() => setShowChapterToast(false), 2400);
  }, []);

  // Auto-scroll active chapter capsule into view
  useEffect(() => {
    if (activeCapsuleRef.current) {
      activeCapsuleRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }
  }, [currentChapter?.id]);

  // Jump directly to a specific chapter
  const handleJumpToChapter = useCallback((chapterId: string) => {
    const targetIdx = allSlides.findIndex(s => s.chapterId === chapterId);
    if (targetIdx !== -1 && targetIdx !== currentSlideIndex) {
      const dir: 1 | -1 = targetIdx > currentSlideIndex ? 1 : -1;
      setSlideMotion({
        type: 'chapter-change',
        dir,
        chapterTitle: allSlides[targetIdx]?.chapterTitle,
        chapterIndex: allSlides[targetIdx]?.chapterIndex,
      });
      triggerChapterToast();
      setProgress(0);
      elapsedBeforePauseRef.current = 0;
      startTimeRef.current = Date.now();
      setCurrentSlideIndex(targetIdx);
    }
  }, [allSlides, currentSlideIndex, triggerChapterToast]);

  // Navigation handlers
  const handleNext = useCallback(() => {
    setProgress(0);
    elapsedBeforePauseRef.current = 0;
    startTimeRef.current = Date.now();
    setCurrentSlideIndex(prev => {
      if (prev < allSlides.length - 1) {
        const nextIdx = prev + 1;
        const willChangeChapter = allSlides[prev]?.chapterId !== allSlides[nextIdx]?.chapterId;
        setSlideMotion({
          type: willChangeChapter ? 'chapter-change' : 'intra-slide',
          dir: 1,
          chapterTitle: willChangeChapter ? allSlides[nextIdx]?.chapterTitle : undefined,
          chapterIndex: willChangeChapter ? allSlides[nextIdx]?.chapterIndex : undefined,
        });
        if (willChangeChapter) {
          triggerChapterToast();
        }
        return nextIdx;
      }
      onClose();
      return prev;
    });
  }, [allSlides, onClose, triggerChapterToast]);

  const handlePrev = useCallback(() => {
    setProgress(0);
    elapsedBeforePauseRef.current = 0;
    startTimeRef.current = Date.now();
    setCurrentSlideIndex(prev => {
      if (prev > 0) {
        const nextIdx = prev - 1;
        const willChangeChapter = allSlides[prev]?.chapterId !== allSlides[nextIdx]?.chapterId;
        setSlideMotion({
          type: willChangeChapter ? 'chapter-change' : 'intra-slide',
          dir: -1,
          chapterTitle: willChangeChapter ? allSlides[nextIdx]?.chapterTitle : undefined,
          chapterIndex: willChangeChapter ? allSlides[nextIdx]?.chapterIndex : undefined,
        });
        if (willChangeChapter) {
          triggerChapterToast();
        }
        return nextIdx;
      }
      return 0;
    });
  }, [allSlides, triggerChapterToast]);

  // Timer loop for progress bar
  useEffect(() => {
    if (!isOpen || isPaused) return;

    startTimeRef.current = Date.now() - elapsedBeforePauseRef.current;

    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min(100, (elapsed / SLIDE_DURATION_MS) * 100);
      setProgress(pct);

      if (pct >= 100) {
        clearInterval(progressIntervalRef.current!);
        handleNext();
      }
    }, 40);

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [isOpen, isPaused, currentSlideIndex, handleNext]);

  // Pause on hold
  const handlePointerDown = () => {
    setIsPaused(true);
    elapsedBeforePauseRef.current = Date.now() - startTimeRef.current;
  };

  const handlePointerUp = () => {
    setIsPaused(false);
  };

  // Tap navigation (Left 30% prev, Right 70% next)
  const handleCardTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;

    if (clickX < width * 0.30) {
      setTapFeedbackSide('left');
      setTimeout(() => setTapFeedbackSide(null), 250);
      handlePrev();
    } else {
      setTapFeedbackSide('right');
      setTimeout(() => setTapFeedbackSide(null), 250);
      handleNext();
    }
  };

  // Touch swipe support & pull down to dismiss
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    touchStartTimeRef.current = Date.now();
    handlePointerDown();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    handlePointerUp();
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartXRef.current;
    const deltaY = touchEndY - touchStartYRef.current;
    const deltaTime = Date.now() - touchStartTimeRef.current;

    // Pull down to dismiss (deltaY > 90px in reasonable time)
    if (deltaY > 90 && Math.abs(deltaY) > Math.abs(deltaX)) {
      onClose();
      return;
    }

    // Horizontal swipe threshold
    if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) && deltaTime < 400) {
      if (deltaX < 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' || e.key === ' ') handleNext();
      else if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handleNext, handlePrev]);

  const handleOpenCompanyHub = (scripCode?: string, symbol?: string, companyName?: string) => {
    if (!scripCode && !symbol) return;
    onClose();
    if (onOpenCompanyIntel) {
      onOpenCompanyIntel(scripCode, symbol, companyName);
    }
  };

  if (!isOpen || !currentSlide) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md overflow-hidden select-none"
        onClick={onClose}
      >
        {/* Story Modal Container */}
        <motion.div
          key="story-modal-card"
          initial={{ opacity: 0, scale: 0.94, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 40 }}
          transition={springSnappy}
          drag="y"
          dragConstraints={{ top: 0, bottom: 250 }}
          dragElastic={0.4}
          onDragEnd={(_, info) => {
            if (info.offset.y > 100 || info.velocity.y > 400) {
              onClose();
            }
          }}
          style={{ opacity: modalOpacity }}
          className={`relative w-full h-full sm:h-[660px] sm:max-w-md bg-gradient-to-b ${chapterTheme.bg} sm:rounded-3xl border border-white/15 shadow-2xl flex flex-col justify-between overflow-hidden transition-colors duration-500`}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={handlePointerDown}
          onMouseUp={handlePointerUp}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Ambient Chapter Radial Glow */}
          <div className={`absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-radial ${chapterTheme.glow} blur-2xl pointer-events-none z-0 transition-all duration-700`} />

          {/* Top Drag Indicator Pill (Apple style) */}
          <div className="w-full pt-2 flex justify-center shrink-0 relative z-20">
            <div className="w-10 h-1 rounded-full bg-white/25" />
          </div>

          {/* Floating Instagram / Groww Chapter Toast on Chapter Boundaries */}
          <AnimatePresence>
            {showChapterToast && (
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.88 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.94 }}
                transition={{ type: "spring", damping: 22, stiffness: 280 }}
                className="absolute top-20 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-2xl bg-black/90 backdrop-blur-2xl border border-white/20 shadow-2xl flex items-center gap-2.5 pointer-events-none whitespace-nowrap"
              >
                <span className={`w-2.5 h-2.5 rounded-full ${chapterTheme.accentDot} animate-ping shrink-0`} />
                <div className="flex flex-col text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-black tracking-widest uppercase text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded">
                      CHAPTER {currentChapterIndex + 1} OF {chapters.length}
                    </span>
                    <span className="text-[9px] font-bold text-slate-300">
                      {marketSession.editionBadge}
                    </span>
                  </div>
                  <span className="text-xs font-black text-white tracking-tight mt-0.5">
                    {currentChapter.title}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ======================================================== */}
          {/* TOP STORY HEADER & PROGRESS BARS                          */}
          {/* ======================================================== */}
          <div className="pt-2 px-4 pb-2 shrink-0 bg-gradient-to-b from-black/80 via-black/40 to-transparent z-20">
            {/* Top Row: Category dot + Chapter Name + Session Badge + Controls */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-2 h-2 rounded-full ${chapterTheme.accentDot} animate-pulse shrink-0`} />
                <h2 className="text-sm font-bold text-white tracking-tight truncate drop-shadow-sm font-display">
                  {currentChapter.title}
                </h2>
                <span className="hidden sm:inline-block text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-slate-300 border border-white/10 whitespace-nowrap">
                  {marketSession.editionBadge}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {/* Manual Story Feed Refresh */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    loadFreshStory(true);
                  }}
                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 flex items-center justify-center text-white/80 transition-colors cursor-pointer"
                  title="Refresh Story with latest market data & news (< 18h)"
                  aria-label="Refresh Story Feed"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
                </button>

                {/* Play / Pause indicator */}
                <button 
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsPaused(prev => !prev);
                  }}
                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 flex items-center justify-center text-white/80 transition-colors cursor-pointer"
                  aria-label={isPaused ? "Play story" : "Pause story"}
                >
                  {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5 fill-current" />}
                </button>

                {/* Close Modal */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                  }}
                  className="w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 active:bg-white/35 flex items-center justify-center text-white transition-colors cursor-pointer"
                  aria-label="Close Story"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Interactive Chapter Indicator Capsules (Instagram / Groww style) */}
            <div className="flex items-center gap-1.5 w-full mb-2 overflow-x-auto no-scrollbar py-0.5">
              {chapters.map((ch, idx) => {
                const isAct = ch.id === currentChapter?.id;
                return (
                  <button
                    ref={isAct ? activeCapsuleRef : null}
                    key={ch.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleJumpToChapter(ch.id);
                    }}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-tight transition-all duration-200 cursor-pointer flex items-center gap-1.5 border shrink-0 ${
                      isAct 
                        ? `${chapterTheme.activeTab} font-black scale-102` 
                        : 'bg-white/5 hover:bg-white/10 text-slate-400 border-white/10'
                    }`}
                    title={`Switch to Chapter ${idx + 1}: ${ch.title}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${isAct ? chapterTheme.accentDot + ' animate-pulse' : 'bg-slate-500'}`} />
                    <span>{idx + 1}. {ch.title.split('&')[0].trim()}</span>
                  </button>
                );
              })}
            </div>

            {/* Segmented Progress Bars: ONLY FOR THE CURRENT CHAPTER SLIDES */}
            <div className="grid gap-1.5 w-full" style={{ gridTemplateColumns: `repeat(${chapterSlideCount}, 1fr)` }}>
              {currentChapter.slides.map((_, idx) => {
                const isCompleted = idx < currentSlideInChapter;
                const isCurrent = idx === currentSlideInChapter;
                const fillWidth = isCompleted ? 100 : isCurrent ? progress : 0;

                return (
                  <div 
                    key={idx} 
                    className="h-1 bg-white/25 rounded-full overflow-hidden backdrop-blur-xs relative"
                  >
                    <div 
                      className="h-full bg-white rounded-full transition-all duration-75 ease-linear"
                      style={{ width: `${fillWidth}%` }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* ======================================================== */}
          {/* SLIDE CONTENT AREA (With Touch Zones)                    */}
          {/* ======================================================== */}
          <div 
            className="flex-1 px-4 pt-1 pb-20 flex flex-col justify-between overflow-y-auto overscroll-contain relative z-10"
            onClick={handleCardTap}
            style={{ perspective: 1200 }}
          >
            {/* Visual Tap Feedback Ripple Chevrons */}
            {tapFeedbackSide === 'left' && (
              <div className="absolute top-1/2 left-3 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white pointer-events-none z-30 animate-ping">
                <ChevronLeft className="w-6 h-6" />
              </div>
            )}
            {tapFeedbackSide === 'right' && (
              <div className="absolute top-1/2 right-3 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white pointer-events-none z-30 animate-ping">
                <ChevronRight className="w-6 h-6" />
              </div>
            )}

            <AnimatePresence mode="wait" custom={slideMotion}>
              <motion.div
                key={currentSlide.id}
                custom={slideMotion}
                variants={storyMotionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                style={{ transformStyle: 'preserve-3d' }}
                className="flex flex-col gap-3 my-auto will-change-transform"
              >
                {/* 1. Tagline & Badges */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    {currentSlide.tagline}
                  </span>
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md shadow-xs tracking-wider ${currentSlide.badgeColor}`}>
                    {currentSlide.badge}
                  </span>
                </div>

                {/* 2. Slide Title */}
                <h1 className="text-base sm:text-lg font-extrabold text-white leading-tight tracking-tight font-display drop-shadow-sm">
                  {currentSlide.title}
                </h1>

                {/* 3. GROWW-STYLE BRAND HERO CARD (Clean stock logo + key live metric) */}
                <GrowwStoryCardHero
                  symbol={currentSlide.actionPill?.symbol || 'SENSEX'}
                  scripCode={currentSlide.actionPill?.scripCode}
                  name={currentSlide.actionPill?.name}
                  badge={currentSlide.badge}
                  badgeColor={currentSlide.badgeColor}
                  statLabel={currentSlide.statsLabel}
                  statValue={currentSlide.statsValue}
                  isPositive={currentSlide.marketTrend === 'BULL' || (currentSlide.indicesSummary?.sensex?.change || 0) >= 0}
                  highlightCategory={currentSlide.chapterTitle}
                  className="w-full shrink-0"
                />

                {/* Rich Story Narrative / Context */}
                {currentSlide.description && (
                  <p className="text-xs text-slate-300/95 leading-relaxed line-clamp-2 px-0.5 font-sans">
                    {currentSlide.description}
                  </p>
                )}

                {/* 4. DIRECT STRUCTURED DATA CARDS */}
                
                {/* Layout A: Indices & Live Sentiment */}
                {currentSlide.indicesSummary && (
                  <div className="grid grid-cols-2 gap-2 bg-white/5 border border-white/10 rounded-xl p-2.5 backdrop-blur-md">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                        <CompanyBrandLogo symbol="SENSEX" size="xs" />
                        <span>BSE SENSEX</span>
                      </div>
                      <div className="text-sm font-black text-white mt-0.5 font-mono">
                        {currentSlide.indicesSummary.sensex.price.toLocaleString('en-IN')}
                      </div>
                      <div className={`text-[10px] font-bold flex items-center gap-0.5 ${currentSlide.indicesSummary.sensex.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {currentSlide.indicesSummary.sensex.change >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        <span>{currentSlide.indicesSummary.sensex.change >= 0 ? '+' : ''}{currentSlide.indicesSummary.sensex.changePercent.toFixed(2)}%</span>
                      </div>
                    </div>

                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                        <CompanyBrandLogo symbol="NIFTY" size="xs" />
                        <span>NSE NIFTY</span>
                      </div>
                      <div className="text-sm font-black text-white mt-0.5 font-mono">
                        {currentSlide.indicesSummary.nifty.price.toLocaleString('en-IN')}
                      </div>
                      <div className={`text-[10px] font-bold flex items-center gap-0.5 ${currentSlide.indicesSummary.nifty.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {currentSlide.indicesSummary.nifty.change >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        <span>{currentSlide.indicesSummary.nifty.change >= 0 ? '+' : ''}{currentSlide.indicesSummary.nifty.changePercent.toFixed(2)}%</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Layout B: Stock Movers (Top Gainers / Dips / Titans) */}
                {currentSlide.movers && currentSlide.movers.length > 0 && (
                  <div className="grid grid-cols-2 gap-1.5">
                    {currentSlide.movers.slice(0, 4).map((m) => {
                      const isUp = m.changePercent >= 0;
                      return (
                        <button
                          type="button"
                          key={m.symbol}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenCompanyHub(m.scripCode, m.symbol, m.name);
                          }}
                          className="flex items-center justify-between p-2 rounded-xl bg-white/5 hover:bg-white/15 active:scale-98 border border-white/10 transition-all cursor-pointer text-left group"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <CompanyBrandLogo 
                              symbol={m.symbol} 
                              scripCode={m.scripCode} 
                              name={m.name} 
                              size="sm" 
                            />
                            <div className="truncate">
                              <p className="text-[11px] font-bold text-white truncate leading-tight flex items-center gap-0.5">
                                {m.symbol}
                                <ArrowUpRight className="w-2.5 h-2.5 text-white/40 group-hover:text-emerald-400 transition-colors inline shrink-0" />
                              </p>
                              <p className="text-[9px] text-slate-400 truncate leading-tight">{m.volume || m.reason || 'Active'}</p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[11px] font-mono font-bold text-slate-200">₹{m.price.toLocaleString('en-IN')}</p>
                            <span className={`text-[10px] font-mono font-black flex items-center justify-end ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {isUp ? '+' : ''}{m.changePercent.toFixed(2)}%
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Layout C: Institutional Cash Ledger (FII vs DII) */}
                {currentSlide.fiiDiiData && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex flex-col gap-2">
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className={`p-2 rounded-lg border ${currentSlide.fiiDiiData.fiiNet >= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
                        <span className={`text-[10px] font-bold block ${currentSlide.fiiDiiData.fiiNet >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                          {currentSlide.fiiDiiData.fiiNet >= 0 ? 'FII Net Inflow' : 'FII Net Outflow'}
                        </span>
                        <span className={`text-xs sm:text-sm font-black font-mono mt-0.5 block ${currentSlide.fiiDiiData.fiiNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {currentSlide.fiiDiiData.fiiNet >= 0 ? '+' : '-'}₹{Math.abs(Math.round(currentSlide.fiiDiiData.fiiNet)).toLocaleString('en-IN')} Cr
                        </span>
                      </div>
                      <div className={`p-2 rounded-lg border ${currentSlide.fiiDiiData.diiNet >= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
                        <span className={`text-[10px] font-bold block ${currentSlide.fiiDiiData.diiNet >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                          {currentSlide.fiiDiiData.diiNet >= 0 ? 'DII Net Inflow' : 'DII Net Outflow'}
                        </span>
                        <span className={`text-xs sm:text-sm font-black font-mono mt-0.5 block ${currentSlide.fiiDiiData.diiNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {currentSlide.fiiDiiData.diiNet >= 0 ? '+' : '-'}₹{Math.abs(Math.round(currentSlide.fiiDiiData.diiNet)).toLocaleString('en-IN')} Cr
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-medium text-slate-300 bg-white/5 py-1 px-2.5 rounded-md">
                      <span className="truncate">{currentSlide.fiiDiiData.flowInsight}</span>
                      {currentSlide.fiiDiiData.dateStr && (
                        <span className="text-[9px] font-bold text-slate-400 shrink-0 ml-2">
                          {currentSlide.fiiDiiData.dateStr}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Layout D: Upcoming Results Calendar List */}
                {currentSlide.upcomingResults && currentSlide.upcomingResults.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {currentSlide.upcomingResults.slice(0, 3).map((r) => (
                      <button
                        type="button"
                        key={r.symbol}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenCompanyHub(r.scripCode, r.symbol, r.name);
                        }}
                        className="flex items-center justify-between p-2 rounded-xl bg-white/5 hover:bg-white/15 active:scale-98 border border-white/10 transition-all cursor-pointer text-left group w-full"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <CompanyBrandLogo 
                            symbol={r.symbol} 
                            scripCode={r.scripCode} 
                            name={r.name} 
                            size="sm" 
                          />
                          <div className="truncate">
                            <p className="text-[11px] font-bold text-white truncate leading-tight flex items-center gap-1">
                              {r.name}
                              <ArrowUpRight className="w-2.5 h-2.5 text-white/40 group-hover:text-blue-400 transition-colors shrink-0 inline" />
                            </p>
                            <p className="text-[9px] text-slate-400 truncate leading-tight">{r.purpose}</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 shrink-0">
                          {r.date}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Layout E: Corporate Demergers & Order Wins */}
                {currentSlide.corporateActions && currentSlide.corporateActions.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {currentSlide.corporateActions.slice(0, 2).map((act, i) => (
                      <button
                        type="button"
                        key={i}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenCompanyHub(act.scripCode, act.symbol, act.name);
                        }}
                        className="p-2.5 rounded-xl bg-white/5 hover:bg-white/15 active:scale-98 border border-white/10 flex items-start gap-2.5 transition-all cursor-pointer text-left w-full group"
                      >
                        <CompanyBrandLogo 
                          symbol={act.symbol} 
                          scripCode={act.scripCode} 
                          name={act.name} 
                          size="md" 
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[11px] font-bold text-white truncate flex items-center gap-1">
                              {act.headline}
                              <ArrowUpRight className="w-2.5 h-2.5 text-white/40 group-hover:text-purple-400 transition-colors shrink-0 inline" />
                            </span>
                            {act.valueBadge && (
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                                {act.valueBadge}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-300 leading-tight mt-0.5">{act.impactText}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Key Bullet Highlights */}
                <div className="space-y-1 pt-1">
                  {currentSlide.bulletPoints.slice(0, 2).map((pt, idx) => (
                    <div key={idx} className="flex items-start gap-1.5 text-[11px] text-slate-300">
                      <span className="text-emerald-400 font-bold shrink-0 leading-none mt-0.5">•</span>
                      <span className="leading-snug">{pt}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* ======================================================== */}
          {/* FLOATING BOTTOM ACTION PILL (Direct 360° Intelligence)   */}
          {/* ======================================================== */}
          {currentSlide.actionPill?.symbol && (
            <div className="absolute bottom-3 left-4 right-4 z-30 pointer-events-auto">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={buttonTap}
                transition={springSnappy}
                onClick={(e) => {
                  e.stopPropagation();
                  if (currentSlide.actionPill) {
                    handleOpenCompanyHub(
                      currentSlide.actionPill.scripCode,
                      currentSlide.actionPill.symbol,
                      currentSlide.actionPill.name
                    );
                  }
                }}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 active:bg-white/30 backdrop-blur-xl border border-white/25 shadow-xl text-white cursor-pointer transition-all duration-150"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <CompanyBrandLogo 
                    symbol={currentSlide.actionPill.symbol} 
                    scripCode={currentSlide.actionPill.scripCode}
                    name={currentSlide.actionPill.name}
                    size="sm" 
                    className="shadow-sm ring-1 ring-white/30" 
                  />
                  <span className="text-xs font-bold text-white truncate drop-shadow-sm">
                    {currentSlide.actionPill.name}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-300 shrink-0 ml-1">
                  <span>View 360° Hub</span>
                  <ChevronRight className="w-4 h-4 text-white/80" />
                </div>
              </motion.button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
