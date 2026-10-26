import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selectPersonalResults,personalStoryChapters,watchlistTerms} from '../../src/utils/forYou';
import {selectHomeNews} from '../../src/utils/homeNews';
import {resultTimingHistory} from '../../src/utils/resultTiming';
const now=Date.parse('2026-10-26T10:00:00+05:30');
const lists=[{is_active:1,items:[{symbol:'HDFCBANK',scripCode:'500180',companyName:'HDFC Bank Ltd'}]},{is_active:0,items:[{symbol:'TCS',scripCode:'532540'}]}];
test('For You selects exact active-list results before limiting and retains today declarations',()=>{
 const rows=[...Array.from({length:10},(_,i)=>({id:'other'+i,symbol:'TCS',scripCode:'532540',meetingTimestamp:now,daysLeft:0})),{id:'ours',symbol:'HDFCBANK',scripCode:'500180',meetingTimestamp:now,daysLeft:0,isDeclared:true},{id:'wrong',symbol:'HDFCBANK',scripCode:'500001',meetingTimestamp:now,daysLeft:0}];
 assert.deepEqual(selectPersonalResults(rows,lists,now).map(x=>x.id),['ours']);
 assert.deepEqual(selectPersonalResults(rows,[],now),[]);
 assert.ok(watchlistTerms(lists).includes('HDFC Bank'));assert.ok(!watchlistTerms(lists).includes('TCS'));
});
test('strict news has no macro fallback and matches a full company name or exact ticker',()=>{
 const base={source:'Publisher',snippet:'',publishedAt:'2026-10-26T08:00:00Z',category:'market'};
 const news=[{...base,id:'macro',title:'RBI repo rate cut',link:'https://example.com/macro'},{...base,id:'ours',title:'HDFC Bank announces results',link:'https://example.com/ours'},{...base,id:'other',title:'TCS announces results',link:'https://example.com/other'}];
 assert.deepEqual(selectHomeNews(news,watchlistTerms(lists),now,true).map(x=>x.id),['ours']);
 assert.deepEqual(selectHomeNews(news,[],now,true),[]);
});
test('personal stories remove macro slides and filter mixed-company result lists',()=>{
 const company={symbol:'HDFCBANK',scripCode:'500180',name:'HDFC Bank'};
 const chapters:any=[{id:'market-pulse',slides:[{id:'macro',layout:'metric',subject:{kind:'topic',topic:'market-pulse'}}]},{id:'earnings-radar',slides:[{id:'results',layout:'list',subject:{kind:'topic',topic:'earnings-radar'},items:[{id:'ours',company},{id:'other',company:{symbol:'TCS',scripCode:'532540'}}]}]}];
 const selected=personalStoryChapters(chapters,['500180']);assert.equal(selected.length,1);assert.deepEqual((selected[0].slides[0] as any).items.map((x:any)=>x.id),['ours']);assert.deepEqual(personalStoryChapters(chapters,[]),[]);
});
const result=(quarter:string,time:string)=>({quarterKey:quarter,status:'Declared',isOutcome:true,exactDateTimeStr:time});
test('timing uses first declared filing per quarter and separates a three-of-four 1-hour window from an exception',()=>{
 const rows=[result('Q1','10 Jul 2026, 15:29:00 IST'),result('Q2','10 Oct 2026, 16:25:00 IST'),result('Q3','10 Jan 2026, 16:28:00 IST'),result('Q4','10 Apr 2026, 21:00:00 IST'),result('Q1','10 Jul 2026, 18:00:00 IST'),{quarterKey:'notice',status:'Meeting Today',submissionTimestamp:now},{quarterKey:'unknown',isOutcome:true,declarationDate:'10 Apr 2026'}];
 const timing=resultTimingHistory(rows,now);assert.equal(timing.points.length,4);assert.equal(timing.window?.duration,60);assert.equal(timing.window?.count,3);assert.deepEqual(timing.exceptions.map(x=>x.quarter),['Q4']);assert.equal(timing.points.find(x=>x.quarter==='Q1')?.minute,15*60+29);
 assert.equal(resultTimingHistory(rows.slice(0,2),now).window,null);
});
test('timing supports midnight clusters, explicit IST, missing clocks and future rejection',()=>{
 const rows=[result('a','10 Jan 2026, 23:40:00 IST'),result('b','10 Apr 2026, 23:50:00 IST'),result('c','11 Jul 2026, 00:20:00 IST'),result('d','10 Oct 2026, 12:00:00 IST'),result('future','10 Jan 2027, 12:00:00 IST')];
 const timing=resultTimingHistory(rows,now);assert.equal(timing.window?.count,3);assert.equal(timing.window?.duration,60);assert.equal(timing.points.length,4);assert.deepEqual(timing.exceptions.map(x=>x.quarter),['d']);
 assert.deepEqual(resultTimingHistory([{quarterKey:'dateonly',isOutcome:true,declarationDate:'10 Apr 2026',fetched_at:now}],now).points,[]);
});
