import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { radarCompanyFromFiling } from '../services/radarCompanyIdentity.js';
import { resolvedRadarEvent } from '../database/impactRadarDao.js';
import { parseBhavcopy, getRadarMovement, bseBhavcopyUrl } from '../services/radarMovementService.js';
import { isRadarMovement, isRadarSessionMove } from '../../src/shared/radarMovement.js';
const day='2026-10-14', now=Date.parse('2026-10-18T00:00:00Z');
const event:any={id:'legacy-aone',title:'A-One Steels India Ltd - 544952 - Intimation Under Regulation 30 (LODR)-Settlement Of NCLT Matter',companies:[{name:'544952',symbol:'544952',scripCode:'544952'}],source:{name:'BSE',kind:'disclosure',url:'https://www.bseindia.com/report.pdf'},category:'legal',authority:'NCLT',status:'monitoring',scheduledDate:null,scheduleConfirmed:false,information:'A sourced settlement.',nextTrigger:null,publishedAt:'2026-10-14T16:11:00Z',updatedAt:'2026-10-14T16:11:00Z'};
test('official filing identity repairs old numeric names and does not invent an NSE symbol',()=>{
 const c=radarCompanyFromFiling({scrip_cd:'544952',companyName:'A-One Steels India Ltd',subject:event.title,pdfLink:event.source.url});
 assert.equal(c?.name,'A-One Steels India Ltd');assert.equal(c?.symbol,'544952');
 assert.equal(resolvedRadarEvent(event).companies[0].name,'A-One Steels India Ltd');
 assert.equal(resolvedRadarEvent({...event,companies:[{...event.companies[0],symbol:'AONESTEELS',name:'A-One Steels India Ltd'}]}).companies[0].symbol,'AONESTEELS','a filing name must not erase an already recorded exchange symbol');
 assert.equal(radarCompanyFromFiling({scrip_cd:'544953',subject:event.title,pdfLink:event.source.url}),null);
 assert.equal(radarCompanyFromFiling({scrip_cd:'544952',subject:event.title,pdfLink:'https://fake.example/report.pdf'}),null);
});
test('NSE SME daily sessions qualify; matching an unknown symbol requires one exact complete company name',async()=>{
 const header='TradDt,Sgmt,Src,FinInstrmTp,TckrSymb,SctySrs,ClsPric,PrvsClsgPric,TtlTradgVol,FinInstrmNm';
 const csv=header+`\n${day},CM,NSE,STK,AONESTEELS,SM,397.7,397.55,500,A-ONE STEELS INDIA LTD`;
 const rows=parseBhavcopy(csv,day);assert.equal(rows.size,1);
 const r=await getRadarMovement(event,now,async d=>d===day?rows:null);
 assert.equal(r.status,'partial');assert.equal(r.companies[0].sessions[0].exchangeSymbol,'AONESTEELS');assert.equal(r.companies[0].sessions[0].symbol,'544952');assert.ok(isRadarMovement(r));
 const ambiguous=new Map(rows);ambiguous.set('OTHER',{...rows.get('AONESTEELS')!,symbol:'OTHER'});
 assert.equal((await getRadarMovement(event,now,async()=>ambiguous)).status,'unavailable');
});
test('a future hearing does not hide already observed publication-day prices',async()=>{
 const rows=parseBhavcopy(`TradDt,Sgmt,Src,FinInstrmTp,TckrSymb,SctySrs,ClsPric,PrvsClsgPric,TtlTradgVol,FinInstrmNm\n${day},CM,NSE,STK,AONESTEELS,EQ,397.7,397.55,500,A-ONE STEELS INDIA LTD`,day);
 const r=await getRadarMovement({...event,status:'scheduled',scheduledDate:'2026-11-26'},now,async d=>d===day?rows:null);
 assert.equal(r.basis,'report-date');assert.equal(r.status,'partial');assert.equal(r.companies[0].sessions[0].date,day);
});
test('BSE-only fallback matches exact scrip code and keeps its own exchange/source/previous close',async()=>{
 const csv=`TradDt,Sgmt,Src,FinInstrmTp,FinInstrmId,TckrSymb,SctySrs,ClsPric,PrvsClsgPric,TtlTradgVol\n${day},CM,BSE,STK,544952,AONE,B,102,100,500`;
 const rows=parseBhavcopy(csv,day,'BSE');assert.ok(isRadarSessionMove(rows.get('544952')));
 const r=await getRadarMovement(event,now,async()=>null,undefined,async d=>d===day?rows:null);
 const s=r.companies[0].sessions[0];assert.equal(s.changePercent.toFixed(2),'2.00');assert.equal(s.exchange,'BSE');assert.equal(s.sourceUrl,bseBhavcopyUrl(day));
 assert.equal(isRadarSessionMove({...s,sourceUrl:s.sourceUrl.replace('20261014','20261013')}),false);
});
test('actual official AONESTEELS reports resolve the screenshot code and show three historical closes',async()=>{
 const csv=fs.readFileSync('server/tests/fixtures/radar-nse-20261013-16.csv','utf8').trim().split(/\r?\n/), header=csv.shift()!;
 const reports=new Map(['2026-10-13','2026-10-14','2026-10-15','2026-10-16'].map(d=>[d,parseBhavcopy(header+'\n'+csv.filter(l=>l.startsWith(d)).join('\n'),d)]));
 const result=await getRadarMovement(event,now,async d=>reports.get(d)||null);
 assert.equal(result.status,'available');
 assert.deepEqual(result.companies[0].sessions.map(s=>s.close),[397.70,391.40,392.75]);
 assert.deepEqual(result.companies[0].sessions.map(s=>s.date),['2026-10-14','2026-10-15','2026-10-16']);
 assert.ok(result.companies[0].sessions.every(s=>s.exchangeSymbol==='AONESTEELS'&&isRadarSessionMove(s)));
});
test('an official unchanged close with zero trading volume remains a record, not missing data',()=>{
 const rows=parseBhavcopy(`TradDt,Sgmt,Src,FinInstrmTp,TckrSymb,SctySrs,ClsPric,PrvsClsgPric,TtlTradgVol\n${day},CM,NSE,STK,ILLQ,ST,100,100,0`,day);
 assert.equal(rows.get('ILLQ')?.changePercent,0);
});
