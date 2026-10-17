import React, { useEffect, useState } from 'react';
import { customFetch } from '../api';
import { isRadarMovement, radarPriceExchange, type RadarMovement } from '../shared/radarMovement';

export function RadarMovementContent({ data, loading, failed, onRetry, companyCount }: { data: RadarMovement | null; loading: boolean; failed: boolean; onRetry: () => void; companyCount?: number }) {
  const available = data?.companies.some(c => c.sessions.length > 0);
  if (loading) return <p role="status" className="impact-radar-price-status">Checking price history…</p>;
  if (failed || !data || (!available && data.status !== 'upcoming')) return <div className="impact-radar-price-status"><span>Price history unavailable.</span><button type="button" onClick={onRetry}>Retry</button></div>;
  if (data.status === 'upcoming') return <p className="impact-radar-price-status">Price history will appear after the reporting session.</p>;
  return <>
    <h4 id="impact-radar-movement-title">Stock movement</h4>
    <p className="impact-radar-price-context">{data.basis === 'event-date' ? 'Event date' : 'Published'}: <strong>{data.anchorDate}</strong>{data.afterClose ? ' · Report after market close' : ''}</p>
    {companyCount && companyCount > 3 ? <p>Showing the first three companies.</p> : null}
    {data.companies.filter(c => c.sessions.length).map(c => {
      const showRange = c.sessions.some(s => s.low != null && s.high != null);
      return <div key={c.symbol} className="impact-radar-price-company"><h5>{c.name || c.symbol}</h5>
        <div className="impact-radar-price-table"><table><caption className="sr-only">Observed daily close versus previous close for {c.name || c.symbol}</caption><thead><tr><th>Session / source</th><th>Prev. close</th><th>Close</th><th>Change</th>{showRange && <th>Day low–high</th>}</tr></thead><tbody>{c.sessions.map(s => <tr key={s.date}><td><a href={s.sourceUrl} target="_blank" rel="noopener noreferrer">{s.date} · {radarPriceExchange(s)}<span className="sr-only"> report (opens a new tab)</span></a></td><td>₹{s.previousClose.toFixed(2)}</td><td>₹{s.close.toFixed(2)}</td><td className={s.changePercent > 0 ? 'is-up' : s.changePercent < 0 ? 'is-down' : ''}>{s.changePercent > 0 ? '+' : ''}{s.changePercent.toFixed(2)}%</td>{showRange && <td>{s.low != null && s.high != null ? `₹${s.low.toFixed(2)} – ₹${s.high.toFixed(2)}` : '—'}</td>}</tr>)}</tbody></table></div>
      </div>;
    })}
    {data.companies.some(c => !c.sessions.length) && <p className="impact-radar-price-note">Some company records are still unavailable.</p>}
    <details className="impact-radar-method"><summary>Price sources & method</summary><p className="impact-radar-price-note">Official exchange final daily reports · INR · close versus that exchange’s previous close. Up to three available sessions from the date shown. {data.basis === 'report-date' && 'The date is the report publication date.'} {data.afterClose && 'The publication day’s close predates the after-market report.'} Corporate actions may affect comparisons; observed changes do not establish causation. Missing data is not zero movement.</p><p className="impact-radar-price-note">Checked {new Date(data.checkedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST.</p></details>
    {data.status === 'partial' && <button type="button" className="impact-radar-price-retry" onClick={onRetry}>Refresh prices</button>}
  </>;
}
export function RadarMovementPanel({ eventId, refreshKey, companyCount }: { eventId: string; refreshKey: string; companyCount?: number }) {
  const [data, setData] = useState<RadarMovement | null>(null), [loading, setLoading] = useState(true), [retry, setRetry] = useState(0), [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 32_000);
    setLoading(true); setFailed(false); setData(null);
    void customFetch(`/api/impact-radar/${encodeURIComponent(eventId)}/movement`, { signal: controller.signal }).then(async r => {
      const body = await r.json(); if (!r.ok || body.success !== true || body.id !== eventId || !isRadarMovement(body.movement)) throw new Error('Unavailable');
      if (alive && !controller.signal.aborted) setData(body.movement);
    }).catch(() => { if (alive) setFailed(true); }).finally(() => { clearTimeout(timeout); if (alive) setLoading(false); });
    return () => { alive = false; controller.abort(); clearTimeout(timeout); };
  }, [eventId, refreshKey, retry]);
  return <section className={`impact-radar-movement${!data?.companies.some(c => c.sessions.length) ? ' is-compact' : ''}`} aria-label="Stock movement" aria-busy={loading}>
    <RadarMovementContent data={data} loading={loading} failed={failed} onRetry={() => setRetry(v => v + 1)} companyCount={companyCount} />
  </section>;
}
