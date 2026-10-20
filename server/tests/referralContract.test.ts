import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchesReferralPayment} from '../services/referralPaymentContract.js';
import {consumeReferralEvents} from '../../src/utils/referralStream.js';

test('payment contract accepts exact discounted price and rejects owner, plan, currency, amount and missing record',()=>{
 const record={uid:'buyer',planId:'pro_monthly',currency:'INR',amountPaise:19900};
 const expected={uid:'buyer',planId:'pro_monthly',currency:'INR',amount:199};
 assert.equal(matchesReferralPayment(record,expected),true);
 for(const patch of [{uid:'attacker'},{planId:'pro_yearly'},{currency:'USD'},{amount:299},{amount:199.001},{amount:NaN},{amount:Infinity}])assert.equal(matchesReferralPayment(record,{...expected,...patch}),false);
 assert.equal(matchesReferralPayment(null,expected),false);
});
test('stream handles chunk boundaries and ignores heartbeat without inventing a confirmed event',async()=>{
 const encoder=new TextEncoder();const payload=JSON.stringify({success:true,code:'ALICE',stats:{totalPending:1,totalConversions:0}});
 const stream=new ReadableStream({start(c){for(const p of [': heart','beat\n\nevent: sna','pshot\nda','ta: '+payload.slice(0,12),payload.slice(12)+'\n\n'])c.enqueue(encoder.encode(p));c.close();}});
 const events:any[]=[];await consumeReferralEvents(new Response(stream,{headers:{'content-type':'text/event-stream'}}),e=>events.push(e),new AbortController().signal);
 assert.equal(events.length,1);assert.equal(events[0].stats.totalPending,1);assert.equal(events[0].stats.totalConversions,0);
});
test('stream rejects server failure and stops deliveries after cancellation',async()=>{
 await assert.rejects(consumeReferralEvents(new Response('event: unavailable\ndata: {}\n\n',{headers:{'content-type':'text/event-stream'}}),()=>assert.fail('no event expected'),new AbortController().signal),/delayed/);
 const controller=new AbortController();controller.abort();let cancelled=false;
 const stream=new ReadableStream({cancel(){cancelled=true;}});
 await consumeReferralEvents(new Response(stream,{headers:{'content-type':'text/event-stream'}}),()=>assert.fail('cancelled'),controller.signal);
 assert.equal(cancelled,true);
});

import {parsePayoutPaise} from '../utils/referralValidation.js';
test('payout money accepts decimal paise precisely and rejects invalid or nonpositive inputs',()=>{
 assert.equal(parsePayoutPaise(0.29),29);assert.equal(parsePayoutPaise('10.10'),1010);
 for(const value of ['-1','NaN',Infinity,0,'1.001','1e3',{},null])assert.equal(parsePayoutPaise(value),null);
});
