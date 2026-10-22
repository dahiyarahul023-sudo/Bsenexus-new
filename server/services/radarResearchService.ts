import { getSupabase } from '../database/supabase.js';
import { isRadarEvent, radarDay, type RadarEvent } from '../../src/shared/impactRadar.js';
import { computeRadarResearch, isRadarResearch, publicRadarResearch, type RadarMarketDay, type RadarResearch } from '../../src/shared/radarResearch.js';
import { isRadarSessionMove } from '../../src/shared/radarMovement.js';
import { loadRadarPriceDay, radarSnapshotAliases } from './radarMovementService.js';
import { saveRadarPriceSessions } from '../database/radarPriceDao.js';
export async function readRadarResearch(id:string):Promise<RadarResearch|null> {
  const r=await getSupabase().from('impact_radar_research').select('data,first_public_at,impact_radar_events(first_public_at)').eq('event_id',id).abortSignal(AbortSignal.timeout(3000)).maybeSingle();
  if(r.error)throw new Error('Research unavailable');
  const row:any=r.data;
  return isRadarResearch(row?.data)&&Date.parse(row.first_public_at)===Date.parse(row.impact_radar_events?.first_public_at)?publicRadarResearch(row.data):null;
}
export async function saveRadarMarketDay(date:string,exchange:'NSE'|'BSE',sourceUrl:string) {
  const r=await getSupabase().from('impact_market_days').upsert({session_date:date,exchange,is_open:true,source_url:sourceUrl},{onConflict:'exchange,session_date',ignoreDuplicates:true}).abortSignal(AbortSignal.timeout(2000));
  if(r.error)throw new Error('Calendar persistence unavailable');
}
export async function refreshRadarResearchCase(event:RadarEvent, firstPublicAt:string,capture=false) {
  const start=new Date(Date.parse(firstPublicAt)-10*86_400_000).toISOString().slice(0,10), end=new Date(Date.parse(firstPublicAt)+90*86_400_000).toISOString().slice(0,10);
  const db=getSupabase(),codes=[...new Set(event.companies.slice(0,3).flatMap(c=>[c.symbol,c.scripCode]))];
  const [prices,calendar]=await Promise.all([
    db.from('impact_price_sessions').select('data').in('symbol',codes).gte('session_date',start).lte('session_date',end).limit(600).abortSignal(AbortSignal.timeout(4000)),
    db.from('impact_market_days').select('*').gte('session_date',start).lte('session_date',end).limit(202).abortSignal(AbortSignal.timeout(4000)),
  ]);
  if(prices.error||calendar.error)throw new Error('Research evidence unavailable');
  const rows=(prices.data||[]).map(r=>r.data).filter(isRadarSessionMove);
  const days:RadarMarketDay[]=(calendar.data||[]).map(d=>({date:d.session_date,exchange:d.exchange,open:d.is_open,sourceUrl:d.source_url}));
  if(capture) {
    // One missing past date only, through the same bounded official report loader as movement.
    // A 404 is NOT proof of a market closure, so absence stays pending.
    const first=radarDay(Date.parse(firstPublicAt));
    const missing=Array.from({length:60},(_,i)=>new Date(Date.parse(first)+i*86_400_000).toISOString().slice(0,10))
      .find(date=>Date.parse(`${date}T10:30:00Z`)<=Date.now()&&!days.some(d=>d.date===date));
    if(missing) {
      const fresh=await loadRadarPriceDay(event.companies.slice(0,3),missing,rows);
      const captured=radarSnapshotAliases(event.companies.slice(0,3),[...fresh.values()]);
      if(captured.length&&!await saveRadarPriceSessions(captured))throw new Error('Research capture failed');
      rows.push(...captured);
      // Successful security rows prove this exchange traded; closures need separately sourced evidence.
      for(const row of fresh.values()) {
        const exchange=row.sourceUrl.includes('nsearchives.nseindia.com')?'NSE':'BSE';
        await saveRadarMarketDay(row.date,exchange,row.sourceUrl);
        days.push({date:row.date,exchange,open:true,sourceUrl:row.sourceUrl});
      }
    }
  }
  const data=computeRadarResearch(firstPublicAt,event.companies,rows,days);
  const saved=await db.from('impact_radar_research').upsert({event_id:event.id,first_public_at:firstPublicAt,policy_version:1,checked_at:data.checkedAt,data},{onConflict:'event_id'}).abortSignal(AbortSignal.timeout(4000));
  if(saved.error)throw new Error('Research persistence failed');return data;
}
let running:Promise<void>|null=null,nextAttempt=0;
export function refreshRadarResearch():Promise<void> {
  if(running)return running;if(Date.now()<nextAttempt)return Promise.resolve();nextAttempt=Date.now()+15*60_000;
  running=(async()=>{
    try {
      const r=await getSupabase().rpc('radar_research_candidates').abortSignal(AbortSignal.timeout(4000));
      if(r.error)throw new Error('Research queue unavailable');
      // The queue is ordered by least-recently checked, independent of the 200-card feed cap.
      for(const row of r.data||[])if(isRadarEvent(row.data))await refreshRadarResearchCase(row.data,row.first_public_at,false);
    }catch{console.warn('[RadarResearch] Refresh unavailable; saved observations retained');nextAttempt=Date.now()+60_000;}
    finally{running=null;}
  })();return running;
}
