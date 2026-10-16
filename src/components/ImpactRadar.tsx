import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Radar, CalendarDays, Radio, BookmarkPlus, BookmarkCheck, ArrowUpRight, ArrowRight, RefreshCw, X, Clock3, Check } from 'lucide-react';
import { customFetch } from '../api';
import { useAuth } from '../context/AuthContext';
import { useVisibilityInterval } from '../hooks/useVisibilityInterval';
import { ActionButton } from './ui/ActionButton';
import { ImpactRadarFeed } from '../utils/impactRadarFeed';
import { RADAR_CATEGORIES, RADAR_NOTICE, RADAR_STALE_MS, isRadarEvent, isRadarUpdate, matchesRadarFilter, radarStatus, radarDay, radarUrl,
  type RadarEvent, type RadarFilter, type RadarUpdate } from '../shared/impactRadar';
import '../styles/impact-radar.css';

const FILTERS: { id: RadarFilter; label: string }[] = [
  { id: 'all', label: 'All events' }, { id: 'live', label: 'Live Radar' }, { id: 'today', label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' }, { id: 'week', label: 'Next 7 days' }, { id: 'tracking', label: 'Tracking' },
];
const time = (value: string | number) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(new Date(value)) + ' IST';
const dayLabel = (event: RadarEvent, now: number) => {
  if (!event.scheduledDate) return 'Date not announced';
  const day = event.scheduledDate;
  const label = day === radarDay(now) ? 'Today' : day === radarDay(now + 86_400_000) ? 'Tomorrow' :
    new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(day));
  return `${label}${event.scheduleConfirmed ? '' : ' · tentative'}`;
};

export function RadarCard({ event, tracked, saving, disabled, now, selected, onOpen, onTrack }: {
  event: RadarEvent; tracked: boolean; saving: boolean; disabled: boolean; now: number; selected: boolean;
  onOpen: (event: RadarEvent, button: HTMLButtonElement) => void; onTrack: () => void;
}) {
  return <article className={`impact-radar-card${selected ? ' is-open' : ''}`}>
    <div className="impact-radar-card-top"><span className="impact-radar-category">{RADAR_CATEGORIES[event.category]}</span>
      <span className="impact-radar-date"><CalendarDays size={12} aria-hidden="true" />{dayLabel(event, now)}</span></div>
    <div className="impact-radar-company">{event.companies.slice(0, 2).map(c => c.name).join(' · ')}{event.companies.length > 2 ? ` +${event.companies.length - 2}` : ''}</div>
    <h3><button type="button" aria-expanded={selected} aria-controls="impact-radar-detail" onClick={e => onOpen(event, e.currentTarget)}>{event.title}<ArrowUpRight size={16} aria-hidden="true" /></button></h3>
    <div className="impact-radar-card-meta"><span>{event.authority}</span><span className="impact-radar-stage">{radarStatus(event, now)}</span></div>
    <div className="impact-radar-card-foot"><span className="impact-radar-source">{event.source.kind === 'news' ? 'News report' : event.source.kind === 'disclosure' ? 'Company disclosure' : 'Official source'}<time dateTime={event.publishedAt}>{time(event.publishedAt)}</time></span>
      <ActionButton type="button" size="sm" variant={tracked ? 'secondary' : 'ghost'} className="impact-radar-track" disabled={disabled} isLoading={saving} loadingText="Saving"
        aria-pressed={tracked} aria-label={`${tracked ? 'Stop tracking' : 'Track'} ${event.title}`} onClick={onTrack}
        icon={tracked ? <BookmarkCheck size={15} aria-hidden="true" /> : <BookmarkPlus size={15} aria-hidden="true" />}>{tracked ? 'Tracking' : 'Track event'}</ActionButton></div>
  </article>;
}

function RadarDetail({ event, now, onClose, tracked, saving, disabled, onTrack, onRefreshKey }: {
  event: RadarEvent; now: number; onClose: () => void; tracked: boolean; saving: boolean; disabled: boolean; onTrack: () => void; onRefreshKey: number | null;
}) {
  const [updates, setUpdates] = useState<RadarUpdate[]>([]), [error, setError] = useState(false), [loading, setLoading] = useState(true), [retry, setRetry] = useState(0);
  const [current, setCurrent] = useState(event);
  const heading = useRef<HTMLHeadingElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => { heading.current?.focus({ preventScroll: true }); heading.current?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'instant' : 'smooth' }); }, [event.id]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    let alive = true;
    setLoading(true); setError(false);
    void customFetch(`/api/impact-radar/${encodeURIComponent(event.id)}`, { signal: controller.signal }).then(async r => {
      const data = await r.json();
      if (!r.ok || data.success !== true || !isRadarEvent(data.event) || data.event.id !== event.id || !Array.isArray(data.updates) || data.updates.some((u: any) => !isRadarUpdate(u) || u.eventId !== event.id)) throw new Error('Unavailable');
      if (alive && !controller.signal.aborted) { setCurrent(data.event); setUpdates(data.updates); }
    }).catch(() => { if (alive) setError(true); }).finally(() => { clearTimeout(timer); if (alive) setLoading(false); });
    return () => { alive = false; controller.abort(); clearTimeout(timer); };
  }, [event.id, event.updatedAt, retry, onRefreshKey]);
  const sourceHref = radarUrl(current.source.url);
  return <section id="impact-radar-detail" className="impact-radar-detail" aria-labelledby="impact-radar-detail-title" aria-busy={loading}>
    <div className="impact-radar-detail-top"><span className="impact-radar-eyebrow">Event brief</span><button type="button" className="impact-radar-close" aria-label="Close event brief" onClick={onClose}><X size={18} aria-hidden="true" /></button></div>
    <h3 id="impact-radar-detail-title" ref={heading} tabIndex={-1}>{current.title}</h3>
    <p className="impact-radar-detail-companies">{current.companies.map(c => `${c.name} (${c.symbol})`).join(' · ')}</p>
    <div className="impact-radar-detail-facts"><span>{current.authority}</span><span>{radarStatus(current, now)}</span><span>{dayLabel(current, now)}</span></div>
    <div className="impact-radar-answers">
      <div><h4>What is this event?</h4><p>{current.information}</p></div>
      <div><h4>What happens next?</h4><p>{current.nextTrigger || 'The next confirmed development has not been announced. Follow the original source for further information.'}</p></div>
      <div><h4>What does the date mean?</h4><p>{current.scheduledDate ? 'This is a reported event date, not a confirmed outcome. A hearing may be deferred; an order or judgment is not guaranteed on that date.' : 'No confirmed future event date is recorded. A publication timestamp is not a hearing date.'}</p></div>
      <div><h4>How long will it continue?</h4><p>{current.status === 'closed' ? 'This matter is marked closed in the recorded timeline. See the source for the scope of closure.' : 'The duration is not confirmed. Tracking keeps this matter available as further sourced developments are added.'}</p></div>
    </div>
    <div className="impact-radar-detail-actions">
      <ActionButton type="button" variant="secondary" size="sm" disabled={disabled} isLoading={saving} loadingText="Saving" aria-pressed={tracked} onClick={onTrack} icon={tracked ? <BookmarkCheck size={16} /> : <BookmarkPlus size={16} />}>{tracked ? 'Tracking event' : 'Track event'}</ActionButton>
      {sourceHref && <a href={sourceHref} target="_blank" rel="noopener noreferrer">{current.source.name}<ArrowUpRight size={15} aria-hidden="true" /><span className="sr-only"> (opens a new tab)</span></a>}
    </div>
    <div className="impact-radar-timeline-heading"><h4>Event timeline</h4><span>Latest source updates</span></div>
    {error && <div className="impact-radar-status" role="status">Timeline could not be refreshed. Previously loaded details may be out of date. <button type="button" onClick={() => setRetry(v => v + 1)}>Retry</button></div>}
    {loading && !updates.length ? <p role="status" className="impact-radar-muted">Loading source updates…</p> : updates.length ? <ol className="impact-radar-timeline">{updates.map(u => <li key={u.id}>
      <time dateTime={u.publishedAt}>{time(u.publishedAt)}</time><strong>{u.title}</strong><p>{u.information}</p>
      <a href={radarUrl(u.source.url)!} target="_blank" rel="noopener noreferrer">{u.source.name}<ArrowUpRight size={13} aria-hidden="true" /><span className="sr-only"> (opens a new tab)</span></a>
    </li>)}</ol> : !error && <p className="impact-radar-muted">No additional source updates are recorded.</p>}
    {updates.length === 50 && <p className="impact-radar-muted">Showing the latest 50 source updates.</p>}
    <p className="impact-radar-disclaimer">{RADAR_NOTICE} This is not an investment recommendation.</p>
  </section>;
}

export function ImpactRadar({ active, identity, onNavigate, density }: {
  active: boolean; identity: string; onNavigate: (tab: string) => void; density: string;
}) {
  const { setIsAuthModalOpen } = useAuth();
  const feed = useMemo(() => new ImpactRadarFeed(identity, customFetch), [identity]);
  const state = useSyncExternalStore(feed.subscribe, feed.getSnapshot, feed.getSnapshot);
  const [filter, setFilter] = useState<RadarFilter>('all'), [category, setCategory] = useState('all'), [limit, setLimit] = useState(6);
  const [selected, setSelected] = useState<RadarEvent | null>(null), [now, setNow] = useState(Date.now());
  const opener = useRef<HTMLButtonElement | null>(null);
  const reduce = useReducedMotion();
  const refresh = useCallback(() => feed.refresh(), [feed]);
  useEffect(() => { setSelected(null); setFilter('all'); setLimit(6); }, [identity]);
  useEffect(() => {
    if (!active) return;
    if (!document.hidden) void refresh();
    const visibility = () => { if (document.hidden) feed.cancelRead(); };
    const nav = (e: Event) => { if ((e as CustomEvent).detail?.tab === 'home' && !document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', visibility); window.addEventListener('bse_nav_tab_refresh', nav);
    return () => { feed.dispose(); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('bse_nav_tab_refresh', nav); };
  }, [active, feed, refresh]);
  useVisibilityInterval(refresh, 60_000, active);
  useVisibilityInterval(() => setNow(Date.now()), 15_000, active);
  const tracked = useMemo(() => new Set(state.following), [state.following]);
  const items = useMemo(() => state.items.filter(e => matchesRadarFilter(e, filter, tracked, now) && (category === 'all' || e.category === category)), [state.items, filter, tracked, now, category]);
  const stale = !!state.error || state.sourceUnavailable || (state.checkedAt !== null && now - state.checkedAt > RADAR_STALE_MS);
  const track = (event: RadarEvent) => { if (identity === 'guest') setIsAuthModalOpen(true); else void feed.toggle(event.id); };
  const close = () => { setSelected(null); opener.current?.isConnected && opener.current.focus({ preventScroll: true }); };
  const initial = state.checkedAt === null && !state.error;
  const statusText = state.loading ? 'Checking updates' : state.error ? 'Check unavailable' : stale ? 'Update delayed' : state.checkedAt ? 'Radar checked' : 'Not checked yet';
  return <section className={`impact-radar impact-radar--${density}`} aria-labelledby="impact-radar-title">
    <div className="impact-radar-heading"><div className="impact-radar-brand"><span className="impact-radar-mark"><Radar size={23} aria-hidden="true" /></span><div><h2 id="impact-radar-title">Impact Radar</h2><p>Know the event. Follow the developments.</p></div></div>
      <div className="impact-radar-heading-actions"><ActionButton type="button" variant="ghost" size="sm" onClick={() => onNavigate('news')}>All news<ArrowRight size={14} aria-hidden="true" /></ActionButton>
        <ActionButton type="button" variant="secondary" size="sm" className="impact-radar-refresh" aria-label="Refresh Impact Radar" title="Refresh Impact Radar" isLoading={state.loading} loadingText="" onClick={refresh} icon={<RefreshCw size={15} aria-hidden="true" />} /></div></div>
    <div className="impact-radar-controls"><div className="impact-radar-filters" role="group" aria-label="Event period">
      {FILTERS.map(f => <button type="button" key={f.id} aria-pressed={filter === f.id} className={filter === f.id ? 'is-selected' : ''} onClick={() => { setFilter(f.id); setLimit(6); setSelected(null); }}>
        {f.id === 'live' ? <Radio size={14} aria-hidden="true" /> : f.id === 'tracking' ? <BookmarkCheck size={14} aria-hidden="true" /> : null}{f.label}
        {f.id === 'tracking' && <span>{identity !== 'guest' && state.followingReady ? state.following.length : '—'}</span>}
      </button>)}
    </div><label className="impact-radar-category-filter"><span className="sr-only">Event category</span><select value={category} onChange={e => { setCategory(e.target.value); setLimit(6); setSelected(null); }}><option value="all">All categories</option>{Object.entries(RADAR_CATEGORIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
    <div className="impact-radar-check" role="status"><span className={`impact-radar-check-dot${stale ? ' is-stale' : ''}`} /><span>{statusText}{state.checkedAt ? ` · ${time(state.checkedAt)}` : ''}</span></div>
    {(state.error || state.sourceUnavailable) && <div className="impact-radar-status" role="status">{state.error || 'Source intake could not be refreshed. Saved events remain available; check original sources for the latest position.'} {state.items.length > 0 && state.error ? 'Previously loaded events are shown.' : ''}</div>}
    {state.followingError && <div className="impact-radar-status" role="status">Your tracking list could not be checked. Refresh to retry.</div>}
    {state.actionError && <div className="impact-radar-status" role="alert">{state.actionError}</div>}
    {state.pending && <div className="impact-radar-new" role="status"><span><Check size={14} aria-hidden="true" />Event updates available</span><ActionButton type="button" size="sm" variant="ghost" onClick={feed.accept}>Show updates<ArrowRight size={14} aria-hidden="true" /></ActionButton></div>}
    {filter === 'tracking' && identity === 'guest' ? <div className="impact-radar-empty"><BookmarkPlus size={25} aria-hidden="true" /><h3>Keep an event on your radar</h3><p>Sign in to save events and return to their latest developments.</p><ActionButton type="button" size="sm" variant="secondary" onClick={() => setIsAuthModalOpen(true)}>Sign in to track</ActionButton></div>
      : initial ? <div className="impact-radar-grid" role="status"><span className="sr-only">Loading Impact Radar…</span>{[0, 1, 2].map(i => <div key={i} className="impact-radar-card impact-radar-skeleton" aria-hidden="true"><span /><span /><span /><span /></div>)}</div>
      : items.length ? <div className="impact-radar-grid">{items.slice(0, limit).map((event, i) => <motion.div key={event.id} initial={reduce ? false : { opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: reduce ? 0 : 0.18, delay: reduce ? 0 : Math.min(i, 3) * 0.035 }}>
        <RadarCard event={event} tracked={tracked.has(event.id)} saving={state.saving.includes(event.id)} disabled={identity !== 'guest' && !state.followingReady} now={now} selected={selected?.id === event.id}
          onOpen={(e, button) => { opener.current = button; setSelected(e); }} onTrack={() => track(event)} />
      </motion.div>)}</div>
      : !state.error && <div className="impact-radar-empty"><Radar size={28} aria-hidden="true" /><h3>{filter === 'tracking' ? state.followingReady ? 'Your radar starts here' : 'Checking your tracking list' : 'No events in this view'}</h3><p>{filter === 'tracking' ? 'Use Track event to keep a matter here, including events that continue across several days.' : 'Confirmed dates and sourced developments will appear here when available. Try another period or category.'}</p></div>}
    {items.length > limit && <button type="button" className="impact-radar-more" onClick={() => setLimit(v => v + 6)}>Show more events <ArrowRight size={14} aria-hidden="true" /></button>}
    {selected && <RadarDetail key={selected.id} event={state.items.find(e => e.id === selected.id) || selected} now={now} onClose={close} onRefreshKey={state.checkedAt} tracked={tracked.has(selected.id)} saving={state.saving.includes(selected.id)} disabled={identity !== 'guest' && !state.followingReady} onTrack={() => track(selected)} />}
    <p className="impact-radar-note"><Clock3 size={13} aria-hidden="true" /><span>{RADAR_NOTICE}</span></p>
  </section>;
}
