import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {once} from 'node:events';
process.env.JWT_SECRET='test-only-referral-api-secret-not-for-deployment';
process.env.SUPABASE_URL='https://referral-test.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY='test-only-service-role';
const originalFetch=globalThis.fetch;
let calledUid='',fail=false;
globalThis.fetch=(async(input:any,init:any)=>{
 const url=String(input?.url||input);
 if(!url.startsWith('https://referral-test.invalid'))return originalFetch(input,init);
 const body=JSON.parse(String(init?.body||'{}'));calledUid=body.p_uid;
 return new Response(JSON.stringify(fail?{message:'database unavailable'}:{success:true,status:'pending',code:body.p_data?.code}),{status:fail?503:200,headers:{'content-type':'application/json'}});
}) as typeof fetch;
const {referralsRouter}=await import('../api/referrals.js');
const app=express();app.use(express.json());
// Test harness injects already-verified identity; production authMiddleware verifies it.
app.use((req,res,next)=>{if(req.headers.authorization==='Bearer alice')(req as any).user={uid:'alice',isAnonymous:false};next();});
app.use('/api/referrals',referralsRouter);
const server=app.listen(0,'127.0.0.1');await once(server,'listening');
const url=`http://127.0.0.1:${(server.address() as any).port}/api/referrals`;
after(async()=>{globalThis.fetch=originalFetch;server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));});
test('anonymous requests cannot apply codes or open private updates',async()=>{
 for(const path of ['/events','/my-code']){const res=await originalFetch(url+path);assert.equal(res.status,401);}
 const res=await originalFetch(url+'/apply',{method:'POST',headers:{'content-type':'application/json'},body:'{"code":"BOB"}'});assert.equal(res.status,401);
});
test('attribution always uses verified UID, ignoring body/header impersonation',async()=>{
 const res=await originalFetch(url+'/apply',{method:'POST',headers:{authorization:'Bearer alice','content-type':'application/json','x-user-id':'attacker'},body:'{"code":"BOB","uid":"attacker","referrerUid":"attacker"}'});
 assert.equal(res.status,200);assert.equal(calledUid,'alice');assert.match(res.headers.get('cache-control')||'',/no-store/);
});
test('ordinary users cannot record payouts and storage failure is not acknowledged as success',async()=>{
 const res=await originalFetch(url+'/admin/payout',{method:'POST',headers:{authorization:'Bearer alice','content-type':'application/json'},body:'{"code":"BOB","amountRupees":10,"txReference":"bank-1"}'});assert.equal(res.status,403);
 fail=true;
 try{const unavailable=await originalFetch(url+'/apply',{method:'POST',headers:{authorization:'Bearer alice','content-type':'application/json'},body:'{"code":"BOB"}'});assert.equal(unavailable.status,503);assert.equal((await unavailable.json()).success,false);}
 finally{fail=false;}
});
