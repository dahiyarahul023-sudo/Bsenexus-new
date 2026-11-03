import { RadarReactionBrief, ReactionBadge, matchesReactionView, REACTION_VIEWS, type ReactionView } from './RadarReactionBrief';
import { isRadarResearch, type RadarResearch } from '../shared/radarReaction';
import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Radar, CalendarDays, Radio, BookmarkPlus, BookmarkCheck, ArrowUpRight, ArrowRight, RefreshCw, Clock3, Check } from 'lucide-react';
import { customFetch } from '../api';
import { useAuth } from '../context/AuthContext';
import { useVisibilityInterval } from '../hooks/useVisibilityInterval';
import { RadarWindow } from './RadarWindow';
import { RadarMovementPanel } from './RadarMovementPanel';
import { ActionButton } from './ui/ActionButton';
import { ImpactRadarFeed } from '../utils/impactRadarFeed';
import { groupRadarCompanies } from '../utils/radarCompanyGroups';
import { RADAR_CATEGORIES, RADAR_NOTICE, isRadarEvent, isRadarUpdate, matchesRadarFilter, radarStatus, radarDay, radarUrl, radarTiming, RADAR_TIMING_LABELS, radarVerificationSources, radarHeadline, radarCompanyName, radarCaseLookup, isRadarCategoryOption,
  radarSourceLabel, isReportedRadarSource, type RadarEvent, type RadarFilter, type RadarUpdate } from '../shared/impactRadar';
import '../styles/impact-radar.css';

const FILTERS: { id: RadarFilter; label: string }[] = [
  { id: 'all', label: 'All events' }, { id: 'live', label: 'Live Radar' }, { id: 'today', label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' }, { id: 'week', label: 'Next 7 days' }, { id: 'past', label: 'Past' }, { id: 'tracking', label: 'Tracking' },
];
const time = (value: string | number) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(new Date(value)) + ' IST';
const dayLabel = (event: RadarEvent, now: number) => {
  if (!event.scheduledDate) return event.status === 'scheduled' ? 'Next date pending' : `${event.occurredDate ? 'Event' : 'Reported'} ${event.occurredDate || radarDay(Date.parse(event.publishedAt))}`;
  const day = event.scheduledDate;
  const label = day === radarDay(now) ? 'Today' : day === radarDay(now + 86_400_000) ? 'Tomorrow' :
    new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(day));
  return `${label}${event.scheduleConfirmed ? '' : ' · tentative'}`;
};

export function RadarCard({ event, tracked, saving, disabled, now, selected, onOpen, onTrack, categoryLabel, research }: {
  research?: RadarResearch | null; categoryLabel?: string; event: RadarEvent; tracked: boolean; saving: boolean; disabled: boolean; now: number; selected: boolean;
  onOpen: (event: RadarEvent, button: HTMLButtonElement) => void; onTrack: () => void;
}) {
  return <article data-timing={radarTiming(event, now)} className={`impact-radar-card${selected ? ' is-open' : ''}`}>
    <div className="impact-radar-card-top"><span className="impact-radar-category">{categoryLabel || RADAR_CATEGORIES[event.category as keyof typeof RADAR_CATEGORIES] || event.category}</span>
      <span className="impact-radar-date"><CalendarDays size={12} aria-hidden="true" />{dayLabel(event, now)}</span></div>
    <div className="impact-radar-company">{event.companies.slice(0, 2).map(radarCompanyName).join(' · ')}{event.companies.length > 2 ? ` +${event.companies.length - 2}` : ''}</div>
    <h3><button type="button" className="impact-radar-card-open" aria-haspopup="dialog" aria-expanded={selected} onClick={e => onOpen(event, e.currentTarget)}><span className="impact-radar-card-title">{radarHeadline(event)}<ArrowUpRight size={16} aria-hidden="true" /></span></button></h3>
    <ReactionBadge event={event} research={research} now={now}/><div className="impact-radar-card-meta"><span>{event.authority}</span><span className="impact-radar-stage"><i aria-hidden="true" />{RADAR_TIMING_LABELS[radarTiming(event, now)]}</span></div>
    <div className="impact-radar-card-foot"><span className="impact-radar-source">{radarSourceLabel(event.source)} · {event.source.name}<time dateTime={event.publishedAt}>{time(event.publishedAt)}</time></span>
      <ActionButton type="button" size="sm" variant={tracked ? 'secondary' : 'ghost'} className="impact-radar-track" disabled={disabled} isLoading={saving} loadingText="Saving"
        aria-pressed={tracked} aria-label={`${tracked ? 'Stop tracking' : 'Track'} ${event.title}`} onClick={onTrack}
        icon={tracked ? <BookmarkCheck size={15} aria-hidden="true" /> : <BookmarkPlus size={15} aria-hidden="true" />}>{tracked ? 'Tracking' : 'Track event'}</ActionButton></div>
  </article>;
}

export function RadarDetail({ event, now, tracked, saving, disabled, onTrack, onRefreshKey, onRelated, research }: {
  research?: RadarResearch | null; event: RadarEvent; now: number; tracked: boolean; saving: boolean; disabled: boolean; onTrack: () => void; onRefreshKey: number | null; onRelated: (event: RadarEvent) => void;
}) {
  const [updates, setUpdates] = useState<RadarUpdate[]>([]), [error, setError] = useState(false), [loading, setLoading] = useState(true), [retry, setRetry] = useState(0);
  const [current, setCurrent] = useState(event);
  const [detailResearch, setDetailResearch] = useState<RadarResearch | null>(null);
  const [firstUpdate, setFirstUpdate] = useState<RadarUpdate | null>(null), [related, setRelated] = useState<RadarEvent[]>([]);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [event.id]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    let alive = true;
    setLoading(true); setError(false);
    void customFetch(`/api/impact-radar/${encodeURIComponent(event.id)}`, { signal: controller.signal }).then(async r => {
      const data = await r.json();
      if (!r.ok || data.success !== true || !isRadarEvent(data.event) || data.event.id !== event.id || !Array.isArray(data.updates) || data.updates.some((u: any) => !isRadarUpdate(u) || u.eventId !== event.id)) throw new Error('Unavailable');
      if (alive && !controller.signal.aborted) { setCurrent(data.event); setUpdates(data.updates); if(isRadarResearch(data.research)&&data.research.status==='ready')setDetailResearch(data.research); setFirstUpdate(isRadarUpdate(data.firstUpdate) && data.firstUpdate.eventId === event.id ? data.firstUpdate : null); setRelated(Array.isArray(data.related) ? data.related.filter((e: unknown) => isRadarEvent(e)).slice(0, 8) : []); }
    }).catch(() => { if (alive) setError(true); }).finally(() => { clearTimeout(timer); if (alive) setLoading(false); });
    return () => { alive = false; controller.abort(); clearTimeout(timer); };
  }, [event.id, event.updatedAt, retry, onRefreshKey]);
  const sourceHref = radarUrl(current.source.url);
  const lookup = radarCaseLookup(current);
  return <section id="impact-radar-detail" className="impact-radar-detail" aria-labelledby="impact-radar-detail-title" aria-busy={loading}>
    <div className="impact-radar-detail-top"><span className="impact-radar-eyebrow">Event brief</span></div>
    <h3 id="impact-radar-detail-title" ref={heading} tabIndex={-1}>{radarHeadline(current)}</h3>
    <p className="impact-radar-detail-companies">{current.companies.map(c => /^\d+$/.test(c.symbol) ? `BSE ${c.scripCode}` : c.symbol).join(' · ')}</p>
    <div className="impact-radar-detail-facts"><span>{current.authority}</span><span>{radarStatus(current, now)}</span><span>{dayLabel(current, now)}</span></div>
    <div className="impact-radar-provenance">
      <p><strong>Published:</strong> {time(current.publishedAt)} · {current.source.name}{isReportedRadarSource(current.source) ? ' · News-reported' : ''}</p>
      {current.occurredDate && <p><strong>Event date:</strong> {current.occurredDate} {current.occurredSource && <a href={radarUrl(current.occurredSource.url)!} target="_blank" rel="noopener noreferrer">Date evidence ↗</a>}</p>}
      {firstUpdate && (firstUpdate.source.url !== current.source.url || Date.parse(firstUpdate.publishedAt) !== Date.parse(current.publishedAt)) && <p><strong>First recorded:</strong> {time(firstUpdate.publishedAt)} <a href={radarUrl(firstUpdate.source.url)!} target="_blank" rel="noopener noreferrer">{firstUpdate.source.name} ↗</a></p>}
      {current.supportingSources?.map(s => <p key={s.url}><strong>Supporting source:</strong> <a href={radarUrl(s.url)!} target="_blank" rel="noopener noreferrer">{s.name} ↗</a></p>)}
      {current.scheduleSource && <p><strong>Next date evidence:</strong> <a href={radarUrl(current.scheduleSource.url)!} target="_blank" rel="noopener noreferrer">{current.scheduleSource.name} ↗</a></p>}
    </div>
    <RadarReactionBrief event={current} research={detailResearch||research} now={now}/><RadarMovementPanel eventId={current.id} refreshKey={current.updatedAt} companyCount={current.companies.length} />
    <div className="impact-radar-answers">
      {!/^The company has published a legal or regulatory disclosure|^A news source has reported this development/i.test(current.information) && <div><h4>Event summary</h4><p>{current.information}</p></div>}
      {current.nextTrigger && <div><h4>Next development</h4><p>{current.nextTrigger}</p></div>}
      {current.scheduledDate && <div><h4>Next scheduled date</h4><p>{current.scheduledDate}{current.scheduleConfirmed ? '' : ' · Reported, confirmation pending'}. The schedule may change.</p></div>}
      {current.status === 'closed' && <div><h4>Recorded status</h4><p>Marked closed. See the original source for the scope of closure.</p></div>}
    </div>
    {(radarVerificationSources(current).length > 0 || lookup.reference) && <details className="impact-radar-verification"><summary>Verify with original sources</summary>
      {/court|tribunal|NCLT|NCLAT|APTEL|SAT/i.test(current.authority) && <>
      {/[a-z]/i.test(lookup.party) && <p><strong>Party:</strong> {lookup.party}</p>}{lookup.reference && <p><strong>Case reference:</strong> {lookup.reference}</p>}
      {!lookup.reference && /[a-z]/i.test(lookup.party) && <p>Use party-name search and match the parties and order date with the original filing.</p>}
      </>}
      {radarVerificationSources(current).map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.name}<ArrowUpRight size={13} aria-hidden="true" /><span className="sr-only"> (opens a new tab)</span></a>)}
    </details>}
    <div className="impact-radar-detail-actions">
      <ActionButton type="button" variant="secondary" size="sm" disabled={disabled} isLoading={saving} loadingText="Saving" aria-pressed={tracked} onClick={onTrack} icon={tracked ? <BookmarkCheck size={16} /> : <BookmarkPlus size={16} />}>{tracked ? 'Tracking event' : 'Track event'}</ActionButton>
      {sourceHref && <a href={sourceHref} target="_blank" rel="noopener noreferrer">{current.source.name}<ArrowUpRight size={15} aria-hidden="true" /><span className="sr-only"> (opens a new tab)</span></a>}
    </div>
    {error && <div className="impact-radar-status" role="status">Timeline could not be refreshed. Previously loaded details may be out of date. <button type="button" onClick={() => setRetry(v => v + 1)}>Retry</button></div>}
    {loading && !updates.length ? <p role="status" className="impact-radar-muted">Loading source updates…</p> : updates.length ? <details className="impact-radar-source-history"><summary>Source history ({updates.length})</summary><ol className="impact-radar-timeline">{updates.map(u => <li key={u.id}>
      <time dateTime={u.publishedAt}>{time(u.publishedAt)}</time><strong>{u.title}</strong><p>{u.information}</p>
      <a href={radarUrl(u.source.url)!} target="_blank" rel="noopener noreferrer">{radarSourceLabel(u.source)} · {u.source.name}<ArrowUpRight size={13} aria-hidden="true" /><span className="sr-only"> (opens a new tab)</span></a>
    </li>)}</ol></details> : null}
    {updates.length === 50 && <p className="impact-radar-muted">Showing the latest 50 source updates.</p>}
    {related.length > 0 && <div className="impact-radar-related"><h4>Related company reports</h4><p>Earlier and newer Radar reports for this company, newest first. Separate reports may concern different proceedings.</p>{related.map(e => <button key={e.id} type="button" onClick={() => onRelated(e)}>{radarHeadline(e)}<span>{radarSourceLabel(e.source)} · {time(e.publishedAt)}</span></button>)}</div>}
    <p className="impact-radar-disclaimer">{RADAR_NOTICE} This is not an investment recommendation.</p>
  </section>;
}

export function ImpactRadar({ active, identity, onNavigate, density, watched = [], watchlistStatus = 'ready', onRefreshWatchlist, watchlistOnly = false }: {
  active: boolean; identity: string; onNavigate: (tab: string) => void; density: string; watched?: string[]; watchlistStatus?: 'loading' | 'ready' | 'error'; onRefreshWatchlist?: () => void; watchlistOnly?: boolean;
}) {
  const { setIsAuthModalOpen } = useAuth();
  const feed = useMemo(() => new ImpactRadarFeed(identity, customFetch), [identity]);
  const state = useSyncExternalStore(feed.subscribe, feed.getSnapshot, feed.getSnapshot);
  const [filter, setFilter] = useState<RadarFilter>('all'), [category, setCategory] = useState('all'), [limit, setLimit] = useState(12);
  const [scope, setScope] = useState<'all' | 'watchlist'>(watchlistOnly ? 'watchlist' : 'all'), [opened, setOpened] = useState(false);
  const [selected, setSelected] = useState<RadarEvent | null>(null), [now, setNow] = useState(Date.now());
  const opener = useRef<HTMLButtonElement | null>(null);
  const reduce = useReducedMotion();
  const [categories, setCategories] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 8000);
    let alive = true;
    void customFetch('/api/impact-radar/categories', { signal: controller.signal }).then(async r => {
      const body = await r.json();
      if (!r.ok || body.success !== true || !Array.isArray(body.categories) || body.categories.some((c: unknown) => !isRadarCategoryOption(c))) throw new Error('Categories unavailable');
      if (alive) setCategories(Object.fromEntries(body.categories.filter((c: any) => c.active).map((c: any) => [c.id, c.label])));
    }).catch(() => { if (alive) setCategories(RADAR_CATEGORIES); }).finally(() => clearTimeout(timeout));
    return () => { alive = false; controller.abort(); clearTimeout(timeout); };
  }, [active]);
  const refresh = useCallback(() => feed.refresh(), [feed]);
  useEffect(() => { setSelected(null); setOpened(false); setScope(watchlistOnly ? 'watchlist' : 'all'); setFilter('all'); setLimit(12); }, [identity]);
  useEffect(()=>{if(watchlistOnly){setSelected(null);setOpened(false);}},[watchlistOnly,watched.join('|')]);
  useEffect(() => { if (!active) { setOpened(false); setSelected(null); } }, [active]);
  useEffect(() => {
    if (!active) return;
    if (!document.hidden) void refresh();
    const visibility = () => { if (document.hidden) feed.cancelRead(); else void refresh(); };
    const resume = () => { if (!document.hidden) void refresh(); };
    const nav = (e: Event) => { if ((e as CustomEvent).detail?.tab === 'home' && !document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', visibility); window.addEventListener('bse_nav_tab_refresh', nav);
    window.addEventListener('online', resume); window.addEventListener('pageshow', resume);
    return () => { feed.dispose(); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('bse_nav_tab_refresh', nav); window.removeEventListener('online', resume); window.removeEventListener('pageshow', resume); };
  }, [active, feed, refresh]);
  useVisibilityInterval(refresh, 60_000, active);
  useVisibilityInterval(() => setNow(Date.now()), 15_000, active);
  const tracked = useMemo(() => new Set(state.following), [state.following]);
  const watchedSet = useMemo(() => new Set(watched.map(s => s.toUpperCase())), [watched]);
  const [reactionView, setReactionView] = useState<ReactionView>('all');
  const items = useMemo(() => state.items.filter(e => matchesReactionView(e,state.research,reactionView,now) && matchesRadarFilter(e, filter, tracked, now) && (category === 'all' || e.category === category) &&
    ((scope === 'all' && !watchlistOnly) || e.companies.some(c => watchedSet.has(c.symbol) || watchedSet.has(c.scripCode)))), [state.items, state.research, reactionView, filter, tracked, now, category, scope, watchedSet, watchlistOnly]);
  const groups = useMemo(() => groupRadarCompanies(items), [items]);
  const preview = groupRadarCompanies([...state.items].sort((a,b)=>Number(matchesReactionView(b,state.research,'morning',now))-Number(matchesReactionView(a,state.research,'morning',now))).filter(e => e.status !== 'closed' && ((scope==='all' && !watchlistOnly) || (watchlistStatus==='ready' && e.companies.some(c=>watchedSet.has(c.symbol)||watchedSet.has(c.scripCode)))))).slice(0,2);
  const sourceOverdue = state.sourceStale || (state.sourceCheckedAt !== null && now - state.sourceCheckedAt > 5 * 60_000);
  const stale = !!state.error || state.sourceUnavailable || sourceOverdue;
  const close = () => { setOpened(false); setSelected(null); };
  const signIn = () => { close(); setIsAuthModalOpen(true); };
  const track = (event: RadarEvent) => { if (identity === 'guest') signIn(); else void feed.toggle(event.id); };
  const open = (event: RadarEvent, button: HTMLButtonElement) => { opener.current = button; setSelected(event); setOpened(true); };
  const back = () => { setSelected(null); requestAnimationFrame(() => { if (opener.current?.isConnected) opener.current.focus({ preventScroll: true }); }); };
  const initial = state.checkedAt === null && !state.error;
  const statusText = state.loading ? 'Checking updates' : state.error ? 'Check unavailable' : state.sourceUnavailable ? 'Source scan unavailable' : sourceOverdue ? 'Source scan delayed' : state.sourcePending ? 'Source check pending' : state.checkedAt ? 'Sources checked' : 'Not checked yet';
  const markTone = state.items.some(e => radarTiming(e, now) === 'live') ? 'live' : state.items.some(e => radarTiming(e, now) === 'upcoming') ? 'upcoming' : 'past';
  const cards = (companyGroups: ReturnType<typeof groupRadarCompanies>) => <div className="impact-radar-grid">{companyGroups.map((group, i) => {
    const event = group.latest;
    return <motion.div className="impact-radar-company-group" key={group.key} initial={reduce ? false : {opacity:0,x:-6}} animate={{opacity:1,x:0}} transition={{duration:reduce ? 0 : .18,delay:reduce ? 0 : Math.min(i,3)*.035}}>
      <RadarCard research={state.research} categoryLabel={categories[event.category]} event={event} tracked={tracked.has(event.id)} saving={state.saving.includes(event.id)} disabled={identity !== 'guest' && !state.followingReady} now={now} selected={group.reports.some(report => report.id === selected?.id)} onOpen={open} onTrack={() => track(event)} />
      {group.reports.length > 1 && <details className="impact-radar-company-reports"><summary>{group.reports.length} reports for this company</summary><div>{group.reports.map(report => <button key={report.id} type="button" onClick={e => open(report,e.currentTarget)}>{radarHeadline(report)}<span>{report.source.name} · {time(report.publishedAt)}</span></button>)}</div></details>}
    </motion.div>;
  })}</div>;
  const skeleton = (count: number) => <div className="impact-radar-grid" role="status"><span className="sr-only">Loading Impact Radar…</span>{Array.from({ length: count }, (_, i) => <div key={i} className="impact-radar-card impact-radar-skeleton" aria-hidden="true"><span /><span /><span /><span /></div>)}</div>;
  const feedback = <>
    {(state.error || state.sourceUnavailable) && <div className="impact-radar-status" role="status">{state.error || 'Some sources could not be refreshed. Saved events remain available.'}</div>}
    {sourceOverdue && !state.sourceUnavailable && <div className="impact-radar-status" role="status">No source scan recorded in the last 5 minutes{state.sourceCheckedAt ? ` · last scan ${time(state.sourceCheckedAt)}` : ''}. Saved events remain available. Refresh reads the latest saved scan status.</div>}
    {state.newsUnavailable && !state.sourceUnavailable && !sourceOverdue && <p className="impact-radar-muted">News sources are recovering. Filing scans are available.</p>}
    {state.followingError && <div className="impact-radar-status" role="status">Your tracking list could not be checked. Refresh to retry.</div>}
    {state.actionError && <div className="impact-radar-status" role="alert">{state.actionError}</div>}
    {state.pending && <div className="impact-radar-new" role="status"><span><Check size={14} aria-hidden="true" />Event updates available</span><ActionButton type="button" size="sm" variant="ghost" onClick={feed.accept}>Show updates<ArrowRight size={14} aria-hidden="true" /></ActionButton></div>}
  </>;
  const check = <div className="impact-radar-check" role="status"><span className={`impact-radar-check-dot${stale ? ' is-stale' : ''}`} /><span>{statusText}{state.sourceCheckedAt ? ` · ${time(state.sourceCheckedAt)}` : ''}</span></div>;
  const refreshButton = <ActionButton type="button" variant="secondary" size="sm" className="impact-radar-refresh" aria-label="Refresh Impact Radar" title="Refresh Impact Radar" isLoading={state.loading} loadingText="" onClick={refresh} icon={<RefreshCw size={15} aria-hidden="true" />} />;
  const scopeControls = <div className="impact-radar-scope" role="group" aria-label="Radar scope">{!watchlistOnly && <button type="button" aria-pressed={scope === 'all'} onClick={() => { setSelected(null); setScope('all'); setLimit(12); }}>All events</button>}<button type="button" aria-pressed={scope === 'watchlist'} onClick={() => { setSelected(null); setScope('watchlist'); setLimit(12); }}>Watchlist Radar</button></div>;
  return <section className={`impact-radar impact-radar-preview impact-radar--${density}`} aria-labelledby="impact-radar-title">
    <div className="impact-radar-heading"><div className="impact-radar-brand"><span className="impact-radar-mark" data-timing={markTone}><Radar size={23} aria-hidden="true" /></span><div><h2 id="impact-radar-title">Impact Radar</h2><p>Know the event. Follow the developments.</p></div></div>
      <div className="impact-radar-heading-actions"><ActionButton type="button" variant="ghost" size="sm" aria-haspopup="dialog" onClick={() => { setSelected(null); setOpened(true); }}>See more<ArrowRight size={14} aria-hidden="true" /></ActionButton>{refreshButton}</div></div>
    {scopeControls}{check}{feedback}
    {scope==='watchlist' && watchlistStatus!=='ready' ? <p className="impact-radar-status" role="status">{watchlistStatus==='loading'?'Checking your watchlist…':'Your watchlist could not be checked.'}{watchlistStatus==='error' && onRefreshWatchlist && <button type="button" onClick={onRefreshWatchlist}>Retry watchlist</button>}</p> : initial ? skeleton(2) : preview.length ? cards(preview) : <p className="impact-radar-status">No sourced events available yet. Open Radar to browse periods and your watchlist.</p>}
    <p className="impact-radar-note"><Clock3 size={13} aria-hidden="true" /><span>{RADAR_NOTICE}</span></p>
    {opened && <RadarWindow onClose={close} onBack={selected ? back : undefined} detailKey={selected?.id || null}>
      {selected ? <RadarDetail research={state.research} key={selected.id} event={state.items.find(e => e.id === selected.id) || selected} now={now} onRelated={setSelected} onRefreshKey={state.checkedAt} tracked={tracked.has(selected.id)} saving={state.saving.includes(selected.id)} disabled={identity !== 'guest' && !state.followingReady} onTrack={() => track(selected)} /> : <>
        <div className="impact-radar-heading"><div className="impact-radar-brand"><span className="impact-radar-mark" data-timing={markTone}><Radar size={23} aria-hidden="true" /></span><div><h2 id="impact-radar-dashboard-title" tabIndex={-1}>Impact Radar</h2><p>News reports, official disclosures and event history</p></div></div>{refreshButton}</div>
        {scopeControls}
        <div className="impact-radar-controls"><div className="impact-radar-filters" role="group" aria-label="Event period">{FILTERS.map(f => <button type="button" key={f.id} aria-pressed={filter === f.id} className={filter === f.id ? 'is-selected' : ''} onClick={() => { setFilter(f.id); setLimit(12); }}>{f.id === 'live' ? <Radio size={14} aria-hidden="true" /> : f.id === 'tracking' ? <BookmarkCheck size={14} aria-hidden="true" /> : null}{f.label}{f.id === 'tracking' && <span>{identity !== 'guest' && state.followingReady ? state.following.length : '—'}</span>}</button>)}</div>
          <label className="impact-radar-category-filter"><span className="sr-only">Event category</span><select value={category} onChange={e => { setCategory(e.target.value); setLimit(12); }}><option value="all">All categories</option>{Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
        {check}{feedback}
        <div className="impact-radar-filters" role="group" aria-label="Market reaction">{Object.entries(REACTION_VIEWS).map(([id,label])=><button type="button" key={id} aria-pressed={reactionView===id} onClick={()=>{setReactionView(id as ReactionView);setLimit(12)}}>{label}</button>)}</div>
        {state.research?.status!=='ready'&&<p className="impact-radar-status" role="status">Reaction research is unavailable or awaiting its first background check. News remains available.</p>}
        <div className="impact-radar-legend"><span data-timing="live">Live / today</span><span data-timing="upcoming">Upcoming</span><span data-timing="past">Past</span></div>
        {identity === 'guest' && (scope === 'watchlist' || filter === 'tracking') ? <div className="impact-radar-empty"><h3>Your personal radar</h3><p>Sign in to see watchlist companies or followed events.</p><ActionButton type="button" size="sm" variant="secondary" onClick={signIn}>Sign in</ActionButton></div>
          : scope === 'watchlist' && watchlistStatus !== 'ready' ? <p className="impact-radar-status" role="status">{watchlistStatus === 'loading' ? 'Checking your watchlist…' : 'Your watchlist could not be checked.'}{watchlistStatus === 'error' && onRefreshWatchlist && <button type="button" onClick={onRefreshWatchlist}>Retry watchlist</button>}</p>
          : initial ? skeleton(3) : groups.length ? <>{cards(groups.slice(0, limit))}{groups.length > limit && <button type="button" className="impact-radar-more" onClick={() => setLimit(v => v + 12)}>Show more companies <ArrowRight size={14} aria-hidden="true" /></button>}<p className="impact-radar-muted">Showing {Math.min(limit, groups.length)} of {groups.length} companies · {items.length} reports. Open a company’s reports to read each development.</p></>
          : <div className="impact-radar-empty"><Radar size={28} aria-hidden="true" /><h3>No events in this view</h3><p>{scope === 'watchlist' ? 'No sourced events match your watchlist and current filters.' : filter === 'tracking' ? 'Track an event to keep following its developments.' : 'Try another period or category. Missing dates are never invented.'}</p>{scope === 'watchlist' && <ActionButton type="button" size="sm" variant="ghost" onClick={() => { close(); onNavigate('watchlists'); }}>Manage watchlist</ActionButton>}</div>}
        <p className="impact-radar-note">{RADAR_NOTICE}</p>
      </>}
    </RadarWindow>}
  </section>;
}
