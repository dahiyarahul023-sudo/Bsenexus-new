import React from 'react';
import { NewsFeedSkeleton } from './DesignedSkeletons';
import './pageSkeleton.css';

/** Widths reflect each content role, not fabricated data or random text lengths. */
function Line({ width = '100%', title = false }: { width?: string; title?: boolean }) {
  return <span data-placeholder className={title ? 'sk-line sk-line--title' : 'sk-line'} style={{ width }} />;
}
function Row({ kind = 'filings' }: { kind?: string }) {
  return <div className={`sk-card sk-card--${kind}`}>
    <div className="sk-row">
      {['watchlists', 'results-calendar', 'notes'].includes(kind) && <span data-placeholder className="sk-avatar" />}
      <div className="sk-copy"><Line width="62%" title /><Line width="36%" /></div>
      <span data-placeholder className="sk-meta" />
    </div>
    {kind !== 'settings' && <><Line width="92%" /><Line width="72%" /></>}
    {kind === 'notes' && <div className="sk-footer"><Line width="26%" /></div>}
  </div>;
}
export function LoadingSkeleton({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="loading-skeleton" role="status" aria-live="polite" aria-busy="true">
    <span className="sr-only">{label}</span>
    <div aria-hidden="true">{children}</div>
  </div>;
}
export function NotesSkeleton() {
  return <LoadingSkeleton label="Loading saved notes"><div className="notes-grid">{[0, 1, 2].map(i => <Row kind="notes" key={i} />)}</div></LoadingSkeleton>;
}
export function HomeSkeleton() {
  return <LoadingSkeleton label="Loading your research overview"><div className="sk-home">
    <Line width="38%" title />
    <div className="sk-two-column"><Row /><Row /></div>
    <Line width="32%" title />
    <div className="sk-two-column"><Row kind="results-calendar" /><Row kind="results-calendar" /></div>
  </div></LoadingSkeleton>;
}
/** Eager fallback: available before the destination's JavaScript downloads. */
export function PageSkeleton({ page = 'section' }: { page?: string }) {
  const titles: Record<string, string> = {
    settings: 'Settings', watchlists: 'Watchlist', 'results-calendar': 'BSE Results Calendar',
    news: 'News', dashboard: 'Filings', logs: 'Logs', storage: 'Storage', diagnostics: 'Diagnostics',
    'seo-suite': 'SEO Studio',
  };
  let listView = ['logs', 'storage', 'diagnostics'].includes(page);
  if (page === 'watchlists' || page === 'results-calendar') {
    try {
      const saved = localStorage.getItem(page === 'watchlists' ? 'nexus_watchlist_view_mode' : 'nexus_calendar_view_mode');
      listView = saved === 'list' || (saved !== 'grid' && window.innerWidth < 768);
    } catch { listView = true; }
  }
  return <LoadingSkeleton label={`Loading ${titles[page] ?? 'section'}`}>
    <div className={`page-skeleton ${page === 'settings' ? 'page-skeleton--settings' : ''}`} data-skeleton-page={page}>
      <div className="sk-heading">
        {titles[page] ? <h2>{titles[page]}</h2> : <Line width="42%" title />}
        <Line width={page === 'settings' ? '68%' : '38%'} />
      </div>
      {page === 'settings' ? <div className="sk-settings-groups">
        {[5, 3, 2].map((rows, group) => <div key={group}>
          {group > 0 && <div className="sk-group-label"><Line width="26%" /></div>}
          <div className="sk-settings-group">{Array.from({ length: rows }, (_, i) => <div className="sk-setting" key={i}>
            <span data-placeholder className="sk-setting-icon" />
            <div className="sk-copy"><Line width={i % 2 ? '42%' : '54%'} title /><Line width="72%" /></div>
          </div>)}</div>
        </div>)}
      </div> : page === 'news' ? <NewsFeedSkeleton count={4} /> : <div className={listView ? 'sk-list' : ['watchlists', 'results-calendar'].includes(page) ? 'sk-data-grid' : 'sk-two-column'}>
        {[0, 1, 2, 3].map(i => <Row key={i} kind={page} />)}
      </div>}
    </div>
  </LoadingSkeleton>;
}
