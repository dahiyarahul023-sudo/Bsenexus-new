import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { publicFilingVersion, storedFilingIndexPages } from '../services/filingIndexNow';

test('actual filing writer queues one drain of public changes only after storage confirms', async()=>{
  const file='server/database/announcementDao.ts';const actual=createRequire(new URL('../../'+file,import.meta.url));
  const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const rows=new Map<string,any>();const notified:{url:string;version:string}[]=[];let release!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve});let resolveNotified!:()=>void;const ready=new Promise<void>(resolve=>{resolveNotified=resolve});
  const db={from(){return {
    select(){return {in(_:string,ids:string[]){const run=async()=>({data:ids.filter(id=>rows.has(id)).map(id=>({id,data:rows.get(id)})),error:null});return {abortSignal:()=>run(),then:(res:any,rej:any)=>run().then(res,rej)}}}},
    upsert(values:any[]){const run=async()=>{await gate;values.forEach(row=>rows.set(row.id,row.data));return {error:null}};return {abortSignal:()=>run(),then:(res:any,rej:any)=>run().then(res,rej)}},
  }}};
  const exports:any={};
  vm.runInNewContext(source,{exports,console,setTimeout,clearTimeout,Date,URL,AbortSignal,process:{env:{NODE_ENV:'test'}},require(spec:string){
    if(spec.endsWith('/supabase.js'))return {getSupabase:()=>db,isSupabaseConfigured:()=>true};
    if(spec.endsWith('/localStore.js'))return {readLocalJson:()=>[],writeLocalJson(){},isOfflineOrNetworkError:()=>false,isQuotaError:()=>false};
    if(spec.endsWith('/logDao.js'))return {addLog:async()=>{}};
    if(spec.endsWith('/helpers.js'))return {determinePriority:()=>({level:'LOW',category:'GENERAL'}),parseBseDate:()=>0,isSymbolMatch:()=>false};
    if(spec.endsWith('/renderCache.js'))return {pageRenderCache:{invalidate(){}},apiResponseCache:{invalidate(){}}};
    if(spec.endsWith('/indexNow.js'))return {notifySearchEnginesOfNewPages(url:string,version:string){notified.push({url,version});resolveNotified()}};
    if(spec.endsWith('/filingIndexNow'))return {publicFilingVersion,storedFilingIndexPages};
    return actual(spec);
  }});
  const filings=[{newsId:'storage-one',companyName:'Reliance',scrip_cd:'500325',subject:'New filing',details:'Source text',pdfLink:''},{newsId:'storage-two',companyName:'Nexus Select Trust',scrip_cd:'543913',subject:'New filing',details:'Source text',pdfLink:''}];
  await exports.saveAnnouncementsBatch(filings);assert.equal(rows.size,0);assert.equal(notified.length,0,'publishing to memory is not confirmed storage');
  release();await Promise.race([ready,new Promise((_,reject)=>setTimeout(()=>reject(new Error('storage notification missing')),1500))]);
  assert.equal(rows.size,2);assert.equal(notified.length,3);assert.equal(new Set(notified.map(page=>page.url)).size,3);
  assert.ok(notified.some(page=>page.url==='https://bsenexus.in/announcements'));
  await exports.saveAnnouncementsBatch(filings);await exports.flushSupabaseWriteQueue();assert.equal(notified.length,3,'identical rows must not be resubmitted');
});
