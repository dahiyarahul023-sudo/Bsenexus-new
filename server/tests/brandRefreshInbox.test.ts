import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyNotificationSnapshots, notificationSnapshot, storeNotificationSnapshot, updateNotificationSnapshots } from '../../src/utils/notificationSnapshots';
import { hasExactScripCode, isBseOperatorFiling, matchesCompanyFiling, projectFilingIdentity } from '../../src/shared/scripMatching';
import { getScripCode, resolveStockDetailsSync, registerStockEntry } from '../utils/stockResolver';
import { ImpactRadarFeed } from '../../src/utils/impactRadarFeed';

const bse = { symbol: 'BSE', companyName: 'BSE Limited', scrip_cd: '540025', pdfLink: 'https://nsearchives.nseindia.com/corporate/BSE1_21102026130745_NSEintimation.pdf' };
test('exchange operator identity never reassigns Advanced Enzyme and survives poisoned old master cache', () => {
  assert.equal(getScripCode('BSE'), undefined);
  assert.equal(getScripCode('NSE'), '544937');
  assert.equal(resolveStockDetailsSync('540025')?.symbol, 'ADVENZYMES');
  registerStockEntry({ symbol:'BSE', scripCode:'540025',name:'BSE Ltd',nameKeywords:[] });
  assert.equal(getScripCode('BSE'), undefined);
  assert.equal(resolveStockDetailsSync('540025')?.symbol, 'ADVENZYMES');
  assert.equal(isBseOperatorFiling(bse), true);
  assert.equal(projectFilingIdentity(bse).scrip_cd,'');
  assert.equal(bse.scrip_cd,'540025','stored/source evidence is not mutated');
  assert.equal(matchesCompanyFiling(bse, '', 'BSE'), true);
  assert.equal(hasExactScripCode(bse, '540025'), false);
  assert.equal(matchesCompanyFiling({scrip_cd:'540025',companyName:'Advanced Enzyme Technologies Ltd'},'', 'BSE'),false);
  assert.equal(hasExactScripCode({scrip_cd:'540025',companyName:'Advanced Enzyme Technologies Ltd'},'540025'),true);
  for (const pdfLink of ['https://example.com/corporate/BSE1_file.pdf','https://nsearchives.nseindia.com.evil.test/corporate/BSE1_file.pdf','https://nsearchives.nseindia.com/corporate/TCS1_file.pdf']) assert.equal(isBseOperatorFiling({...bse,pdfLink}),false);
  assert.equal(isBseOperatorFiling({...bse,symbol:'ADVENZYMES'}),false);
  assert.equal(matchesCompanyFiling({scrip_cd:'544937'}, '544937','NSE'),true);
  assert.equal(matchesCompanyFiling({scrip_cd:'540025'}, '544937','NSE'),false);
});
test('inbox snapshots keep each confirmed filter, hide other owners and reconcile read/clear everywhere', () => {
  let state = emptyNotificationSnapshots<{id:string;isRead:boolean}>('alice');
  assert.equal(notificationSnapshot(state,'alice','ALL'),undefined, 'cold is loading, not confirmed empty');
  state=storeNotificationSnapshot(state,'alice','ALL',[{id:'one',isRead:false},{id:'two',isRead:false}]);
  state=storeNotificationSnapshot(state,'alice','WATCHLIST',[{id:'one',isRead:false}]);
  assert.equal(notificationSnapshot(state,'alice','ALL')?.length,2);
  assert.equal(notificationSnapshot(state,'bob','ALL'),undefined);
  state=updateNotificationSnapshots(state,'alice',items=>items.map(n=>n.id==='one'?{...n,isRead:true}:n));
  assert.equal(notificationSnapshot(state,'alice','ALL')?.[0].isRead,true);
  assert.equal(notificationSnapshot(state,'alice','WATCHLIST')?.[0].isRead,true);
  assert.equal(updateNotificationSnapshots(state,'bob',()=>[]),state);
  state=updateNotificationSnapshots(state,'alice',()=>[]);
  assert.deepEqual(notificationSnapshot(state,'alice','ALL'),[]);
  assert.deepEqual(notificationSnapshot(state,'alice','WATCHLIST'),[]);
  state=storeNotificationSnapshot(state,'bob','RESULTS',[]);
  assert.equal(notificationSnapshot(state,'alice','ALL'),undefined);
  assert.equal(notificationSnapshot(state,'bob','ALL'),undefined);
  assert.deepEqual(notificationSnapshot(state,'bob','RESULTS'),[]);
});
test('an abort-resolving Radar timeout gives a retry state and the next check can recover', async context => {
  context.mock.timers.enable({apis:['setTimeout']});
  let slow=true;
  const feed=new ImpactRadarFeed('guest',async (_url,options)=> slow ? new Promise(resolve=>options?.signal?.addEventListener('abort',()=>resolve(Response.json({success:true,items:[]})),{once:true})) : Response.json({success:true,items:[]}));
  const first=feed.refresh();context.mock.timers.tick(20_001);await first;
  assert.equal(feed.getSnapshot().loading,false);
  assert.match(feed.getSnapshot().error!,/timed out/);
  slow=false;await feed.refresh();assert.equal(feed.getSnapshot().error,null);assert.ok(feed.getSnapshot().checkedAt);
  feed.dispose();
});

test('BSE-only-on-NSE is recognized by F&O symbol without claiming the Advanced Enzyme BSE code', async () => {
  const {isFnOStock}=await import('../utils/fnoStocks');
  assert.equal(isFnOStock('BSE'),true);
  assert.equal(isFnOStock('540025'),false);
  const {storedFilingIndexPages}=await import('../services/filingIndexNow');
  for(const code of ['', '540025']){
    const pages=storedFilingIndexPages([{...bse,scrip_cd:code,newsId:'bse-new',subject:'New BSE filing'}]);
    assert.deepEqual(pages.map(p=>p.url).sort(),['https://bsenexus.in/announcements','https://bsenexus.in/company/BSE']);
  }
});
