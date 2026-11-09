import React, { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { ArrowRight, Newspaper, RefreshCw } from 'lucide-react';
import { customFetch } from '../api';
import { useVisibilityInterval } from '../hooks/useVisibilityInterval';
import { ActionButton } from './ui/ActionButton';
import { ShareActionMenu } from './ui/motion/ShareActionMenu';
import { SaveNoteButton } from './notes/SaveNoteButton';
import { HomeNewsFeed, HomeNewsItem, selectHomeNews, safeNewsUrl } from '../utils/homeNews';
import '../styles/home-news.css';

const labels: Record<string, string> = { market: 'Markets', corporate: 'Companies', earnings: 'Results', regulatory: 'Policy' };

export function NewsTextCard({ item, lead = false }: { item: HomeNewsItem; lead?: boolean }) {
  const href = safeNewsUrl(item.link);
  if (!href) return null;
  const timestamp = Date.parse(item.publishedAt);
  const hasDate = Number.isFinite(timestamp) && timestamp <= Date.now() + 5 * 60_000;
  return (
    <article className={`home-news-card${lead ? ' home-news-card--lead' : ''}`}>
      <div className="home-news-card-top">
        <span className="home-news-category">{labels[item.category] || 'Market News'}</span>
        {lead && <span className="home-news-featured">Top story</span>}
      </div>
      <h3><a href={href} target="_blank" rel="noopener noreferrer" aria-label={`${item.title} — read original at ${item.source} (opens a new tab)`}>{item.title}</a></h3>
      {lead && item.snippet && <p className="home-news-summary">{item.snippet.length > 180 ? `${item.snippet.slice(0, 177)}…` : item.snippet}</p>}
      <div className="home-news-card-footer">
        <div className="home-news-source"><span>{item.source}</span>
          {hasDate ? <time dateTime={new Date(timestamp).toISOString()}>{new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(timestamp)} IST</time>
            : <span className="home-news-date">Publication time unavailable</span>}
        </div>
      </div>
      <div className="home-news-card-actions">
        <SaveNoteButton label="Save note" link={{ type: 'news', label: (item.symbol || item.source).slice(0, 60), symbol: item.symbol, url: href }} className="home-news-note" />
        <ShareActionMenu contentKind="news" title={item.title} headline={`Source: ${item.source}`} url={href} size="sm" className="home-news-share" />

      </div>
    </article>
  );
}

export function HomeMarketNews({ active, identity, watched, onNavigate, density, watchlistOnly = false, watchlistStatus = 'ready' }: {
  active: boolean; identity: string; watched: string[]; onNavigate: (tab: string) => void; density: string; watchlistOnly?: boolean; watchlistStatus?: string;
}) {
  const feed = useMemo(() => new HomeNewsFeed(), [identity, watchlistOnly ? watched.join('|') : '']);
  const state = useSyncExternalStore(feed.subscribe, feed.getSnapshot, feed.getSnapshot);
  const watchedRef = useRef(watched); watchedRef.current = watched;
  const refresh = useCallback(() => feed.refresh(async signal => {
    const response = await customFetch('/api/news', { signal });
    if (!response.ok) throw new Error('News unavailable');
    return response.json();
  }, items => selectHomeNews(items, watchedRef.current, Date.now(), watchlistOnly)), [feed, watchlistOnly]);

  useEffect(() => {
    if (!active || (watchlistOnly && (watchlistStatus !== 'ready' || !watched.length))) return;
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
  }, [active, feed, refresh, watchlistStatus, watched.length, watchlistOnly]);
  useVisibilityInterval(refresh, 120_000, active && (!watchlistOnly || (watchlistStatus==='ready' && !!watched.length)));

  if (watchlistOnly && (watchlistStatus !== 'ready' || !watched.length)) return <section className="home-news"><h2>Your stock news</h2><p className="home-news-status">{watchlistStatus==='loading'?'Checking your watchlist…':watchlistStatus==='error'?'Your watchlist could not be checked.':'Add stocks to see matching company news.'}</p></section>;
  const initial = state.checkedAt === null && !state.error;
  return (
    <section className={`home-news home-news--${density}`} aria-labelledby="home-news-title" aria-busy={state.loading}>
      <div className="home-news-heading">
        <div className="home-news-heading-copy">
          <span className="home-news-icon"><Newspaper size={20} aria-hidden="true" /></span>
          <div><h2 id="home-news-title">{watchlistOnly ? 'Your stock news' : 'Market News'}</h2><p>{watchlistOnly ? 'Headlines matching your watchlist companies.' : 'Headlines that matter, from trusted sources.'}</p></div>
        </div>
        <div className="home-news-heading-actions">
          <ActionButton type="button" variant="ghost" size="sm" className="home-news-control" onClick={() => onNavigate('news')}>All news <ArrowRight size={14} aria-hidden="true" className="inline" /></ActionButton>
          <ActionButton type="button" variant="secondary" size="sm" className="home-news-control home-news-refresh" isLoading={state.loading} loadingText="" onClick={() => refresh()} aria-label={state.loading ? 'Checking market news' : 'Refresh market news'} title="Refresh market news" icon={<RefreshCw size={14} aria-hidden="true" />} />
        </div>
      </div>
      <div className="home-news-toolbar">
        <span>{state.checkedAt ? `Feed checked ${new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(state.checkedAt)} IST` : 'Latest market headlines'}</span>
      </div>
      {state.error && <div className="home-news-status" role="status">{state.displayed.length ? 'Could not check for updates. Previous headlines are still available.' : 'Market news is unavailable right now. Try Refresh again.'}</div>}
      {state.pending && <div className="home-news-updates" role="status"><span>New headlines available</span>
        <ActionButton type="button" variant="ghost" size="sm" className="home-news-control" onClick={() => feed.accept()}>Show updates <ArrowRight size={14} aria-hidden="true" className="inline" /></ActionButton>
      </div>}
      {initial && !state.displayed.length ? <div role="status" className="home-news-skeleton"><span className="sr-only">Checking market headlines…</span><div aria-hidden="true" className="home-news-grid">{[0, 1, 2].map(index => <div key={index} className={`home-news-card${index === 0 ? ' home-news-card--lead' : ''}`}><span /><span /><span /></div>)}</div></div>
        : state.displayed.length ? <div className="home-news-grid">{state.displayed.map((item, index) => <NewsTextCard key={item.id} item={item} lead={index === 0} />)}</div>
        : !state.error && <div className="home-news-status">{watchlistOnly ? 'No matching company headlines yet. We will keep this section focused on your stocks.' : 'No headlines available yet. Check again soon or explore Market News.'}</div>}
    </section>
  );
}
