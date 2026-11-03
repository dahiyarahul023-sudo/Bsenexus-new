import { RADAR_CALENDAR_2026, type ReactionCalendar } from '../../src/shared/radarReaction.js';
import { validRadarDate } from '../../src/shared/impactRadar.js';
// Fixed official endpoint, bounded request. Never infer next year's holidays from this year's dates.
let cached:ReactionCalendar=RADAR_CALENDAR_2026, retryAt=0;
let pending:Promise<ReactionCalendar|null>|null=null;
export const currentReactionCalendar=(now=Date.now()):ReactionCalendar|null=>cached.year===Number(new Date(now+19800000).toISOString().slice(0,4))?cached:null;
export async function refreshReactionCalendar(now=Date.now(),request:typeof fetch=fetch):Promise<ReactionCalendar|null> {
 if(now<retryAt)return currentReactionCalendar(now);
 if(pending)return pending;
 retryAt=now+6*3600000;
 pending=(async()=>{
  try {
   const response=await request('https://www.nseindia.com/api/holiday-master?type=trading',{signal:AbortSignal.timeout(3000),headers:{'User-Agent':'Mozilla/5.0',Accept:'application/json'}});
   if(!response.ok)throw Error();
   const payload=await response.json();const year=Number(new Date(now+19800000).toISOString().slice(0,4));
   if(!Array.isArray(payload.CM)||payload.CM.length<5||payload.CM.length>60)throw Error();
   const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
   const dates=payload.CM.map((r:any)=>{const m=String(r.tradingDate||'').match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/);if(!m||+m[3]!==year||!months.includes(m[2]))throw Error();return `${m[3]}-${String(months.indexOf(m[2])+1).padStart(2,'0')}-${m[1]}`;});
   if(dates.some((d:string)=>!validRadarDate(d)))throw Error();
   cached={year,holidays:dates,source:'https://www.nseindia.com/api/holiday-master?type=trading',...(year===2026?{special:RADAR_CALENDAR_2026.special}:{})};
  }catch{retryAt=now+3600000;}
  finally{pending=null;}
  return currentReactionCalendar(now);
 })();return pending;
}
