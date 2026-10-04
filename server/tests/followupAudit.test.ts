import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
process.chdir(fs.mkdtempSync(path.join(os.tmpdir(),'bsenexus-followup-')));
process.env.NODE_ENV = 'test';
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

test('local request refunds are once-only, owner-bound and safe after quota reset', async () => {
  const { saveUserProfile } = await import('../database/usersDao.js');
  const q = await import('../services/aiQuotaService.js');
  await saveUserProfile('refund-user',{tier:'pro',proExpiresAt:Date.now()+86400000},true);
  const a = await q.checkAndConsumeServerAiQuota('refund-user',false);
  const b = await q.checkAndConsumeServerAiQuota('refund-user',false);
  await q.refundServerAiQuota('wrong-user',false,a.reservationId);
  assert.equal((await q.getServerAiQuotaStatus('refund-user',false)).usedToday,2);
  await q.refundServerAiQuota('refund-user',false,a.reservationId);
  await q.refundServerAiQuota('refund-user',false,a.reservationId);
  assert.equal((await q.getServerAiQuotaStatus('refund-user',false)).usedToday,1);
  await q.resetServerAiQuota('refund-user');
  await q.checkAndConsumeServerAiQuota('refund-user',false);
  await q.refundServerAiQuota('refund-user',false,b.reservationId);
  assert.equal((await q.getServerAiQuotaStatus('refund-user',false)).usedToday,1);
});

test('production cannot reserve quota without durable storage or silently fall back to a local file', async () => {
  const { requiresDurableAiQuota, operateDurableAiQuota } = await import('../database/aiQuotaDao.js');
  process.env.NODE_ENV='production';
  try {
    assert.equal(requiresDurableAiQuota(),true);
    await assert.rejects(operateDurableAiQuota('test-user','reserve'),(error:any)=>error.code==='PAYMENT_STORE_UNAVAILABLE');
  } finally {process.env.NODE_ENV='test';}
});

test('watchlist mutations report missing/foreign records and mutate only the owner record', async () => {
  const {addWatchlist,renameWatchlist,toggleWatchlist,deleteWatchlist,getAllWatchlists} = await import('../database/watchlistDao.js');
  const id = await addWatchlist('Before','list-owner');
  const list = { id };
  assert.equal(await renameWatchlist(list.id,'Attack','other-owner'),false);
  assert.equal(await toggleWatchlist('missing',false,'list-owner'),false);
  assert.equal(await renameWatchlist(list.id,'After','list-owner'),true);
  assert.equal(await toggleWatchlist(list.id,false,'list-owner'),true);
  const saved = (await getAllWatchlists('list-owner')).find(x=>x.id===list.id);
  assert.equal(saved.name,'After');assert.equal(saved.is_active,0);
  assert.equal(await deleteWatchlist(id,'other-owner'),false);
  assert.equal(await deleteWatchlist(id,'list-owner'),true);
  assert.equal(await deleteWatchlist(id,'list-owner'),false);
});

test('heuristic financial extraction identifies provider and limited evidence explicitly', async () => {
  const { generateInstantHeuristicSummary }=await import('../services/gemini.js');
  const result=generateInstantHeuristicSummary('Test Company','Test filing','No figures available.','OTHER');
  assert.match(result,/Heuristic extraction/);assert.match(result,/not a Gemini-generated/);assert.match(result,/full PDF has not been analyzed/);
});

test('shared notification reads are isolated per user and personal inbox remains private', async () => {
  const n=await import('../database/notificationDao.js');
  await n.addNotification({id:'shared-audit',userId:'system',title:'Shared test',message:'Synthetic',type:'GENERAL',priority:'LOW',symbol:'TEST',scripCode:'0',isWatchlist:true});
  await n.addNotification({id:'private-audit',userId:'reader-a',title:'Private test',message:'Synthetic',type:'GENERAL',priority:'LOW',symbol:'TEST2',scripCode:'0',isWatchlist:true});
  assert.equal(await n.markNotificationsReadBatch(['shared-audit'],'reader-a'),1);
  assert.equal(await n.markNotificationsReadBatch(['shared-audit'],'reader-a'),0);
  assert.equal((await n.getAllNotifications('reader-a')).find(x=>x.id==='shared-audit')?.isRead,true);
  assert.equal((await n.getAllNotifications('reader-b')).find(x=>x.id==='shared-audit')?.isRead,false);
  assert.equal(await n.markNotificationRead('private-audit','reader-b'),false);
  assert.equal((await n.getAllNotifications('reader-b')).some(x=>x.id==='private-audit'),false);
});

test('configured cloud notification failure is returned instead of pretending a local notification is durable', async t => {
  const storage=await import('../database/supabase.js');
  const n=await import('../database/notificationDao.js');
  process.env.SUPABASE_URL='https://audit-fixture.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='synthetic-test-key';
  storage.resetSupabaseClient();
  t.mock.method(storage.getSupabase(),'from',()=>({upsert:async()=>({error:new Error('synthetic missing table')})}) as any);
  try {
    await assert.rejects(n.addNotification({id:'must-not-save',userId:'reader-a',title:'Synthetic failed persistence',message:'Test',type:'GENERAL',priority:'LOW',symbol:'ERR',scripCode:'0'}),(e:any)=>e.code==='PAYMENT_STORE_UNAVAILABLE');
  } finally {delete process.env.SUPABASE_URL;delete process.env.SUPABASE_SERVICE_ROLE_KEY;storage.resetSupabaseClient();}
  assert.equal((await n.getAllNotifications('reader-a',100,{watchlistOnly:false})).some(x=>x.id==='must-not-save'),false);
});

test('closing story edition starts at 15:30 IST, and trading hours exclude pre-open and the closing boundary', async () => {
  const {getISTMarketSession}=await import('../../src/components/story/storyData.js');
  for(const time of ['15:00:00','15:29:59']) {
    const result=getISTMarketSession(new Date('2026-10-05T'+time+'+05:30'));
    assert.equal(result.showMarketMoves,false);assert.equal(result.isMarketHours,true);
  }
  const close=getISTMarketSession(new Date('2026-10-05T15:30:00+05:30'));
  assert.equal(close.showMarketMoves,true);assert.equal(close.isMarketHours,false);assert.match(close.editionBadge,/3:30/);
  assert.equal(getISTMarketSession(new Date('2026-10-05T09:14:00+05:30')).isMarketHours,false);
  assert.equal(getISTMarketSession(new Date('2026-10-05T09:15:00+05:30')).isMarketHours,true);
  assert.equal(getISTMarketSession(new Date('2026-10-04T15:30:00+05:30')).showMarketMoves,false);
});

test('inserting a filing invalidates cached feed responses immediately', async () => {
  const {apiResponseCache}=await import('../utils/renderCache.js');
  const {saveAnnouncementsBatch}=await import('../database/announcementDao.js');
  apiResponseCache.set('/api/announcements:fixture',JSON.stringify([]),'application/json');
  assert.ok(apiResponseCache.get('/api/announcements:fixture'));
  await saveAnnouncementsBatch([{newsId:'AUDIT-CACHE-ONLY',companyName:'Synthetic test company',subject:'Test filing',details:'Isolated test',pdfLink:'',scrip_cd:'000000',bseTime:new Date().toISOString()}]);
  assert.equal(apiResponseCache.get('/api/announcements:fixture'),null);
});

test('API cache separates query filters and private identities, retaining stale evidence on hits and 304s', async () => {
  const express=(await import('express')).default;
  const {RenderCache}=await import('../utils/renderCache.js');
  const app=express();const cache=new RenderCache({maxEntries:10});
  app.use((req,_res,next)=>{(req as any).user={uid:req.headers['x-fixture-uid'] || 'guest'};next();});
  app.get('/feed',cache.middleware({ttlMs:10000,publicCache:false}),(req,res)=>{
    res.setHeader('X-BSE-Feed-Stale','true');res.setHeader('Cache-Control','private, max-age=1');
    res.json({symbol:req.query.symbol,uid:(req as any).user.uid});
  });
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
  const base='http://127.0.0.1:'+(server.address() as any).port;
  try {
    const first=await fetch(base+'/feed?symbol=A',{headers:{'x-fixture-uid':'one'}});
    const etag=first.headers.get('etag')!;assert.equal((await first.json()).symbol,'A');
    const second=await fetch(base+'/feed?symbol=B',{headers:{'x-fixture-uid':'one'}});assert.equal((await second.json()).symbol,'B');
    const other=await fetch(base+'/feed?symbol=A',{headers:{'x-fixture-uid':'two'}});assert.equal((await other.json()).uid,'two');
    const hit=await fetch(base+'/feed?symbol=A',{headers:{'x-fixture-uid':'one'}});
    assert.equal(hit.headers.get('x-cache'),'HIT');assert.equal(hit.headers.get('x-bse-feed-stale'),'true');assert.equal(hit.headers.get('cache-control'),'private, max-age=1');
    const unchanged=await fetch(base+'/feed?symbol=A',{headers:{'x-fixture-uid':'one','if-none-match':etag}});
    assert.equal(unchanged.status,304);assert.equal(unchanged.headers.get('x-bse-feed-stale'),'true');
    assert.match(unchanged.headers.get('vary') || '',/Authorization/);
  } finally {await new Promise<void>(r=>server.close(()=>r()));}
});

test('a successful API response cannot relabel old quotes fresh when providers fail or only some quotes update', async () => {
  const {buildMarketFreshnessSnapshot}=await import('../services/marketIndicesService.js');
  const quote={id:'one',symbol:'TEST',name:'Test',category:'EQUITY_INDEX' as const,currency:'INR',price:10,change:0,changePercent:0,lastUpdated:'2026-10-04T01:00:00Z',source:'OFFICIAL_TEST_FIXTURE'};
  const two={...quote,id:'two',lastUpdated:'2026-10-04T02:00:00Z'};
  const result=buildMarketFreshnessSnapshot([quote,two],new Set(['two']),Date.parse('2026-10-04T03:00:00Z'));
  assert.equal(result.stale,true);assert.equal(result.indices[0].stale,true);assert.equal(result.indices[1].stale,false);
  assert.equal(result.lastRefreshed,Date.parse(quote.lastUpdated));assert.notEqual(result.lastRefreshed,result.fetchAttemptedAt);
  const empty=buildMarketFreshnessSnapshot([{...quote,source:'UNAVAILABLE'}],new Set(),Date.now());
  assert.deepEqual(empty.indices,[]);assert.equal(empty.lastRefreshed,0);
});


test('clear inbox hides shared and own old notifications only for the caller, and permits new ones', async () => {
  const n = await import('../database/notificationDao.js');
  const item = {message:'Synthetic',type:'GENERAL' as const,priority:'LOW' as const,symbol:'CLEAR',scripCode:'0',isWatchlist:true};
  const before = Date.now()-10000;
  await n.addNotification({...item,id:'clear-shared',userId:'system',title:'Shared old',timestamp:before});
  await n.addNotification({...item,id:'clear-own',userId:'clear-a',title:'Personal old',timestamp:before});
  await n.clearAllNotifications('clear-a');
  assert.equal((await n.getAllNotifications('clear-a')).length,0);
  assert.ok((await n.getAllNotifications('clear-b')).some(x=>x.id==='clear-shared'));
  assert.equal((await n.getAllNotifications('clear-b')).some(x=>x.id==='clear-own'),false);
  const state = JSON.parse(fs.readFileSync('data/notification_inbox_state.json','utf8'));
  assert.ok(state['clear-a']>=before);
  await n.addNotification({...item,id:'clear-new',userId:'system',title:'Shared new',timestamp:state['clear-a']+1});
  assert.deepEqual((await n.getAllNotifications('clear-a')).map(x=>x.id),['clear-new']);
});

test('production clear inbox cannot succeed without durable storage', async () => {
  const n = await import('../database/notificationDao.js');
  process.env.NODE_ENV='production';
  try { await assert.rejects(n.clearAllNotifications('clear-a'),(e:any)=>e.code==='PAYMENT_STORE_UNAVAILABLE'); }
  finally {process.env.NODE_ENV='test';}
});

test('cloud inbox clear uses the account-bound RPC and propagates missing migration failures', async t => {
  const storage = await import('../database/supabase.js');
  const n = await import('../database/notificationDao.js');
  process.env.SUPABASE_URL='https://audit-fixture.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY='synthetic-test-key';
  storage.resetSupabaseClient();
  let fail=false;
  const mock=t.mock.method(storage.getSupabase(),'rpc',async (name:string,args:any)=>{
    assert.equal(name,'clear_user_notification_inbox');assert.deepEqual(args,{p_uid:'clear-cloud-user'});
    return fail ? {data:null,error:new Error('missing migration')} : {data:Date.now(),error:null};
  });
  try {
    await n.clearAllNotifications('clear-cloud-user');
    assert.equal(mock.mock.callCount(),1);
    fail=true;
    await assert.rejects(n.clearAllNotifications('clear-cloud-user'),(e:any)=>e.code==='PAYMENT_STORE_UNAVAILABLE');
  } finally {delete process.env.SUPABASE_URL;delete process.env.SUPABASE_SERVICE_ROLE_KEY;storage.resetSupabaseClient();}
});


test('durable watchlist deletion fails honestly and leaves the cached owned list on cloud write failure', async t => {
  const w = await import('../database/watchlistDao.js');
  const storage = await import('../database/supabase.js');
  const id=await w.addWatchlist('Deletion failure fixture','delete-failure-owner');
  const before=await w.getAllWatchlists('delete-failure-owner');
  process.env.SUPABASE_URL='https://audit-fixture.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY='synthetic-test-key';storage.resetSupabaseClient();
  t.mock.method(storage.getSupabase(),'from',(table:string)=>{
    assert.equal(table,'user_watchlists');
    return {select:()=>({eq:(_column:string,uid:string)=>({maybeSingle:async()=>{assert.equal(uid,'delete-failure-owner');return {data:{lists:before},error:null};}})}),upsert:async()=>({error:new Error('synthetic write failure')})} as any;
  });
  try {await assert.rejects(w.deleteWatchlist(id,'delete-failure-owner'),(e:any)=>e.code==='PAYMENT_STORE_UNAVAILABLE');}
  finally {delete process.env.SUPABASE_URL;delete process.env.SUPABASE_SERVICE_ROLE_KEY;storage.resetSupabaseClient();}
  assert.ok((await w.getAllWatchlists('delete-failure-owner')).some(x=>x.id===id));
  process.env.NODE_ENV='production';
  try {await assert.rejects(w.deleteWatchlist(id,'delete-failure-owner'),(e:any)=>e.code==='PAYMENT_STORE_UNAVAILABLE');}
  finally {process.env.NODE_ENV='test';}
});
