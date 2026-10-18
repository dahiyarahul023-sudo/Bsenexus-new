import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as movement from '../../src/shared/radarMovement.js';
import * as contract from '../../src/shared/impactRadar.js';
function load(file:string,extra='') {
 const req=createRequire(new URL('../../'+file,import.meta.url)), exports:any={};
 const code=ts.transpileModule(fs.readFileSync(file,'utf8')+extra,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 vm.runInNewContext(code,{exports,console,require(p:string){
  if(p.endsWith('/radarMovement'))return movement;
  if(p.endsWith('/impactRadar'))return contract;
  if(p==='./RadarMovementPanel')return {RadarMovementPanel:()=>null};
  if(p==='./ui/ActionButton')return req(p);
  if(p.startsWith('.'))return {};
  return req(p);
 }});return exports;
}
test('missing prices render one short retry row without an empty table or long caveats',()=>{
 const {RadarMovementContent}=load('src/components/RadarMovementPanel.tsx');
 const html=renderToStaticMarkup(React.createElement(RadarMovementContent,{data:{status:'unavailable',companies:[{symbol:'544952',sessions:[]}]},loading:false,failed:false,onRetry(){}}));
 assert.match(html,/Price history unavailable/);assert.match(html,/Retry/);assert.doesNotMatch(html,/<table|NSE|previous close|No verified|Source:|Recheck price history/);assert.ok(html.length<300);
});
test('available zero movement is shown and optional source methodology starts collapsed',()=>{
 const {RadarMovementContent}=load('src/components/RadarMovementPanel.tsx');
 const data={basis:'report-date',anchorDate:'2026-10-14',afterClose:true,checkedAt:'2026-10-17T10:00:00Z',status:'partial',companies:[{symbol:'544952',name:'A-One Steels India Ltd',sessions:[{date:'2026-10-14',symbol:'544952',series:'EQ',close:100,previousClose:100,changePercent:0,sourceUrl:'https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_20261014_F_0000.csv.zip'}]}]};
 const html=renderToStaticMarkup(React.createElement(RadarMovementContent,{data,loading:false,failed:false,onRetry(){}}));
 assert.match(html,/0.00%/);assert.match(html,/A-One Steels India Ltd/);assert.match(html,/2026-10-14 · NSE/);assert.match(html,/<details/);assert.doesNotMatch(html,/<details[^>]*open|Day low|Not available/);
});
test('a sparse actual event detail omits repeated unknown FAQs and numerical party-name instructions',()=>{
 const {RadarDetail}=load('src/components/ImpactRadar.tsx');
 const event={id:'aone',title:'A-One Steels India Ltd: Settlement of NCLT matter',companies:[{symbol:'544952',name:'A-One Steels India Ltd',scripCode:'544952'}],category:'legal',authority:'NCLT',status:'monitoring',scheduledDate:null,scheduleConfirmed:false,information:'The company has published a legal or regulatory disclosure. Read the original filing for the scope and current position.',nextTrigger:null,source:{name:'BSE company disclosure',kind:'disclosure',url:'https://www.bseindia.com/report.pdf'},publishedAt:'2026-10-14T16:11:00Z',updatedAt:'2026-10-14T16:11:00Z'};
 const html=renderToStaticMarkup(React.createElement(RadarDetail,{event,now:Date.parse('2026-10-17T12:00:00Z'),tracked:false,saving:false,disabled:false,onTrack(){},onRefreshKey:null,onRelated(){}}));
 assert.match(html,/Settlement of NCLT/);assert.match(html,/BSE 544952/);assert.doesNotMatch(html,/not independently verified|What happens next|How long will it continue|duration is not confirmed|Case reference:|Party:<\/strong> 544952|Earliest recorded/);
 assert.match(html,/<details class="impact-radar-verification"/);assert.doesNotMatch(html,/<details[^>]*open/);
});

test('weekend context renders a labelled blue negative bar and keeps its source during refresh or retry failure',()=>{
 const {RadarMovementContent}=load('src/components/RadarMovementPanel.tsx');
 const s={date:'2026-10-16',symbol:'YESBANK',series:'EQ',close:17.5,previousClose:18.12,changePercent:(17.5/18.12-1)*100,sourceUrl:'https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_20261016_F_0000.csv.zip'};
 const data={basis:'report-date',anchorDate:'2026-10-18',afterClose:false,checkedAt:'2026-10-18T12:00:00Z',status:'partial',companies:[{symbol:'YESBANK',name:'Yes Bank Ltd',sessions:[],previousSession:s,latestSession:s}]};
 for(const state of [{loading:false,failed:false},{loading:true,failed:false},{loading:false,failed:true}]){
  const html=renderToStaticMarkup(React.createElement(RadarMovementContent,{data,...state,onRetry(){}}));
  assert.match(html,/is-before/);assert.match(html,/Before report/);assert.match(html,/↓ -3.42%/);assert.match(html,/aria-pressed="true"/);assert.match(html,/₹17.50/);assert.match(html,/2026-10-16 · NSE/);assert.doesNotMatch(html,/Price history unavailable/);
 }
});
