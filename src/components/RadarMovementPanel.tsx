import React, { useEffect, useState } from 'react';
import { customFetch } from '../api';
import { isRadarMovement, type RadarMovement } from '../shared/radarMovement';
export function RadarMovementPanel({ eventId, refreshKey, companyCount }: { eventId: string; refreshKey: string; companyCount?: number }) {
  const [data, setData] = useState<RadarMovement | null>(null), [loading, setLoading] = useState(true), [retry, setRetry] = useState(0), [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 20_000);
    setLoading(true); setFailed(false); setData(null);
    void customFetch(`/api/impact-radar/${encodeURIComponent(eventId)}/movement`, { signal: controller.signal }).then(async r => {
      const body = await r.json(); if (!r.ok || body.success !== true || body.id !== eventId || !isRadarMovement(body.movement)) throw new Error('Unavailable');
      if (alive && !controller.signal.aborted) setData(body.movement);
    }).catch(() => { if (alive) setFailed(true); }).finally(() => { clearTimeout(timeout); if (alive) setLoading(false); });
    return () => { alive = false; controller.abort(); clearTimeout(timeout); };
  }, [eventId, refreshKey, retry]);
  return <section className="impact-radar-movement" aria-labelledby="impact-radar-movement-title" aria-busy={loading}>
    <h4 id="impact-radar-movement-title">What did the stock actually do?</h4>
    {companyCount && companyCount > 3 ? <p>Showing price history for the first three named companies.</p> : null}
    {loading ? <p role="status">Checking NSE daily reports…</p> : failed || !data ? <p role="status">Price history could not be checked. <button type="button" onClick={() => setRetry(v => v + 1)}>Retry</button></p>
      : data.status === 'upcoming' ? <p>The event has not been confirmed as completed. No expected price move is shown.</p>
      : <><p>{data.basis === 'event-date' ? 'Sourced event date' : 'Report publication date'}: <strong>{data.anchorDate}</strong>.{data.basis === 'report-date' && ' The actual event date is not verified.'}{data.afterClose && ' The report was published after the regular 3:30 pm IST close; the publication day’s close predates this report.'}</p>
        {data.companies.map(c => <div key={c.symbol} className="impact-radar-price-company"><h5>{c.symbol} · NSE</h5>
          {c.sessions.length ? <div className="impact-radar-price-table"><table><caption className="sr-only">Observed daily close versus previous close for {c.symbol}</caption><thead><tr><th>Session</th><th>Prev. close</th><th>Close</th><th>Close change</th><th>Day low–high</th></tr></thead><tbody>{c.sessions.map(s => <tr key={s.date}><td><a href={s.sourceUrl} target="_blank" rel="noopener noreferrer">{s.date}<span className="sr-only"> · NSE report (opens a new tab)</span></a></td><td>₹{s.previousClose.toFixed(2)}</td><td>₹{s.close.toFixed(2)}</td><td className={s.changePercent > 0 ? 'is-up' : s.changePercent < 0 ? 'is-down' : ''}>{s.changePercent > 0 ? '+' : ''}{s.changePercent.toFixed(2)}%</td><td>{s.low != null && s.high != null ? `₹${s.low.toFixed(2)} – ₹${s.high.toFixed(2)}` : 'Not available'}</td></tr>)}</tbody></table></div>
            : <p>No verified NSE daily report was available for this company in this window. Check the company identifier and retry; an unavailable report does not imply zero movement.</p>}</div>)}
        <p className="impact-radar-price-note">Source: NSE final CM bhavcopy · INR · daily close versus the exchange’s previous close. Up to three available sessions within eight calendar days. Missing reports are not treated as zero movement or assumed holidays. Corporate actions can affect comparisons. These observations do not establish that the event caused the move.</p>
        <p className="impact-radar-price-note">Checked {new Date(data.checkedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST.</p>
        {(data.status === 'partial' || data.status === 'unavailable') && <button type="button" className="impact-radar-more" onClick={() => setRetry(v => v + 1)}>Recheck price history</button>}</>}
  </section>;
}
