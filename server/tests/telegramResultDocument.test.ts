import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { PDFParse } from 'pdf-parse';
import { isValidTelegramResultSummary, telegramResultIdentity } from '../utils/telegramResultPolicy.js';
import { renderGroundedResult, RESULT_EXTRACTION_INSTRUCTION } from '../utils/resultAnalysis.js';
import { isBseFiling } from '../../src/shared/filingSource.js';

const extracted = { basis: 'consolidated', basisEvidence: 'Consolidated financial results', unit: 'crore', unitEvidence: 'Rupees in crore', kind: 'quarter', periodEnd: '2026-09-30', headerEvidence: 'Quarter ended 30 September 2026', columns: [{ end: '2026-09-30', kind: 'quarter' }], revenue: { label: 'Revenue from operations', rowEvidence: 'Revenue from operations 100', values: [100] }, profit: { label: 'Net profit', rowEvidence: 'Net profit 20', values: [20] } };
const result = JSON.stringify(extracted);

function pdf() {
  const content='BT /F1 8 Tf 20 700 Td (Consolidated financial results Rupees in crore Quarter ended 30 September 2026 Revenue from operations 100 Net profit 20) Tj ET';
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Length '+content.length+' >>\nstream\n'+content+'\nendstream'];
  let data='%PDF-1.4\n';const offsets=[0];
  for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(data));data+=(i+1)+' 0 obj\n'+objects[i]+'\nendobj\n';}
  const start=Buffer.byteLength(data);data+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(x=>String(x).padStart(10,'0')+' 00000 n \n').join('');
  data+='trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+start+'\n%%EOF\n';
  return Buffer.concat([Buffer.from(data),Buffer.alloc(6*1024*1024,32)]);
}

function harness(body: Buffer, cached='', breaker='CLOSED', modelResult=result) {
  let modelCalls=0,replyCalls=0;const cacheWrites:any[]=[];const prompts:any[]=[];const exports:any={};
  const code=ts.transpileModule(fs.readFileSync('server/services/gemini.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const dependencies:any={
    '../utils/bseDocument.js':{fetchExchangeDocument:async()=>new Response(new Uint8Array(body)),readBoundedDocument:async()=>body},
    './telegram.js':{sendReplyToTelegram:async()=>{replyCalls++;return {success:true};}},
    '../database/logDao.js':{addLog:async()=>{}},
    '../database/announcementDao.js':{getAnnouncementById:async()=>cached?{aiSummaryEn:cached}:null,updateAnnouncementSummary:async(...args:any[])=>{cacheWrites.push(args);}},
    '../utils/circuitBreaker.js':{geminiCircuitBreaker:{getState:()=> breaker,execute:async(fn:()=>any)=>fn()}},
    './ai/modelRegistry.js':{hasAnyAiProvider:()=>true},
    './ai/aiGateway.js':{aiComplete:async(_task:string,options:any)=>{modelCalls++;prompts.push(options);return {text:modelResult,provider:'test',modelId:'test'};}},
    '../utils/telegramResultPolicy.js':{isValidTelegramResultSummary,telegramResultIdentity},
    '../utils/resultAnalysis.js':{renderGroundedResult,RESULT_EXTRACTION_INSTRUCTION},
    '../../src/shared/filingSource.js':{isBseFiling},
    './telegramResultSummary.js':{deliverTelegramResultSummary:async(_input:any,deps:any)=>{const text=await deps.generate();if(text)await deps.send(text);return text?'sent':'invalid';}},
    '../database/telegramResultDao.js':{telegramResultStore:{}},
    'pdf-parse':{PDFParse},
  };
  vm.runInNewContext(code,{exports,Buffer,Uint8Array,Response,AbortSignal,setTimeout,clearTimeout,console,process:{env:{}},require:(name:string)=>dependencies[name]||{}});
  return {run:(pdfLink='https://www.bseindia.com/xml-data/corpfiling/AttachLive/result.pdf')=>exports.generateAndSendSummary(1,'Test company','Financial results for quarter ended September 30, 2026','','RESULTS',pdfLink,'result-id','test-chat','english','532477'),stats:()=>({modelCalls,replyCalls,prompts,cacheWrites})};
}
test('large PDFs use pdf-parse v2 and real extracted text reaches the result model',async()=>{
  const h=harness(pdf());await h.run();const stats=h.stats();
  assert.equal(stats.modelCalls,1);assert.equal(stats.replyCalls,1);assert.equal(stats.cacheWrites.length,1);
  assert.match(stats.prompts[0].prompt,/EXTRACTED PDF TEXT/);
  assert.match(stats.prompts[0].prompt,/Revenue from operations 100 Net profit 20/);
  assert.equal(stats.prompts[0].temperature,0);
});
test('NSE documents are not automatically summarized or delivered',async()=>{
  const h=harness(pdf());await h.run('https://nsearchives.nseindia.com/corporate/result.pdf');
  assert.equal(h.stats().modelCalls,0);assert.equal(h.stats().replyCalls,0);
});
test('a missing/HTML document never calls the model or posts a headline-only financial analysis',async()=>{
  const h=harness(Buffer.from('<html>Access denied</html>'));await h.run();
  assert.equal(h.stats().modelCalls,0);assert.equal(h.stats().replyCalls,0);
});
test('poisoned cached templates are ignored rather than sent to Telegram',async()=>{
  const h=harness(Buffer.from('<html>Access denied</html>'),'Please provide the document. Revenue ₹[Current] Cr vs ₹[YoY] Cr (+X.X%)');await h.run();
  assert.equal(h.stats().modelCalls,0);assert.equal(h.stats().replyCalls,0);
});

test('grounded text result bypasses unrelated open Gemini breaker and persists the website language field',async()=>{
  const h=harness(pdf(),'', 'OPEN');await h.run();
  const stats=h.stats();assert.equal(stats.modelCalls,1);assert.equal(stats.replyCalls,1);
  assert.equal(stats.cacheWrites.length,1);assert.equal(stats.cacheWrites[0][0],'result-id');
  assert.equal(stats.cacheWrites[0][2],'english');assert.match(stats.cacheWrites[0][1],/Revenue.*100 crore/);
});
test('unvalidated model prose is neither cached nor delivered',async()=>{
  const h=harness(pdf(),'', 'OPEN','Revenue +999% PAT +999%');await h.run();
  assert.equal(h.stats().cacheWrites.length,0);assert.equal(h.stats().replyCalls,0);
});
