import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useReducedMotion } from 'framer-motion';
import { X, Share2, RotateCcw } from 'lucide-react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { BseNexusLogo } from '../ui/BseNexusLogo';
import { SpecialDayCardTemplate } from './SpecialDayCardTemplate';
import { SpecialDayArtDefs } from './SpecialDayArtwork';
import '../../styles/special-day-story.css';
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
  const [direction, setDirection] = useState<1 | -1 | 0>(0);
  const [paused, setPaused] = useState(false);
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [shareNotice, setShareNotice] = useState('');
  const [finished, setFinished] = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const pointerRef = useRef<{ x: number; y: number; time: number; held: boolean } | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const playbackRef = useRef({ index: 0, elapsed: 0 });

  const reducedMotion = useReducedMotion();
  useBodyScrollLock(isOpen);

  const cards = config.cards || [];
  const card = cards[currentIndex];
  const CARD_DURATION_MS = 8000;

  // Rising gold embers — fixed for the modal's lifetime.
  const embers = useMemo(
    () =>
      Array.from({ length: 12 }, () => {
        const size = 2 + Math.random() * 3.5;
        return {
          left: `${4 + Math.random() * 92}%`,
          width: size,
          height: size,
          animationDuration: `${6 + Math.random() * 6}s`,
          animationDelay: `${Math.random() * 8}s`
        } as React.CSSProperties;
      }),
    []
  );

  const handleNext = useCallback(() => {
    if (currentIndex >= cards.length - 1) {
      setFinished(true);
      setProgress(100);
      return;
    }
    setDirection(1);
    setCurrentIndex(currentIndex + 1);
    setProgress(0);
    playbackRef.current = { index: currentIndex + 1, elapsed: 0 };
  }, [cards.length, currentIndex]);

  const handlePrev = useCallback(() => {
    if (finished) {
      setFinished(false);
      setCurrentIndex(cards.length - 1);
      setProgress(0);
      setDirection(-1);
      playbackRef.current = { index: cards.length - 1, elapsed: 0 };
      return;
    }
    if (currentIndex <= 0) return;
    setDirection(-1);
    setCurrentIndex(currentIndex - 1);
    setProgress(0);
    playbackRef.current = { index: Math.max(0, currentIndex - 1), elapsed: 0 };
  }, [currentIndex, cards.length, finished]);

  const handleReplay = useCallback(() => {
    setFinished(false);
    setCurrentIndex(0);
    setDirection(0);
    setProgress(0);
    playbackRef.current = { index: 0, elapsed: 0 };
  }, []);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
      setDirection(0);
      setPaused(false);
      setHolding(false);
      setProgress(0);
      setShareNotice('');
      setFinished(false);
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
  const isStopped = paused || holding || !isOpen || Boolean(reducedMotion) || finished;
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
        setShareNotice('Story link copied');
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
      className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-0 sm:p-4 select-none animate-in fade-in duration-200"
      onPointerDown={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={config.title}
        className="sds-story relative w-full sm:max-w-md h-full sm:h-[90vh] sm:max-h-[820px] sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
      >
        <SpecialDayArtDefs />

        {/* Rising gold embers across every card */}
        <div className="sds-embers" aria-hidden="true">
          {embers.map((style, i) => (
            <span key={i} className="sds-ember" style={style} />
          ))}
        </div>

        {/* Minimal header: progress segments + logo dot + share/close only */}
        <header className="relative z-[3] px-4 pt-3 shrink-0" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
          <div className="sds-progress-row" style={{ marginBottom: 10 }}>
            {cards.map((c, idx) => {
              const isCompleted = idx < currentIndex;
              const isCurrent = idx === currentIndex;
              const barProgress = isCompleted ? 100 : isCurrent ? progress : 0;

              return (
                <div key={c.id} className="sds-seg">
                  <i style={{ width: `${barProgress}%` }} />
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between">
            <BseNexusLogo className="w-[30px] h-[30px] shrink-0" />
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={handleShare}
                disabled={sharing}
                aria-label="Share special day story"
                className="sds-icon-btn"
              >
                <Share2 size={17} />
              </button>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                aria-label="Close special day story"
                className="sds-icon-btn"
              >
                <X size={19} />
              </button>
            </div>
          </div>
        </header>

        {/* Share notification toast */}
        <div className={`sds-toast${shareNotice ? ' sds-show' : ''}`} role="status">
          {shareNotice || 'Story link copied'}
        </div>

        {/* Card body with pointer touch/click detection */}
        <main
          className="relative z-[2] flex-1 min-h-0 overflow-hidden cursor-pointer"
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
              config={config}
              direction={direction}
              paused={paused}
              holding={holding}
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
        </main>

        {/* End screen with replay (reached by advancing past the last card) */}
        <div className={`sds-end-screen${finished ? ' sds-show' : ''}`}>
          <h2>Story finished ✨</h2>
          <p>You have seen all {cards.length} cards of the {config.shortTitle}.</p>
          <button type="button" onClick={handleReplay}>
            <span className="inline-flex items-center gap-2">
              <RotateCcw size={15} />
              Watch again
            </span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
