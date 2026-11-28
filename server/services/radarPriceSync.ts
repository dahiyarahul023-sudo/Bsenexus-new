import { listRadarEvents } from '../database/impactRadarDao.js';
import { refreshRadarReactionLearning } from './radarReactionLearning.js';
import { radarDay, type RadarEvent } from '../../src/shared/impactRadar.js';
import type { RadarSessionMove } from '../../src/shared/radarMovement.js';
import { loadRadarPriceDay, radarPriceAliases, radarPriceDates, radarPriceStore, radarSnapshotAliases, type RadarPriceStore } from './radarMovementService.js';

interface SyncDependencies {
  events: typeof listRadarEvents; store: RadarPriceStore; day: typeof loadRadarPriceDay;
  now: () => number; log: (line: string) => void;
}
/** One worker for watchdog, boot and authenticated external cron. No browser visit is required. */
export function createRadarPriceSync(overrides: Partial<SyncDependencies> = {}) {
  const deps: SyncDependencies = {events:listRadarEvents,store:radarPriceStore,day:loadRadarPriceDay,now:Date.now,log:console.info,...overrides};
  let running: Promise<void> | null=null, nextAttempt=0, cursor=0;
  return function refresh(): Promise<void> {
    if(running)return running;
    if(deps.now()<nextAttempt)return Promise.resolve();
    nextAttempt=deps.now()+15*60_000;
    running=(async()=>{
      let savedCount=0, readFailures=0, writeFailures=0, sourceMisses=0;
      const started=deps.now();
      const deadline=Date.now()+40_000;
      try{
        const all=await deps.events();
        const unique=[...new Map(all.flatMap(e=>e.companies).map(c=>[c.scripCode,c])).values()].sort((a,b)=>a.scripCode.localeCompare(b.scripCode));
        if(!unique.length)return;
        // Rotate bounded security batches; restart reads durable snapshots again. Cross-instance writes are duplicate-safe.
        const companies: RadarEvent['companies']=Array.from({length:Math.min(30,unique.length)},(_,i)=>unique[(cursor+i)%unique.length]);
        const dates=radarPriceDates(radarDay(started),8,-1).filter(day=>Date.parse(`${day}T10:30:00Z`)<=started);
        const saved: RadarSessionMove[]=[];
        for(let i=0;i<companies.length && Date.now()<deadline;i+=3){
          try{saved.push(...await deps.store.read([...new Set(companies.slice(i,i+3).flatMap(radarPriceAliases))],dates));}
          catch{readFailures++;}
        }
        let completedDates=0;
        const capture=async(day:string)=>{
          if(Date.now()>=deadline)return;
          // The shared loader coalesces reports with interactive reads and bounds upstream concurrency/timeouts.
          let timeout: ReturnType<typeof setTimeout>;
          const rows=await Promise.race([deps.day(companies,day,saved),new Promise<null>(resolve=>{timeout=setTimeout(()=>resolve(null),Math.max(1,deadline-Date.now()));})]).finally(()=>clearTimeout(timeout!));
          if(!rows){sourceMisses+=companies.length;return;}
          sourceMisses+=companies.length-rows.size;
          const fresh=radarSnapshotAliases(companies,[...rows.values()]).filter(s=>!saved.some(r=>r.symbol===s.symbol&&r.date===s.date));
          for(let i=0;i<fresh.length;i+=30){
            if(Date.now()>=deadline)return;
            const batch=fresh.slice(i,i+30);
            try{if(await deps.store.save(batch)){saved.push(...batch);savedCount+=batch.length;}else writeFailures++;}
            catch{writeFailures++;}
          }
          completedDates++;
        };
        // Friday can complete while an unpublished weekend report is slow; each day's save is independent.
        for(let i=0;i<dates.length && Date.now()<deadline;i+=3){
          await Promise.all(dates.slice(i,i+3).map(capture));
        }
        // Keep a failed storage batch eligible; other instances may have committed an uncertain write.
        if(!readFailures&&!writeFailures&&completedDates===dates.length)cursor=(cursor+companies.length)%unique.length;
      }catch{readFailures++;}
      finally{
        if(readFailures||writeFailures)nextAttempt=deps.now()+60_000;
        deps.log(`[RadarPrices] ${JSON.stringify({saved:savedCount,readFailures,writeFailures,sourceMisses,durationMs:deps.now()-started})}`);
        running=null;
      }
    })();
    return running;
  };
}
const captureRadarPrices=createRadarPriceSync();
export async function refreshRadarPriceSnapshots() {
  await captureRadarPrices();
  await refreshRadarReactionLearning();
}
