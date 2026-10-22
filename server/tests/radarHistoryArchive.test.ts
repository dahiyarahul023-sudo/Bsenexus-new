import {test} from 'node:test';
import assert from 'node:assert/strict';
import {radarCaseIdentity} from '../services/radarCaseIdentity.js';
import {archiveHash,decodeRadarArchive,encodeRadarArchive,verifyArchiveCopies,type RadarArchive} from '../services/radarArchive.js';
import {parseRadarHistoryQuery} from '../database/radarHistoryDao.js';
import {computeRadarResearch,isRadarResearch,publicRadarResearch,type RadarMarketDay} from '../../src/shared/radarResearch.js';
import type {RadarSessionMove} from '../../src/shared/radarMovement.js';
const source={name:'BSE disclosure',kind:'disclosure' as const,url:'https://www.bseindia.com/report.pdf'};
const time='2024-10-10T04:00:00.000Z';
const event={id:'history-case',title:'Supreme Court of India civil appeal no 123/2024 hearing',companies:[{symbol:'PNCINFRA',name:'PNC Infratech Ltd',scripCode:'539150'}],category:'legal',authority:'Supreme Court',status:'closed' as const,scheduledDate:null,scheduleConfirmed:false,information:'A source-backed court order.',nextTrigger:null,source,publishedAt:time,updatedAt:time};
const update={id:'history-source',eventId:event.id,title:event.title,information:event.information,source,publishedAt:time};
const snapshot:RadarArchive={version:1,event,firstPublicAt:time,eventVersion:time,updates:[update],updateDigest:'a'.repeat(32),research:null};
test('same company, source and generic reference cannot join different dates/developments',()=>{
  const a=radarCaseIdentity('539150','SEBI','SEBI appeal no 123/2024 order',source,time);
  const b=radarCaseIdentity('539150','SEBI','SEBI appeal no 123/2024 order',source,'2024-11-10T04:00:00Z');
  assert.notEqual(a.id,b.id);assert.equal(a.kind,'provisional');
  assert.notEqual(a.id,radarCaseIdentity('539150','SEBI','SEBI appeal no 124/2024 order',source,time).id);
});
test('only a complete unambiguous proceeding identity joins sources; appeals and companies stay separate',()=>{
  const a=radarCaseIdentity('539150','Supreme Court',event.title,source,time);
  const b=radarCaseIdentity('539150','Supreme Court',event.title.replace('no','number'),{...source,url:'https://www.bseindia.com/later.pdf'},'2024-11-10T04:00:00Z');
  assert.equal(a.kind,'referenced');assert.equal(a.id,b.id);
  assert.equal(radarCaseIdentity('539150','Supreme Court',event.title.replace(' of India',''),source,time).kind,'provisional','a generic foreign/unknown Supreme Court must not be assigned an Indian proceeding identity');
  assert.equal(radarCaseIdentity('539150','Supreme Court',event.title+' and criminal appeal no 124/2024',source,time).kind,'provisional','multi-proceeding headlines cannot pick one case to merge');
  for(const other of [radarCaseIdentity('539150','Supreme Court',event.title.replace('civil','criminal'),source,time),radarCaseIdentity('500325','Supreme Court',event.title,source,time),radarCaseIdentity('539150','NCLAT',event.title,source,time)])assert.notEqual(a.id,other.id);
});
test('archive compression roundtrips public evidence and rejects corruption, wrong case and decompression mismatch',()=>{
  const bytes=encodeRadarArchive({...snapshot,event:{...event,privateOwner:'never-export'} as any});
  const restored=decodeRadarArchive(bytes,archiveHash(bytes),event.id);
  assert.deepEqual(restored.updates,[update]);assert.ok(!('privateOwner' in restored.event));
  assert.throws(()=>decodeRadarArchive(bytes,'b'.repeat(64),event.id),/checksum/);
  assert.throws(()=>decodeRadarArchive(bytes,archiveHash(bytes),'another-case'),/restore/);
  assert.throws(()=>encodeRadarArchive({...snapshot,updates:[update,update]}),/Invalid/);
  assert.throws(()=>encodeRadarArchive({...snapshot,updates:[{...update,eventId:'wrong'}]}),/Invalid/);
});
test('primary-only archive is not an independent backup; full readback errors never return verified status',async()=>{
  let copy:Buffer;
  const storage={upload:async(_p:string,b:Buffer)=>{copy=b;},download:async()=>copy!};
  assert.equal((await verifyArchiveCopies(snapshot,storage)).backupFileId,null);
  await assert.rejects(verifyArchiveCopies(snapshot,{...storage,download:async()=>Buffer.from('corrupt')}),/checksum/);
  await assert.rejects(verifyArchiveCopies(snapshot,{...storage,backup:async()=>{throw new Error('offline');}}),/offline/);
  await assert.rejects(verifyArchiveCopies(snapshot,{...storage,backup:async()=>({fileId:'backup',bytes:Buffer.from('corrupt')})}),/checksum/);
  assert.equal((await verifyArchiveCopies(snapshot,{...storage,backup:async(_p,b)=>({fileId:'verified-backup',bytes:b})})).backupFileId,'verified-backup');
});
test('history validates dates, bounded search, cursor tuples and control characters',()=>{
  assert.ok(parseRadarHistoryQuery({q:'PNCINFRA',from:'2024-01-01',to:'2026-12-31'}));
  for(const q of [{q:'x'.repeat(121)},{q:['injected']},{q:'<script>'},{q:'bad\nquery'},{from:'2024-02-30'},{from:'2026-01-01',to:'2024-01-01'},{cursor:'bad'},{cursor:Buffer.from(JSON.stringify([time,'bad,id'])).toString('base64url')}])assert.equal(parseRadarHistoryQuery(q),null);
  assert.deepEqual(parseRadarHistoryQuery({cursor:Buffer.from(JSON.stringify([time,event.id])).toString('base64url')})?.before,{time,id:event.id});
});
const price=(date:string,close=100,previousClose=100):RadarSessionMove=>({date,symbol:'PNCINFRA',series:'EQ',close,previousClose,changePercent:(close/previousClose-1)*100,sourceUrl:`https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_${date.replaceAll('-','')}_F_0000.csv.zip`});
const day=(date:string,open=true):RadarMarketDay=>({date,open,exchange:'NSE',sourceUrl:'https://www.nseindia.com/market-data/holiday-calendar'});
test('missing data remains pending/missing, not a zero or a no-reaction conclusion',()=>{
  const result=computeRadarResearch(time,event.companies,[],[],Date.parse('2024-12-01'));
  assert.ok(result.companies[0].points.every(p=>p.percent===null&&p.status==='pending'));
  const missing=computeRadarResearch(time,event.companies,[],[day('2024-10-10')],Date.parse('2024-12-01'));
  assert.equal(missing.companies[0].points[0].status,'missing');assert.equal(missing.companies[0].points[0].percent,null);
  assert.ok(isRadarResearch(result));assert.equal(result.benchmark,null);assert.equal(result.companies[0].cohort,'unreviewed');
});
test('confirmed closures skip sessions; after-close anchors next open day and preserves real zero observations',()=>{
  const first='2024-10-11T14:00:00Z',prices=[price('2024-10-14',100,100),price('2024-10-15',103,100),price('2024-10-16',105,103)];
  const calendar=[day('2024-10-12',false),day('2024-10-13',false),day('2024-10-14'),day('2024-10-15'),day('2024-10-16')];
  const r=computeRadarResearch(first,event.companies,prices,calendar,Date.parse('2024-11-01'));
  assert.equal(r.companies[0].points[0].date,'2024-10-14');assert.equal(r.companies[0].points[0].percent,0);assert.equal(r.companies[0].points[0].status,'observed');
  assert.ok(Math.abs(r.companies[0].points[1].percent!-5)<1e-9);assert.equal(r.companies[0].points[2].percent,null);assert.ok(isRadarResearch(r));
  assert.ok(!('privateOwner' in publicRadarResearch({...r,privateOwner:'secret'} as any)));
});
test('unverified calendar gaps do not silently turn an arbitrary available close into session +3',()=>{
  const r=computeRadarResearch(time,event.companies,[price('2024-10-10'),price('2024-10-12',110),price('2024-10-14',120)],[day('2024-10-10'),day('2024-10-12'),day('2024-10-14')],Date.parse('2024-11-01'));
  assert.equal(r.companies[0].points[0].percent,0);assert.equal(r.companies[0].points[1].percent,null);
  const bse={...price('2024-10-10',50,50),symbol:'539150',exchange:'BSE' as const,sourceUrl:'https://www.bseindia.com/download/BhavCopy/Equity/BhavCopy_BSE_CM_0_0_0_20241010_F_0000.csv.zip'};
  const mixed=computeRadarResearch(time,event.companies,[bse,price('2024-10-12',110)],[day('2024-10-10'),day('2024-10-11'),day('2024-10-12')],Date.parse('2024-11-01'));
  assert.equal(mixed.companies[0].points[1].percent,null,'NSE closing prices must never use a BSE baseline');
});
