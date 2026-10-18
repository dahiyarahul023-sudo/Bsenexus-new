import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getRadarMovement,nseBhavcopyUrl,loadRadarPriceDay,radarSnapshotAliases} from '../services/radarMovementService.js';
import {createRadarPriceSync} from '../services/radarPriceSync.js';
import {isRadarMovement,radarSessionTiming,type RadarSessionMove} from '../../src/shared/radarMovement.js';
import type {RadarEvent} from '../../src/shared/impactRadar.js';
const company={symbol:'YESBANK',name:'Yes Bank Ltd',scripCode:'532648'};
const event=(publishedAt='2026-10-18T04:24:42Z'):RadarEvent=>({id:'yesbank-context',title:'Yes Bank: Supreme Court AT1 ruling',companies:[company],category:'liability',authority:'Supreme Court',status:'monitoring',scheduledDate:null,scheduleConfirmed:false,nextTrigger:null,information:'The publisher reported a court ruling.',source:{name:'Publisher',kind:'news',url:'https://publisher.example/yesbank'},publishedAt,updatedAt:publishedAt});
const quote=(date:string,close=17.5,previousClose=18.12):RadarSessionMove=>({date,symbol:'YESBANK',series:'EQ',close,previousClose,changePercent:(close/previousClose-1)*100,sourceUrl:nseBhavcopyUrl(date)});
const sunday=Date.parse('2026-10-18T12:00:00Z');
test('Sunday news reads saved Friday by security code and distinguishes before-report from a missing future session',async()=>{
 const friday={...quote('2026-10-16'),symbol:'532648',exchangeSymbol:'YESBANK'};
 let requested:string[]=[];
 const result=await getRadarMovement(event(),sunday,async()=>null,{read:async(keys,dates)=>{assert.ok(keys.includes('532648'));requested=dates;return [friday];},save:async()=>true});
 assert.ok(requested.includes('2026-10-16'));assert.equal(result.status,'partial');assert.deepEqual(result.companies[0].sessions,[]);
 assert.equal(result.companies[0].previousSession?.close,17.5);assert.equal(result.companies[0].latestSession?.date,'2026-10-16');
 assert.equal(radarSessionTiming(result,result.companies[0].previousSession!),'Before report');assert.ok(isRadarMovement(result));
 assert.equal(isRadarMovement({...result,companies:[{...result.companies[0],previousSession:quote('2026-10-19')}]}),false);
});
test('old and new reports reuse latest company prices without relabelling them as the same event response',async()=>{
 const prices=[quote('2026-10-16')];const store={read:async()=>prices,save:async()=>true};
 const old=await getRadarMovement(event('2026-10-01T04:00:00Z'),sunday,async()=>null,store);
 const fresh=await getRadarMovement(event(),sunday,async()=>null,store);
 assert.equal(old.companies[0].sessions.length,0);assert.equal(old.companies[0].latestSession?.date,'2026-10-16');
 assert.equal(fresh.companies[0].previousSession?.date,'2026-10-16');
 assert.equal(radarSessionTiming(old,prices[0]),'After report');
});
test('after-close and intraday report-day labels preserve timing rather than imply a causal return',()=>{
 const s=quote('2026-10-16');
 assert.equal(radarSessionTiming({basis:'report-date',anchorDate:s.date,afterClose:true},s),'Before report');
 assert.equal(radarSessionTiming({basis:'report-date',anchorDate:s.date,afterClose:false},s),'Report day');
});
test('read and save failures are separate from verified observations, with a successful retry confirming durability',async()=>{
 const friday=quote('2026-10-16');let failSave=true;
 const read=async()=>{throw Error('db offline');};const save=async()=>!failSave;
 const run=()=>getRadarMovement(event(),sunday,async day=>day===friday.date?new Map([[company.symbol,friday]]):null,{read,save});
 const failed=await run();assert.equal(failed.persistence?.read,'failed');assert.equal(failed.persistence?.write,'failed');assert.equal(failed.companies[0].previousSession?.close,17.5);
 failSave=false;assert.equal((await run()).persistence?.write,'ok');
});
test('price identity aliases preserve the exchange ticker and never assign another company or date',async()=>{
 const s=quote('2026-10-16');const aliases=radarSnapshotAliases([company],[s]);
 assert.equal(aliases.find(r=>r.symbol==='532648')?.exchangeSymbol,'YESBANK');
 const result=await loadRadarPriceDay([company],'2026-10-16',aliases,async()=>{throw Error('should use saved');},null);
 assert.equal(result.get('YESBANK')?.close,17.5);
 assert.equal((await loadRadarPriceDay([company],'2026-10-15',[],async()=>new Map([['YESBANK',s]]),null)).size,0);
});
test('automatic capture persists Monday without detail visits; concurrent ticks coalesce and restart reuses durable rows',async()=>{
 let now=Date.parse('2026-10-19T12:00:00Z'),loads=0,writes=0;const durable=new Map<string,RadarSessionMove>();
 const monday=quote('2026-10-19',18,17.5),friday=quote('2026-10-16');
 const store={read:async(keys:string[],dates:string[])=>[...durable.values()].filter(s=>keys.includes(s.symbol)&&dates.includes(s.date)),save:async(rows:RadarSessionMove[])=>{writes++;for(const s of rows)if(!durable.has(s.symbol+s.date))durable.set(s.symbol+s.date,s);return true;}};
 const deps={events:async()=>[event()],store,now:()=>now,log(){},day:async(companies:RadarEvent['companies'],date:string,saved:RadarSessionMove[])=>loadRadarPriceDay(companies,date,saved,async d=>{loads++;const s=[monday,friday].find(s=>s.date===d);return s?new Map([['YESBANK',s]]):null;},null)};
 const sync=createRadarPriceSync(deps);await Promise.all([sync(),sync(),sync()]);assert.equal(writes,2);assert.equal(durable.size,4);const firstLoads=loads;
 await sync();assert.equal(loads,firstLoads,'five-minute cooldown avoids repeated capture');
 await createRadarPriceSync(deps)();assert.equal(writes,2,'restart does not rewrite existing final snapshots');
 const result=await getRadarMovement(event(),now,async()=>null,store);
 assert.equal(result.companies[0].previousSession?.date,friday.date);assert.equal(result.companies[0].sessions[0].date,monday.date);assert.equal(radarSessionTiming(result,monday),'After report');
});
test('background save failure is observable and retries the batch after one minute without storing missing quotes as zero',async()=>{
 let now=sunday,fail=true;const logs:string[]=[];let writes=0;
 const sync=createRadarPriceSync({events:async()=>[event()],now:()=>now,store:{read:async()=>[],save:async()=>{writes++;return !fail;}},day:async(_c,d)=>d==='2026-10-16'?new Map([['YESBANK',quote(d)]]):new Map(),log:l=>logs.push(l)});
 await sync();assert.equal(writes,1);assert.match(logs[0],/"writeFailures":1/);now+=59_000;await sync();assert.equal(writes,1);
 now+=1000;fail=false;await sync();assert.equal(writes,2);assert.match(logs[1],/"saved":2/);
});

test('a slow unpublished weekend report cannot prevent the background worker from saving Friday',async()=>{
 let release!:()=>void,recorded!:()=>void;
 const gate=new Promise<void>(r=>{release=r;}),written=new Promise<void>(r=>{recorded=r;});
 const sync=createRadarPriceSync({events:async()=>[event()],now:()=>sunday,log(){},store:{read:async()=>[],save:async rows=>{assert.ok(rows.every(s=>s.date==='2026-10-16'));recorded();return true;}},day:async(_c,d)=>{
  if(['2026-10-18','2026-10-17'].includes(d))await gate;
  return d==='2026-10-16'?new Map([['YESBANK',quote(d)]]):new Map();
 }});
 const work=sync();let timer:ReturnType<typeof setTimeout>;
 try{await Promise.race([written,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Friday blocked behind weekend requests')),1000);})]);}
 finally{clearTimeout(timer!);release();await work;}
});

test('a stored close older than eight days still appears as dated latest company context, never as an event-window return',async()=>{
 const lastKnown=quote('2026-09-30');
 const result=await getRadarMovement(event(),sunday,async()=>null,{read:async()=>[],latest:async(keys,through)=>{assert.ok(keys.includes('532648'));assert.equal(through,'2026-10-18');return [lastKnown];},save:async()=>true});
 assert.equal(result.status,'partial');assert.equal(result.companies[0].latestSession?.date,'2026-09-30');assert.equal(result.companies[0].previousSession,undefined);assert.deepEqual(result.companies[0].sessions,[]);
});
