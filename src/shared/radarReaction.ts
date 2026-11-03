import { radarDay, sourceValid, validRadarDate, validRadarTime, type RadarEvent, type RadarUpdate, type RadarSource } from './impactRadar';
import { isRadarSessionMove, type RadarSessionMove } from './radarMovement';
import { isRadarMateriality,usableSizeSnapshot,SIZE_BANDS,EXPOSURE_BANDS,type RadarMateriality,type SizeBand,type ExposureBand } from './radarMateriality';
export const REACTION_VERSION = 1;
export const REACTION_RULE = { closePercent: 3, rangePercent: 5, baselineSessions: 10, baselineMultiple: 2 };
export const REACTION_FACTS = {
  relief: 'Stay / relief', restriction: 'Restriction / suspension', liability: 'Penalty / financial exposure',
  licence: 'Licence / approval change', insolvency: 'Insolvency / creditors', proceeding: 'Hearing / investigation', other: 'Other sourced development',
} as const;
export type ReactionFact = keyof typeof REACTION_FACTS;
export interface ReactionCalendar { year: number; holidays: string[]; source: string; special?: Record<string,{open:number;close:number}> }
// Year-bound, never reuse lunar holidays in a different year. Unknown years fail open only for recording actual reports, not scheduling claims.
export const RADAR_CALENDAR_2026: ReactionCalendar = {year:2026, source:'https://www.nseindia.com/resources/exchange-communication-holidays', holidays:['01-15','01-26','03-03','03-26','03-31','04-03','04-14','05-01','05-28','06-26','09-14','10-02','10-20','11-10','11-24','12-25'].map(d=>'2026-'+d), special:{'2026-11-08':{open:860,close:930}}};
export function reactionSession(day:string, calendar:ReactionCalendar|null=RADAR_CALENDAR_2026) {
  if(day.startsWith('2026-')&&calendar?.year!==2026)calendar=RADAR_CALENDAR_2026;
  if(!validRadarDate(day)||!calendar||Number(day.slice(0,4))!==calendar.year)return null;
  if(calendar.special?.[day])return calendar.special[day];
  if([0,6].includes(new Date(day).getUTCDay())||calendar.holidays.includes(day))return {open:0,close:0};
  return {open:555,close:930};
}
const addDay=(d:string,n:number)=>new Date(Date.parse(d)+n*86400000).toISOString().slice(0,10);
export function firstFullReactionSession(publishedAt:string, calendar:ReactionCalendar|null=RADAR_CALENDAR_2026):string|null {
  if(!validRadarTime(publishedAt))return null;
  const time=Date.parse(publishedAt), day=radarDay(time), minute=(time+19800000)%86400000/60000;
  for(let i=0;i<15;i++) {const d=addDay(day,i),s=reactionSession(d,calendar);if(!s)return null;if(s.open && (i>0||minute<=s.open))return d;}
  return null;
}
export function reactionMorning(publishedAt:string, now:number, sessionDate:string|null, calendar:ReactionCalendar|null=RADAR_CALENDAR_2026):boolean {
  if(!sessionDate||radarDay(now)!==sessionDate)return false;
  const s=reactionSession(sessionDate,calendar);if(!s?.open)return false;
  const minute=(now+19800000)%86400000/60000;
  return Date.parse(publishedAt)<=now && minute>=s.open-90 && minute<s.open+45;
}
export function reactionFact(title:string, information:string):{key:ReactionFact;excerpt:string} {
  const text=`${title}. ${information}`.replace(/\s+/g,' ').trim();
  const clauses=text.split(/(?<=[.!?;])\s+/).filter(Boolean);
  const patterns:[ReactionFact,RegExp][]=[
    ['relief',/\b(?:granted.{0,30}(?:stay|relief)|(?:interim )?stay (?:of|on|in|order)|(?:set|setting) aside|quashed|lifted (?:the )?(?:ban|restriction))\b/i],
    ['restriction',/\b(?:barred|debarred|suspended|prohibited|banned|restrictions? (?:on|imposed)|operations? (?:halted|stopped)|cease and desist)\b/i],
    ['licence',/\b(?:licen[cs]e|approval).{0,40}\b(?:revoked|cancelled|suspended|withdrawn|granted|approved)\b|\b(?:revoked|cancelled|suspended|granted).{0,40}\b(?:licen[cs]e|approval)\b/i],
    ['liability',/\b(?:penalt(?:y|ies)|fine|tax demand|liabilit(?:y|ies)|damages|compensation|write.off)\b/i],
    ['insolvency',/\b(?:insolvency|cirp|bankruptcy|creditors|liquidation|resolution plan)\b/i],
    ['proceeding',/\b(?:hearing|investigation|probe|petition|adjudication|arbitration|order|ruling|judgment)\b/i],
  ];
  for(const [key,pattern]of patterns) {
    const clause=clauses.find(c=>pattern.test(c)&&!(/\b(?:not|no|denied|refused|seeking|sought|request(?:ed|ing)?)\b.{0,30}(?:stay|relief|suspend|ban|penalt|licen|approval)/i.test(c)));
    if(clause)return {key,excerpt:clause.slice(0,700)};
  }
  return {key:'other',excerpt:text.slice(0,700)};
}
export interface RadarReaction {
  version:1; id:string; eventId:string; updateId:string; scripCode:string; symbol:string; companyName:string;
  category:string; fact:ReactionFact; excerpt:string; source:RadarSource; publishedAt:string; checkedAt:string;
  scope:'interim'|'final'|'unspecified'; amounts:string[]; authority:string;
  materiality?:RadarMateriality;
  sessionDate:string|null; state:'awaiting-session'|'awaiting-data'|'observed'|'calendar-pending';
  observation?:{session:RadarSessionMove;rangePercent:number|null;volatile:boolean;baselineMedian:number|null;baselineCount:number;unusual:boolean|null;baselineRangeMedian?:number|null;baselineRangeCount?:number;unusualRange?:boolean|null};
}
export function evaluateRadarReaction(event:RadarEvent,update:RadarUpdate,company:RadarEvent['companies'][number],prices:RadarSessionMove[],now=Date.now(),calendar:ReactionCalendar|null=RADAR_CALENDAR_2026):RadarReaction {
  const fact=reactionFact(update.title,update.information), sessionDate=firstFullReactionSession(update.publishedAt,calendar);
  const id=`${update.id}:${company.scripCode}`;
  const text=`${update.title} ${update.information}`;
  const scope=/\binterim\b/i.test(text)?'interim':/\b(?:final (?:order|ruling|judgment)|permanent (?:ban|restriction))\b/i.test(text)?'final':'unspecified';
  const amounts=[...text.matchAll(/(?:₹|\bRs\.?|\bINR)\s*[\d,]+(?:\.\d+)?(?:\s*(?:-|–|to)\s*[\d,]+(?:\.\d+)?)?\s*(?:crores?|cr\.?|lakhs?|lacs?|million|billion)?/gi)].slice(0,4).map(m=>m[0].trim());
  const result:RadarReaction={version:1,id,eventId:event.id,updateId:update.id,scripCode:company.scripCode,symbol:company.symbol,companyName:company.name,category:event.category,fact:fact.key,excerpt:fact.excerpt,scope,amounts,authority:event.authority,source:update.source,publishedAt:update.publishedAt,checkedAt:new Date(now).toISOString(),sessionDate,state:sessionDate?'awaiting-session':'calendar-pending'};
  const eligible=prices.filter(p=>isRadarSessionMove(p)&&[company.symbol,company.scripCode].includes(p.symbol)&&Date.parse(`${p.date}T11:00:00Z`)<=now);
  // If the holiday calendar is unavailable, retain actual observations without pretending to know the first expected trading date.
  if(!sessionDate)return result;
  if(Date.parse(`${sessionDate}T11:00:00Z`)>now)return result;
  const session=eligible.find(s=>s.date===sessionDate);
  if(!session)return {...result,state:'awaiting-data'};
  const previous=[...new Map(eligible.filter(p=>p.date<sessionDate&&Date.parse(`${p.date}T11:00:00Z`)<Date.parse(update.publishedAt)&&(p.exchange||p.sourceUrl.split('/')[2])===(session.exchange||session.sourceUrl.split('/')[2])).map(p=>[p.date,p])).values()].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,20);
  const median=(a:number[])=>{const s=[...a].sort((a,b)=>a-b);return s.length?(s[Math.floor((s.length-1)/2)]+s[Math.floor(s.length/2)])/2:null};
  const baselineMedian=previous.length>=REACTION_RULE.baselineSessions?median(previous.map(s=>Math.abs(s.changePercent))):null;
  const rangePercent=session.high!=null&&session.low!=null?(session.high-session.low)/session.previousClose*100:null;
  const ranges=previous.filter(s=>s.high!=null&&s.low!=null).map(s=>(s.high!-s.low!)/s.previousClose*100);
  const baselineRangeMedian=ranges.length>=REACTION_RULE.baselineSessions?median(ranges):null;
  return {...result,state:'observed',observation:{session,rangePercent,volatile:Math.abs(session.changePercent)>=REACTION_RULE.closePercent||(rangePercent!==null&&rangePercent>=REACTION_RULE.rangePercent),baselineMedian,baselineCount:previous.length,unusual:baselineMedian===null?null:Math.abs(session.changePercent)>=Math.max(REACTION_RULE.closePercent,baselineMedian*REACTION_RULE.baselineMultiple),baselineRangeMedian,baselineRangeCount:ranges.length,unusualRange:rangePercent===null||baselineRangeMedian===null?null:rangePercent>=Math.max(REACTION_RULE.rangePercent,baselineRangeMedian*REACTION_RULE.baselineMultiple)}};
}
export function isRadarReaction(r:any):r is RadarReaction {
  if(r?.materiality!==undefined&&(!isRadarMateriality(r.materiality)||r.materiality.snapshot.scripCode!==r.scripCode||!usableSizeSnapshot(r.materiality.snapshot,r.publishedAt,r.sessionDate)))return false;
  if(r?.observation&&(r.observation.baselineRangeCount!==undefined&&(!Number.isInteger(r.observation.baselineRangeCount)||r.observation.baselineRangeCount<0||r.observation.baselineRangeCount>20)||r.observation.baselineRangeMedian!==undefined&&r.observation.baselineRangeMedian!==null&&(!Number.isFinite(r.observation.baselineRangeMedian)||r.observation.baselineRangeMedian<0)||r.observation.unusualRange!==undefined&&r.observation.unusualRange!==null&&typeof r.observation.unusualRange!=='boolean'))return false;
  return r?.version===1&&typeof r.id==='string'&&r.id===`${r.updateId}:${r.scripCode}`&&typeof r.eventId==='string'&&typeof r.updateId==='string'&&/^\d{6}$/.test(r.scripCode)&&/^[A-Z0-9&._-]{1,30}$/.test(r.symbol)&&typeof r.companyName==='string'&&r.companyName.length<=160&&Object.hasOwn(REACTION_FACTS,r.fact)&&typeof r.excerpt==='string'&&r.excerpt.length<=700&&['interim','final','unspecified'].includes(r.scope)&&Array.isArray(r.amounts)&&r.amounts.length<=4&&r.amounts.every((v:any)=>typeof v==='string'&&v.length<=100)&&typeof r.authority==='string'&&r.authority.length<=100&&sourceValid(r.source)&&validRadarTime(r.publishedAt)&&validRadarTime(r.checkedAt)&&(r.sessionDate===null||validRadarDate(r.sessionDate))&&['awaiting-session','awaiting-data','observed','calendar-pending'].includes(r.state)&&
    (r.state==='observed'?!!r.observation&&isRadarSessionMove(r.observation.session)&&[r.symbol,r.scripCode].includes(r.observation.session.symbol)&&r.observation.session.date===r.sessionDate&&typeof r.observation.volatile==='boolean'&&Number.isInteger(r.observation.baselineCount)&&r.observation.baselineCount>=0&&r.observation.baselineCount<=20&&(r.observation.rangePercent===null||Number.isFinite(r.observation.rangePercent))&&(r.observation.baselineMedian===null||Number.isFinite(r.observation.baselineMedian))&&(r.observation.unusual===null||typeof r.observation.unusual==='boolean'):r.observation===undefined);
}
export interface ReactionPattern {fact:ReactionFact;scope:'interim'|'final'|'unspecified';sourceKind:RadarSource['kind'];days:number;samples:number;volatile:number;up:number;down:number;medianAbsMove:number;sizeBand?:SizeBand;exposureBand?:ExposureBand;medianRange?:number|null;rangeSamples?:number}
export function comparableReactionPatterns(row:RadarReaction,patterns:ReactionPattern[]):ReactionPattern[] {
 return patterns.filter(p=>p.fact===row.fact&&p.scope===row.scope&&p.sourceKind===row.source.kind&&(p.sizeBand||'unknown')===(row.materiality?.sizeBand||'unknown')&&(p.exposureBand||'unknown')===(row.materiality?.exposureBand||'unknown'));
}
export function historicalVolatilitySignal(row:RadarReaction,patterns:ReactionPattern[]):ReactionPattern|null {
 if(!row.materiality||(row.amounts.length>0&&row.materiality.amountInr===null))return null;
 return comparableReactionPatterns(row,patterns).find(p=>p.days===365&&p.samples>=20&&p.volatile/p.samples>=0.6)||null;
}
export interface RadarResearch {status:'ready'|'unavailable';rows:RadarReaction[];patterns:ReactionPattern[];checkedAt:string;}
export function reactionPhase(row:RadarReaction,now:number):RadarReaction['state'] {
 return row.state==='awaiting-session'&&row.sessionDate&&Date.parse(`${row.sessionDate}T11:00:00Z`)<=now?'awaiting-data':row.state;
}
export function isRadarResearch(v:any):v is RadarResearch {
 return v&&['ready','unavailable'].includes(v.status)&&validRadarTime(v.checkedAt)&&Array.isArray(v.rows)&&v.rows.length<=600&&v.rows.every(isRadarReaction)&&Array.isArray(v.patterns)&&v.patterns.length<=1800&&v.patterns.every((p:any)=>Object.hasOwn(REACTION_FACTS,p.fact)&&['interim','final','unspecified'].includes(p.scope)&&['disclosure','official','news','report','company'].includes(p.sourceKind)&&[30,60,365].includes(p.days)&&[p.samples,p.volatile,p.up,p.down].every(n=>Number.isInteger(n)&&n>=0)&&p.samples>=p.volatile&&p.samples>=p.up+p.down&&Number.isFinite(p.medianAbsMove)&&p.medianAbsMove>=0&&(p.sizeBand===undefined||SIZE_BANDS.includes(p.sizeBand))&&(p.exposureBand===undefined||EXPOSURE_BANDS.includes(p.exposureBand))&&(p.rangeSamples===undefined||(Number.isInteger(p.rangeSamples)&&p.rangeSamples>=0&&p.rangeSamples<=p.samples))&&(p.medianRange===undefined||p.medianRange===null||(Number.isFinite(p.medianRange)&&p.medianRange>=0)));
}
