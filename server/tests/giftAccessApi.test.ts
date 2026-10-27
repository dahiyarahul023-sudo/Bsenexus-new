import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { createGiftAccessRouter, buildGiftEmail } from '../api/giftAccess.js';
import { newGiftToken, giftCreateInput, hashGiftToken } from '../services/giftAccessPolicy.js';
import { projectSubscription } from '../services/subscriptionAccess.js';
const token = newGiftToken(), id = randomUUID();
const owner = { uid:'owner', email:'dahiyarahul023@gmail.com', emailVerified:true, adminElevatedUntil:Date.now()+60000, isOwner:true };
const recipient = { uid:'recipient', email:'recipient@example.com', emailVerified:true };
async function serve(run: (url:string,calls:any[],sent:any[])=>Promise<void>, options:any={}) {
 const calls:any[]=[],sent:any[]=[];
 const app=express();app.use(express.json());app.use((req,_res,next)=>{(req as any).user= options.noUser ? null : options.user || owner;next();});
 app.use('/api/gifts',createGiftAccessRouter({enabled:()=>true,configured:()=>true,
  verify:async()=>({uid:'recipient',email:'recipient@example.com',emailVerified:true,displayName:'Recipient',isOwner:false,...options.identity}),
  profile:async()=>null,
  command:async(action,actor,data)=> { calls.push({action,actor,data}); if(options.outage)throw Error('offline');return action==='list'?{items:[]}:{invite:{id,email:'recipient@example.com',validityDays:30,claimUntil:Date.now()+86400000,status:'pending'},shouldSend:action==='create'||action==='resend'}; },
  send:async input=>{sent.push(input);return options.mailFailure ? {ok:false,error:'network-error'}:{ok:true,id:'provider-id'};},...options.dependencies}));
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 try{await run(`http://127.0.0.1:${(server.address() as any).port}`,calls,sent);}finally{await new Promise<void>(r=>server.close(()=>r()));}
}
const post=(url:string,body:object,extra:object={})=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://bsenexus.in','X-Gift-Action':'1',...extra},body:JSON.stringify(body)});
const create=()=>({requestId:randomUUID(),email:'Recipient@example.com',validityDays:30,claimDays:7,note:'Internal'});
const redeem=()=>({token,firebaseIdToken:'a-valid-fixture-firebase-token'});
test('owner must be PIN-elevated: body roles and signed-in non-owners cannot create or list gifts',async()=>{
 for(const user of [recipient,{...owner,adminElevatedUntil:0},{...owner,emailVerified:false}]) await serve(async(base,calls)=>{
  assert.equal((await fetch(base+'/api/gifts/admin')).status,403);
  assert.equal((await post(base+'/api/gifts/admin',{...create(),isAdmin:true})).status,403);assert.equal(calls.length,0);
 },{user});
 await serve(async(base,calls)=>{assert.equal((await post(base+'/api/gifts/claim',redeem())).status,401);assert.equal(calls.length,0);},{noUser:true});
});
test('creation binds normalized email, sends no plaintext token into storage, and reports provider acceptance',async()=>{
 await serve(async(base,calls,sent)=>{
  const response=await post(base+'/api/gifts/admin',create());assert.equal(response.status,200);
  assert.equal((await response.json()).invite.delivery,'accepted');
  assert.equal(calls[0].data.email,'recipient@example.com');assert.equal(calls[0].actor,'owner');assert.equal(calls[0].data.hash.length,64);
  assert.equal(calls[0].data.token,undefined);assert.equal(calls[1].action,'delivery');assert.equal(sent.length,1);
  assert.ok(sent[0].text.includes('https://bsenexus.in/activate-gift#token=bnx_gift_'));assert.equal(sent[0].verifiedSenderOnly,true);
  assert.equal(response.headers.get('cache-control'),'private, no-store');
 });
});
test('cross-site calls and duration manipulation are rejected before mutation',async()=>{
 await serve(async(base,calls)=>{
  assert.equal((await post(base+'/api/gifts/admin',create(),{Origin:'https://attacker.invalid'})).status,403);
  assert.equal((await post(base+'/api/gifts/admin',{...create(),validityDays:0})).status,400);
  assert.equal((await post(base+'/api/gifts/claim',{...redeem(),validityDays:365})).status,400);assert.equal(calls.length,0);
 });
});
test('fresh Firebase identity must match session UID and have verified email before redemption',async()=>{
 for(const identity of [{uid:'another-user'},{emailVerified:false}]) await serve(async(base,calls)=>{
  assert.equal((await post(base+'/api/gifts/claim',redeem())).status,403);assert.equal(calls.length,0);
 },{user:recipient,identity});
 await serve(async(base,calls)=>{
  assert.equal((await post(base+'/api/gifts/preview',redeem())).status,200);assert.equal(calls[0].action,'preview');assert.equal(calls[0].data.email,recipient.email);assert.equal(calls[0].data.hash,hashGiftToken(token));assert.equal(calls[0].actor,recipient.uid);
 },{user:recipient});
});
test('mail failure is persisted as unknown, not sent or activated; database outage does not send',async()=>{
 await serve(async(base,calls,sent)=>{const r=await post(base+'/api/gifts/admin',create());assert.equal((await r.json()).invite.delivery,'unknown');assert.equal(calls[1].data.delivery,'unknown');assert.equal(sent.length,1);},{mailFailure:true});
 await serve(async(base,_calls,sent)=>{assert.equal((await post(base+'/api/gifts/admin',create())).status,503);assert.equal(sent.length,0);},{outage:true});
});
test('gift expiry combines with paid/trial rights without mutating the stored profile',()=>{
 const now=100000,raw:any={uid:'u',tier:'pro',proExpiresAt:now+5000,lastPaymentAt:1};const gift={id,validityDays:30,activatedAt:now,expiresAt:now+10000};
 const a=projectSubscription(raw,gift,now+5000,now);assert.equal(a.proExpiresAt,now+10000);assert.equal(a.subscriptionAccess!.source,'gift');assert.equal(raw.proExpiresAt,now+5000);
 const revoked=projectSubscription(raw,null,now+5000,now);assert.equal(revoked.proExpiresAt,now+5000);assert.equal(revoked.subscriptionAccess!.source,'paid');
 const expired=projectSubscription({...raw,lastPaymentAt:null,proExpiresAt:now-1},null,0,now);assert.equal(expired.tier,'free');
});
test('email uses a canonical fragment link and request bounds are enforced',()=>{
 assert.equal(giftCreateInput.parse(create()).email,'recipient@example.com');assert.throws(()=>giftCreateInput.parse({...create(),validityDays:3651}));
 const mail=buildGiftEmail({validityDays:30,claimUntil:Date.now()},token);assert.ok(mail.html.includes('#token='+token));assert.ok(!mail.html.includes('Internal'));
});
