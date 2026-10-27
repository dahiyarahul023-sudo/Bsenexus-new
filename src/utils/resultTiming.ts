import { parseFilingTimestamp } from './timeFormat';
export interface TimingPoint { quarter: string; timestamp: number; minute: number; date: string; }
export const clockLabel = (minute: number) => { const m=((minute%1440)+1440)%1440;return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`; };
/** First verified declaration per quarter; scheduled meetings and ingestion clocks are excluded. */
export function resultTimingHistory(rows: any[], now = Date.now()) {
  const quarters=new Map<string,TimingPoint>();
  for(const row of rows) {
    if (!(row.isOutcome===true || ['Declared','Outcome Declared'].includes(row.status))) continue;
    const quarter=String(row.quarterKey || '').trim(); if(!quarter)continue;
    let timestamp=Number(row.submissionTimestamp);
    if (!Number.isFinite(timestamp) || timestamp<=0) {
      const times=[row.exactDateTimeStr,row.declaredAtFormatted,row.declarationTime,
        row.declarationDate && row.declarationTime ? `${row.declarationDate} ${row.declarationTime}` : ''];
      timestamp=0;
      for(const value of times) {
        if(typeof value!=='string' || !/\d{1,2}:\d{2}/.test(value) || !/\d{4}/.test(value))continue;
        const clean=value.replace(/,\s*/g,' ').replace(/\s+IST$/i,'');
        const iso=clean.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
        timestamp=parseFilingTimestamp(iso ? `${iso[1]}T${iso[2].padStart(2,'0')}:${iso[3]}:${iso[4]||'00'}+05:30` : clean);
        if(timestamp>0)break;
      }
    }
    if(!Number.isFinite(timestamp)||timestamp<=0||timestamp>now)continue;
    const point={quarter,timestamp,minute:Math.floor(((timestamp+19800000)%86400000)/60000),date:new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Kolkata'}).format(timestamp)};
    if(!quarters.has(quarter)||timestamp<quarters.get(quarter)!.timestamp)quarters.set(quarter,point);
  }
  const points=[...quarters.values()].sort((a,b)=>b.timestamp-a.timestamp).slice(0,8);
  let window: {start:number;duration:number;count:number}|null=null;
  if(points.length>=4) {
    const required=Math.max(3,Math.ceil(points.length*.75));
    for(const duration of [60,120]) {
      const candidates=[...new Set(points.flatMap(point=>[point.minute,Math.floor(point.minute/15)*15]))].map(start=>({start,duration,count:points.filter(p=>(p.minute-start+1440)%1440<=duration).length})).sort((a,b)=>b.count-a.count || Number(a.start%15!==0)-Number(b.start%15!==0) || a.start-b.start);
      if(candidates[0]?.count>=required) {window=candidates[0];break;}
    }
  }
  const exceptions=window ? points.filter(point=>(point.minute-window!.start+1440)%1440>window!.duration) : [];
  return {points,window,exceptions};
}
