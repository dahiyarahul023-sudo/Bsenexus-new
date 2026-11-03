import { reactionCandidates,reactionPrices,saveReactionBatch,saveReactionCursor } from '../database/radarReactionDao.js';
import { evaluateRadarReaction,type ReactionCalendar } from '../../src/shared/radarReaction.js';
import { refreshReactionCalendar } from './radarReactionCalendar.js';
import { enrichRadarCompanyContexts } from './radarCompanyContextService.js';
interface Dependencies {enrich:typeof enrichRadarCompanyContexts;candidates:typeof reactionCandidates;prices:typeof reactionPrices;save:typeof saveReactionBatch;cursor:typeof saveReactionCursor;calendar:(now:number)=>Promise<ReactionCalendar|null>;now:()=>number;log:(line:string)=>void}
export function createRadarReactionLearning(overrides:Partial<Dependencies>={}) {
 const deps:Dependencies={enrich:enrichRadarCompanyContexts,candidates:reactionCandidates,prices:reactionPrices,save:saveReactionBatch,cursor:saveReactionCursor,calendar:refreshReactionCalendar,now:Date.now,log:console.info,...overrides};
 let running:Promise<void>|null=null,retryAt=0;
 return function refresh():Promise<void> {
  if(running)return running;if(deps.now()<retryAt)return Promise.resolve();retryAt=deps.now()+5*60000;
  running=(async()=>{
   const now=deps.now(),deadline=Date.now()+25000;let saved=0,failed=false,contextFailures=0;
   try {
    const [batch,calendar]=await Promise.all([deps.candidates(now),deps.calendar(now)]);
    let checkpoint=false;
    for(let start=0;start<batch.items.length;start+=3) {
     if(Date.now()>=deadline){failed=true;break;}
     await Promise.all(batch.items.slice(start,start+3).map(async({event,update})=>{
      for(let i=0;i<event.companies.length;i+=3) {
       if(Date.now()>=deadline)throw Error('Research time budget reached');
       const companies=event.companies.slice(i,i+3),prices=await deps.prices(companies.map(c=>c.scripCode),companies.map(c=>c.symbol),now,update.publishedAt);
       const rows=companies.map(company=>evaluateRadarReaction(event,update,company,prices,now,calendar));
       await deps.save(rows);saved+=rows.length;
       try{await deps.enrich(rows);}catch{contextFailures++;}
      }
     }));
     if(!checkpoint&&batch.historyCount!==undefined&&start+3>=batch.historyCount) {await deps.cursor(batch.cursor,now);checkpoint=true;}
    }
    if(!failed&&!checkpoint)await deps.cursor(batch.cursor,now);
   } catch{failed=true;}
   finally{if(failed||contextFailures)retryAt=deps.now()+60000;deps.log(`[RadarResearch] ${JSON.stringify({saved,failed,contextFailures})}`);running=null;}
  })();return running;
 };
}
export const refreshRadarReactionLearning=createRadarReactionLearning();
