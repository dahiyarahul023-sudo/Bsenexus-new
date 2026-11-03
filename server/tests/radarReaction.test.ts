import {test} from 'node:test';
import assert from 'node:assert/strict';
import {firstFullReactionSession,reactionMorning,reactionFact,evaluateRadarReaction,isRadarReaction,RADAR_CALENDAR_2026} from '../../src/shared/radarReaction';
import {createRadarReactionLearning} from '../services/radarReactionLearning';
import {matchesReactionView} from '../../src/components/RadarReactionBrief';
import type {RadarEvent,RadarUpdate} from '../../src/shared/impactRadar';
const company={symbol:'YESBANK',scripCode:'532648',name:'Yes Bank Ltd'};
const event:RadarEvent={id:'case-1',title:'Court granted interim stay',companies:[company],category:'legal',authority:'High Court',status:'monitoring',scheduledDate:null,scheduleConfirmed:false,information:'The court granted an interim stay on the adjudication order.',nextTrigger:null,source:{name:'BSE',kind:'disclosure',url:'https://www.bseindia.com/report.pdf'},publishedAt:'2026-11-02T12:00:00Z',updatedAt:'2026-11-02T12:00:00Z'};
const update:RadarUpdate={id:'report-1',eventId:event.id,title:event.title,information:event.information,source:event.source,publishedAt:event.publishedAt};
const price=(date='2026-11-03',close=105,previousClose=100)=>({date,symbol:'YESBANK',series:'EQ',close,previousClose,changePercent:(close/previousClose-1)*100,sourceUrl:`https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_${date.replaceAll('-','')}_F_0000.csv.zip`});
const after=Date.parse('2026-11-03T12:00:00Z');
test('full reaction session obeys IST publication time, weekends, dated holidays, Muhurat, and unknown year',()=>{
 assert.equal(firstFullReactionSession('2026-11-03T03:00:00Z'),'2026-11-03');
 assert.equal(firstFullReactionSession('2026-11-03T09:00:00Z'),'2026-11-04');
 assert.equal(firstFullReactionSession('2026-10-16T12:00:00Z'),'2026-10-19');
 assert.equal(firstFullReactionSession('2026-11-09T12:00:00Z'),'2026-11-11');
 assert.equal(firstFullReactionSession('2026-11-06T12:00:00Z'),'2026-11-08');
 assert.equal(firstFullReactionSession('2027-01-04T03:00:00Z'),null);
 assert.equal(reactionMorning(update.publishedAt,Date.parse('2026-11-03T03:00:00Z'),'2026-11-03'),true);
 assert.equal(reactionMorning(update.publishedAt,Date.parse('2026-11-03T06:00:00Z'),'2026-11-03'),false);
});
test('extract saved wording and distinguish granted relief from requests or refused relief',()=>{
 assert.equal(reactionFact('Court granted interim stay','The court granted an interim stay.').key,'relief');
 for(const title of ['Court refused interim stay','Company seeking interim stay','No penalty imposed'])assert.notEqual(reactionFact(title,'').key,title.includes('penalty')?'liability':'relief');
 assert.equal(reactionFact('Licence revoked','Operating licence has been revoked.').key,'licence');
});
test('missing data is never quiet, publication-day movement never leaks into the next full-session reaction or baseline',()=>{
 const intra={...update,publishedAt:'2026-11-03T09:00:00Z'};
 const r=evaluateRadarReaction(event,intra,company,[price('2026-11-03',120)],Date.parse('2026-11-04T12:00:00Z'));
 assert.equal(r.state,'awaiting-data');assert.equal(r.observation,undefined);
 const waiting=evaluateRadarReaction(event,update,company,[price()],Date.parse('2026-11-03T03:00:00Z'));
 assert.equal(waiting.state,'awaiting-session');assert.equal(waiting.observation,undefined);
 const other=evaluateRadarReaction(event,update,company,[{...price(),symbol:'OTHER'}],after);assert.equal(other.state,'awaiting-data');
});
test('close/range thresholds, sufficient pre-news baseline, factual source and exact company survive validation',()=>{
 const history=Array.from({length:12},(_,i)=>price(new Date(Date.parse('2026-11-01')-i*86400000).toISOString().slice(0,10),101));
 const r=evaluateRadarReaction(event,update,company,[price(),...history],after);
 assert.equal(r.state,'observed');assert.equal(r.observation?.volatile,true);assert.equal(r.observation?.unusual,true);assert.equal(r.observation?.baselineCount,12);assert.equal(isRadarReaction(r),true);
 assert.equal(isRadarReaction({...r,source:{...r.source,url:'javascript:alert(1)'}}),false);
 assert.equal(isRadarReaction({...r,fact:'toString'}),false);
 const quiet=evaluateRadarReaction(event,update,company,[price('2026-11-03',100)],after);assert.equal(quiet.observation?.volatile,false);assert.equal(quiet.observation?.unusual,null);
 const range=evaluateRadarReaction(event,update,company,[{...price('2026-11-03',100),high:104,low:98}],after);assert.equal(range.observation?.volatile,true);
});
test('morning / pending / observed filters use latest company evidence, never an older volatile follow-up',()=>{
 const observed=evaluateRadarReaction(event,update,company,[price()],after);
 const later=evaluateRadarReaction(event,{...update,id:'report-2',publishedAt:'2026-11-03T13:00:00Z'},company,[],after+3600000);
 const research={status:'ready' as const,rows:[observed,later],patterns:[],checkedAt:new Date(after).toISOString()};
 assert.equal(matchesReactionView(event,research,'volatile',after),false);
 assert.equal(matchesReactionView(event,research,'pending',after),true);
});
test('worker coalesces, saves without visits, advances durable cursor only after writes and retries failure',async()=>{
 let now=after,writes=0,cursors=0,fail=false;const log:string[]=[];
 const sync=createRadarReactionLearning({now:()=>now,candidates:async()=>({items:[{event,update}],cursor:'report-1'}),calendar:async()=>RADAR_CALENDAR_2026,prices:async()=>[price()],save:async rows=>{writes++;assert.equal(rows[0].state,'observed');if(fail)throw Error('storage');},cursor:async()=>{cursors++},log:l=>log.push(l)});
 await Promise.all([sync(),sync(),sync()]);assert.equal(writes,1);assert.equal(cursors,1);
 await sync();assert.equal(writes,1);now+=300000;fail=true;await sync();assert.equal(cursors,1);assert.match(log.at(-1)!,/"failed":true/);
 now+=60000;fail=false;await sync();assert.equal(cursors,2);
});
test('interim/final scope and monetary amounts retain exact saved wording instead of guessing exposure',()=>{
 const r=evaluateRadarReaction(event,{...update,information:'The final order imposed a penalty of Rs. 12.5 crore.'},company,[],after);
 assert.equal(r.scope,'interim','the source title still explicitly says interim');assert.deepEqual(r.amounts,['Rs. 12.5 crore']);
 const final=evaluateRadarReaction({...event,title:'Final order'},{...update,title:'Final order',information:'The final order imposed a penalty of ₹10 crore.'},company,[],after);
 assert.equal(final.scope,'final');assert.deepEqual(final.amounts,['₹10 crore']);
});
