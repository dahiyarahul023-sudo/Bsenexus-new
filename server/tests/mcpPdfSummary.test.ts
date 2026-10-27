import test from 'node:test';
import assert from 'node:assert/strict';
import { createFilingPdfSummarizer, cachedFilingSummary, filingSummaryVersion } from '../ai/filingSummary';
import { createAiToolRunner } from '../ai/tools';
const item={id:'filing-one',newsId:'filing-one',scrip_cd:'532540',companyName:'TCS',subject:'Financial results',details:'Stored headline only',pdfLink:'https://www.bseindia.com/xml-data/corpfiling/AttachLive/test.pdf',aiSummaryEn:'Old headline heuristic'};
const english='The attached filing reports the approved financial results and the accompanying disclosures. No unsupported comparison is included.';
const hinglish='Attached filing mein approved financial results aur related disclosures diye gaye hain. Figures original PDF se verify karne chahiye.';
const complete=(text=english,language='english')=>(async()=>({text:JSON.stringify({summary:text,language}),provider:'gemini',modelAlias:'fixture-model'})) as any;
const pdfFetch=(async()=>new Response('%PDF-1.7 fixture official document',{status:200})) as any;
test('PDF analysis uses official bytes, requested language and visible provenance; legacy heuristic cache is excluded',async()=>{
  let input:any;const generate=createFilingPdfSummarizer({fetch:pdfFetch,complete:(async(_task:any,options:any)=>{input=options;return complete()()}) as any});
  const result=await generate(item,'english');assert.ok(input.pdfInline.data);assert.equal(input.jsonMode,true);assert.equal(result.documentCoverage,'full_pdf');assert.equal(result.documentAnalyzed,true);assert.equal(result.language,'english');assert.match(result.documentSha256,/^[a-f0-9]{64}$/);assert.doesNotMatch(result.summary,/</);
  assert.equal(cachedFilingSummary(item,'english'),null);assert.equal(cachedFilingSummary({...item,aiConnectionSummaryEn:result},'english')?.summary,english);
  assert.equal(cachedFilingSummary({...item,subject:'Corrected',aiConnectionSummaryEn:result},'english'),null);
  assert.equal((await createFilingPdfSummarizer({fetch:pdfFetch,complete:complete(hinglish,'hinglish')})(item,'hinglish')).language,'hinglish');
});
test('unsafe/missing PDFs, unreadable content, invalid language and unavailable providers never return a heuristic success',async()=>{
  let calls=0;const ai=(async()=>{calls++;throw new Error('provider unavailable')}) as any;
  const generate=createFilingPdfSummarizer({fetch:pdfFetch,complete:ai});
  await assert.rejects(generate({...item,pdfLink:'http://127.0.0.1/private'},'english'),(e:any)=>e.code==='document_unavailable');assert.equal(calls,0);
  await assert.rejects(createFilingPdfSummarizer({fetch:(async()=>new Response('<html>not PDF</html>')) as any,complete:ai})(item,'english'));assert.equal(calls,0);
  await assert.rejects(generate(item,'english'),(e:any)=>e.code==='generation_unavailable');
  await assert.rejects(createFilingPdfSummarizer({fetch:pdfFetch,complete:complete(english,'hinglish')})(item,'hinglish'),(e:any)=>e.code==='generation_unavailable');
});
test('large PDFs disclose extracted-text truncation instead of claiming full-document analysis',async()=>{
  const bytes=Buffer.concat([Buffer.from('%PDF-'),Buffer.alloc(6*1024*1024)]);let prompt='';
  const generate=createFilingPdfSummarizer({fetch:(async()=>new Response(bytes)) as any,extract:async()=> 'Document facts. '.repeat(6000),complete:(async(_task:any,options:any)=>{prompt=options.prompt;assert.equal(options.pdfInline,undefined);return complete()()}) as any});
  const result=await generate(item,'english');assert.equal(result.documentCoverage,'extracted_text');assert.equal(result.inputTruncated,true);assert.ok(JSON.parse(prompt).documentText.length<=80000);
});
function runnerFixture(pro=true,fail=false,cached=false) {
  const count={consumed:0,refunded:0,claimed:0,released:0,generated:0,cached:0};
  const evidence={summary:english,language:'english',generationMode:'pdf_ai',documentAnalyzed:true,documentCoverage:'full_pdf',inputTruncated:false,summaryTruncated:false,pdfUrl:item.pdfLink,sourceVersion:filingSummaryVersion(item),documentSha256:'a'.repeat(64),generatedAt:new Date().toISOString(),provider:'gemini',model:'fixture',schemaVersion:1} as const;
  const run=createAiToolRunner({state:async()=>({grant:{uid:'alice',id:'grant',scopes:['analysis:generate']},profile:{uid:'alice'},pro,limits:{daily:200,perMinute:20,writes:50}}) as any,rpc:async()=>({remaining:20}),filing:async()=>({...item,...(cached?{aiConnectionSummaryEn:evidence}:{})}) as any,summarize:async()=>{count.generated++;if(fail)throw new Error('provider failed');return evidence;},cacheSummary:()=>{count.cached++},db:async action=>{const q={update:()=>q,eq:()=>q,is:()=>q,select:async()=>({data:[{request_id:'test'}],error:null})};const r=await action({from:()=>q} as any);return r.data;},quota:{consume:async()=>{count.consumed++;return {allowed:true,reservationId:'quota-id'} as any},refund:async()=>{count.refunded++},complete:()=>{},claimFree:async()=>{count.claimed++;return true},releaseFree:async()=>{count.released++}}});
  return {run,count};
}
test('real tool runner refunds Pro generation or releases free demo on provider failure; validated cache uses neither',async()=>{
  for(const pro of [true,false]){const {run,count}=runnerFixture(pro,true);await assert.rejects(run('token','filing_summary',{filingId:'filing-one',requestId:'request_summary_01'}));assert.equal(count.refunded,pro?1:0);assert.equal(count.released,pro?0:1);}
  const cached=runnerFixture(true,false,true);const result=await cached.run('token','filing_summary',{filingId:'filing-one',requestId:'request_summary_02'});assert.equal(result.cached,true);assert.equal(cached.count.consumed,0);assert.equal(cached.count.generated,0);
  const fresh=runnerFixture();assert.equal((await fresh.run('token','filing_summary',{filingId:'filing-one',requestId:'request_summary_03'})).generationMode,'pdf_ai');assert.equal(fresh.count.cached,1);
});
