import { validRadarDate, validRadarTime, radarDay } from './impactRadar';
import { isRadarSessionMove, type RadarSessionMove } from './radarMovement';
export const RADAR_RESEARCH_HORIZONS = [1,3,5,20] as const;
export interface RadarMarketDay {date:string;exchange:'NSE'|'BSE';open:boolean;sourceUrl:string}
export interface RadarReactionPoint {sessions:1|3|5|20;status:'observed'|'pending'|'missing';date:string|null;percent:number|null;sourceUrl:string|null}
export interface RadarResearch {
  version:1;firstPublicAt:string;checkedAt:string;basis:'first-recorded-publication';adjustment:'unadjusted';
  benchmark:null;companies:{symbol:string;points:RadarReactionPoint[];cohort:'unreviewed';prices:RadarSessionMove[]}[];
}
/** Calendar coverage must be source-confirmed, including closures. Missing prices never mean zero.
 * During-session reports overlap that day's trading. After close starts next confirmed open session.
 * These are raw close-to-baseline observations, never attributed impact or adjusted excess returns.
 */
export function computeRadarResearch(firstPublicAt:string, companies:{symbol:string;scripCode:string}[], prices:RadarSessionMove[], calendar:RadarMarketDay[], now=Date.now()):RadarResearch {
  const local=new Date(Date.parse(firstPublicAt)+330*60_000), publishedDay=radarDay(Date.parse(firstPublicAt));
  const afterClose=local.getUTCHours()*60+local.getUTCMinutes()>=15*60+30;
  const result:RadarResearch={version:1,firstPublicAt,checkedAt:new Date(now).toISOString(),basis:'first-recorded-publication',adjustment:'unadjusted',benchmark:null,companies:[]};
  for(const company of companies.slice(0,3)) {
    const rows=prices.filter(p=>[company.symbol,company.scripCode].includes(p.symbol)&&isRadarSessionMove(p));
    const exchange=rows.some(p=>p.sourceUrl.includes('nsearchives.nseindia.com'))?'NSE':rows.length?'BSE':calendar.some(d=>d.exchange==='NSE')?'NSE':'BSE';
    const chosen=new Map<string,RadarSessionMove>();
    for(const p of rows.filter(p=>(p.sourceUrl.includes('nsearchives.nseindia.com')?'NSE':'BSE')===exchange))if(!chosen.has(p.date))chosen.set(p.date,p);
    const days=new Map(calendar.filter(d=>d.exchange===exchange).map(d=>[d.date,d]));
    const openDates:string[]=[];
    for(let i=afterClose?1:0;i<90;i++) {
      const date=new Date(Date.parse(publishedDay)+i*86_400_000).toISOString().slice(0,10);
      if(Date.parse(`${date}T10:30:00Z`)>now)break;
      const day=days.get(date);
      if(!day)break;
      if(day.open)openDates.push(date);
      if(openDates.length===20)break;
    }
    const first=chosen.get(openDates[0]);
    const baseline=first?.previousClose;
    const points=RADAR_RESEARCH_HORIZONS.map(sessions=>{
      const date=openDates[sessions-1]||null,row=date?chosen.get(date):undefined;
      const sameExchange=row && (row.sourceUrl.includes('nsearchives.nseindia.com')?'NSE':'BSE')===exchange;
      const percent=baseline && row && sameExchange ? (row.close/baseline-1)*100 : null;
      return {sessions,status:percent!==null?'observed' as const:date?'missing' as const:'pending' as const,date,percent,sourceUrl:percent!==null?row!.sourceUrl:null};
    });
    // A gap beyond an already verified horizon does not invalidate that earlier observation.
    result.companies.push({symbol:company.symbol,points,cohort:'unreviewed',prices:[...chosen.values()].sort((a,b)=>a.date.localeCompare(b.date))});
  }
  return result;
}
export function publicRadarResearch(v:RadarResearch):RadarResearch {
  return {version:1,firstPublicAt:v.firstPublicAt,checkedAt:v.checkedAt,basis:v.basis,adjustment:v.adjustment,benchmark:null,
    companies:v.companies.map(c=>({symbol:c.symbol,cohort:'unreviewed',points:c.points.map(({sessions,status,date,percent,sourceUrl})=>({sessions,status,date,percent,sourceUrl})),
      prices:c.prices.map(({date,symbol,series,close,previousClose,changePercent,sourceUrl,exchange,exchangeSymbol})=>({date,symbol,series,close,previousClose,changePercent,sourceUrl,...(exchange?{exchange}:{}),...(exchangeSymbol?{exchangeSymbol}:{})}))}))};
}
export function isRadarResearch(v:any):v is RadarResearch {
  return v?.version===1 && validRadarTime(v.firstPublicAt) && validRadarTime(v.checkedAt) && v.basis==='first-recorded-publication' && v.adjustment==='unadjusted' && v.benchmark===null &&
    Array.isArray(v.companies)&&v.companies.length<=3&&v.companies.every((c:any)=>/^[A-Z0-9&._-]{1,30}$/.test(c.symbol)&&c.cohort==='unreviewed'&&Array.isArray(c.prices)&&c.prices.length<=200&&c.prices.every(isRadarSessionMove)&&
      Array.isArray(c.points)&&c.points.length===4&&c.points.every((p:any,i:number)=>p.sessions===RADAR_RESEARCH_HORIZONS[i]&&['observed','pending','missing'].includes(p.status)&&
        (p.date===null||validRadarDate(p.date))&&(p.status==='observed'?p.date&&Number.isFinite(p.percent)&&p.percent>=-100&&typeof p.sourceUrl==='string'&&c.prices.some((s:RadarSessionMove)=>s.date===p.date&&s.sourceUrl===p.sourceUrl):p.percent===null&&p.sourceUrl===null)));
}
