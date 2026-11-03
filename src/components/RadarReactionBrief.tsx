import React from 'react';
import { REACTION_FACTS, reactionFact, reactionMorning, reactionPhase, comparableReactionPatterns, historicalVolatilitySignal, type RadarResearch, type RadarReaction } from '../shared/radarReaction';
import { SIZE_LABELS,EXPOSURE_LABELS } from '../shared/radarMateriality';
import type { RadarEvent } from '../shared/impactRadar';
export const REACTION_VIEWS={all:'All reactions',volatile:'Volatility observed',pending:'Awaiting session',morning:'Morning watch',watch:'Historical volatility watch'} as const;
export type ReactionView=keyof typeof REACTION_VIEWS;
export function eventReactions(research:RadarResearch|null|undefined,event:RadarEvent):RadarReaction[] {
 const rows=(research?.rows||[]).filter(r=>r.eventId===event.id);
 return [...new Map(rows.sort((a,b)=>Date.parse(a.publishedAt)-Date.parse(b.publishedAt)).map(r=>[r.scripCode,r])).values()];
}
export function matchesReactionView(event:RadarEvent,research:RadarResearch|null|undefined,view:ReactionView,now:number) {
 if(view==='all')return true;
 const rows=eventReactions(research,event);
 if(view==='volatile')return rows.some(r=>r.state==='observed'&&r.observation?.volatile);
 if(view==='watch')return rows.some(r=>reactionPhase(r,now)==='awaiting-session'&&historicalVolatilitySignal(r,research?.patterns||[]));
 if(view==='pending')return rows.some(r=>reactionPhase(r,now)==='awaiting-session');
 return rows.some(r=>r.state==='awaiting-session'&&reactionMorning(r.publishedAt,now,r.sessionDate));
}
export function ReactionBadge({event,research,now}:{event:RadarEvent;research?:RadarResearch|null;now:number}) {
 const rows=eventReactions(research,event);
 const morning=matchesReactionView(event,research,'morning',now),volatile=matchesReactionView(event,research,'volatile',now);
 const label=morning?'Morning watch':volatile?'Volatility observed':matchesReactionView(event,research,'watch',now)?'Historical volatility watch':rows.some(r=>reactionPhase(r,now)==='awaiting-session')?'Awaiting session':rows.some(r=>reactionPhase(r,now)==='awaiting-data')?'Awaiting price data':rows.some(r=>r.state==='calendar-pending')?'Session calendar pending':rows.length?'Reaction recorded':'Reaction not assessed';
 return <span className={`radar-reaction-badge${morning?' is-morning':''}`}>{label}</span>;
}
export function RadarReactionBrief({event,research,now}:{event:RadarEvent;research?:RadarResearch|null;now:number}) {
 const rows=eventReactions(research,event),fact=reactionFact(event.title,event.information);
 const patterns=rows[0]?comparableReactionPatterns(rows[0],research?.patterns||[]):[];
 const signal=rows[0]?historicalVolatilitySignal(rows[0],research?.patterns||[]):null;
 return <section className="radar-reaction-brief" aria-label="News detail and reaction research">
  <h4>What changed & market reaction</h4><ReactionBadge event={event} research={research} now={now}/>
  {research?.status==='unavailable'&&<p role="status">Research refresh unavailable. Saved assessments are shown with their original dates.</p>}
  {signal&&<p className="radar-reaction-badge">Historical volatility watch · {signal.volatile}/{signal.samples} matched archived observations</p>}
  <p><strong>{REACTION_FACTS[rows[0]?.fact||fact.key]}</strong></p>
  <blockquote>{rows[0]?.excerpt||fact.excerpt}</blockquote>
  {rows[0]&&<p>Scope: {rows[0].scope==='unspecified'?'not established':rows[0].scope} · {rows[0].authority}{rows[0].amounts.length?` · Amount stated: ${rows[0].amounts.join('; ')}`:''}</p>}
  <p className="impact-radar-muted">Saved source wording. A short or incomplete report may not establish the full ruling or its exceptions.</p>
  {!rows.length&&<p>Reaction assessment is not available yet. Source news remains available.</p>}
  {rows.map(r=><div key={r.id} className="radar-reaction-company">
   <strong>{r.companyName}</strong><p><a href={r.source.url} target="_blank" rel="noopener noreferrer">{r.source.name} · {new Date(r.publishedAt).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST ↗</a></p><p className="impact-radar-muted">Last assessed {new Date(r.checkedAt).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST</p>
   {r.materiality?<p>Market cap at capture: ₹{(r.materiality.snapshot.marketCapInr/1e7).toLocaleString('en-IN',{maximumFractionDigits:2})} crore · {SIZE_LABELS[r.materiality.sizeBand]}. {r.materiality.amountToCapPercent!==null?`Stated amount: ${Number(r.materiality.amountToCapPercent.toPrecision(4))}% of market cap.`:'No single unambiguous INR amount to compare.'}<br/><a href={r.materiality.snapshot.sourceUrl} target="_blank" rel="noopener noreferrer">Company-size source ↗</a> · Captured {new Date(r.materiality.snapshot.capturedAt).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST</p>:<p className="impact-radar-muted">Company-relative context unavailable for this incident. Current valuations are not substituted for historical data.</p>}
   {r.state==='observed'&&r.observation?<p><a href={r.observation.session.sourceUrl} target="_blank" rel="noopener noreferrer">{r.sessionDate} · official daily report ↗</a><br/>{r.observation.rangePercent!==null?`Daily range ${r.observation.rangePercent.toFixed(2)}% · `:'Daily range unavailable · '}Absolute close move {Math.abs(r.observation.session.changePercent).toFixed(2)}%.<br/>{r.observation.baselineRangeMedian!=null?`Usual daily range ${r.observation.baselineRangeMedian.toFixed(2)}% across ${r.observation.baselineRangeCount} prior sessions${r.observation.baselineRangeMedian>0&&r.observation.rangePercent!==null?`; ${(r.observation.rangePercent/r.observation.baselineRangeMedian).toFixed(1)}× usual range`:''}. `:'Range baseline: insufficient prior history. '}Close change {r.observation.session.changePercent>0?'+':''}{r.observation.session.changePercent.toFixed(2)}%. {r.observation.unusualRange===true?'Daily range exceeds the stock’s historical range threshold. ':''}{r.observation.unusual===null?`Stock baseline: ${r.observation.baselineCount}/10 sessions; insufficient history.`:r.observation.unusual?'Close move exceeds the historical close-move threshold.':'Close move is within the historical close-move threshold.'}</p>:<p>{reactionPhase(r,now)==='awaiting-session'?`Awaiting a completed session from ${r.sessionDate}. No reaction is assumed.`:reactionPhase(r,now)==='awaiting-data'?`The expected session (${r.sessionDate}) has passed; official price data is missing.`:'The trading calendar is not confirmed. No session date is assumed.'}</p>}
  </div>)}
  <details><summary>Pattern archive · 30 / 60 / 365 days</summary>
   {rows[0]&&<p>For {rows[0].companyName}: {SIZE_LABELS[rows[0].materiality?.sizeBand||'unknown']} · {EXPOSURE_LABELS[rows[0].materiality?.exposureBand||'unknown']}. Numerical research bands; these are not exchange size classifications. The stated-amount ratio is not an estimate of the final liability.</p>}
   {patterns.length?patterns.map(p=><p key={`${p.days}:${p.scope}`}>{p.days} days · {p.scope} scope: {p.samples} independent company/session samples; {p.volatile} met the volatility threshold. Median daily range {p.medianRange!=null?`${p.medianRange.toFixed(2)}% (${p.rangeSamples}/${p.samples} with range data)`:'unavailable'}. Median absolute close change {p.medianAbsMove.toFixed(2)}%. {p.samples<20?'Early sample; too little history for a reliable pattern.':'Historical association only; direction is not predicted.'}</p>):<p>No completed comparable samples yet. Missing prices are excluded, not counted as quiet sessions.</p>}
   <p>Volatility threshold: absolute daily close change ≥3% or high–low range ≥5% of previous close. Unusual range and close comparisons each need ≥2× their corresponding prior median, with at least 10 earlier sessions. Intraday news uses the next full session; the overlapping publication-day close is excluded. Duplicate company/session reports are counted once, and overlapping different proceedings are excluded. Other news, liquidity, corporate actions and market-wide moves can confound observations. Daily data cannot identify the exact moment or prove the news caused a move.</p>
  </details>
 </section>;
}
