import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { ReadCache } from '../utils/readCache.js';

function harness() {
  let now=1_000_000,reads=0,companyReads=0,failCompany=false;
  let hold:Promise<void>|undefined;
  const rows=new Map<string,any>([['filing',{subject:'Original',scrip_cd:'532540'}]]);
  const db={from(){let deleting=false,id='',scrip='';return {
    select(){return this},eq(field:string,value:string){if(field==='scrip_cd')scrip=value;else id=value;return this},
    order(){return this},limit(){return this},gt(){return this},
    async abortSignal(){companyReads++;if(failCompany)return {data:null,error:new Error('offline')};return {data:[...rows].filter(([,value])=>value.scrip_cd===scrip).map(([id,data])=>({id,scrip_cd:scrip,data:structuredClone(data)})),error:null}},
    async maybeSingle(){reads++;return {data:rows.has(id)?{id,data:structuredClone(rows.get(id))}:null,error:null}},
    in(_field:string,ids:string[]){const run=async()=>{if(deleting){ids.forEach(id=>rows.delete(id));return {error:null}}return {data:ids.filter(id=>rows.has(id)).map(id=>({id,data:structuredClone(rows.get(id))})),error:null}};return {abortSignal:()=>run(),then:(res:any,rej:any)=>run().then(res,rej)}},
    delete(){deleting=true;return this},upsert(values:any[]){const run=async()=>{if(hold)await hold;for(const row of values)rows.set(row.id,structuredClone(row.data));return {error:null}};return {abortSignal:()=>run(),then:(res:any,rej:any)=>run().then(res,rej)}}
  }}};
  const deps:any={
    './supabase.js':{getSupabase:()=>db,isSupabaseConfigured:()=>true},
    '../utils/helpers.js':{parseBseDate:()=>0,determinePriority:()=>({level:'LOW',category:'GENERAL'})},
    './logDao.js':{addLog:async()=>{}},'./localStore.js':{readLocalJson:()=>[],writeLocalJson(){},isOfflineOrNetworkError:()=>false,isQuotaError:()=>false},
    '../utils/bloomFilter.js':{BloomFilter:class{add(){}has(){return false}}},
    '../utils/renderCache.js':{pageRenderCache:{invalidate(){}},apiResponseCache:{invalidate(){}}},
    '../services/indexNow.js':{notifySearchEnginesOfNewPages(){}},
    '../services/filingIndexNow':{publicFilingVersion:()=>'',storedFilingIndexPages:()=>[]},
    '../../src/shared/filingSource.js':{isBseFiling:()=>true},
    '../../src/shared/scripMatching.js':{projectFilingIdentity:(row:any)=>row,hasExactScripCode:(row:any,code:string)=>row.scrip_cd===code},
    '../utils/readCache.js':{ReadCache}
  };
  class Clock extends Date{static now(){return now}}
  const exports:any={};const source=readFileSync(new URL('../database/announcementDao.ts',import.meta.url),'utf8');
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:(p:string)=>{assert.ok(deps[p],p);return deps[p]},Date:Clock,structuredClone,AbortSignal,setTimeout,clearTimeout,console,process:{env:{}}});
  return {dao:exports,rows,reads:()=>reads,companyReads:()=>companyReads,failCompany:(value:boolean)=>{failCompany=value},advance:(ms:number)=>{now+=ms},hold:(value:Promise<void>|undefined)=>{hold=value}};
}

test('cloud-only filing reads coalesce, preserve fields, isolate caller mutations and refresh on TTL',async()=>{
  const h=harness();const [a,b]=await Promise.all([h.dao.getAnnouncementById('filing'),h.dao.getAnnouncementById('filing')]);
  assert.equal(h.reads(),1);assert.equal(a.scrip_cd,'532540');a.subject='Caller mutation';assert.equal(b.subject,'Original');
  h.rows.get('filing').subject='Updated elsewhere';h.advance(60_000);
  assert.equal((await h.dao.getAnnouncementById('filing')).subject,'Updated elsewhere');assert.equal(h.reads(),2);
});

test('missing filing cache expires after 15 seconds; a confirmed delete invalidates a positive lookup',async()=>{
  const h=harness();assert.equal(await h.dao.getAnnouncementById('new'),null);
  h.rows.set('new',{subject:'Newly published'});assert.equal(await h.dao.getAnnouncementById('new'),null);
  h.advance(15_000);assert.equal((await h.dao.getAnnouncementById('new')).subject,'Newly published');
  await h.dao.deleteAnnouncementsFromStorageAndCloud(['new']);assert.equal(await h.dao.getAnnouncementById('new'),null);
});

test('queued and confirmed partial writes both invalidate a cloud-only filing lookup',async()=>{
  const h=harness();await h.dao.getAnnouncementById('filing');
  let release!:()=>void;const held=new Promise<void>(r=>{release=r});h.hold(held);
  h.dao.queueAnnouncementsBatchWrite([{docId:'filing',data:{aiSummaryEn:'Confirmed summary'},merge:true}]);
  for(let i=0;i<15;i++)await Promise.resolve();
  assert.equal((await h.dao.getAnnouncementById('filing')).subject,'Original');assert.equal(h.reads(),2,'enqueue invalidates before confirmation');
  release();await h.dao.flushSupabaseWriteQueue();
  const updated=await h.dao.getAnnouncementById('filing');assert.equal(updated.aiSummaryEn,'Confirmed summary');assert.equal(updated.subject,'Original');assert.equal(h.reads(),3,'confirmation invalidates a read racing the write');
});


test('connector company bodies coalesce across calls, isolate callers and expire without extending freshness',async()=>{
  const h=harness();
  const [a,b]=await Promise.all([h.dao.getCachedCompanyFilings('532540'),h.dao.getCachedCompanyFilings('532540')]);
  assert.equal(h.companyReads(),1);a[0].subject='Caller mutation';assert.equal(b[0].subject,'Original');
  h.rows.get('filing').subject='Remote change';h.advance(29_999);
  assert.equal((await h.dao.getCachedCompanyFilings('532540'))[0].subject,'Original');
  h.advance(1);assert.equal((await h.dao.getCachedCompanyFilings('532540'))[0].subject,'Remote change');
  assert.equal(h.companyReads(),2);
});

test('connector company failures are retried, while writes and deletes invalidate cached bodies',async()=>{
  const h=harness();h.failCompany(true);
  await assert.rejects(h.dao.getCachedCompanyFilings('532540'),/unavailable/);
  h.failCompany(false);await h.dao.getCachedCompanyFilings('532540');assert.equal(h.companyReads(),2);
  h.dao.queueAnnouncementsBatchWrite([{docId:'filing',data:{subject:'Changed'},merge:true}]);
  await h.dao.flushSupabaseWriteQueue();
  assert.equal((await h.dao.getCachedCompanyFilings('532540'))[0].subject,'Changed');
  await h.dao.deleteAnnouncementsFromStorageAndCloud(['filing']);
  assert.equal((await h.dao.getCachedCompanyFilings('532540')).length,0);
});
