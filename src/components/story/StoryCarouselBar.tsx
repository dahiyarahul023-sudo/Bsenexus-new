import React, { useCallback, useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { fetchLiveStoryChapters, getInitialStoryChapters, getStorySessionStorageKey } from './storyData';
import type { StoryChapter, StoryTopic } from './storyTypes';
import { STORY_TOPICS } from './storyTypes';
import { storyCash } from './storyBuilder';
import { StoryTopicMark } from './StoryArtwork';
import '../../styles/market-stories.css';

function topicHint(chapters: StoryChapter[], id: StoryTopic, fallback: string) {
  const chapter = chapters.find(chapter => chapter.id === id);
  const first = chapter?.slides[0];
  if (id === 'market-pulse' && first?.layout === 'comparison') return `Sensex ${first.blocks[0]?.detail || ''}`;
  if (id === 'institutional-flows' && first?.layout === 'chart') return storyCash(first.chart.points.reduce((sum, point) => sum + point.values[0], 0));
  if (id === 'earnings-radar' && chapter) return `${chapter.slides.reduce((sum, slide) => sum + (slide.layout === 'list' ? slide.items.length : 0), 0)} meetings`;
  return fallback;
}

export function StoryCarouselBar({ onOpenStory, className = '' }: { onOpenStory: (chapterId?: string) => void; className?: string }) {
  const [chapters, setChapters] = useState(getInitialStoryChapters);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [seen, setSeen] = useState(false);
  const updateSeen = useCallback(() => { try { setSeen(localStorage.getItem(getStorySessionStorageKey()) === 'true'); } catch {} }, []);
  useEffect(() => {
    let cancelled = false;
    updateSeen();
    const load = (force = false) => {
      if (document.hidden) return;
      fetchLiveStoryChapters(force).then(data => { if (!cancelled) { setChapters(data); setFailed(false); setLoaded(true); } }).catch(() => { if (!cancelled) { setFailed(true); setLoaded(true); } });
    };
    const visibility = () => load(false);
    load(retry > 0); document.addEventListener('visibilitychange', visibility);
    return () => { cancelled = true; document.removeEventListener('visibilitychange', visibility); };
  }, [retry, updateSeen]);
  const topics = loaded && !failed ? STORY_TOPICS.filter(topic => chapters.some(chapter => chapter.id === topic.id)) : STORY_TOPICS;
  return <section className={`story-carousel ${className}`} aria-label="Market stories" onFocusCapture={updateSeen}>
    <div className="story-carousel-heading"><strong>Market stories</strong><button type="button" onClick={() => onOpenStory()} disabled={loaded && !failed && !chapters.length}>Watch all<ChevronRight size={14} /></button></div>
    {topics.length > 0 && <div className="story-capsules">{topics.map(topic => <button type="button" key={topic.id} className="story-capsule" onClick={() => onOpenStory(topic.id)}>
      <span className="story-capsule-ring" data-seen={seen}><StoryTopicMark topic={topic.id} /></span>
      <span className="story-capsule-label">{topic.label}</span><span className="story-capsule-hint">{topicHint(chapters, topic.id, topic.hint)}</span>
    </button>)}</div>}
    {loaded && (failed || !chapters.length) && <div className="story-carousel-status"><span>{failed ? 'Stories couldn’t update' : 'No fresh stories right now'}</span><button type="button" onClick={() => setRetry(value => value + 1)}>Retry</button></div>}
  </section>;
}
