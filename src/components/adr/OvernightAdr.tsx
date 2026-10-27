import type { FeedDensity } from '../../hooks/useFeedDensity';
import React, { useEffect, useRef, useState } from 'react';
import { ChevronRight, ExternalLink, Globe2, RefreshCw, Star } from 'lucide-react';
import { adrClient } from '../../services/adrClient';
import { adrCompanyFor, adrIsRecent, adrPercent, adrSessionLabel, adrSeverity, rankAdrs, type AdrQuote, type AdrSnapshot } from '../../shared/adr';
import { heliosCard } from '../ui/helios';
import { ActionButton } from '../ui/ActionButton';
import type { StoryCompany } from '../story/storyTypes';

function useAdrSnapshot(active: boolean) {
  const [snapshot, setSnapshot] = useState<AdrSnapshot | null>(() => adrClient.peek());
  const [loading, setLoading] = useState(!snapshot);
  const [error, setError] = useState('');
  const epoch = useRef(0);
  const retry = async () => {
    const version = ++epoch.current;
    setLoading(true);
    try { const data = await adrClient.load(); if (version === epoch.current) { setSnapshot(data); setError(''); } }
    catch (failure) { if (version === epoch.current) setError(failure instanceof Error ? failure.message : 'Could not check ADR quotes.'); }
    finally { if (version === epoch.current) setLoading(false); }
  };
  useEffect(() => {
    if (!active) return;
    const refresh = () => { if (!document.hidden) void retry(); };
    refresh();
    const timer = setInterval(refresh, 60000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('bse_nav_tab_refresh', refresh);
    return () => { epoch.current++; clearInterval(timer); document.removeEventListener('visibilitychange', refresh); window.removeEventListener('bse_nav_tab_refresh', refresh); };
  }, [active]);
  return { snapshot, loading, error, retry };
}
const companyOf = (quote: AdrQuote): StoryCompany => ({ symbol: quote.symbol, scripCode: quote.scripCode, name: quote.name });

export function AdrRows({ items, watched = [], onOpenCompany, now = Date.now(), confirmed = true }: {
  items: AdrQuote[]; watched?: string[]; onOpenCompany: (company: StoryCompany) => void; now?: number; confirmed?: boolean;
}) {
  const watching = new Set(watched.map(value => value.toUpperCase()));
  return <div className="adr-rows">{items.map(quote => {
    const important = confirmed && adrIsRecent(quote, now) && !quote.corporateAction;
    const severity = important ? adrSeverity(quote.changePercent) : 'normal';
    return <div className="adr-row" key={quote.adrSymbol} data-severity={severity}>
      <button type="button" className="adr-company" onClick={() => onOpenCompany(companyOf(quote))}>
        <span className="adr-company-copy"><strong>{quote.name}</strong><small>{quote.adrSymbol} · ${quote.close.toFixed(2)} · {adrSessionLabel(quote.sessionDate)} US close</small>
          {(watching.has(quote.symbol) || watching.has(quote.scripCode)) && <span className="adr-watchlist"><Star size={10} aria-hidden="true" /> Your watchlist</span>}
          {quote.corporateAction ? <small>Split in comparison period</small> : severity !== 'normal' ? <span className="adr-move-label">{severity === 'sharp' ? 'Sharp US move' : 'Large US move'}</span> : null}
          {!adrIsRecent(quote, now) && <small>Older session</small>}
        </span><span className="adr-value" data-direction={quote.changePercent < 0 ? 'down' : quote.changePercent > 0 ? 'up' : 'flat'}>{adrPercent(quote.changePercent)}</span><ChevronRight size={14} aria-hidden="true" />
      </button>
      <a className="adr-source-link" href={quote.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={`${quote.name} ADR quote source`}><ExternalLink size={14} aria-hidden="true" /></a>
    </div>;
  })}</div>;
}

export function OvernightAdrView({ snapshot, watched = [], onOpenCompany, onOpenStory, now = Date.now(), density = 'compact', watchlistOnly = false }: {
  snapshot: AdrSnapshot; watched?: string[]; onOpenCompany: (company: StoryCompany) => void; onOpenStory?: () => void; now?: number; density?: FeedDensity; watchlistOnly?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const items = rankAdrs(snapshot.items, watched).filter(item=>!watchlistOnly || watched.includes(item.symbol) || watched.includes(adrCompanyFor(item.symbol)?.scripCode || ''));
  const confirmed = !snapshot.refreshFailed && now - snapshot.checkedAt <= 10 * 60000;
  const lead = items.find(item => confirmed && adrIsRecent(item, now) && !item.corporateAction && adrSeverity(item.changePercent) !== 'normal');
  if (watchlistOnly && !items.length) return null;
  return <section className={`adr-panel ${heliosCard}`} data-density={density} data-prominent={Boolean(lead)} aria-label="Overnight ADR">
    <header className="adr-header"><div><h2><Globe2 size={16} aria-hidden="true" /> Overnight ADR</h2><p>{lead ? `${lead.name} ${lead.changePercent < 0 ? 'fell' : 'rose'} ${Math.abs(lead.changePercent).toFixed(2)}% in the US session` : 'Indian companies in the US market'}</p></div>{onOpenStory && <ActionButton size="sm" variant="ghost" onClick={onOpenStory}>Story <ChevronRight size={13} /></ActionButton>}</header>
    <AdrRows items={expanded ? items : items.slice(0, 3)} watched={watched} onOpenCompany={onOpenCompany} now={now} confirmed={confirmed} />
    <footer className="adr-footer"><span>USD · Yahoo Finance · Regular sessions</span>{items.length > 3 && <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? 'Show less' : `View all ${items.length}`}</button>}</footer>
    {snapshot.status === 'partial' && <p className="adr-status" role="status">Some ADR quotes could not be checked.</p>}
    {!confirmed && <p className="adr-status" role="status">Saved snapshot. Latest quotes could not be confirmed.</p>}
    <p className="adr-context">US session change; the Indian opening can differ.</p>
  </section>;
}

export function OvernightAdr({ active = true, watched, onOpenCompany, onOpenStory, density = 'compact', watchlistOnly = false }: {
  active?: boolean; watched?: string[]; onOpenCompany: (company: StoryCompany) => void; onOpenStory: () => void; density?: FeedDensity; watchlistOnly?: boolean;
}) {
  const state = useAdrSnapshot(active);
  if (watchlistOnly && !watched?.length) return null;
  return <div className="adr-owner">
    {state.snapshot ? <OvernightAdrView watchlistOnly={watchlistOnly} snapshot={state.snapshot} density={density} watched={watched} onOpenCompany={onOpenCompany} onOpenStory={watchlistOnly ? undefined : onOpenStory} />
      : <section className={`adr-panel ${heliosCard}`} aria-label="Overnight ADR"><h2 className="adr-loading-title">Overnight ADR</h2>{state.loading ? <div className="adr-skeleton" role="status" aria-label="Loading ADR quotes"><span /><span /><span /></div> : <p className="adr-status">ADR quotes are unavailable.</p>}</section>}
    {state.error && <div className="adr-recovery" role="status"><span>{state.error}</span><ActionButton size="sm" variant="ghost" disabled={state.loading} onClick={() => void state.retry()}><RefreshCw size={12} /> Retry</ActionButton></div>}
  </div>;
}
function CompanyAdrContent({ symbol }: { symbol: string }) {
  const { snapshot, error, loading, retry } = useAdrSnapshot(true);
  const item = snapshot?.items.find(item => item.symbol === symbol);
  return <section className="adr-company-strip" aria-label="US ADR session">
    {item ? <><div><strong>{item.adrSymbol} ADR <span className="adr-value" data-direction={item.changePercent < 0 ? 'down' : 'up'}>{adrPercent(item.changePercent)}</span></strong><p>${item.close.toFixed(2)} · {adrSessionLabel(item.sessionDate)} US close · USD</p></div><a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">Yahoo Finance <ExternalLink size={12} /></a></>
      : <p role="status">{loading ? 'Checking US ADR session…' : 'US ADR quote unavailable.'}</p>}
    {error && <button type="button" onClick={() => void retry()} disabled={loading}>Retry ADR quote</button>}
    {item && (!adrIsRecent(item) || snapshot?.refreshFailed || snapshot && Date.now() - snapshot.checkedAt > 10 * 60000) && <small>Saved session; latest quote unconfirmed.</small>}
  </section>;
}
export function CompanyAdr({ symbol, scripCode }: { symbol?: string; scripCode?: string }) {
  const company = adrCompanyFor(symbol, scripCode);
  return company ? <CompanyAdrContent key={company.symbol} symbol={company.symbol} /> : null;
}
