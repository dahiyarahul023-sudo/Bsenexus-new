import React from 'react';
import { ChevronRight } from 'lucide-react';
import type { StoryCompany, StorySlide } from './storyTypes';
import { CompanyBrandLogo } from './StoryVisuals';
import { StoryArtwork } from './StoryArtwork';
import { StoryChart } from './StoryChart';

function Heading({ slide }: { slide: StorySlide }) {
  const position = slide.emphasis ? slide.title.indexOf(slide.emphasis) : -1;
  return <h1 id="market-story-title" className="story-title">{position >= 0 ? <>{slide.title.slice(0, position)}<em>{slide.emphasis}</em>{slide.title.slice(position + slide.emphasis!.length)}</> : slide.title}</h1>;
}

export const StorySlideView = React.memo(function StorySlideView({ slide, onOpenCompany, onInspectChange }: {
  slide: StorySlide; onOpenCompany: (company: StoryCompany) => void; onInspectChange: (active: boolean) => void;
}) {
  return <article className={`story-slide story-slide-${slide.layout}`} data-layout={slide.layout}>
    <Heading slide={slide} />
    {slide.summary && <p className="story-summary">{slide.summary}</p>}
    {slide.layout === 'news' && slide.artwork && <StoryArtwork kind={slide.artwork} />}
    {slide.layout === 'metric' && <div className="story-metric"><span>{slide.metric.label}</span><strong>{slide.metric.value}</strong>{slide.metric.detail && <p>{slide.metric.detail}</p>}</div>}
    {slide.layout === 'comparison' && <div className="story-comparison">{slide.blocks.map(block => <div className="story-bubble" key={block.label}><span>{block.label}</span><strong>{block.value}</strong>{block.detail && <p className={`story-tone-${block.tone || 'neutral'}`}>{block.detail}</p>}</div>)}</div>}
    {slide.layout === 'chart' && <StoryChart chart={slide.chart} onInspectChange={onInspectChange} />}
    {slide.layout === 'list' && <div className="story-list">{slide.items.map(item => {
      const contents = <>{item.company && <CompanyBrandLogo {...item.company} size="md" />}<span className="story-list-copy"><strong>{item.label}</strong>{item.detail && <small>{item.detail}</small>}</span>{item.value && <span className={`story-list-value story-tone-${item.tone || 'neutral'}`}>{item.value}</span>}{item.company && <ChevronRight size={14} aria-hidden="true" />}</>;
      return item.company ? <button key={item.id} type="button" className="story-list-row" data-story-interactive="true" onClick={() => onOpenCompany(item.company!)}>{contents}</button> : <div key={item.id} className="story-list-row">{contents}</div>;
    })}</div>}
  </article>;
});
