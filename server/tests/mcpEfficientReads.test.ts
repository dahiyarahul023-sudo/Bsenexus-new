import test from 'node:test';
import assert from 'node:assert/strict';
import { createAiToolRunner } from '../ai/tools.js';
import { filingsData } from '../ai/market.js';
import { AiError, parseTool } from '../ai/policy.js';
import { ReadCache } from '../utils/readCache.js';

const date='2026-11-02T06:00:00.000Z';
const rows=[
  {newsId:'unrelated',scrip_cd:'500325',bseTimestamp:Date.parse(date)+1,subject:'Unrelated'},
  {newsId:'tcs-b',scrip_cd:'532540',bseTimestamp:Date.parse(date),subject:'Second'},
  {newsId:'tcs-a',scrip_cd:'532540',bseTimestamp:Date.parse(date),subject:'First'},
];
function setup(options:{scopes?:string[];pro?:boolean;items?:any[];fail?:boolean}={}) {
 let owner='',reservations=0,reads=0,marketReads=0;
 const runner=createAiToolRunner({
  state:async()=>({grant:{uid:'alice',id:'grant',scopes:options.scopes??['market:read','watchlists:read']},profile:{},pro:options.pro??true,limits:{daily:200,perMinute:20,writes:50}} as any),
  rpc:async()=>{reservations++;return {}},
  db:async(action:any)=>{reads++;if(options.fail)throw new Error('offline');return action({from(table:string){assert.equal(table,'user_watchlists');return {
    select(fields:string){assert.equal(fields,'lists');return this},
    eq(field:string,value:string){assert.equal(field,'uid');owner=value;return this},
    async maybeSingle(){return {lists:[{id:'mine',items:options.items??[{scripCode:'532540',symbol:'TCS'}]}]}}
  }}})},
  filings:async(args,sources)=>filingsData(args,{...sources,recent:async()=>{marketReads++;return rows},company:async()=>{throw new Error('Watchlist must not fetch company history')}}),
 });
 return {runner,counters:()=>({owner,reservations,reads,marketReads})};
}
test('watchlist scope precedes pagination; tied timestamps and inclusive polling retain correct IDs',async()=>{
 const h=setup();const first=await h.runner('token','filings_search',{watchlistId:'mine',limit:1,after:date});
 assert.equal(first.watchlistStockCount,1);assert.equal(first.coverage.kind,'recent_watchlist_window');
 assert.deepEqual(first.filings.map((r:any)=>r.id),['tcs-a']);assert.equal(first.recommendedPollIntervalSeconds,60);
 const second=await h.runner('token','filings_search',{watchlistId:'mine',limit:1,after:date,before:first.nextBefore,beforeId:first.nextBeforeId});
 assert.deepEqual(second.filings.map((r:any)=>r.id),['tcs-b']);assert.equal(second.hasMore,false);
 assert.equal(h.counters().owner,'alice');
});
test('empty watchlist does not widen to market; guessed IDs and owner injection are rejected',async()=>{
 const h=setup({items:[]});const result=await h.runner('token','filings_search',{watchlistId:'mine'});
 assert.deepEqual(result.filings,[]);assert.equal(h.counters().marketReads,0);
 await assert.rejects(h.runner('token','filings_search',{watchlistId:'bob-list'}),(e:any)=>e.code==='not_found');
 assert.throws(()=>parseTool('filings_search',{company:'TCS',watchlistId:'mine'}),AiError);
 assert.throws(()=>parseTool('filings_search',{watchlistId:'mine',uid:'bob'}),AiError);
});
test('each watchlist call rechecks scopes and Pro before reservation or data access; storage failures stay visible',async()=>{
 for(const options of [{scopes:['market:read']},{scopes:['watchlists:read']},{pro:false}]) {
  const h=setup(options);await assert.rejects(h.runner('token','filings_search',{watchlistId:'mine'}),AiError);
  assert.equal(h.counters().reservations,0);assert.equal(h.counters().reads,0);
 }
 const h=setup({fail:true});await assert.rejects(h.runner('token','filings_search',{watchlistId:'mine'}),/offline/);
});
test('clearing a public read cache fences an in-flight old value',async()=>{
 const cache=new ReadCache<string>({maxEntries:2,ttlMs:()=>30000});let release!:(v:string)=>void;
 const old=cache.get('company',()=>new Promise(r=>{release=r}));await Promise.resolve();cache.clear();
 assert.equal(await cache.get('company',async()=>'new'),'new');release('old');await old;
 assert.equal(await cache.get('company',async()=>'wrong'),'new');
});
