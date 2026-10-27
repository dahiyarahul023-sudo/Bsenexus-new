import test from 'node:test';
import assert from 'node:assert/strict';
import { IndexNowQueue, contentVersion, indexNowUrl, type IndexNowStore, type IndexNowPage } from '../services/indexNowQueue';
import { storedFilingIndexPages, publicFilingVersion } from '../services/filingIndexNow';
import { loadIndexNowKey } from '../services/indexNowConfig';

function fixture(status=202) {
  const records=new Map<string,IndexNowPage>();const posted:any[]=[];let calls=0;let completeStatus=0;
  const store:IndexNowStore={async enqueue(pages){pages.forEach(page=>records.set(page.url,page));},async claim(){if(calls++)return [];return [...records.values()].map(page=>({...page,token:'fixture-token'}));},async complete(_,s){completeStatus=s;}};
  const queue=new IndexNowQueue({store,key:'a'.repeat(64),enabled:true,fetch:(async(url,options)=>{posted.push({url,...options,body:JSON.parse(String(options?.body))});return new Response('',{status});}) as typeof fetch});
  return {queue,posted,records,get status(){return completeStatus;}};
}
test('one batch contains distinct changed company URLs and announcements; HTTP 202 is accepted',async()=>{
  const f=fixture();const rows=[{newsId:'one',scrip_cd:'500325',subject:'First filing'},{newsId:'two',scrip_cd:'500325',subject:'Second filing'},{newsId:'three',scrip_cd:'543913',subject:'Nexus filing'}];
  const pages=storedFilingIndexPages(rows);pages.forEach(page=>f.queue.enqueue(page.url,page.version));
  assert.equal(f.posted.length,0,'enqueue cannot await or issue an ingestion-time HTTP request');
  const results=await Promise.all([f.queue.flush(),f.queue.flush()]);assert.equal(results[0].success,true);assert.equal(f.posted.length,1);
  assert.deepEqual(new Set(f.posted[0].body.urlList),new Set(['https://bsenexus.in/company/RELIANCE','https://bsenexus.in/company/NXST','https://bsenexus.in/announcements']));
  assert.equal(f.posted[0].url,'https://api.indexnow.org/indexnow');assert.equal(f.status,202);
  assert.equal(f.posted[0].headers['Content-Type'],'application/json; charset=utf-8');
});
test('canonical validation rejects foreign/private/query URLs and normalizes ampersand symbols',()=>{
  assert.equal(indexNowUrl('https://bsenexus.in/company/M&M'),'https://bsenexus.in/company/M%26M');
  for(const url of ['http://bsenexus.in/companies','https://bsenexus.in.evil.example/companies','https://evil.example/companies','https://bsenexus.in/settings','https://bsenexus.in/company/RELIANCE?token=private','https://name@bsenexus.in/companies','https://bsenexus.in/company/%2e%2e'])assert.equal(indexNowUrl(url),null,url);
});
test('a poll collects multiple page saves into one request and repeated release is harmless',async()=>{
  const f=fixture();const release=f.queue.beginBatch();
  f.queue.enqueue('https://bsenexus.in/company/RELIANCE');await f.queue.flush();assert.equal(f.posted.length,0);
  f.queue.enqueue('https://bsenexus.in/company/TCS');f.queue.enqueue('https://bsenexus.in/announcements');
  release();release();await f.queue.flush();assert.equal(f.posted.length,1);assert.equal(f.posted[0].body.urlList.length,3);assert.equal(f.queue.getStats().activeBatches,0);
});
test('HTTP/source errors return recoverable status without immediate requeue storm',async()=>{
  const f=fixture(503);f.queue.enqueue('https://bsenexus.in/companies',contentVersion('changed'));const result=await f.queue.flush();assert.equal(result.success,false);assert.equal(f.status,503);await f.queue.flush();assert.equal(f.posted.length,1);
  const broken=new IndexNowQueue({enabled:true,key:'a'.repeat(64),store:{async enqueue(){throw new Error('offline')},async claim(){return []},async complete(){}},fetch:(async()=>{throw new Error('must not reach HTTP')}) as typeof fetch});
  broken.enqueue('https://bsenexus.in/companies');assert.equal((await broken.flush()).success,false);assert.equal(broken.getStats().pendingQueueSize,1);
});
test('accepted HTTP status remains observable when receipt persistence fails',async()=>{
  let calls=0;const logs:any[]=[];
  const store:IndexNowStore={async enqueue(){},async claim(){return calls++?[]:[{url:'https://bsenexus.in/companies',version:contentVersion('changed'),token:'claimed'}]},async complete(){throw new Error('receipt unavailable')}};
  const queue=new IndexNowQueue({store,key:'a'.repeat(64),enabled:true,fetch:(async()=>new Response('',{status:202})) as typeof fetch,log:(...args)=>logs.push(args)});
  assert.deepEqual(await queue.flush(),{success:true,submittedCount:1});
  assert.equal(logs.length,1);assert.equal(logs[0][0],202);assert.match(logs[0][2],/cooldown reservation retained/);
  assert.equal(queue.getStats().lastHttpStatus,202);assert.equal(queue.getStats().successfulBatches,1);
  await queue.flush();assert.equal(logs.length,1,'receipt outage must not cause an immediate HTTP replay');
});
test('delivery-only fields cannot create public content changes and bad rows create no URLs',()=>{
  const filing={newsId:'one',subject:'Published',scrip_cd:'500325',pdfLink:'https://www.bseindia.com/a.pdf'};
  assert.equal(publicFilingVersion(filing),publicFilingVersion({...filing,is_sent:1,fetched_at:Date.now()}));
  assert.notEqual(publicFilingVersion(filing),publicFilingVersion({...filing,subject:'Corrected'}));
  assert.deepEqual(storedFilingIndexPages([{newsId:'stub',is_sent:1},null]),[]);
});
test('ownership token is server-env-backed and invalid explicit configuration fails closed',()=>{
  const env:NodeJS.ProcessEnv={};const key=loadIndexNowKey(env);assert.match(key,/^[a-f0-9]{64}$/);assert.equal(env.INDEXNOW_KEY,key);
  assert.equal(loadIndexNowKey({INDEXNOW_KEY:'invalid'}),'');
});
