import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hasCalendarResultToday} from '../../src/shared/watchlistResultStatus';
import {isVerifiedResultFiling} from '../../src/shared/resultFiling';
import {detectHumanTitle} from '../../src/utils/cleanBseSubject';
import {readCompanyIntelSnapshot,storeCompanyIntelSnapshot,clearCompanyIntelSnapshots} from '../../src/utils/companyIntelSnapshots';
import {createCurrentResultVerifier} from '../services/currentResultEvidence';

const now=Date.parse('2026-11-03T13:30:00Z');
const meeting={scripCode:'532725',meetingTimestamp:Date.parse('2026-11-02T18:30:00Z'),isDeclared:true,resultDeclarationTime:'2026-11-03T14:01:13'};
test('Watchlist declaration requires the exact verified calendar Today record and actual IST publication day',()=>{
 assert.equal(hasCalendarResultToday([meeting],'532725',now),true);
 for(const patch of [{scripCode:'500477'},{isDeclared:false},{meetingTimestamp:Date.parse('2026-11-04T00:00:00+05:30')},{resultDeclarationTime:'2026-11-02T14:01:13'},{resultDeclarationTime:'2026-11-03T23:01:13'}])assert.equal(hasCalendarResultToday([{...meeting,...patch}],'532725',now),false);
 assert.equal(hasCalendarResultToday([],'532725',now),false);
});
test('the screenshot Ashok Leyland notice and generic board outcome cannot declare results by category or audited wording',()=>{
 const subject='Ashok Leyland Ltd - 500477 - Board Meeting Intimation for To Inter-Alia Consider And Approve The Unaudited Financial Results Of The Company For The Period Ended September 30, 2026';
 assert.equal(isVerifiedResultFiling({subject,category:'RESULTS'}),false);
 assert.equal(detectHumanTitle(subject,'RESULTS'),'Board meeting intimation');
 assert.equal(isVerifiedResultFiling({subject:'Board Meeting Outcome for Outcome Of The Board Meeting Dated November 03, 2026.'}),false);
});
test('same-owner reopen reuses the confirmed snapshot without renewing freshness, while other selections remain isolated',()=>{
 clearCompanyIntelSnapshots();storeCompanyIntelSnapshot('a:532725:SOLAR',{recentFilings:[{id:'one'}]},now);
 assert.equal(readCompanyIntelSnapshot('a:532725:SOLAR',now+14_000)?.at,now);
 assert.equal(readCompanyIntelSnapshot('b:532725:SOLAR',now+14_000),null);
 assert.equal(readCompanyIntelSnapshot('a:500477:ASHOK',now+14_000),null);
 assert.equal(readCompanyIntelSnapshot('a:532725:SOLAR',now+301_000),null);
});
const generic={id:'solar-outcome',newsId:'solar-outcome',scrip_cd:'532725',subject:'Outcome Of Board Meeting Dated November 3, 2026',bseTime:'2026-11-03T14:01:13',pdfLink:'https://www.bseindia.com/xml-data/corpfiling/AttachLive/solar.pdf'};
const proof={version:1 as const,filingId:generic.id,scripCode:'532725',pdfUrl:generic.pdfLink,documentSha256:'a'.repeat(64),checkedAt:new Date(now).toISOString(),verdict:'result' as const,excerpt:'The board considered and approved the unaudited financial results for the quarter ended September 30, 2026.'};
test('a recent generic Solar outcome is verified once across readers, saved without re-import and then reusable',async()=>{
 let calls=0;const saved:any[]=[];
 const verify=createCurrentResultVerifier({now:()=>now,verify:async()=>{calls++;await new Promise(r=>setTimeout(r,5));return proof},save:async row=>{saved.push(row)}});
 const [first,second]=await Promise.all([verify([generic]),verify([generic])]);
 assert.equal(calls,1);assert.equal(saved.length,1);assert.equal(isVerifiedResultFiling(first[0]),true);assert.equal(isVerifiedResultFiling(second[0]),true);
 await verify([generic]);assert.equal(calls,1);
});
test('blocked PDFs back off, old/notice/NSE rows never trigger verification, and unrelated proof cannot declare a row',async()=>{
 let clock=now,calls=0;
 const verifier=createCurrentResultVerifier({now:()=>clock,verify:async()=>{calls++;throw Error('PDF blocked')},save:async()=>assert.fail('No invalid proof may be saved')});
 await verifier([generic]);await verifier([generic]);assert.equal(calls,1);
 clock+=61_000;await verifier([generic]);assert.equal(calls,2);
 await verifier([{...generic,bseTime:'2026-10-01T14:01:13'},{...generic,source:'NSE'},{...generic,subject:'Board Meeting Intimation to consider financial results'}]);assert.equal(calls,2);
 const mismatch=createCurrentResultVerifier({now:()=>now,verify:async()=>({...proof,scripCode:'500477'}),save:async()=>assert.fail()});
 assert.equal(isVerifiedResultFiling((await mismatch([generic]))[0]),false);
});
test('timed-out PDF work retains the global capacity limit and cannot save late proof',async()=>{
 let calls=0;const release:Array<()=>void>=[];
 const verifier=createCurrentResultVerifier({now:()=>now,timeoutMs:10,verify:async item=>{
  calls++;await new Promise<void>(resolve=>release.push(resolve));
  return {...proof,filingId:item.newsId};
 },save:async()=>assert.fail('Timed-out proof must not be saved')});
 const second={...generic,id:'second',newsId:'second'},third={...generic,id:'third',newsId:'third'};
 const first=verifier([generic,second]);
 await new Promise(resolve=>setTimeout(resolve,25));
 assert.equal(isVerifiedResultFiling((await first)[0]),false);
 await verifier([third]);assert.equal(calls,2,'unsettled parsers still occupy both slots');
 release.forEach(resolve=>resolve());
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(isVerifiedResultFiling((await verifier([generic]))[0]),false,'late proof is discarded');
});
