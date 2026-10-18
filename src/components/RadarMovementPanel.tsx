import React, { useEffect, useState } from 'react';
import { customFetch } from '../api';
import { hasRadarPrices, isRadarMovement, radarPriceExchange, radarSessionTiming, type RadarMovement } from '../shared/radarMovement';

function CompanyMovement({ company: c, data }: { company: RadarMovement['companies'][number]; data: RadarMovement }) {
  const [selected, setSelected] = useState(''), [pulse, setPulse] = useState(0);
  const sessions = [...new Map([...(c.previousSession ? [c.previousSession] : []), ...c.sessions, ...(c.latestSession ? [c.latestSession] : [])].map(s => [s.date,s])).values()].sort((a,b) => a.date.localeCompare(b.date));
  if (!sessions.length) return null;
  const active = sessions.find(s => s.date === selected) || sessions[sessions.length-1];
  const scale = Math.max(1,...sessions.map(s => Math.abs(s.changePercent)));
  const timing = (s: typeof active) => !c.sessions.some(r => r.date === s.date) && c.previousSession?.date !== s.date ? `Latest available · ${radarSessionTiming(data,s)}` : radarSessionTiming(data,s);
  return <div className="impact-radar-price-company"><h5>{c.name || c.symbol}</h5>
    <div className="impact-radar-move-bars" aria-label={`Daily movements for ${c.name || c.symbol}`}>
      {sessions.map(s => {
        const before = radarSessionTiming(data,s).startsWith('Before');
        return <button key={s.date} type="button" aria-pressed={active.date===s.date} aria-label={`${s.date}, ${timing(s)}, ${s.changePercent>0?'+':''}${s.changePercent.toFixed(2)} percent`} onClick={() => {setSelected(s.date);setPulse(n=>n+1);}} className={`impact-radar-move-bar ${before?'is-before':s.changePercent>0?'is-up':s.changePercent<0?'is-down':'is-flat'}`}>
          <span className="impact-radar-mini-plot" aria-hidden="true"><span key={`${s.date}:${active.date===s.date?pulse:0}`} className={`impact-radar-mini-fill ${s.changePercent<0?'points-down':'points-up'}`} style={{height:`${s.changePercent===0?2:Math.max(3,Math.abs(s.changePercent)/scale*12)}px`}} /></span>
          <strong>{s.changePercent>0?'↑ +':s.changePercent<0?'↓ ':'↔ '}{s.changePercent.toFixed(2)}%</strong>
          <span>{new Date(`${s.date}T12:00:00Z`).toLocaleDateString('en-IN',{day:'numeric',month:'short',timeZone:'Asia/Kolkata'})}</span><small>{timing(s)}</small>
        </button>;
      })}
    </div>
    <p className="impact-radar-selected-price" role="status">{timing(active)} · <a href={active.sourceUrl} target="_blank" rel="noopener noreferrer">{active.date} · {radarPriceExchange(active)}<span className="sr-only"> report (opens a new tab)</span></a><br />₹{active.previousClose.toFixed(2)} → ₹{active.close.toFixed(2)}{active.low!=null && active.high!=null ? <span> · Range ₹{active.low.toFixed(2)}–₹{active.high.toFixed(2)}</span> : null}</p>
    <details className="impact-radar-method"><summary>Daily prices & sources</summary><div className="impact-radar-price-table"><table><caption className="sr-only">Observed final daily close versus previous close for {c.name || c.symbol}</caption><thead><tr><th>Session / source</th><th>Prev. close</th><th>Close</th><th>Change</th></tr></thead><tbody>{sessions.map(s => <tr key={s.date}><td><a href={s.sourceUrl} target="_blank" rel="noopener noreferrer">{s.date} · {radarPriceExchange(s)}</a><br />{timing(s)}</td><td>₹{s.previousClose.toFixed(2)}</td><td>₹{s.close.toFixed(2)}</td><td>{s.changePercent>0?'+':''}{s.changePercent.toFixed(2)}%</td></tr>)}</tbody></table></div></details>
  </div>;
}
export function RadarMovementContent({ data, loading, failed, onRetry, companyCount }: { data: RadarMovement | null; loading: boolean; failed: boolean; onRetry: () => void; companyCount?: number }) {
  const available = hasRadarPrices(data);
  if (loading && !available) return <p role="status" className="impact-radar-price-status">Checking price history…</p>;
  if (!available && (failed || !data || data.status !== 'upcoming')) return <div className="impact-radar-price-status"><span>{data?.persistence?.read==='failed'?'Price storage unavailable.':'Price history unavailable.'}</span><button type="button" onClick={onRetry}>Retry</button></div>;
  if (!data) return null;
  if (data.status === 'upcoming') return <p className="impact-radar-price-status">Price history will appear after the reporting session.</p>;
  return <>
    <h4 id="impact-radar-movement-title">Stock movement</h4>
    <p className="impact-radar-price-context">{data.basis==='event-date'?'Event date':'Published'}: <strong>{data.anchorDate}</strong>{data.afterClose?' · Report after market close':''}</p>
    {loading && <p role="status" className="impact-radar-price-note">Refreshing prices…</p>}
    {failed && <p role="status" className="impact-radar-price-note">Refresh failed. Saved observations remain visible.</p>}
    {companyCount && companyCount>3 ? <p>Showing the first three companies.</p> : null}
    {data.companies.map(c => <CompanyMovement key={c.symbol} company={c} data={data} />)}
    {data.companies.every(c=>!c.sessions.length) && <p className="impact-radar-price-note">Following sessions update when the exchange publishes final reports.</p>}
    <details className="impact-radar-method"><summary>Price sources & method</summary><p className="impact-radar-price-note">Official exchange final daily reports · INR · daily close versus that exchange’s previous close. Blue bars show sessions before the {data.basis==='event-date'?'event':'report'}; arrows and signs show direction. Up to three sessions from the date shown, with previous-session and latest-company context separately labelled. A report-day daily close can include trading before publication. Corporate actions may affect comparisons; these changes do not establish causation. Missing data is not zero movement.</p><p className="impact-radar-price-note">Checked {new Date(data.checkedAt).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST.{data.persistence?.read==='failed'?' Saved history could not be read; exchange observations are shown.':''}{data.persistence?.write==='failed'?' These observations could not be confirmed saved. Retry prices to save again.':''}</p></details>
    {(data.status==='partial'||failed||data.persistence?.write==='failed') && <button type="button" className="impact-radar-price-retry" onClick={onRetry} disabled={loading}>Refresh prices</button>}
  </>;
}
export function RadarMovementPanel({ eventId, refreshKey, companyCount }: { eventId: string; refreshKey: string; companyCount?: number }) {
  const [resolved, setResolved] = useState<{id:string;movement:RadarMovement}|null>(null), [loading,setLoading]=useState(true), [retry,setRetry]=useState(0), [failed,setFailed]=useState(false);
  const data=resolved?.id===eventId?resolved.movement:null;
  useEffect(() => {
    let alive=true;
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),36_000);
    setLoading(true);setFailed(false);
    void customFetch(`/api/impact-radar/${encodeURIComponent(eventId)}/movement`,{signal:controller.signal}).then(async r=>{
      const body=await r.json();if(!r.ok||body.success!==true||body.id!==eventId||!isRadarMovement(body.movement))throw new Error('Unavailable');
      if(alive&&!controller.signal.aborted)setResolved({id:eventId,movement:body.movement});
    }).catch(()=>{if(alive)setFailed(true);}).finally(()=>{clearTimeout(timeout);if(alive)setLoading(false);});
    return()=>{alive=false;controller.abort();clearTimeout(timeout);};
  },[eventId,refreshKey,retry]);
  return <section className={`impact-radar-movement${!hasRadarPrices(data)?' is-compact':''}`} aria-label="Stock movement" aria-busy={loading}><RadarMovementContent data={data} loading={loading} failed={failed} onRetry={()=>setRetry(v=>v+1)} companyCount={companyCount} /></section>;
}
