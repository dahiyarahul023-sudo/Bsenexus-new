import { personalStoryChapters } from '../utils/forYou';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight, MoreHorizontal, Pause, Play, RotateCw, Share2, X } from 'lucide-react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useAuth } from '../context/AuthContext';
import { fetchLiveStoryChapters, getAllSlides, getInitialStoryChapters, getStorySessionStorageKey } from './story/storyData';
import { getStoryDuration, resolveStorySelection, safeStoryUrl } from './story/storyBuilder';
import type { StoryChapter, StoryCompany } from './story/storyTypes';
import { STORY_TOPICS } from './story/storyTypes';
import { StorySlideView } from './story/StorySlideView';
import { StoryChapterProgress } from './story/StoryChapterProgress';
import { StoryTopicMark } from './story/StoryArtwork';
import { CompanyBrandLogo } from './story/StoryVisuals';
import { BseNexusLogo } from './ui/BseNexusLogo';
import '../styles/market-stories.css';

interface TodayMarketStoryModalProps {
  watched?: string[];
  isOpen: boolean;
  onClose: () => void;
  initialChapterId?: string;
  onStoryViewed?: () => void;
  onOpenCompanyIntel?: (scripCode?: string, symbol?: string, companyName?: string) => void;
}

export function TodayMarketStoryModal({ isOpen, onClose, initialChapterId, onStoryViewed, onOpenCompanyIntel, watched }: TodayMarketStoryModalProps) {
  const { profile, user } = useAuth();
  const showNavigationButtons = profile?.uid === user?.uid ? profile?.notificationPreferences?.storyNavigationButtons !== false : true;
  const [rawChapters, setChapters] = useState<StoryChapter[]>(getInitialStoryChapters);
  const chapters=useMemo(()=>personalStoryChapters(rawChapters,watched),[rawChapters,watched?.join('|')]);
  const [activeId, setActiveId] = useState(() => resolveStorySelection(chapters, '', initialChapterId).activeId);
  const [missingTopic, setMissingTopic] = useState(() => resolveStorySelection(chapters, '', initialChapterId).missingTopic);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [menu, setMenu] = useState(false);
  const [paused, setPaused] = useState(false);
  const [holding, setHolding] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  const [progress, setProgress] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [scrollable, setScrollable] = useState(false);
  const [notice, setNotice] = useState('');
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose); onCloseRef.current = onClose;
  const onViewedRef = useRef(onStoryViewed); onViewedRef.current = onStoryViewed;
  const topicRef = useRef(initialChapterId);
  const viewedRef = useRef(false);
  const loadVersion = useRef(0);
  const playback = useRef({ id: '', elapsed: 0 });
  const pointer = useRef<{ x: number; y: number; time: number; scroll: number; held: boolean } | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reducedMotion = useReducedMotion();
  useBodyScrollLock(isOpen);

  const slides = useMemo(() => getAllSlides(chapters), [chapters]);
  const index = Math.max(0, slides.findIndex(slide => slide.id === activeId));
  const slide = missingTopic ? undefined : slides[index];
  const chapter = chapters.find(chapter => chapter.id === slide?.chapterId);

  const load = useCallback(async (force = false) => {
    const version = ++loadVersion.current;
    setLoading(true); setFailed(false);
    try {
      const data = personalStoryChapters(await fetchLiveStoryChapters(force), watched);
      if (version !== loadVersion.current) return;
      setChapters(data);
      const requested = topicRef.current;
      setActiveId(previous => resolveStorySelection(data, previous, requested).activeId);
      setMissingTopic(resolveStorySelection(data, '', requested).missingTopic);
      if (data.some(chapter => chapter.id === requested)) topicRef.current = undefined;
    } catch {
      if (version === loadVersion.current) setFailed(true);
    } finally { if (version === loadVersion.current) setLoading(false); }
  }, [watched?.join('|')]);

  useEffect(() => {
    if (!isOpen) return;
    const cached = personalStoryChapters(getInitialStoryChapters(),watched);
    const selection = resolveStorySelection(cached, '', initialChapterId);
    topicRef.current = selection.missingTopic ? initialChapterId : undefined;
    setChapters(cached); setActiveId(selection.activeId); setMissingTopic(selection.missingTopic);
    setPaused(false); setHolding(false); setInspecting(false); setSharing(false); setDragY(0);
    setHidden(document.hidden); setMenu(false); setProgress(0); setNotice('');
    playback.current = { id: '', elapsed: 0 }; viewedRef.current = false;
    void load();
    return () => { loadVersion.current++; clearTimeout(holdTimer.current); pointer.current = null; };
  }, [isOpen, initialChapterId, load]);

  useEffect(() => {
    if (!isOpen || !slide || viewedRef.current) return;
    viewedRef.current = true;
    try { localStorage.setItem(getStorySessionStorageKey(), 'true'); } catch {}
    onViewedRef.current?.();
  }, [isOpen, slide]);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const overlay = overlayRef.current;
    const background = [...document.body.children].filter((node): node is HTMLElement => node instanceof HTMLElement && node !== overlay && !node.contains(overlay));
    const inert = background.map(node => node.inert);
    background.forEach(node => { node.inert = true; });
    closeRef.current?.focus({ preventScroll: true });
    const visibility = () => {
      setHidden(document.hidden);
      if (document.hidden) { clearTimeout(holdTimer.current); pointer.current = null; setHolding(false); setDragY(0); }
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      background.forEach((node, i) => { node.inert = inert[i]; });
      if (previous?.isConnected && !previous.closest('[inert]')) previous.focus({ preventScroll: true });
    };
  }, [isOpen]);

  useEffect(() => {
    setInspecting(false); setProgress(0); setNotice('');
    contentRef.current?.scrollTo({ top: 0 });
  }, [slide?.id]);

  useEffect(() => {
    const content = contentRef.current;
    if (!isOpen || !content) return;
    const measure = () => setScrollable(content.scrollHeight > content.clientHeight + 2);
    const observer = new ResizeObserver(measure);
    observer.observe(content); if (content.firstElementChild) observer.observe(content.firstElementChild);
    measure();
    return () => observer.disconnect();
  }, [isOpen, slide?.id, loading, failed, missingTopic]);

  const move = useCallback((direction: number) => {
    if (!slides.length) return;
    const next = index + direction;
    if (next < 0) return;
    if (next >= slides.length) { onCloseRef.current(); return; }
    setActiveId(slides[Math.max(0, next)].id); setMenu(false); setInspecting(false);
    playback.current = { id: '', elapsed: 0 }; setProgress(0);
  }, [slides, index]);

  const stopped = paused || holding || inspecting || sharing || hidden || menu || Boolean(reducedMotion) || scrollable || loading;
  useEffect(() => {
    if (!isOpen || !slide || stopped) return;
    const id = slide.id;
    if (playback.current.id !== id) playback.current = { id, elapsed: 0 };
    const start = performance.now(); const duration = getStoryDuration(slide);
    const timer = setInterval(() => {
      const elapsed = playback.current.elapsed + performance.now() - start;
      setProgress(Math.min(100, elapsed / duration * 100));
      if (elapsed >= duration) { clearInterval(timer); move(1); }
    }, 80);
    return () => {
      clearInterval(timer);
      if (playback.current.id === id) playback.current.elapsed += performance.now() - start;
    };
  }, [isOpen, slide, stopped, move]);

  useEffect(() => {
    if (!isOpen) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); if (menu) { setMenu(false); menuButtonRef.current?.focus(); } else onCloseRef.current(); return; }
      if (event.key === 'Tab') {
        const focusable = [...(panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex="0"]') || [])].filter(node => node.getClientRects().length > 0);
        const first = focusable[0]; const last = focusable[focusable.length - 1];
        if (event.shiftKey && (document.activeElement === first || !panelRef.current?.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !panelRef.current?.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
        return;
      }
      const target = event.target as HTMLElement;
      if (menu || target.closest('button, a, input, textarea, select, [data-story-interactive]')) return;
      if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
      if (event.key === ' ') { event.preventDefault(); setPaused(value => !value); }
    };
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  }, [isOpen, menu, move]);

  const releasePointer = () => { clearTimeout(holdTimer.current); setHolding(false); setDragY(0); };
  const pointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button, a, [data-story-interactive]')) return;
    pointer.current = { x: event.clientX, y: event.clientY, time: performance.now(), scroll: event.currentTarget.scrollTop, held: false };
    event.currentTarget.setPointerCapture(event.pointerId);
    holdTimer.current = setTimeout(() => { if (pointer.current) { pointer.current.held = true; setHolding(true); } }, 240);
  };
  const pointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = pointer.current; if (!start) return;
    const dx = event.clientX - start.x; const dy = event.clientY - start.y;
    if (Math.abs(dx) + Math.abs(dy) > 12) { clearTimeout(holdTimer.current); setHolding(false); }
    if (!scrollable && dy > 12 && dy > Math.abs(dx) && !reducedMotion) setDragY(Math.min(120, dy * .55));
  };
  const pointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = pointer.current; pointer.current = null; releasePointer(); if (!start) return;
    const dx = event.clientX - start.x; const dy = event.clientY - start.y;
    if (dy > 100 && dy > Math.abs(dx) && start.scroll === 0 && !scrollable) { onCloseRef.current(); return; }
    if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy)) { move(dx < 0 ? 1 : -1); return; }
    if (start.held || performance.now() - start.time > 350 || Math.abs(dx) + Math.abs(dy) > 12) return;
    const bounds = event.currentTarget.getBoundingClientRect(); move(event.clientX - bounds.left < bounds.width * .5 ? -1 : 1);
  };

  const openCompany = useCallback((company: StoryCompany) => {
    if (!onOpenCompanyIntel) return;
    onCloseRef.current(); onOpenCompanyIntel(company.scripCode, company.symbol, company.name);
  }, [onOpenCompanyIntel]);

  const share = async () => {
    if (!slide) return;
    setSharing(true);
    const data = { title: slide.title, text: [slide.title, slide.summary].filter(Boolean).join('\n'), url: safeStoryUrl(slide.source.url) || `${window.location.origin}/` };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(`${data.text}\n${data.url}`); setNotice('Story copied'); }
    } catch (error) { if ((error as Error).name !== 'AbortError') setNotice('Sharing is unavailable right now'); }
    finally { setSharing(false); }
  };

  if (!isOpen || typeof document === 'undefined') return null;
  const selectedTopic = STORY_TOPICS.find(topic => topic.id === initialChapterId);
  const subjectCompany = slide?.subject.kind === 'company' ? slide.subject.company : undefined;
  const sourceDate = slide?.source.publishedAt ? new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(slide.source.publishedAt) + ' IST' : slide?.source.dateLabel;
  return createPortal(<div className="story-overlay" ref={overlayRef} onPointerDown={event => {
    if (event.target === event.currentTarget) onCloseRef.current();
    if (menu && !menuRef.current?.contains(event.target as Node)) setMenu(false);
  }}>
    <div className="story-panel" ref={panelRef} role="dialog" aria-modal="true" aria-label="Market stories" aria-describedby="story-instructions" style={{ transform: dragY ? `translateY(${dragY}px)` : undefined }}>
      <p id="story-instructions" className="story-sr-only">Tap the left or right side to navigate, hold to pause, or use the story controls. With content focused, use arrow keys to navigate and Space to pause. Escape closes stories.</p>
      <header className="story-header">
        <StoryChapterProgress chapter={chapter} activeId={slide?.id} progress={progress} />
        <div className="story-topline">
          <span className="story-wordmark" aria-label="BSE Nexus"><BseNexusLogo className="w-7 h-7" /></span>
          <p>{missingTopic ? selectedTopic?.label : chapter?.title || 'Market stories'}</p>
          <div className="story-header-actions">
            {slide && <button type="button" className="story-icon-button" aria-label="Share story" onClick={share} disabled={sharing}><Share2 size={19} /></button>}
            <div ref={menuRef} className="story-menu-owner">
              <button ref={menuButtonRef} type="button" className="story-icon-button" aria-label="Story controls" aria-expanded={menu} aria-controls="story-controls" onClick={() => setMenu(value => !value)}><MoreHorizontal size={21} /></button>
              {menu && <div className="story-controls" id="story-controls">
                <button type="button" onClick={() => { setPaused(value => !value); setMenu(false); menuButtonRef.current?.focus(); }}><>{paused ? <Play size={16} /> : <Pause size={16} />}{paused ? 'Resume' : 'Pause'} story</></button>
                <button type="button" disabled={!slide || index === 0} onClick={() => move(-1)}><ChevronLeft size={16} />Previous</button>
                <button type="button" disabled={!slide} onClick={() => move(1)}><ChevronRight size={16} />Next</button>
                <button type="button" disabled={loading} onClick={() => { setMenu(false); void load(true); menuButtonRef.current?.focus(); }}><RotateCw size={16} />{loading ? 'Refreshing…' : 'Refresh stories'}</button>
              </div>}
            </div>
            <button ref={closeRef} type="button" className="story-icon-button" aria-label="Close stories" onClick={() => onCloseRef.current()}><X size={24} /></button>
          </div>
        </div>
      </header>
      <main ref={contentRef} className="story-content" tabIndex={0} aria-label="Story content" style={{ touchAction: scrollable ? 'pan-y pinch-zoom' : 'pinch-zoom' }} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => { pointer.current = null; releasePointer(); }} onLostPointerCapture={() => { pointer.current = null; releasePointer(); }}>
        {slide ? <StorySlideView key={slide.id} slide={slide} onOpenCompany={openCompany} onInspectChange={setInspecting} /> : <div className="story-state" role="status">
          <StoryTopicMark topic={selectedTopic?.id || 'market-pulse'} />
          <h1>{loading ? 'Checking the latest stories' : failed ? 'Stories couldn’t load' : missingTopic ? 'No fresh stories for this topic' : 'No fresh stories right now'}</h1>
          <p>{loading ? 'A short market read is on its way.' : failed ? 'Check your connection and try again.' : 'New stories appear when source data is available.'}</p>
          {!loading && <button className="story-text-button" type="button" onClick={() => void load(true)}>Try again</button>}
          {missingTopic && slides.length > 0 && <button className="story-text-button" type="button" onClick={() => { setMissingTopic(false); topicRef.current = undefined; setActiveId(slides[0].id); }}>View available stories</button>}
        </div>}
      </main>
      <footer className="story-footer">
        {slide && <>
          {showNavigationButtons && <nav className="story-navigation" aria-label="Story navigation">
            <button type="button" disabled={index === 0} onClick={() => move(-1)}><ChevronLeft size={19} />Previous</button>
            <button type="button" aria-label={paused ? 'Resume story' : 'Pause story'} aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? <Play size={19} /> : <Pause size={19} />}</button>
            <button type="button" onClick={() => move(1)}>{index === slides.length - 1 ? 'Done' : 'Next'}<ChevronRight size={19} /></button>
          </nav>}
          {subjectCompany && onOpenCompanyIntel && <button type="button" className="story-company-link" onClick={() => openCompany(subjectCompany)}><CompanyBrandLogo {...subjectCompany} size="sm" /><span>{subjectCompany.name}</span><ChevronRight size={17} /></button>}
          <div className="story-source">{slide.source.url ? <a href={slide.source.url} target="_blank" rel="noopener noreferrer">{slide.source.name} ↗</a> : <span>{slide.source.name}</span>}{sourceDate && <span>{sourceDate}</span>}</div>
          {failed ? <button className="story-refresh-status" type="button" onClick={() => void load(true)}>Showing saved snapshot · Retry refresh</button> : loading ? <p className="story-refresh-status">Checking for updates…</p> : null}
          {(paused || reducedMotion || scrollable) && !menu && <button className="story-pause-status" type="button" onClick={() => reducedMotion || scrollable ? move(1) : setPaused(false)}>{reducedMotion || scrollable ? 'Next story' : 'Paused · Resume'}<ChevronRight size={13} /></button>}
        </>}
        <span role="status" className="story-notice">{notice}</span>
      </footer>
    </div>
  </div>, document.body);
}
