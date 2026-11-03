import {test} from 'node:test';
import assert from 'node:assert/strict';
import {radarMateriality,statedAmountInr,usableSizeSnapshot,isRadarMateriality,type RadarSizeSnapshot} from '../../src/shared/radarMateriality';
import {sizeSnapshotFromQuote,createRadarContextEnricher} from '../services/radarCompanyContextService';
import {evaluateRadarReaction,comparableReactionPatterns,historicalVolatilitySignal,type ReactionPattern,RADAR_CALENDAR_2026} from '../../src/shared/radarReaction';
import {createRadarReactionLearning} from '../services/radarReactionLearning';
const company={scripCode:'532648',symbol:'YESBANK',name:'Yes Bank Ltd'};
const event={id:'case',title:'Court granted interim stay on a ₹50 crore penalty',information:'Court granted interim stay on a ₹50 crore penalty.',companies:[company],category:'legal',authority:'High Court',status:'monitoring' as const,scheduledDate:null,scheduleConfirmed:false,nextTrigger:null,source:{name:'BSE',kind:'disclosure' as const,url:'https://www.bseindia.com/report.pdf'},publishedAt:'2026-11-02T12:00:00Z',updatedAt:'2026-11-02T12:00:00Z'};
const update={id:'report',eventId:event.id,title:event.title,information:event.information,source:event.source,publishedAt:event.publishedAt};
const snapshot=(cap=1000e7):RadarSizeSnapshot=>({scripCode:company.scripCode,marketCapInr:cap,currency:'INR',quotedAt:'2026-11-02T10:00:00Z',capturedAt:'2026-11-02T13:00:00Z',sourceUrl:'https://finance.yahoo.com/quote/532648.BO/'});
const price=(date:string,close=100,low=99,high=101)=>({date,symbol:company.symbol,series:'EQ',previousClose:100,close,low,high,changePercent:close-100,sourceUrl:`https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_${date.replaceAll('-','')}_F_0000.csv.zip`});
const now=Date.parse('2026-11-03T12:00:00Z');
test('same ₹50 crore is compared with each company market cap; amounts, currencies and ambiguity stay explicit',()=>{
 const small=radarMateriality(snapshot(1000e7),['₹50 crore','₹50 crore']);
 const big=radarMateriality(snapshot(2000000e7),['₹50 crore']);
 assert.equal(small.amountToCapPercent,5);assert.equal(big.amountToCapPercent,0.0025);
 assert.equal(small.exposureBand,'over-1pct');assert.equal(big.exposureBand,'under-0.1pct');assert.notEqual(small.sizeBand,big.sizeBand);
 assert.equal(statedAmountInr(['Rs. 5,000 lakh']),50e7);assert.equal(statedAmountInr(['INR 500 million']),50e7);
 for(const a of [[],['USD 50 million'],['₹50 crore','₹100 crore'],['₹0 crore']])assert.equal(statedAmountInr(a),null);
 assert.equal(statedAmountInr(['₹50'],'₹50–100 crore'),null);
 for(const range of ['Rs. 50–100 crore','₹50 crore–100 crore','₹50 crore to ₹100 crore']){const rangeRow=evaluateRadarReaction(event,{...update,title:'Penalty of '+range,information:'A disputed range is stated.'},company,[],now);assert.deepEqual(rangeRow.amounts,[range]);assert.equal(statedAmountInr(rangeRow.amounts),null);}
 const unsupported=evaluateRadarReaction(event,{...update,title:'Penalty of INR 5e8',information:'Scientific notation.'},company,[],now);assert.deepEqual(unsupported.amounts,[]);
 assert.equal(isRadarMateriality({...small,amountToCapPercent:50}),false);
});
test('current valuations cannot be assigned to old incidents, wrong codes or foreign-currency quotes',()=>{
 assert.equal(usableSizeSnapshot(snapshot(),event.publishedAt,'2026-11-03'),true);
 assert.equal(usableSizeSnapshot({...snapshot(),capturedAt:'2026-11-03T04:00:00Z'},event.publishedAt,'2026-11-03'),false);
 assert.equal(usableSizeSnapshot({...snapshot(),capturedAt:'2026-10-01T13:00:00Z',quotedAt:'2026-10-01T10:00:00Z'},event.publishedAt,'2026-11-03'),false);
 const q={symbol:'532648.BO',currency:'INR',marketCap:1000e7,regularMarketTime:new Date(snapshot().quotedAt)};
 assert.ok(sizeSnapshotFromQuote('532648',q,Date.parse(snapshot().capturedAt)));
 assert.equal(sizeSnapshotFromQuote('532648',{...q,symbol:'OTHER.BO'},now),null);
 assert.equal(sizeSnapshotFromQuote('532648',{...q,currency:'USD'},now),null);
});
test('large intraday range with a flat close remains volatile and unusual against its own range baseline',()=>{
 const previous=Array.from({length:12},(_,i)=>price(new Date(Date.parse('2026-11-01')-i*86400000).toISOString().slice(0,10),100,99,101));
 const flat=evaluateRadarReaction(event,update,company,[price('2026-11-03',100,95,105),...previous],now);
 assert.equal(flat.observation?.session.changePercent,0);assert.equal(flat.observation?.rangePercent,10);assert.equal(flat.observation?.volatile,true);assert.equal(flat.observation?.baselineRangeMedian,2);assert.equal(flat.observation?.unusualRange,true);assert.equal(flat.observation?.unusual,false);
 for(const close of [94,106])assert.equal(evaluateRadarReaction(event,update,company,[price('2026-11-03',close,90,110)],now).observation?.volatile,true);
});
test('historical volatility watch requires enough matched size/exposure observations and does not depend on up/down direction',()=>{
 const r={...evaluateRadarReaction(event,update,company,[],Date.parse('2026-11-02T13:00:00Z')),materiality:radarMateriality(snapshot(),['₹50 crore'])};
 const p:ReactionPattern={fact:r.fact,scope:r.scope,sourceKind:r.source.kind,sizeBand:r.materiality.sizeBand,exposureBand:r.materiality.exposureBand,days:365,samples:20,volatile:14,up:5,down:15,medianAbsMove:3,medianRange:7,rangeSamples:20};
 assert.equal(historicalVolatilitySignal(r,[p]),p);
 assert.equal(historicalVolatilitySignal(r,[{...p,up:15,down:5}])?.volatile,14);
 assert.equal(historicalVolatilitySignal(r,[{...p,samples:19}]),null);
 assert.equal(comparableReactionPatterns({...r,materiality:radarMateriality(snapshot(2000000e7),['₹50 crore'])},[p]).length,0);
 assert.equal(historicalVolatilitySignal({...r,materiality:undefined},[p]),null);
});
test('context capture uses response completion time and keeps existing immutable snapshots',async()=>{
 let time=Date.parse('2026-11-03T03:44:59Z'),writes=0,quotes=0;
 const row=evaluateRadarReaction(event,update,company,[],time);
 const enrich=createRadarContextEnricher({now:()=>time,read:async()=>new Map(),save:async()=>{writes++},quote:async()=>{quotes++;time+=120000;return {symbol:'532648.BO',currency:'INR',marketCap:1000e7,regularMarketTime:new Date(snapshot().quotedAt)}}});
 await enrich([row]);assert.equal(quotes,1);assert.equal(writes,0,'provider response after the reaction opens is too late');
 const old=radarMateriality(snapshot(),['₹50 crore']);
 const skip=createRadarContextEnricher({now:()=>Date.parse('2026-11-02T14:00:00Z'),read:async()=>new Map([[row.id,old]]),save:async()=>assert.fail(),quote:async()=>assert.fail()});await skip([row]);
});
test('company context outage does not block reaction saves or durable scan progress',async()=>{
 let saved=0,cursors=0;const logs:string[]=[];
 const work=createRadarReactionLearning({now:()=>now,candidates:async()=>({items:[{event,update}],cursor:'x'}),prices:async()=>[price('2026-11-03')],calendar:async()=>RADAR_CALENDAR_2026,save:async()=>{saved++},cursor:async()=>{cursors++},enrich:async()=>{throw Error('quotes unavailable')},log:s=>logs.push(s)});
 await work();assert.equal(saved,1);assert.equal(cursors,1);assert.match(logs[0],/"contextFailures":1/);
});
