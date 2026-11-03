import YahooFinance from 'yahoo-finance2';
import { radarMateriality,usableSizeSnapshot,isRadarSizeSnapshot,materialityCutoff,type RadarSizeSnapshot } from '../../src/shared/radarMateriality.js';
import type { RadarReaction } from '../../src/shared/radarReaction.js';
import { readRadarCompanyContexts,saveRadarCompanyContext } from '../database/radarCompanyContextDao.js';
let client:InstanceType<typeof YahooFinance>|null=null;
export function sizeSnapshotFromQuote(code:string,q:any,capturedAt:number):RadarSizeSnapshot|null {
 if(q?.symbol!==`${code}.BO`||q.currency!=='INR'||!(q.regularMarketTime instanceof Date)||!Number.isFinite(q.regularMarketTime.getTime()))return null;
 const value:RadarSizeSnapshot={scripCode:code,marketCapInr:q.marketCap,currency:'INR',quotedAt:q.regularMarketTime.toISOString(),capturedAt:new Date(capturedAt).toISOString(),sourceUrl:`https://finance.yahoo.com/quote/${code}.BO/`};
 return isRadarSizeSnapshot(value)?value:null;
}
async function quote(code:string):Promise<any> {
 client??=new YahooFinance({suppressNotices:['yahooSurvey']});return client.quote(`${code}.BO`);
}
export function createRadarContextEnricher(deps={read:readRadarCompanyContexts,save:saveRadarCompanyContext,quote,now:Date.now}) {
 let windowAt=0,attempts=0,active=0;
 const snapshots=new Map<string,RadarSizeSnapshot>();
 return async(rows:RadarReaction[])=>{
  const now=deps.now();if(now-windowAt>=300000){windowAt=now;attempts=0;}
  const eligible=rows.filter(r=>now<=materialityCutoff(r.sessionDate)&&now>=Date.parse(r.publishedAt)&&now-Date.parse(r.publishedAt)<=7*86400000);
  if(!eligible.length)return;
  const existing=await deps.read(eligible.map(r=>r.id));
  for(const r of eligible) {
   if(existing.has(r.id))continue;
   let s=snapshots.get(r.scripCode);
   if(!s||now-Date.parse(s.capturedAt)>300000) {
    if(attempts>=2||active>=2)continue;
    attempts++;active++;
    const request=Promise.resolve().then(()=>deps.quote(r.scripCode));
    void request.catch(()=>{}).finally(()=>active--);
    let timer:ReturnType<typeof setTimeout>|undefined;
    try{const q=await Promise.race([request,new Promise<null>(resolve=>{timer=setTimeout(()=>resolve(null),3000)})]);s=sizeSnapshotFromQuote(r.scripCode,q,deps.now())||undefined;if(s){snapshots.set(r.scripCode,s);while(snapshots.size>120)snapshots.delete(snapshots.keys().next().value!);}}
    finally{clearTimeout(timer);}
   }
   if(s&&usableSizeSnapshot(s,r.publishedAt,r.sessionDate))await deps.save(r.id,radarMateriality(s,r.amounts,r.excerpt));
  }
 };
}
export const enrichRadarCompanyContexts=createRadarContextEnricher();
