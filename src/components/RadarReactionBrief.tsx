import React from 'react';
import { REACTION_FACTS, reactionFact, reactionMorning, reactionPhase, type RadarResearch, type RadarReaction } from '../shared/radarReaction';
import type { RadarEvent } from '../shared/impactRadar';
export const REACTION_VIEWS={all:'All reactions',volatile:'Volatility observed',pending:'Awaiting session',morning:'Morning watch'} as const;
export type ReactionView=keyof typeof REACTION_VIEWS;
export function eventReactions(research:RadarResearch|null|undefined,event:RadarEvent):RadarReaction[] {
 const rows=(research?.rows||[]).filter(r=>r.eventId===event.id);
 return [...new Map(rows.sort((a,b)=>Date.parse(a.publishedAt)-Date.parse(b.publishedAt)).map(r=>[r.scripCode,r])).values()];
}
export function matchesReactionView(event:RadarEvent,research:RadarResearch|null|undefined,view:ReactionView,now:number) {
 if(view==='all')return true;
 const rows=eventReactions(research,event);
 if(view==='volatile')return rows.some(r=>r.state==='observed'&&r.observation?.volatile);
 if(view==='pending')return rows.some(r=>reactionPhase(r,now)==='awaiting-session');
 return rows.some(r=>r.state==='awaiting-session'&&reactionMorning(r.publishedAt,now,r.sessionDate));
}
export function ReactionBadge({event,research,now}:{event:RadarEvent;research?:RadarResearch|null;now:number}) {
 const rows=eventReactions(research,event);
 const morning=matchesReactionView(event,research,'morning',now),volatile=matchesReactionView(event,research,'volatile',now);
 const label=morning?'Morning watch':volatile?'Volatility observed':rows.some(r=>reactionPhase(r,now)==='awaiting-session')?'Awaiting session':rows.some(r=>reactionPhase(r,now)==='awaiting-data')?'Awaiting price data':rows.some(r=>r.state==='calendar-pending')?'Session calendar pending':rows.length?'Reaction recorded':'Reaction not assessed';
 return <span className={`radar-reaction-badge${morning?' is-morning':''}`}>{label}</span>;
}
export function RadarReactionBrief({event,research,now}:{event:RadarEvent;research?:RadarResearch|null;now:number}) {
 const rows=eventReactions(research,event),fact=reactionFact(event.title,event.information);
 const patterns=(research?.patterns||[]).filter(p=>p.fact===(rows[0]?.fact||fact.key)&&p.sourceKind===(rows[0]?.source.kind||event.source.kind));
 return <section className="radar-reaction-brief" aria-label="News detail and reaction research">
  <h4>What changed & market reaction</h4><ReactionBadge event={event} research={research} now={now}/>
  {research?.status==='unavailable'&&<p role="status">Research refresh unavailable. Saved assessments are shown with their original dates.</p>}
  <p><strong>{REACTION_FACTS[rows[0]?.fact||fact.key]}</strong></p>
  <blockquote>{rows[0]?.excerpt||fact.excerpt}</blockquote>
  {rows[0]&&<p>Scope: {rows[0].scope==='unspecified'?'not established':rows[0].scope} · {rows[0].authority}{rows[0].amounts.length?` · Amount stated: ${rows[0].amounts.join('; ')}`:''}</p>}
  <p className="impact-radar-muted">Saved source wording. A short or incomplete report may not establish the full ruling or its exceptions.</p>
  {!rows.length&&<p>Reaction assessment is not available yet. Source news remains available.</p>}
  {rows.map(r=><div key={r.id} className="radar-reaction-company">
   <strong>{r.companyName}</strong><p><a href={r.source.url} target="_blank" rel="noopener noreferrer">{r.source.name} · {new Date(r.publishedAt).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST ↗</a></p><p className="impact-radar-muted">Last assessed {new Date(r.checkedAt).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST</p>
   {r.state==='observed'&&r.observation?<p><a href={r.observation.session.sourceUrl} target="_blank" rel="noopener noreferrer">{r.sessionDate} · official daily report ↗</a><br/>Close change {r.observation.session.changePercent>0?'+':''}{r.observation.session.changePercent.toFixed(2)}%{r.observation.rangePercent!==null?` · Daily range ${r.observation.rangePercent.toFixed(2)}%`:''}. {r.observation.unusual===null?`Stock baseline: ${r.observation.baselineCount}/10 sessions; insufficient history.`:r.observation.unusual?'Above the stock’s historical movement threshold.':'Within the stock’s historical movement threshold.'}</p>:<p>{reactionPhase(r,now)==='awaiting-session'?`Awaiting a completed session from ${r.sessionDate}. No reaction is assumed.`:reactionPhase(r,now)==='awaiting-data'?`The expected session (${r.sessionDate}) has passed; official price data is missing.`:'The trading calendar is not confirmed. No session date is assumed.'}</p>}
  </div>)}
  <details><summary>Pattern archive · 30 / 60 / 365 days</summary>
   {patterns.length?patterns.map(p=><p key={`${p.days}:${p.scope}`}>{p.days} days · {p.scope} scope: {p.samples} independent company/session samples; {p.volatile} met the volatility threshold. Median absolute close change {p.medianAbsMove.toFixed(2)}%. {p.samples<20?'Early sample; too little history for a reliable pattern.':'Historical association only; direction is not predicted.'}</p>):<p>No completed comparable samples yet. Missing prices are excluded, not counted as quiet sessions.</p>}
   <p>Volatility threshold: absolute daily close change ≥3% or high–low range ≥5% of previous close. Unusual close moves also need ≥2× the prior median absolute change, with at least 10 earlier sessions. Intraday news uses the next full session; the overlapping publication-day close is excluded. Duplicate company/session reports are counted once, and overlapping different proceedings are excluded. Corporate actions and market-wide moves can confound observations. Daily data cannot identify the exact moment or prove the news caused a move.</p>
  </details>
 </section>;
}
