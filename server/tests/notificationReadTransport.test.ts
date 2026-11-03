import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAllNotifications, getUnreadNotificationCount, markNotificationRead, clearAllNotifications, addNotificationOnce } from '../database/notificationDao.js';
import { resetSupabaseClient } from '../database/supabase.js';

test('actual inbox DAO reads 500 long IDs without oversized GETs and shares reads with the badge', async () => {
  const oldUrl=process.env.SUPABASE_URL, oldKey=process.env.SUPABASE_SERVICE_ROLE_KEY, original=globalThis.fetch;
  process.env.SUPABASE_URL='https://fixture.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='fixture-only';resetSupabaseClient();
  const owner='inbox-transport-fixture';let receiptFailure=false;let notificationReads=0;const sizes:number[]=[];
  const rows=Array.from({length:500},(_,i)=>({id:`notif_${String(i).padStart(36,'0')}_${'x'.repeat(28)}`,user_id:owner,title:'Result filed',message:'Quarterly result',type:'RESULT',timestamp:Date.now()-i,is_read:false,is_watchlist:true}));
  let read=false,cleared=false;
  globalThis.fetch=async(input,init)=>{
    const url=new URL(String(input)),method=init?.method || 'GET';let data:any=[];let status=200;
    if(url.pathname.endsWith('/user_notification_inbox_state'))data={cleared_before:0};
    else if(url.pathname.endsWith('/notifications') && method==='GET'){notificationReads++;data=cleared?[]:rows.map(row=>url.searchParams.get('user_id')?.includes('other-account')?{...row,user_id:'other-account',title:'Other account only'}:row);}
    else if(url.pathname.endsWith('/user_notification_receipts') && method==='GET'){
      sizes.push(url.href.length);
      if(url.href.length>16000 || receiptFailure){status=520;data={message:'Upstream rejected request'};}
      else {assert.ok([`eq.${owner}`,'eq.other-account'].includes(url.searchParams.get('user_id') || ''));data=read?[{notification_id:rows[0].id}]:[];}
    } else if(url.pathname.endsWith('/user_notification_receipts'))read=true;
    else if(url.pathname.endsWith('/clear_user_notification_inbox')){cleared=true;data=Date.now();}
    else if(url.pathname.endsWith('/notifications')){data=[{id:'fresh'}];cleared=false;}
    return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
  };
  try {
    const [items,count]=await Promise.all([getAllNotifications(owner,500,{watchlistOnly:false}),getUnreadNotificationCount(owner)]);
    assert.equal(items.length,500);assert.equal(count,500);
    assert.ok(sizes.every(n=>n<8000),'every request has room for headers below the gateway limit');
    assert.equal(notificationReads,1,'list and badge use one same-owner snapshot');
    assert.equal((await getAllNotifications('other-account'))[0].title,'Other account only');
    assert.equal((await getAllNotifications(owner))[0].title,'Result filed','another owner cannot replace the first snapshot');
    await markNotificationRead(rows[0].id,owner);
    assert.equal((await getAllNotifications(owner,500,{watchlistOnly:false}))[0].isRead,true,'confirmed receipt invalidates prior snapshot');
    await clearAllNotifications(owner);
    assert.equal((await getAllNotifications(owner)).length,0);
    await addNotificationOnce({id:'fresh',userId:owner,title:'New',message:'New',type:'GENERAL',timestamp:Date.now(),isRead:false,priority:'LOW',symbol:'SBIN',scripCode:'500112'});
    receiptFailure=true;
    await assert.rejects(getAllNotifications(owner),/store unavailable/i,'a failed receipt batch cannot become empty success or cached partial data');
    receiptFailure=false;
    assert.equal((await getAllNotifications(owner,500,{watchlistOnly:false})).length,500,'failed reads can recover immediately');
  } finally {
    globalThis.fetch=original;
    if(oldUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=oldUrl;
    if(oldKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=oldKey;
    resetSupabaseClient();
  }
});
