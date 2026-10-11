import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {once} from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
process.chdir(fs.mkdtempSync(path.join(os.tmpdir(),'alerts-api-')));
process.env.NODE_ENV='test';process.env.JWT_SECRET='test-only-alert-api-not-deployed';
delete process.env.SUPABASE_URL;delete process.env.SUPABASE_SERVICE_ROLE_KEY;
const {apiRouter}=await import('../api/routes.js');
const app=express();app.use(express.json());
// Production authMiddleware verifies identity before these handlers; this harness
// supplies an already-verified ordinary user, not a user ID from a payload.
app.use((req,_res,next)=>{const uid=req.headers.authorization;if(uid==='alice'||uid==='bob')(req as any).user={uid,isAnonymous:false,auth:true};next();});
app.use('/api',apiRouter);
const server=app.listen(0,'127.0.0.1');await once(server,'listening');
const base=`http://127.0.0.1:${(server.address() as any).port}/api/alert-rules`;
after(async()=>{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));});
const call=(suffix='',method='GET',body?:any,owner='alice')=>fetch(base+suffix,{method,headers:{authorization:owner,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
const prefs={results:true,corporate:false,material:false,scope:'ALL_STOCKS',channels:{inApp:true,telegram:false}};
test('anonymous callers cannot read or write private alert settings',async()=>{
 for(const [suffix,method] of [['','GET'],['','POST'],['/presets','PUT'],['/rule_x/toggle','PATCH'],['/rule_x','DELETE']])assert.equal((await call(suffix,method,method==='GET'?undefined:{},'')).status,401);
});
test('save/reload/retry preserves switches, scope and channels with three presets',async()=>{
 for(let n=0;n<3;n++)assert.equal((await call('/presets','PUT',prefs)).status,200);
 const response=await call();assert.match(response.headers.get('cache-control')||'',/no-store/);
 const {rules}=await response.json();assert.equal(rules.length,3);
 assert.equal(rules.find((r:any)=>r.presetKey==='corporate').enabled,false);
 assert.ok(rules.every((r:any)=>r.scope==='ALL_STOCKS'&&!r.channels.telegram));
});
test('custom rule create/edit/toggle/delete is persisted and isolated from presets and other users',async()=>{
 const draft={id:'rule_api_retry',name:'My custom results',enabled:true,category:'RESULTS',priority:'ALL',scope:'ALL_STOCKS',symbols:[],keywords:[],excludeKeywords:[],channels:{inApp:true,telegram:false},userId:'bob'};
 assert.equal((await call('','POST',draft)).status,200);
 assert.equal((await call('','POST',{...draft,name:'Edited results'})).status,200);
 let rules=(await (await call()).json()).rules;assert.equal(rules.length,4);assert.equal(rules.find((r:any)=>r.id===draft.id).userId,'alice');
 assert.equal((await call('/'+draft.id+'/toggle','PATCH',{enabled:false})).status,200);
 rules=(await (await call()).json()).rules;assert.equal(rules.find((r:any)=>r.id===draft.id).enabled,false);
 assert.equal((await call('/'+draft.id,'DELETE',undefined,'bob')).status,404);
 assert.equal((await call('/'+draft.id,'DELETE')).status,200);
 assert.equal((await (await call()).json()).rules.length,3);
});
test('invalid rule fields produce visible 400 errors rather than saved success',async()=>{
 assert.equal((await call('/presets','PUT',{...prefs,corporate:'false'})).status,400);
 const response=await call('','POST',{name:'broken'});assert.equal(response.status,400);assert.equal((await response.json()).success,false);
});
