import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { AsyncLocalStorage } from 'node:async_hooks';
import { VersionedSnapshot } from '../utils/versionedSnapshot.js';

function harness(size=2) {
  let now=1_000_000;
  const rows=new Map<string,any>();
  for(let i=0;i<size;i++) rows.set(`owner-${String(i).padStart(4,'0')}`,{uid:`owner-${String(i).padStart(4,'0')}`,revision:0,updated_at:'initial',lists:[{id:'list',name:'Saved',is_active:1,items:[{symbol:i===0?'TCS':'INFY',priority:i===0?'HIGH':'MEDIUM',scripCode:i===0?'532540':'500209'}]}]});
  const queries:any[]=[];
  let quotaRestricted=false;
  const from=()=>{
    let columns='*',uids:string[]|undefined,uid:string|undefined,after='',limit=1000,patch:any,expected:number|undefined;
    const execute=()=>{
      queries.push({columns,uids,uid,after,patch});
      if(quotaRestricted)return {data:[],error:new Error('quota restricted'),status:402};
      if(patch){const row=rows.get(uid!);if(!row||row.revision!==expected)return {data:[],error:null};rows.set(uid!,{...row,...structuredClone(patch),revision:row.revision+1});return {data:[{revision:row.revision+1}],error:null};}
      let selected=[...rows.values()].filter(row=>(!uid||row.uid===uid)&&(!uids||uids.includes(row.uid))&&row.uid.localeCompare(after)>0).sort((a,b)=>a.uid.localeCompare(b.uid)).slice(0,limit);
      selected=selected.map(row=>columns==='*'?row:Object.fromEntries(columns.split(',').map(c=>[c.trim(),row[c.trim()]])));
      return {data:structuredClone(selected),error:null};
    };
    const query:any={select(c:string){columns=c;return query},order(){return query},limit(n:number){limit=n;return query},gt(_key:string,value:string){after=value;return query},in(_key:string,value:string[]){uids=value;return query},eq(key:string,value:any){if(key==='uid')uid=value;if(key==='revision')expected=value;return query},abortSignal(){return query},update(value:any){patch=value;return query},upsert(){throw new Error('background scans must never write')},insert(){throw new Error('existing owner fixture must not be created')},async maybeSingle(){const r=execute();return {...r,data:r.data[0]||null}},then(resolve:any,reject:any){return Promise.resolve().then(execute).then(resolve,reject)}};
    return query;
  };
  const exports:any={};
  const deps:any={
    'node:async_hooks':{AsyncLocalStorage},
    '../ai/policy.js':{connectionsEnabled:()=>true},
    './supabase.js':{getSupabase:()=>({from}),isSupabaseConfigured:()=>true},
    './paymentStore.js':{runPaymentStore:(_operation:string,promise:any)=>promise,PaymentStoreUnavailableError:Error},
    './localStore.js':{readLocalJson:(_name:string,fallback:any)=>fallback,writeLocalJson(){},isOfflineOrNetworkError:()=>false},
    '../utils/stockResolver.js':{resolveStockDetailsSync:()=>null,resolveStockDetailsStrict:()=>null},
    '../utils/retry.js':{withRetry:(f:any)=>f()},'./logDao.js':{addLog:async()=>{}},
    '../utils/versionedSnapshot.js':{VersionedSnapshot}
  };
  class Clock extends Date{static now(){return now}}
  const source=readFileSync(new URL('../database/watchlistDao.ts',import.meta.url),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{exports,require:(p:string)=>{assert.ok(deps[p],`unmocked dependency ${p}`);return deps[p]},Date:Clock,AbortSignal,structuredClone,process:{env:{}},console:{log(){},info(){},warn(){}}});
  return {dao:exports,rows,queries,advance:(ms:number)=>{now+=ms},setQuotaRestricted:(value:boolean)=>{quotaRestricted=value}};
}
const plain=(value:any)=>JSON.parse(JSON.stringify(value));
const bodies=(h:ReturnType<typeof harness>)=>h.queries.filter(q=>q.columns.includes('lists'));

test('monitor, calendar and global symbol-map readers share one paged snapshot and seed owner reads',async()=>{
  const h=harness();
  const [symbols,map,calendar]=await Promise.all([h.dao.getActiveWatchlistSymbols('all',{noCreate:true}),h.dao.getActiveWatchlistSymbolMap('all',{noCreate:true}),h.dao.getCalendarWatchlistStocks()]);
  assert.deepEqual(plain(symbols).sort(),['INFY','TCS']);assert.equal(map.TCS.priority,'HIGH');assert.equal(calendar.length,2);
  assert.equal(h.queries.length,2,'one metadata scan and one body batch replace the full/N+1 scans');
  assert.equal(bodies(h).length,1);assert.deepEqual(plain(bodies(h)[0].uids),['owner-0000','owner-0001']);
  await Promise.all([h.dao.getActiveWatchlistSymbols('owner-0000',{noCreate:true}),h.dao.getActiveWatchlistSymbolMap('owner-0001',{noCreate:true})]);
  assert.equal(h.queries.length,2,'owner readers reuse the same validated lists');
  h.advance(60_000);await h.dao.getActiveWatchlistSymbols('all',{noCreate:true});
  assert.equal(h.queries.length,3);assert.equal(bodies(h).length,1,'unchanged lists must not be downloaded again');
});

test('cross-instance edits download only changed owners and preserve intentionally empty lists',async()=>{
  const h=harness();await h.dao.getActiveWatchlistSymbols('all',{noCreate:true});
  h.rows.get('owner-0000').lists=[];h.rows.get('owner-0000').revision++;
  h.advance(60_000);
  assert.deepEqual(plain(await h.dao.getActiveWatchlistSymbols('all',{noCreate:true})),['INFY']);
  assert.deepEqual(plain(bodies(h).at(-1).uids),['owner-0000']);
  assert.deepEqual(plain(await h.dao.getAllWatchlists('owner-0000',{noCreate:true})),[]);
  h.rows.delete('owner-0001');h.advance(60_000);
  assert.deepEqual(plain(await h.dao.getActiveWatchlistSymbols('all',{noCreate:true})),[]);
});

test('repeated aggregate cache hits cannot extend the 60-second owner freshness window',async()=>{
  const h=harness();await h.dao.getActiveWatchlistSymbols('all',{noCreate:true});
  h.advance(59_000);await h.dao.getCalendarWatchlistStocks();
  h.rows.get('owner-0000').lists=[];h.rows.get('owner-0000').revision++;
  h.advance(1000);
  assert.deepEqual(plain(await h.dao.getAllWatchlists('owner-0000',{noCreate:true})),[]);
});

test('website CAS mutations bypass snapshot reads and invalidate the background snapshot',async()=>{
  const h=harness();await h.dao.getActiveWatchlistSymbols('all',{noCreate:true});
  assert.equal(await h.dao.renameWatchlist('list','Changed','owner-0000'),true);
  const writes=h.queries.filter(q=>q.patch);assert.equal(writes.length,1);
  assert.equal(h.rows.get('owner-0000').lists[0].name,'Changed');
  const before=h.queries.length;await h.dao.getCalendarWatchlistStocks();
  assert.ok(h.queries.length>before,'same-instance edits invalidate before the TTL expires');
  assert.equal(bodies(h).at(-1).uids[0],'owner-0000');
});

test('metadata and value pagination cover owners beyond one PostgREST page',async()=>{
  const h=harness(501);const items=await h.dao.getCalendarWatchlistStocks();
  assert.equal(items.length,501);
  assert.equal(h.queries.filter(q=>!q.columns.includes('lists')).length,2);
  assert.equal(bodies(h).length,11);assert.ok(bodies(h).every(q=>q.uids.length<=50));
});


test('inactive numeric-zero lists stay out of global symbols and priority maps',async()=>{
  const h=harness();h.rows.get('owner-0000').lists[0].is_active=0;
  assert.deepEqual(plain(await h.dao.getActiveWatchlistSymbols('all',{noCreate:true})),['INFY']);
  assert.equal((await h.dao.getActiveWatchlistSymbolMap('all',{noCreate:true})).TCS,undefined);
});


test('keyset pagination follows database collation across mixed-case owner IDs',async()=>{
  const h=harness(1001);const saved=[...h.rows.values()];h.rows.clear();
  saved.forEach((row,index)=>{
    const uid=index<500?`a${String(index).padStart(4,'0')}`:index<1000?`B${String(index).padStart(4,'0')}`:'c-last';
    h.rows.set(uid,{...row,uid});
  });
  assert.equal((await h.dao.getCalendarWatchlistStocks()).length,1001);
  assert.equal(h.queries.filter(q=>!q.columns.includes('lists')).length,3);
});

test('quota denial shares a cooldown across aggregate and owner reads without blocking durable mutations',async()=>{
  const h=harness();
  await h.dao.getActiveWatchlistSymbols('all',{noCreate:true});
  h.advance(60_000);
  h.setQuotaRestricted(true);
  const before=h.queries.length;
  await h.dao.getActiveWatchlistSymbols('all',{noCreate:true});
  assert.equal(h.queries.length,before+1,'aggregate failing over must not fan out');
  assert.equal((await h.dao.getAllWatchlists('owner-0000',{noCreate:true}))[0].name,'Saved');
  await h.dao.getCalendarWatchlistStocks();
  assert.equal(h.queries.length,before+1,'known owner reads use the existing snapshot fallback');
  await assert.rejects(h.dao.renameWatchlist('list','Changed','owner-0000'));
  assert.equal(h.queries.length,before+2,'durable mutation still attempts its fresh read');
  h.setQuotaRestricted(false);
  h.advance(60_000);
  assert.deepEqual(plain(await h.dao.getActiveWatchlistSymbols('all',{noCreate:true})),['TCS','INFY']);
  assert.equal(h.queries.length,before+3,'metadata probing resumes after the cooldown');
});
