import React from 'react';
import type { StoryChapter } from './storyTypes';

/** One strip and count for the whole chapter, including every company's pages. */
export function StoryChapterProgress({ chapter, activeId, progress }: {
  chapter?: StoryChapter; activeId?: string; progress: number;
}) {
  const slides = chapter?.slides || [];
  const activeIndex = slides.findIndex(slide => slide.id === activeId);
  const fraction = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress / 100)) : 0;
  return <div className="story-progress-row">
    <div className="story-progress" aria-hidden="true">{(slides.length ? slides : [null]).map((slide, index) =>
      <span key={slide?.id || 'loading'} data-active={index === activeIndex || undefined}><i style={{ transform: `scaleX(${index < activeIndex ? 1 : index === activeIndex ? fraction : 0})` }} /></span>
    )}</div>
    {activeIndex >= 0 && <span className="story-progress-count" aria-label={`${chapter!.title}, story ${activeIndex + 1} of ${slides.length}`}>{activeIndex + 1} / {slides.length}</span>}
  </div>;
}
