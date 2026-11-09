import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useReducedMotion } from 'framer-motion';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Pause, 
  Play, 
  Share2, 
  Sparkles,
  CalendarDays
} from 'lucide-react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { BseNexusLogo } from '../ui/BseNexusLogo';
import { SpecialDayCardTemplate } from './SpecialDayCardTemplate';
import type { SpecialDayConfig } from '../../config/specialDay';

interface SpecialDayStoryModalProps {
  config: SpecialDayConfig;
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tabId: string) => void;
}

export function SpecialDayStoryModal({
  config,
  isOpen,
  onClose,
  onNavigateTab
}: SpecialDayStoryModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [shareNotice, setShareNotice] = useState('');

  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const pointerRef = useRef<{ x: number; y: number; time: number; held: boolean } | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const playbackRef = useRef({ index: 0, elapsed: 0 });
  
  const reducedMotion = useReducedMotion();
  useBodyScrollLock(isOpen);

  const cards = config.cards || [];
  const card = cards[currentIndex];
  const CARD_DURATION_MS = 8000;

  const handleNext = useCallback(() => {
    setCurrentIndex(prev => {
      if (prev >= cards.length - 1) {
        onClose();
        return prev;
      }
      return prev + 1;
    });
    setProgress(0);
    playbackRef.current = { index: currentIndex + 1, elapsed: 0 };
  }, [cards.length, currentIndex, onClose]);

  const handlePrev = useCallback(() => {
    setCurrentIndex(prev => {
      if (prev <= 0) return 0;
      return prev - 1;
    });
    setProgress(0);
    playbackRef.current = { index: Math.max(0, currentIndex - 1), elapsed: 0 };
  }, [currentIndex]);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
      setPaused(false);
      setHolding(false);
      setProgress(0);
      setShareNotice('');
      playbackRef.current = { index: 0, elapsed: 0 };
    }
  }, [isOpen]);

  // Focus trap and accessibility
  useEffect(() => {
    if (!isOpen) return;
    closeButtonRef.current?.focus({ preventScroll: true });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === ' ') {
        e.preventDefault();
        setPaused(p => !p);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleNext, handlePrev, onClose]);

  // Auto-advance playback loop
  const isStopped = paused || holding || !isOpen || Boolean(reducedMotion);
  useEffect(() => {
    if (!isOpen || !card || isStopped) return;

    if (playbackRef.current.index !== currentIndex) {
      playbackRef.current = { index: currentIndex, elapsed: 0 };
    }

    const start = performance.now();
    const interval = setInterval(() => {
      const elapsed = playbackRef.current.elapsed + (performance.now() - start);
      const ratio = Math.min(100, (elapsed / CARD_DURATION_MS) * 100);
      setProgress(ratio);

      if (elapsed >= CARD_DURATION_MS) {
        clearInterval(interval);
        handleNext();
      }
    }, 60);

    return () => {
      clearInterval(interval);
      if (playbackRef.current.index === currentIndex) {
        playbackRef.current.elapsed += (performance.now() - start);
      }
    };
  }, [isOpen, card, currentIndex, isStopped, handleNext]);

  // Touch & Click Gesture Navigation
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button, a, [data-story-interactive]')) return;

    pointerRef.current = {
      x: e.clientX,
      y: e.clientY,
      time: performance.now(),
      held: false
    };

    holdTimerRef.current = setTimeout(() => {
      if (pointerRef.current) {
        pointerRef.current.held = true;
        setHolding(true);
      }
    }, 220);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    clearTimeout(holdTimerRef.current);
    const start = pointerRef.current;
    pointerRef.current = null;
    setHolding(false);

    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;

    // Swipe horizontal
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) handleNext();
      else handlePrev();
      return;
    }

    // Tap left or right half
    if (!start.held && performance.now() - start.time < 350 && Math.abs(dx) + Math.abs(dy) < 15) {
      const bounds = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - bounds.left;
      if (clickX < bounds.width * 0.4) {
        handlePrev();
      } else {
        handleNext();
      }
    }
  };

  const handleShare = async () => {
    if (!card) return;
    setSharing(true);
    const text = `${config.title} - ${card.title}\n${card.subtitle || ''}\n${window.location.origin}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: config.title,
          text: text,
          url: window.location.origin
        });
      } else {
        await navigator.clipboard.writeText(text);
        setShareNotice('Story link copied to clipboard');
        setTimeout(() => setShareNotice(''), 2500);
      }
    } catch {
      // User cancelled or clipboard denied
    } finally {
      setSharing(false);
    }
  };

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div 
      ref={overlayRef}
      className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-0 sm:p-4 select-none animate-in fade-in duration-200"
      onPointerDown={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div 
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={config.title}
        className="relative w-full sm:max-w-md h-full sm:h-[90vh] sm:max-h-[820px] bg-white dark:bg-[#12131C] sm:rounded-3xl shadow-2xl border border-slate-200/80 dark:border-white/10 flex flex-col overflow-hidden"
      >
        {/* Top Progress Bars (one segment per card) */}
        <div className="pt-3 px-4 pb-2 flex items-center gap-1.5 shrink-0 bg-white/90 dark:bg-[#12131C]/90 backdrop-blur-md z-20">
          {cards.map((c, idx) => {
            const isCompleted = idx < currentIndex;
            const isCurrent = idx === currentIndex;
            const barProgress = isCompleted ? 100 : isCurrent ? progress : 0;

            return (
              <div 
                key={c.id} 
                className="h-1 flex-1 bg-slate-200 dark:bg-white/15 rounded-full overflow-hidden"
              >
                <div 
                  className="h-full bg-emerald-500 rounded-full transition-all duration-75 ease-linear"
                  style={{ width: `${barProgress}%` }}
                />
              </div>
            );
          })}
        </div>

        {/* Top Header Bar */}
        <header className="px-4 py-2 flex items-center justify-between gap-3 shrink-0 border-b border-slate-100 dark:border-white/5 bg-white/90 dark:bg-[#12131C]/90 backdrop-blur-md z-20">
          <div className="flex items-center gap-2 min-w-0">
            <BseNexusLogo className="w-6 h-6 shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] font-black tracking-widest text-emerald-600 dark:text-emerald-400 uppercase block leading-none">
                {config.badgeText}
              </span>
              <h1 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate mt-0.5 leading-tight">
                {config.shortTitle}
              </h1>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleShare}
              disabled={sharing}
              aria-label="Share special day story"
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            >
              <Share2 size={16} />
            </button>

            <button
              type="button"
              onClick={() => setPaused(p => !p)}
              aria-label={paused ? "Resume playback" : "Pause playback"}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            >
              {paused ? <Play size={16} /> : <Pause size={16} />}
            </button>

            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="Close special day story"
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            >
              <X size={19} />
            </button>
          </div>
        </header>

        {/* Share notification toast */}
        {shareNotice && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 px-3 py-1 rounded-full bg-slate-900 text-white text-[11px] font-medium shadow-md">
            {shareNotice}
          </div>
        )}

        {/* Card Body with pointer touch/click detection */}
        <main 
          className="flex-1 overflow-hidden relative cursor-pointer"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => {
            clearTimeout(holdTimerRef.current);
            pointerRef.current = null;
            setHolding(false);
          }}
        >
          {card ? (
            <SpecialDayCardTemplate
              key={card.id}
              card={card}
              currentIndex={currentIndex}
              totalCards={cards.length}
              disclaimer={config.disclaimer}
              onActionClick={(tabId) => {
                if (tabId && onNavigateTab) {
                  onClose();
                  onNavigateTab(tabId);
                }
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-slate-400">
              No content available.
            </div>
          )}

          {/* Bottom Hover Navigation Chevrons for desktop */}
          <div className="hidden sm:flex items-center justify-between absolute inset-x-2 top-1/2 -translate-y-1/2 pointer-events-none">
            <button
              type="button"
              data-story-interactive="true"
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              disabled={currentIndex === 0}
              aria-label="Previous card"
              className={`p-2 rounded-full bg-slate-900/60 dark:bg-white/20 text-white backdrop-blur-md transition-opacity pointer-events-auto cursor-pointer ${currentIndex === 0 ? 'opacity-0' : 'opacity-70 hover:opacity-100'}`}
            >
              <ChevronLeft size={20} />
            </button>

            <button
              type="button"
              data-story-interactive="true"
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              aria-label="Next card"
              className="p-2 rounded-full bg-slate-900/60 dark:bg-white/20 text-white backdrop-blur-md opacity-70 hover:opacity-100 transition-opacity pointer-events-auto cursor-pointer"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </main>

        {/* Footer controls */}
        <footer className="px-5 py-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between shrink-0 bg-slate-50/80 dark:bg-[#161722]/80 backdrop-blur-md">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <CalendarDays size={13} className="text-emerald-500" />
            <span>{config.sessionLabel}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="px-3 py-1 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-2xs"
            >
              {currentIndex === cards.length - 1 ? 'Finish' : 'Next'}
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body
  );
}
