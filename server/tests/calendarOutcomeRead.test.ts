import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';
import { hasExactScripCode, projectFilingIdentity } from '../../src/shared/scripMatching.js';
import { isBseFiling } from '../../src/shared/filingSource.js';
import { isVerifiedResultFiling } from '../../src/shared/resultFiling.js';
const row=(id:string,patch:any={})=>({id,scrip_cd:'532497',data:{subject:'Financial results for quarter ended September 30, 2026',category:'RESULTS',bseTimestamp:1793091061000,...patch}});
function harness(respond:(url:URL)=>Response|Promise<Response>) {
 const urls:URL[]=[];
 const client=createClient('https://offline.supabase.co','fixture-service-key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(input)=>{const url=new URL(String(input));urls.push(url);return respond(url);}}});
 const exports:any={};const dependencies:any={
 '../database/supabase.js':{getSupabase:()=>client,isSupabaseConfigured:()=>true},
 '../../src/shared/scripMatching.js':{hasExactScripCode,projectFilingIdentity},
 '../../src/shared/filingSource.js':{isBseFiling},'../../src/shared/resultFiling.js':{isVerifiedResultFiling}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('server/services/calendarOutcomeRead.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,AbortSignal,console,require:(name:string)=>dependencies[name]});
 return {read:exports.readCalendarOutcomes as (codes:string[],since:number)=>Promise<any[]>,urls};
}
test('durable read uses exact batched codes and rejects notice, wrong code, NSE and conflicting aliases',async()=>{
 const h=harness(()=>Response.json([row('valid'),row('notice',{subject:'Board meeting scheduled to consider financial results'}),row('conflict',{scripCode:'500049'}),row('nse',{source:'NSE'}),{...row('wrong'),scrip_cd:'500049'}]));
 const result=await h.read(['532497','bad','532497'],1793039400000);
 assert.equal(JSON.stringify(result.map(r=>r.id)),JSON.stringify(['valid']));
 assert.equal(h.urls[0].searchParams.get('scrip_cd'),'in.(532497)');assert.equal(h.urls[0].searchParams.get('fetched_at'),'gte.1793039400000');
 assert.match(h.urls[0].searchParams.get('or')!,/data->>subject.ilike/);
});
test('same batch coalesces concurrent reads and keyset paging reaches evidence past first page',async()=>{
 let count=0;const h=harness(async()=>{count++;await new Promise(r=>setTimeout(r,5));return Response.json(count===1?Array.from({length:500},(_,i)=>row(String(i).padStart(4,'0'),{subject:'Board meeting outcome'})):[row('radico')]);});
 const [a,b]=await Promise.all([h.read(['532497'],1),h.read(['532497'],1)]);
 assert.equal(count,2);assert.equal(a[0].id,'radico');assert.equal(b[0].id,'radico');assert.equal(h.urls[1].searchParams.get('id'),'gt.0499');
});
test('storage failure and bounded incomplete coverage stay unavailable instead of successful empty',async()=>{
 const fail=harness(()=>Response.json({message:'storage unavailable'},{status:503}));await assert.rejects(fail.read(['532497'],1),/unavailable/);
 let page=0;const capped=harness(()=>Response.json(Array.from({length:500},(_,i)=>row(String(page++*500+i).padStart(8,'0')))));
 await assert.rejects(capped.read(['532497'],1),/coverage incomplete/);assert.equal(capped.urls.length,8);
});
