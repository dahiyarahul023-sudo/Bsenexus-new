import { compactWatchlistStock } from "../ai/calendarRead";
import test from 'node:test';
import assert from 'node:assert/strict';
import { companyCandidates, exactCompany, filingsData, formatFiling } from '../ai/market';
import { registerStockEntry, getScripCode, resolveStockDetailsSync } from '../utils/stockResolver';
import { parseTool, TOOL_SPECS, validateRedirect, allowance } from '../ai/policy';
import { renderAiConnectionDocs } from '../ai/docs';
import { AI_DATA_DISCLOSURE } from '../../src/shared/aiDataDisclosure';
import { reviewerFixture } from '../../scripts/provision-ai-reviewer';
const pdf='https://www.bseindia.com/xml-data/corpfiling/AttachLive/test.pdf';
test('verified codes and renamed aliases survive a poisoned legacy stock cache',()=>{
  assert.equal(exactCompany('INDUSINDBK').scripCode,'532187');assert.equal(exactCompany('532209').symbol,'J&KBANK');
  assert.equal(exactCompany('ZOMATO').symbol,'ETERNAL');assert.equal(exactCompany('ETERNAL').name,'Eternal Limited');
  registerStockEntry({symbol:'INDUSINDBK',scripCode:'532209',name:'Corrupt cached bank',nameKeywords:[]});
  registerStockEntry({symbol:'ZOMATO',scripCode:'543320',name:'Zomato Ltd',nameKeywords:[],sector:'Consumer services'});
  assert.equal(exactCompany('ZOMATO').sector,'Consumer services');
  const legacy=compactWatchlistStock({symbol:'INDUSINDBK',scripCode:'532209',companyName:'IndusInd Bank'});assert.equal(legacy.symbol,'J&KBANK');assert.equal(legacy.identityConflict,true);
  assert.equal(getScripCode('INDUSINDBK'),'532187');assert.equal(resolveStockDetailsSync('532209')?.name,'Jammu and Kashmir Bank Ltd');assert.equal(exactCompany('ZOMATO').symbol,'ETERNAL');
});
test('typo lookup suggests candidates without allowing an approximate write identity',()=>{
  assert.equal(companyCandidates('Relience').length,0);assert.equal(companyCandidates('Relience',true)[0].symbol,'RELIANCE');
  assert.throws(()=>exactCompany('Relience'),/Company identity/);assert.deepEqual(companyCandidates('50032',true),[]);
});
test('cross-exchange copies do not reappear after a page cursor and distinct filings remain',async()=>{
  const rows=[{newsId:'bse-one',scrip_cd:'532540',subject:'Financial Results approved',bseTime:'2026-10-21T10:05:00Z',pdfLink:pdf,exchange:'BSE'},
    {newsId:'nse-copy',scrip_cd:'532540',subject:'Financial Results approved',bseTime:'2026-10-21T10:03:00Z',exchange:'NSE'},
    {newsId:'distinct',scrip_cd:'532540',subject:'Dividend declared',bseTime:'2026-10-21T10:01:00Z',pdfLink:pdf},
    {newsId:'different-company',scrip_cd:'500325',subject:'Financial Results approved',bseTime:'2026-10-21T09:55:00Z',exchange:'NSE'}];
  const source={recent:async()=>rows} as any;const first=await filingsData({limit:1},source);assert.equal(first.deduplicatedCount,1);
  const next=await filingsData({limit:10,before:first.nextBefore!,beforeId:first.nextBeforeId!},source);
  assert.deepEqual(next.filings.map(item=>item.id),['distinct','different-company']);
  const dividend=await filingsData({category:'DIVIDEND'},source);assert.equal(dividend.filings[0].category,'DIVIDEND');assert.ok(dividend.filings[0].categories.includes('DIVIDEND'));
  assert.throws(()=>parseTool('filings_search',{category:'arbitrary'}));assert.equal(parseTool('filings_search',{category:'dividend'}).args.category,'DIVIDEND');
});
test('missing identity never creates an empty filing URL, and bounded text exposes legacy truncation',()=>{
  const item=formatFiling({newsId:'one',subject:"Company update today''s <b>notice</b>",details:'Stored summary....',scrip_cd:'532540'});
  assert.equal(item.symbol,'TCS');assert.equal(item.summaryTruncated,true);assert.ok(!item.headline.includes('<b>'));assert.ok(item.headline.includes("today's"));assert.ok(!item.nexusUrl.includes('/filing//'));
  assert.equal(formatFiling({newsId:'unknown',subject:'No security'}).nexusUrl,'');
  assert.equal(formatFiling({newsId:'prefix',scrip_cd:'532540',subject:'TCS - 532540 - Dividend announced'}).headline,'Dividend announced');
  assert.equal(formatFiling({newsId:'long-prefix',scrip_cd:'532540',subject:'Tata Consultancy Services Ltd., - 532540 - Dividend announced'}).headline,'Dividend announced');
});
test('tool contracts are factual, named, bounded and reflect available result records',()=>{
  assert.equal(Object.keys(TOOL_SPECS).length,22);
  for(const [name,spec] of Object.entries(TOOL_SPECS)){assert.ok(spec.title.length>3);assert.ok(name.length<=64);assert.doesNotMatch(spec.description,/\bask the user|Preserve requestId|Resolve ambiguous|No need to fetch|Include source links/);}
  assert.match(TOOL_SPECS.results_read.description,/not extracted/);assert.match(TOOL_SPECS.filing_summary.description,/official exchange PDF/);
});
test('OAuth loopback ports are permitted only for exact local native callback hosts',()=>{
  for(const uri of ['https://claude.ai/api/mcp/auth_callback','http://localhost:51473/callback','http://127.0.0.1:59232/oauth/callback'])assert.equal(validateRedirect(uri),uri);
  for(const uri of ['http://127.1/cb','http://localhost.evil.example/cb','http://localhost@evil.example/cb','http://127.0.0.2/cb','https://localhost/cb','http://localhost:33/cb#secret'])assert.throws(()=>validateRedirect(uri));
});
test('reviewer allowances expire and never affect a normal account or grant paid access',()=>{
  const uid='mcp-reviewer-00000000-0000-0000-0000-000000000123',oldUid=process.env.AI_REVIEWER_UID,oldExpiry=process.env.AI_REVIEWER_UNTIL;
  process.env.AI_REVIEWER_UID=uid;process.env.AI_REVIEWER_UNTIL=new Date(Date.now()+86400000).toISOString();
  try {assert.equal(allowance(false,uid).daily,1000);assert.equal(allowance(true,'alice').daily,200);assert.equal(allowance(false,'alice').daily,20);process.env.AI_REVIEWER_UNTIL=new Date(Date.now()-1).toISOString();assert.equal(allowance(false,uid).daily,20);assert.throws(()=>reviewerFixture('alice'));assert.equal(reviewerFixture(uid).list.items.length,2);}
  finally {if(oldUid===undefined)delete process.env.AI_REVIEWER_UID;else process.env.AI_REVIEWER_UID=oldUid;if(oldExpiry===undefined)delete process.env.AI_REVIEWER_UNTIL;else process.env.AI_REVIEWER_UNTIL=oldExpiry;}
});
test('public documentation includes all tool names, examples, partial coverage and the same privacy disclosures',()=>{
  const html=renderAiConnectionDocs();for(const name of ['get_profile',...Object.keys(TOOL_SPECS)])assert.ok(html.includes(name));
  for(const text of ['Register automatically','completeMarket: false','not extracted','200 calls/day','25 MiB','admin@bsenexus.in'])assert.ok(html.includes(text),text);
  for(const section of AI_DATA_DISCLOSURE)assert.ok(html.includes(section.title));
});
