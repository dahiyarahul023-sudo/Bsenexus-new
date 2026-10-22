import React,{useEffect,useRef,useState} from 'react';
import {ArrowUpRight,Search} from 'lucide-react';
import {customFetch} from '../api';
import {ActionButton} from './ui/ActionButton';
import {isRadarEvent,radarHeadline,validRadarTime,type RadarEvent} from '../shared/impactRadar';

export function RadarHistory({onOpen}:{onOpen:(event:RadarEvent,button:HTMLButtonElement)=>void}) {
  const [draft,setDraft]=useState({q:'',from:'',to:''}),[search,setSearch]=useState(draft),[cursor,setCursor]=useState<string|null>(null);
  const [rows,setRows]=useState<{event:RadarEvent;firstPublicAt:string}[]>([]),[next,setNext]=useState<string|null>(null);
  const [loading,setLoading]=useState(true),[error,setError]=useState(false),[retry,setRetry]=useState(0);
  const generation=useRef(0);
  const submitSearch=()=>{setRows([]);setNext(null);setCursor(null);setSearch({...draft});};
  useEffect(()=>{
    const version=++generation.current,controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    setLoading(true);setError(false);
    const query=new URLSearchParams(Object.fromEntries(Object.entries(search).filter(([,v])=>v)));
    if(cursor)query.set('cursor',cursor);
    void customFetch(`/api/impact-radar/history?${query}`,{signal:controller.signal}).then(async r=>{
      const body=await r.json();
      if(!r.ok||body.success!==true||!Array.isArray(body.items)||body.items.some((row:any)=>!isRadarEvent(row.event)||!validRadarTime(row.firstPublicAt))||!(body.nextCursor===null||typeof body.nextCursor==='string'))throw new Error('History unavailable');
      if(version!==generation.current||controller.signal.aborted)return;
      setRows(previous=>cursor?[...new Map([...previous,...body.items].map(row=>[row.event.id,row])).values()]:body.items);setNext(body.nextCursor);
    }).catch(()=>{if(version===generation.current)setError(true);}).finally(()=>{clearTimeout(timer);if(version===generation.current)setLoading(false);});
    return()=>{generation.current++;controller.abort();clearTimeout(timer);};
  },[search,cursor,retry]);
  return <section className="impact-radar-history" aria-label="Radar history">
    <form className="impact-radar-history-search" onSubmit={e=>{e.preventDefault();submitSearch();}}>
      <label><span>Company or case keywords</span><input value={draft.q} maxLength={120} placeholder="Company, authority or case number" onChange={e=>setDraft(v=>({...v,q:e.target.value}))}/></label>
      <label><span>First recorded from</span><input type="date" value={draft.from} max={draft.to||undefined} onChange={e=>setDraft(v=>({...v,from:e.target.value}))}/></label>
      <label><span>Through</span><input type="date" value={draft.to} min={draft.from||undefined} onChange={e=>setDraft(v=>({...v,to:e.target.value}))}/></label>
      <ActionButton type="submit" variant="secondary" size="sm" icon={<Search size={15}/>} onClick={e=>{e.preventDefault();submitSearch();}}>Search history</ActionButton>
    </form>
    <p className="impact-radar-muted">Saved records have no automatic expiry. Separate proceedings keep separate records, with their source updates inside. Coverage includes recorded evidence, not a complete market archive.</p>
    {error&&<div className="impact-radar-status" role="status">History could not be loaded.{rows.length>0?' Previously loaded records remain below.':''} <button type="button" onClick={()=>setRetry(v=>v+1)}>Retry</button></div>}
    {loading&&!rows.length?<div className="impact-radar-card impact-radar-skeleton" role="status"><span className="sr-only">Loading history…</span><span/><span/><span/></div>:!error&&!rows.length?<p className="impact-radar-status">No saved records match this search. Try a company name or a wider date range.</p>:null}
    <div className="impact-radar-history-list">{rows.map(({event,firstPublicAt})=><article key={event.id}>
      <button type="button" onClick={e=>onOpen(event,e.currentTarget)}><strong>{radarHeadline(event)}</strong><ArrowUpRight size={17} aria-hidden="true"/></button>
      <p>{event.authority} · {event.status} · First recorded {new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Kolkata'}).format(new Date(firstPublicAt))}</p>
      <span>{event.source.name} · Source-backed record</span>
    </article>)}</div>
    {next&&<ActionButton type="button" size="sm" variant="secondary" isLoading={loading} loadingText="Loading older records" onClick={()=>setCursor(next)}>Load older records</ActionButton>}
    <p className="impact-radar-muted" role="status">{rows.length?`${rows.length} saved records loaded${next?' · more available':''}`:''}</p>
  </section>;
}
