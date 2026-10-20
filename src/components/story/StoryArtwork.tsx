import React from 'react';
import type { StoryArtworkKind, StoryTopic } from './storyTypes';
import { Activity, CalendarDays, Globe2, Newspaper } from 'lucide-react';

/** Topic identities describe a category. They must never stand in for a listed company. */
export function StoryTopicMark({ topic, className = '' }: { topic: StoryTopic; className?: string }) {
  const Icon = topic === 'institutional-flows' ? Globe2 : topic === 'earnings-radar' ? CalendarDays : topic === 'corporate-actions' ? Newspaper : Activity;
  return <span className={`story-topic-mark ${className}`} aria-hidden="true"><Icon strokeWidth={1.6} /></span>;
}

/** Small curated native artwork collection; repeatable, no remote photo or per-story generation. */
export const StoryArtwork = React.memo(function StoryArtwork({ kind }: { kind: StoryArtworkKind }) {
  return <div className={`story-artwork story-artwork-${kind}`} aria-hidden="true">
    <svg viewBox="0 0 320 220" fill="none">
      <ellipse cx="160" cy="190" rx="112" ry="12" fill="currentColor" opacity=".07" />
      <circle cx="160" cy="108" r="88" fill="currentColor" opacity=".055" />
      <circle cx="257" cy="53" r="6" fill="currentColor" opacity=".28" />
      <path d="M54 79h12m-6-6v12M259 153h12m-6-6v12" stroke="currentColor" strokeWidth="2" opacity=".35" />
      {kind === 'banking' ? <>
        <rect x="80" y="68" width="150" height="95" rx="13" transform="rotate(-9 80 68)" fill="#454b71" />
        <rect x="91" y="75" width="149" height="95" rx="13" transform="rotate(7 91 75)" fill="currentColor" opacity=".6" />
        <rect x="69" y="92" width="175" height="91" rx="15" fill="#343a54" stroke="#7c849d" strokeWidth="1.5" />
        <path d="M70 111h172" stroke="#68708a" strokeWidth="1.5" />
        <rect x="197" y="124" width="59" height="38" rx="10" fill="#444c68" stroke="#838ba3" strokeWidth="1.5" />
        <circle cx="214" cy="143" r="4" fill="currentColor" />
      </> : kind === 'industry' ? <>
        <path d="M71 179V99l54-25v25l54-25v105H71Z" fill="#3a425c" stroke="#727b97" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M179 116h66v63h-66" fill="#30394f" stroke="#727b97" strokeWidth="1.5" />
        <path d="M205 116V58h23v58" fill="#4b5870" />
        <path d="M214 45c-19-9-19-24-5-30m15 29c-10-9-6-17 2-23" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity=".4" />
        {[88, 122, 156, 193, 224].map(x => <rect key={x} x={x} y="132" width="10" height="17" rx="2" fill="currentColor" opacity=".75" />)}
      </> : kind === 'energy' ? <>
        <circle cx="110" cy="67" r="24" fill="currentColor" opacity=".65" />
        <path d="M82 120h120l31 55H58l24-55Z" fill="#35455e" stroke="#8190a8" strokeWidth="1.5" />
        <path d="M78 137h133M68 155h153M111 121l-9 53m48-53 5 53m32-53 22 53M114 178v13m59-13v13" stroke="#8190a8" strokeWidth="1.5" />
        <path d="m222 52-28 44h24l-9 32 38-49h-26l13-27h-12Z" fill="currentColor" />
      </> : kind === 'healthcare' ? <>
        <rect x="88" y="57" width="144" height="126" rx="9" fill="#3a425c" stroke="#727b97" strokeWidth="1.5" />
        <path d="M151 70h18v17h17v18h-17v17h-18v-17h-17V87h17V70Z" fill="currentColor" />
        <path d="M145 183v-41h30v41" fill="#252c42" stroke="#727b97" strokeWidth="1.5" />
        {[105, 200].map(x => <g key={x}><rect x={x} y="136" width="14" height="16" rx="2" fill="currentColor" opacity=".45" /><rect x={x} y="160" width="14" height="16" rx="2" fill="currentColor" opacity=".45" /></g>)}
      </> : <>
        <rect x="66" y="53" width="188" height="125" rx="15" fill="#31394f" stroke="#727b97" strokeWidth="1.5" />
        <path d="M89 76h56M89 88h30" stroke="#9aa3bc" strokeWidth="3" strokeLinecap="round" />
        <path d="M93 153v-24m37 24v-42m37 42v-35m37 35V94" stroke="currentColor" strokeWidth="12" strokeLinecap="round" opacity=".8" />
        <path d="m91 115 39-24 35 5 41-26m-17 0h18v18" stroke="#a8b5d0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </>}
    </svg>
  </div>;
});
