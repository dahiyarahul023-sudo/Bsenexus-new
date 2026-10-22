import React,{useEffect,useState} from 'react';
import {customFetch} from '../api';
import {isRadarResearch,type RadarResearch} from '../shared/radarResearch';
import {radarUrl} from '../shared/impactRadar';
export function RadarResearchPanel({eventId}:{eventId:string}) {
  const [open,setOpen]=useState(false),[value,setValue]=useState<RadarResearch|null>(null),[loaded,setLoaded]=useState(false),[error,setError]=useState(false),[retry,setRetry]=useState(0);
  useEffect(()=>{
    if(!open||loaded)return;
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);let alive=true;
    setError(false);
    void customFetch(`/api/impact-radar/${encodeURIComponent(eventId)}/research`,{signal:controller.signal}).then(async r=>{
      const body=await r.json();if(!r.ok||body.success!==true||!(body.research===null||isRadarResearch(body.research)))throw new Error('Unavailable');
      if(alive&&!controller.signal.aborted){setValue(body.research);setLoaded(true);}
    }).catch(()=>{if(alive)setError(true);}).finally(()=>clearTimeout(timer));
    return()=>{alive=false;controller.abort();clearTimeout(timer);};
  },[eventId,open,loaded,retry]);
  return <details className="impact-radar-research" onToggle={e=>setOpen(e.currentTarget.open)}><summary>Historical observations · 1 / 3 / 5 / 20 sessions</summary>
    {error?<p className="impact-radar-status" role="status">Research could not be checked. <button type="button" onClick={()=>setRetry(v=>v+1)}>Retry</button></p>:!loaded?<p className="impact-radar-muted" role="status">Loading saved observations…</p>:!value?<p className="impact-radar-muted">Observations are pending. Missing prices or calendar dates are not zero reaction.</p>:<>
      <p className="impact-radar-muted">From the first recorded public report ({new Date(value.firstPublicAt).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST). After-close reports start at the next confirmed open session; during-session reports overlap that day's trading.</p>
      {value.companies.map(c=><div key={c.symbol} className="impact-radar-research-company"><h4>{c.symbol}</h4><table><caption className="sr-only">Unadjusted close observations for {c.symbol}</caption><thead><tr><th>Session</th><th>Date</th><th>Close change</th></tr></thead><tbody>{c.points.map(p=><tr key={p.sessions}><th>+{p.sessions}</th><td>{p.date||'—'}</td><td>{p.status==='observed'?<a href={radarUrl(p.sourceUrl)!} target="_blank" rel="noopener noreferrer">{p.percent!>0?'+':''}{p.percent!.toFixed(2)}% ↗</a>:p.status==='missing'?'Price missing':'Pending / calendar incomplete'}</td></tr>)}</tbody></table></div>)}
      <p className="impact-radar-muted">Raw, unadjusted prices; corporate actions and concurrent news are not reviewed. Benchmark comparison is unavailable. These observations do not establish that this event caused a move, and are not labelled “no reaction” or used as forecasts.</p>
    </>}
  </details>;
}
