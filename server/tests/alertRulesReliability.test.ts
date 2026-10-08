import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { effectiveAlertRules, makePresetRules, presetsFromRules } from '../../src/shared/alertRules.js';
process.env.SUPABASE_URL='https://alerts-test.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY='test-only-key';
const originalFetch=globalThis.fetch;
const rows=new Map<string,any>();let fail=false;
globalThis.fetch=(async(input:any,init:any={})=>{
 const url=new URL(String(input?.url||input));
 if(url.origin!=='https://alerts-test.invalid')return originalFetch(input,init);
 if(fail)return new Response(JSON.stringify({message:'unavailable'}),{status:503,headers:{'content-type':'application/json'}});
 const method=init.method||'GET';
 const id=url.searchParams.get('id')?.replace('eq.','');
 const owner=url.searchParams.get('user_id')?.replace('eq.','');
 let selected=[...rows.values()].filter(r=>(!id||r.id===id)&&(!owner||r.user_id===owner));
 if(method==='POST') {
   const body=JSON.parse(init.body);selected=Array.isArray(body)?body:[body];
   for(const r of selected)rows.set(r.id,structuredClone(r));
 } else if(method==='PATCH') {
   const patch=JSON.parse(init.body);selected=selected.map(r=>({...r,...patch}));for(const r of selected)rows.set(r.id,r);
 } else if(method==='DELETE') {for(const r of selected)rows.delete(r.id);}
 const accept=new Headers(init.headers).get('accept')||'';
 return new Response(JSON.stringify(accept.includes('object')?(selected[0]||null):selected),{status:200,headers:{'content-type':'application/json'}});
}) as typeof fetch;
const dao=await import('../database/alertRulesDao.js');
after(()=>{globalThis.fetch=originalFetch;});
const values={results:true,corporate:false,material:false,scope:'ALL_STOCKS' as const,channels:{inApp:true,telegram:false}};
const custom={id:'rule_custom_retry',name:'My TCS buybacks',description:'',enabled:true,category:'BUYBACK',priority:'ALL',scope:'SPECIFIC_SYMBOLS',symbols:['TCS'],keywords:[],excludeKeywords:[],channels:{inApp:true,telegram:false}};
test('repeated preset saves keep three stable rows and restore off switches, scope and channels',async()=>{
 const first=await dao.saveAlertPresets(values,'alice');
 await dao.saveAlertPresets(values,'alice');assert.equal(rows.size,3);
 assert.deepEqual((await dao.getAllAlertRules('alice')).map(r=>r.id).sort(),first.map(r=>r.id).sort());
 assert.deepEqual(presetsFromRules(await dao.getAllAlertRules('alice')),values);
});
test('legacy duplicate presets select latest owner setting, never another owner or first default',()=>{
 const older=makePresetRules('a',{...values,corporate:true},k=>'old_'+k,1);
 const newer=makePresetRules('a',values,k=>'new_'+k,2);
 const legacy=[...older,...newer].map(({presetKey,...r})=>r);
 const result=effectiveAlertRules([...legacy,...makePresetRules('b',values,k=>'b_'+k,3)],'a');
 assert.equal(result.length,3);assert.equal(presetsFromRules(result).corporate,false);
 const canonical=makePresetRules('a',{...values,corporate:true},k=>'canonical_'+k,4);
 assert.equal(presetsFromRules(effectiveAlertRules([...legacy,...canonical],'a')).corporate,true);
});
test('custom create retry/edit does not duplicate, is owner-scoped and refresh sees external deletion',async()=>{
 await dao.saveAlertRule(custom,'alice');await dao.saveAlertRule({...custom,name:'Changed'},'alice');
 assert.equal([...rows.values()].filter(r=>r.id===custom.id).length,1);
 await assert.rejects(()=>dao.saveAlertRule(custom,'bob'),{status:404});
 assert.equal(await dao.deleteAlertRule(custom.id,'bob'),false);
 assert.equal((await dao.getAllAlertRules('bob')).some(r=>r.id===custom.id),false);
 await dao.initAlertRulesFromCloud();rows.delete(custom.id);
 const snapshot=await dao.initAlertRulesFromCloud();assert.equal(snapshot.some(r=>r.id===custom.id),false);
});
test('durable failures never claim local success or empty settings',async()=>{
 fail=true;
 try {await assert.rejects(()=>dao.saveAlertPresets(values,'alice'),{status:503});await assert.rejects(()=>dao.getAllAlertRules('alice'),{status:503});await assert.rejects(()=>dao.initAlertRulesFromCloud(),{status:503});}
 finally{fail=false;}
});
test('specific ticker resolves company scrip; unrelated scrip and keywords are rejected',()=>{
 const rule={...custom,userId:'alice',createdAt:1} as any;
 const filing={companyName:'Tata Consultancy Services Ltd',scripCode:'532540',subject:'Share buyback announcement',priority:'HIGH'};
 const matched=dao.evaluateAlertRulesForUser(filing,'alice',[rule]);assert.equal(matched.matchedRules.some(r=>r.id===rule.id),true);assert.equal(matched.shouldSendTelegram,false);
 assert.equal(dao.evaluateAlertRulesForUser({...filing,scripCode:'500325'},'alice',[rule]).matchedRules.some(r=>r.id===rule.id),false);
 assert.equal(dao.evaluateAlertRulesForUser(filing,'alice',[{...rule,excludeKeywords:['buyback']}]).matchedRules.some(r=>r.id===rule.id),false);
});
test('corporate preset covers buybacks, while disabled presets do not match',()=>{
 const rules=makePresetRules('alice',{...values,corporate:true},k=>'preset_'+k);
 assert.equal(dao.evaluateAlertRulesForUser({subject:'Buy-back of shares',priority:'MEDIUM'},'alice',rules).shouldSendInApp,true);
 assert.equal(dao.evaluateAlertRulesForUser({subject:'Buy-back of shares',priority:'HIGH'},'alice',makePresetRules('alice',values,k=>'preset_'+k)).shouldSendInApp,false);
});
test('malformed custom rules and reserved IDs cannot create unsafe records',async()=>{
 await assert.rejects(()=>dao.saveAlertRule({...custom,enabled:'false'},'alice'),{status:400});
 await assert.rejects(()=>dao.saveAlertRule({...custom,id:'preset_other'},'alice'),{status:400});
 await assert.rejects(()=>dao.saveAlertRule({...custom,symbols:[]},'alice'),{status:400});
 assert.equal(await dao.toggleAlertRule('preset_results',false,'alice'),false);
});
