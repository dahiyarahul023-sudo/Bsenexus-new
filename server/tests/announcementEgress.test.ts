import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { ReadCache } from '../utils/readCache.js';

function harness() {
  let now=1_000_000,reads=0;
  let hold:Promise<void>|undefined;
  const rows=new Map<string,any>([['filing',{subject:'Original',scrip_cd:'532540'}]]);
  const db={from(){let deleting=false,id='';return {
    select(){return this},eq(_field:string,value:string){id=value;return this},
    async maybeSingle(){reads++;return {data:rows.has(id)?{id,data:structuredClone(rows.get(id))}:null,error:null}},
    async in(_field:string,ids:string[]){if(deleting){ids.forEach(id=>rows.delete(id));return {error:null}}return {data:ids.filter(id=>rows.has(id)).map(id=>({id,data:structuredClone(rows.get(id))})),error:null}},
    delete(){deleting=true;return this},async upsert(values:any[]){if(hold)await hold;for(const row of values)rows.set(row.id,structuredClone(row.data));return {error:null}}
  }}};
  const deps:any={
    './supabase.js':{getSupabase:()=>db,isSupabaseConfigured:()=>true},
    '../utils/helpers.js':{parseBseDate:()=>0,determinePriority:()=>({level:'LOW',category:'GENERAL'})},
    './logDao.js':{addLog:async()=>{}},'./localStore.js':{readLocalJson:()=>[],writeLocalJson(){},isOfflineOrNetworkError:()=>false},
    '../utils/bloomFilter.js':{BloomFilter:class{add(){}has(){return false}}},
    '../utils/renderCache.js':{pageRenderCache:{invalidate(){}},apiResponseCache:{invalidate(){}}},
    '../services/indexNow.js':{notifySearchEnginesOfNewPages(){}},
    '../services/filingIndexNow':{publicFilingVersion:()=>'',storedFilingIndexPages:()=>[]},
    '../../src/shared/filingSource.js':{isBseFiling:()=>true},
    '../../src/shared/scripMatching.js':{projectFilingIdentity:(row:any)=>row},
    '../utils/readCache.js':{ReadCache}
  };
  class Clock extends Date{static now(){return now}}
  const exports:any={};const source=readFileSync(new URL('../database/announcementDao.ts',import.meta.url),'utf8');
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:(p:string)=>{assert.ok(deps[p],p);return deps[p]},Date:Clock,structuredClone,setTimeout,clearTimeout,console,process:{env:{}}});
  return {dao:exports,rows,reads:()=>reads,advance:(ms:number)=>{now+=ms},hold:(value:Promise<void>|undefined)=>{hold=value}};
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
