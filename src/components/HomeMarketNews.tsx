import React, { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { ArrowRight, ExternalLink, Newspaper, RefreshCw } from 'lucide-react';
import { customFetch } from '../api';
import { useVisibilityInterval } from '../hooks/useVisibilityInterval';
import { HomeNewsFeed, HomeNewsItem, selectHomeNews, safeNewsUrl } from '../utils/homeNews';
import '../styles/home-news.css';

const labels: Record<string, string> = { market: 'Markets', corporate: 'Companies', earnings: 'Results', regulatory: 'Policy' };

export function NewsTextCard({ item, lead = false }: { item: HomeNewsItem; lead?: boolean }) {
  const href = safeNewsUrl(item.link);
  if (!href) return null;
  const timestamp = Date.parse(item.publishedAt);
  const hasDate = Number.isFinite(timestamp) && timestamp <= Date.now() + 5 * 60_000;
  return (
    <a className={`home-news-card${lead ? ' home-news-card--lead' : ''}`} href={href}
      target="_blank" rel="noopener noreferrer" aria-label={`${item.title} — read original at ${item.source} (opens a new tab)`}>
      <div className="home-news-card-top">
        <span className="home-news-category">{labels[item.category] || 'Market News'}</span>
        {lead && <span className="home-news-featured">Top story</span>}
      </div>
      <h3>{item.title}</h3>
      {lead && item.snippet && <p className="home-news-summary">{item.snippet.length > 180 ? `${item.snippet.slice(0, 177)}…` : item.snippet}</p>}
      <div className="home-news-card-footer">
        <div className="home-news-source"><span>{item.source}</span>
          {hasDate ? <time dateTime={new Date(timestamp).toISOString()}>{new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(timestamp)} IST</time>
            : <span className="home-news-date">Publication time unavailable</span>}
        </div>
        <span className="home-news-read">Read original <ExternalLink size={13} aria-hidden="true" /></span>
      </div>
    </a>
  );
}

export function HomeMarketNews({ active, identity, watched, onNavigate, density }: {
  active: boolean; identity: string; watched: string[]; onNavigate: (tab: string) => void; density: string;
}) {
  const feed = useMemo(() => new HomeNewsFeed(), [identity]);
  const state = useSyncExternalStore(feed.subscribe, feed.getSnapshot, feed.getSnapshot);
  const watchedRef = useRef(watched); watchedRef.current = watched;
  const refresh = useCallback(() => feed.refresh(async signal => {
    const response = await customFetch('/api/news', { signal });
    if (!response.ok) throw new Error('News unavailable');
    return response.json();
  }, items => selectHomeNews(items, watchedRef.current)), [feed]);

  useEffect(() => {
    if (!active) return;
    if (!document.hidden) void refresh();
    const onVisibility = () => { if (document.hidden) feed.cancel(); };
    const onNavRefresh = (event: Event) => { if (!document.hidden && (event as CustomEvent).detail?.tab === 'home') void refresh(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('bse_nav_tab_refresh', onNavRefresh);
    return () => {
      feed.cancel();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('bse_nav_tab_refresh', onNavRefresh);
    };
  }, [active, feed, refresh]);
  useVisibilityInterval(refresh, 60_000, active);

  const initial = state.checkedAt === null && !state.error;
  return (
    <section className={`home-news home-news--${density}`} aria-labelledby="home-news-title" aria-busy={state.loading}>
      <div className="home-news-heading">
        <div className="home-news-heading-copy">
          <span className="home-news-icon"><Newspaper size={20} aria-hidden="true" /></span>
          <div><h2 id="home-news-title">Market News</h2><p>Headlines that matter, from trusted sources.</p></div>
        </div>
        <button type="button" className="home-news-all" onClick={() => onNavigate('news')}>View all news <ArrowRight size={15} aria-hidden="true" /></button>
      </div>
      <div className="home-news-toolbar">
        <span>{state.checkedAt ? `Feed checked ${new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(state.checkedAt)} IST` : 'Latest market headlines'}</span>
        <button type="button" className="home-news-refresh" disabled={state.loading} onClick={() => void refresh()} aria-label="Refresh market news">
          <RefreshCw size={14} aria-hidden="true" /> {state.loading ? 'Checking…' : 'Refresh'}
        </button>
      </div>
      {state.error && <div className="home-news-status" role="status">{state.displayed.length ? 'Could not check for updates. Previous headlines are still available.' : 'Market news is unavailable right now. Try Refresh again.'}</div>}
      {state.pending && <button type="button" className="home-news-updates" onClick={() => feed.accept()}>
        New headlines available <span>Show updates <ArrowRight size={14} aria-hidden="true" /></span>
      </button>}
      {initial && !state.displayed.length ? <div role="status" className="home-news-skeleton"><span className="sr-only">Checking market headlines…</span><div aria-hidden="true" className="home-news-grid">{[0, 1, 2].map(index => <div key={index} className={`home-news-card${index === 0 ? ' home-news-card--lead' : ''}`}><span /><span /><span /></div>)}</div></div>
        : state.displayed.length ? <div className="home-news-grid">{state.displayed.map((item, index) => <NewsTextCard key={item.id} item={item} lead={index === 0} />)}</div>
        : !state.error && <div className="home-news-status">No headlines available yet. Check again soon or explore Market News.</div>}
    </section>
  );
}
