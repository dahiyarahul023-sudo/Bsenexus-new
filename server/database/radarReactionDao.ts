import { getSupabase } from './supabase.js';
import { isRadarEvent,isRadarUpdate,isRadarEventInScope,type RadarEvent,type RadarUpdate } from '../../src/shared/impactRadar.js';
import { isRadarReaction,type RadarReaction,type RadarResearch } from '../../src/shared/radarReaction.js';
import { isRadarSessionMove,type RadarSessionMove } from '../../src/shared/radarMovement.js';
const checked=<T>(r:{data:T;error:unknown}):T=>{if(r.error)throw Error('Radar research storage unavailable');return r.data;};
export interface ReactionCandidate {event:RadarEvent;update:RadarUpdate}
export async function reactionCandidates(now:number):Promise<{items:ReactionCandidate[];cursor:string;historyCount?:number}> {
 const db=getSupabase(),signal=AbortSignal.timeout(6000),since=new Date(now-365*86400000).toISOString();
 const cursor=checked(await db.from('impact_radar_reaction_progress').select('cursor_id').eq('id','history').abortSignal(signal).maybeSingle())?.cursor_id||'';
 const query=()=>db.from('impact_radar_updates').select('id,data,impact_radar_events(data)').gte('published_at',since).lte('published_at',new Date(now).toISOString());
 const q=query().order('id').limit(30);if(cursor)q.gt('id',cursor);
 const [recent,history,pending]=await Promise.all([
  query().order('published_at',{ascending:false}).limit(30).abortSignal(signal).then(checked),q.abortSignal(signal).then(checked),
  db.from('impact_radar_reactions').select('update_id').neq('state','observed').gte('published_at',since).order('checked_at').limit(30).abortSignal(signal).then(checked),
 ]);
 const retry=pending?.length?checked(await query().in('id',pending.map(r=>r.update_id)).abortSignal(signal)):[];
 const historical=new Set((history||[]).map(r=>r.id));
 const items=[...new Map([...(history||[]),...(retry||[]),...(recent||[])].map((r:any)=>[r.id,r])).values()].flatMap((r:any)=>{
  const event=r.impact_radar_events?.data,update=r.data;
  return isRadarEvent(event)&&isRadarEventInScope(event)&&isRadarUpdate(update)&&update.eventId===event.id?[{event,update}]:[];
 });
 return {items,cursor:history?.length?history[history.length-1].id:'',historyCount:items.filter(r=>historical.has(r.update.id)).length};
}
export async function reactionPrices(codes:string[],symbols:string[],now:number,publishedAt?:string):Promise<RadarSessionMove[]> {
 const through=Math.min(now,publishedAt?Date.parse(publishedAt)+15*86400000:now);
 const groups=await Promise.all(codes.map(async(code,i)=>checked(await getSupabase().from('impact_price_sessions').select('symbol,session_date,data').in('symbol',[code,symbols[i]]).lte('session_date',new Date(through+19800000).toISOString().slice(0,10)).order('session_date',{ascending:false}).limit(60).abortSignal(AbortSignal.timeout(2500)))));
 return groups.flatMap(rows=>(rows||[]).filter(r=>isRadarSessionMove(r.data)&&r.data.symbol===r.symbol&&r.data.date===r.session_date).map(r=>r.data));
}
export async function saveReactionBatch(rows:RadarReaction[]) {
 if(rows.length>120||!rows.every(isRadarReaction))throw Error('Invalid reaction batch');
 if(rows.length)checked(await getSupabase().rpc('save_radar_reactions',{p_rows:rows}).abortSignal(AbortSignal.timeout(4000)));
}
export async function saveReactionCursor(cursor:string,now:number) {
 checked(await getSupabase().from('impact_radar_reaction_progress').upsert({id:'history',cursor_id:cursor,checked_at:new Date(now).toISOString()}).abortSignal(AbortSignal.timeout(2500)));
}
export async function readRadarResearch(ids:string[],now=Date.now()):Promise<RadarResearch> {
 try {
  const [raw,patterns]=await Promise.all([
   ids.length?getSupabase().from('impact_radar_reactions').select('data').in('event_id',ids.slice(0,200)).order('published_at',{ascending:false}).limit(600).abortSignal(AbortSignal.timeout(3000)).then(checked):[],
   getSupabase().rpc('radar_reaction_patterns',{p_as_of:new Date(now).toISOString()}).abortSignal(AbortSignal.timeout(4000)).then(checked),
  ]);
  return {status:'ready',rows:(raw||[]).map((r:any)=>r.data).filter(isRadarReaction),patterns:patterns as any,checkedAt:new Date(now).toISOString()};
 } catch{return {status:'unavailable',rows:[],patterns:[],checkedAt:new Date(now).toISOString()};}
}
