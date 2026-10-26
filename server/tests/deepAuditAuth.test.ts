import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { getFirebaseAuth } from '../security/firebaseAdmin.js';
import { telegramLinksRouter, telegramStartProof, validTelegramWebhookSecret } from '../api/telegramLinks.js';
import { getSupabase, resetSupabaseClient } from '../database/supabase.js';
import { checkAccountProtection, isAccountProtectionUnavailable } from '../security/accountRateLimiter.js';
process.env.JWT_SECRET ||= 'offline-test-audit-secret';
const { authMiddleware, authRouter, requireAdmin } = await import('../security/auth.js');
async function serve(run: (url:string)=>Promise<void>) {
 const app=express();app.use(express.json());app.use(cookieParser());app.use(authMiddleware);app.use('/auth',authRouter);app.use('/api',telegramLinksRouter);app.get('/admin',requireAdmin,(_req,res)=>res.json({ok:true}));
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 try{await run(`http://127.0.0.1:${(server.address() as any).port}`);}finally{await new Promise<void>(r=>server.close(()=>r()));}
}
test('only a same-owner, unexpired PIN elevation cookie unlocks Firebase admin requests',async t=>{
 t.mock.method(getFirebaseAuth(),'verifyIdToken',async()=>({uid:'owner',email:'dahiyarahul023@gmail.com',email_verified:true}));
 const cookie=(uid:string,until:number)=>jwt.sign({uid,email:'dahiyarahul023@gmail.com',emailVerified:true,isOwner:true,isAdmin:true,adminElevatedUntil:until},process.env.JWT_SECRET!);
 await serve(async base=>{
  const headers: Record<string,string>={Authorization:'Bearer firebase.test.token'};
  assert.equal((await fetch(base+'/admin',{headers})).status,403);
  headers.Cookie=`authToken=${cookie('owner',Date.now()+60000)}`;assert.equal((await fetch(base+'/admin',{headers})).status,200);
  headers.Cookie=`authToken=${cookie('owner',Date.now()-1)}`;assert.equal((await fetch(base+'/admin',{headers})).status,403);
  headers.Cookie=`authToken=${cookie('another-uid',Date.now()+60000)}`;assert.equal((await fetch(base+'/admin',{headers})).status,403);
 });
});
test('omitted CAPTCHA and configured App Check cannot be bypassed on session issuance',async()=>{
 const old=process.env.RECAPTCHA_ENFORCE,oldCheck=process.env.FIREBASE_APPCHECK_ENFORCE;
 try {
  process.env.RECAPTCHA_ENFORCE='true';
  await serve(async base=>{
   const response=await fetch(base+'/auth/session',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
   assert.equal(response.status,400);assert.equal((await response.json()).code,'MISSING_TOKEN');
   process.env.FIREBASE_APPCHECK_ENFORCE='true';
   assert.equal((await fetch(base+'/auth/session',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).status,401);
  });
 }finally{if(old===undefined)delete process.env.RECAPTCHA_ENFORCE;else process.env.RECAPTCHA_ENFORCE=old;if(oldCheck===undefined)delete process.env.FIREBASE_APPCHECK_ENFORCE;else process.env.FIREBASE_APPCHECK_ENFORCE=oldCheck;}
});
test('production shared-store outage denies protection checks',async()=>{
 const old=process.env.NODE_ENV;process.env.NODE_ENV='production';
 try {await assert.rejects(checkAccountProtection('offline-audit-key'),isAccountProtectionUnavailable);}
 finally{process.env.NODE_ENV=old;}
});
test('only authentic private, non-forwarded Telegram start proofs are accepted',()=>{
 const nonce='a'.repeat(43);const message={text:`/start ${nonce}`,chat:{id:123,type:'private'},from:{id:123,is_bot:false}};
 assert.deepEqual(telegramStartProof({message}),{nonce,chatId:'123'});
 for(const patch of [{chat:{id:123,type:'group'}},{from:{id:999}},{forward_origin:{}},{text:'/start short'},{from:{id:123,is_bot:true}}])assert.equal(telegramStartProof({message:{...message,...patch}}),null);
 assert.equal(validTelegramWebhookSecret(undefined,'x'.repeat(32)),false);assert.equal(validTelegramWebhookSecret('wrong','x'.repeat(32)),false);assert.equal(validTelegramWebhookSecret('x'.repeat(32),'x'.repeat(32)),true);
});

test('actual Telegram routes reject forged webhooks and issue only hashed, owner-bound challenges',async t=>{
 const keys=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','TELEGRAM_BOT_TOKEN','TELEGRAM_WEBHOOK_SECRET','TELEGRAM_WEBHOOK_URL'];
 const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 Object.assign(process.env,{SUPABASE_URL:'https://audit-supabase.invalid',SUPABASE_SERVICE_ROLE_KEY:'offline-test-key',TELEGRAM_BOT_TOKEN:'offline-test-bot',TELEGRAM_WEBHOOK_SECRET:'x'.repeat(32),TELEGRAM_WEBHOOK_URL:'https://bsenexus.in/api/telegram/webhook'});
 const calls: any[]=[];
 t.mock.method(getSupabase(),'rpc',async (fn:string,args:any)=>{calls.push({fn,args});return {data:{chatId:null,verifiedAt:null},error:null};});
 // Database settings read fails into its existing local/default read path; no external traffic.
 const original=globalThis.fetch;
 t.mock.method(globalThis,'fetch',async (input:any,init:any)=>{
  const url=String(input);
  if(url.includes('api.telegram.org'))return new Response(JSON.stringify(url.endsWith('/getMe')?{ok:true,result:{username:'VerifiedAuditBot'}}:{ok:true,result:{url:process.env.TELEGRAM_WEBHOOK_URL}}));
  if(!url.startsWith('http://127.0.0.1:'))throw new Error('External test request blocked');
  return original(input,init);
 });
 try{await serve(async base=>{
  assert.equal((await fetch(base+'/api/telegram/webhook',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).status,401);
  assert.equal(calls.length,0);
  const cookie=jwt.sign({uid:'audit-owner',email:'dahiyarahul023@gmail.com',emailVerified:true,isOwner:true},process.env.JWT_SECRET!);
  const response=await fetch(base+'/api/users/telegram/link',{method:'POST',headers:{Cookie:`authToken=${cookie}`}});
  assert.equal(response.status,200);const data=await response.json();const nonce=new URL(data.url).searchParams.get('start')!;
  assert.equal(new URL(data.url).pathname,'/VerifiedAuditBot');assert.equal(nonce.length,43);
  assert.equal(calls[0].args.p_uid,'audit-owner');assert.equal(calls[0].args.p_action,'start');assert.equal(calls[0].args.p_hash.length,64);assert.notEqual(calls[0].args.p_hash,nonce);
 });}finally{for(const k of keys){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}resetSupabaseClient();}
});
