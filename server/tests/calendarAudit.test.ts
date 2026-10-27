import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function command(name:string, context:any) {
  const ast=ts.createSourceFile('calendar.tsx',fs.readFileSync('src/components/ResultsCalendar.tsx','utf8'),ts.ScriptTarget.Latest,true);
  let node:ts.VariableDeclaration|undefined;
  function visit(n:ts.Node) {if(ts.isVariableDeclaration(n)&&n.name.getText(ast)===name)node=n;ts.forEachChild(n,visit);}visit(ast);
  assert.ok(node,name);const exports:any={};
  vm.runInNewContext(ts.transpileModule('export const '+node.getText(ast)+';',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
    {exports,AbortController,AbortSignal,Error,console,...context});return exports[name];
}
function runup(request:any, expanded:string|null=null) {
  const state:any={expanded,rows:[],error:null,busy:false};const controller={current:null as AbortController|null},selection={current:'owner:511243:28 Oct 2026:10'};
  const run=command('toggleRunupAnnouncements',{customFetch:request,expandedRunupDate:expanded,runupWindowDays:10,runupSelectionRef:selection,runupReadController:controller,
    setExpandedRunupDate:(v:any)=>state.expanded=v,setRunupAnnouncements:(v:any)=>state.rows=v,setRunupError:(v:any)=>state.error=v,setLoadingRunupAnnouncements:(v:any)=>state.busy=v});
  return {run,state,controller,selection};
}
test('switching open pre-result window reloads 20 days instead of collapsing the drawer',async()=>{
  let url='';const f=runup(async(u:string)=>{url=u;return Response.json({success:true,announcements:[{id:'20day'}]});},'28 Oct 2026');
  await f.run('511243','CHOLAFIN','28 Oct 2026',20,true);
  assert.equal(f.state.expanded,'28 Oct 2026');assert.match(url,/windowDays=20/);assert.equal(f.state.rows[0].id,'20day');
});
test('failed pre-result read stays an error and retry can recover actual content',async()=>{
  const f=runup(async()=>Response.json({success:false,announcements:[]},{status:503}));
  await f.run('511243','CHOLAFIN','28 Oct 2026');assert.match(f.state.error,/filings/i);assert.equal(f.state.busy,false);
});
test('obsolete company response cannot fill the new drawer',async()=>{
  let done!:(r:Response)=>void;const f=runup(()=>new Promise(r=>done=r));const pending=f.run('511243','CHOLAFIN','28 Oct 2026');
  f.selection.current='owner:532977:28 Oct 2026:10';done(Response.json({success:true,announcements:[{id:'wrong-company'}]}));await pending;
  assert.equal(f.state.rows.length,0);
});
test('collapse aborts the in-flight pre-result read and ignores its eventual response',async()=>{
  let done!:(r:Response)=>void;const f=runup(()=>new Promise(r=>done=r),'28 Oct 2026');
  const pending=f.run('511243','CHOLAFIN','28 Oct 2026',20,true);
  await f.run('511243','CHOLAFIN','28 Oct 2026');
  done(Response.json({success:true,announcements:[{id:'late'}]}));await pending;
  assert.equal(f.state.expanded,null);assert.equal(f.state.rows.length,0);
});

test('failed calendar response cannot erase usable cached cards or stamp a fresh cache',async()=>{
  const controller={current:null};let cards=0,caches=0,error='';
  const run=command('fetchCalendar',{calendarKey:'owner:all',requestSequence:{current:0},calendarRequest:controller,requestKey:{current:'owner:all'},items:[{id:'saved'}],
    setCalendarError:(v:any)=>error=v,setRefreshing:()=>{},setLoading:()=>{},getCacheItem:()=>[],customFetch:async()=>Response.json({success:false,items:[],error:'Server returned non-JSON response (200)'}),
    selectedWatchlistId:'',calendarScope:'all',statusFilter:'upcoming',setItems:()=>cards++,setCacheItem:()=>caches++,setLastUpdated:()=>{},setStatusFilter:()=>{},setWatchlistSyncFeedback:()=>{},setTimeout});
  await run(false);assert.equal(cards,0);assert.equal(caches,0);assert.match(error,/could not be refreshed/);
});

test('late AI success never patches a different selected declaration and duplicate input is coalesced',async()=>{
  let done!:(r:Response)=>void;let selected:any={declarationAnnouncementId:'original'},requests=0,quota=0;const aiRequest={current:null};
  const run=command('handleGenerateSummary',{aiRequest,user:{uid:'owner'},profile:{notificationPreferences:{aiSummaryLang:'english'}},isProOrAdmin:true,aiQuota:{canGenerate:true},
    setIsGeneratingAi:()=>{},setAiStepIndex:()=>{},customFetch:()=>{requests++;return new Promise(r=>done=r);},syncQuotaFromResponse:()=>quota++,
    setSelectedModalItem:(fn:any)=>selected=fn(selected),setItems:()=>{},alert:()=>{throw Error('unexpected alert');}});
  const pending=run('original');await run('original');selected={declarationAnnouncementId:'different'};
  done(Response.json({aiSummary:'Original company summary',aiSummaryLang:'english'}));await pending;
  assert.equal(requests,1);assert.equal(quota,1);assert.equal(selected.aiSummaryEn,undefined);assert.equal(aiRequest.current,null);
});

function telegram(request:any,admin=true) {
  const state:any={messages:[],alerts:[],pins:0};const controller={current:null};
  const run=command('handleManualSendTelegram',{telegramRequest:controller,user:{uid:'owner'},isAdmin:admin,customFetch:request,getCalendarLink:()=>'',
    setIsSendingTelegram:()=>{},setIsPlaneFlying:()=>{},setTelegramStatus:(v:any)=>state.messages.push(v),setIsAuthModalOpen:()=>{},setIsAdminPinModalOpen:()=>state.pins++,alert:(v:any)=>state.alerts.push(v)});
  return {run,state,controller};
}
const filing={id:'filing',scripCode:'511243',symbol:'CHOLAFIN',companyName:'Chola',meetingDate:'28 Oct 2026',purpose:'Results'};
test('Telegram success needs a confirmed message ID; denial has PIN recovery and no success state',async()=>{
  const f=telegram(async()=>Response.json({success:false,adminElevationRequired:true,error:'Verify PIN'},{status:403}));
  assert.equal(await f.run(filing),false);assert.equal(f.state.pins,1);assert.deepEqual(f.state.messages,[null]);assert.equal(f.controller.current,null);
  const malformed=telegram(async()=>Response.json({success:true}));assert.equal(await malformed.run(filing),false);
  const ok=telegram(async()=>Response.json({success:true,messageId:123}));assert.equal(await ok.run(filing),true);assert.match(ok.state.messages.at(-1),/accepted/);
  let calls=0;const regular=telegram(async()=>{calls++;},false);assert.equal(await regular.run(filing),false);assert.equal(calls,0);
});
test('Telegram duplicate clicks share one pending send and obsolete completion stays silent',async()=>{
  let done!:(r:Response)=>void;let calls=0;const f=telegram(()=>{calls++;return new Promise(r=>done=r);});
  const pending=f.run(filing);assert.equal(await f.run(filing),false);f.controller.current.abort();f.controller.current=null;
  done(Response.json({success:true,messageId:123}));assert.equal(await pending,false);assert.equal(calls,1);assert.deepEqual(f.state.messages,[null]);
});

test('global watchlist archive reports failed and unresolved stocks instead of all-success',async()=>{
  const source=fs.readFileSync('server/services/resultsCalendarService.ts','utf8');
  const ast=ts.createSourceFile('service.ts',source,ts.ScriptTarget.Latest,true);
  const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='fetchDeepHistoricalResultsForWatchlist');assert.ok(fn);
  const exports:any={};vm.runInNewContext(ts.transpileModule(fn.getText(ast),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,console,
    getActiveWatchlistSymbols:async()=>['GOOD','FAILED','UNRESOLVED'],getScripCodeForSymbolOrName:(s:string)=>s==='UNRESOLVED'?'':s==='GOOD'?'511243':'532977',
    fetchDeepHistoricalResultsForStock:async(_code:string,s:string)=>{if(s==='FAILED')throw Error('BSE unavailable');return {success:true,newlySaved:12};},addLog:async()=>{}});
  const result=await exports.fetchDeepHistoricalResultsForWatchlist(1);
  assert.equal(result.success,false);assert.equal(result.failedCount,2);assert.equal(result.completedCount,1);assert.equal(result.newlySaved,12);assert.match(result.error,/2/);
});

test('calendar dialog keyboard keeps focus within the owning panel and restores it on close',()=>{
  let effect:any;const previous:any={isConnected:true,focus:()=>document.activeElement=previous};const document:any={activeElement:previous};
  const exports:any={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/hooks/useCalendarDialog.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,document,require:()=>({useRef:()=>({current:null}),useEffect:(fn:any)=>effect=fn})});
  let closed=0;const props=exports.useCalendarDialog(true,()=>closed++);
  const first:any={getClientRects:()=>[1],getAttribute:()=>null,focus:()=>document.activeElement=first};const last:any={...first,focus:()=>document.activeElement=last};
  const root:any={focus:()=>document.activeElement=root,querySelectorAll:()=>[first,last]};props.ref.current=root;const cleanup=effect();assert.equal(document.activeElement,root);
  const event=(key:string,shiftKey=false)=>({key,shiftKey,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){}});
  props.onKeyDown(event('Tab'));assert.equal(document.activeElement,first);
  props.onKeyDown(event('Tab',true));assert.equal(document.activeElement,last);
  props.onKeyDown(event('Tab'));assert.equal(document.activeElement,first);
  props.onKeyDown(event('Escape'));assert.equal(closed,1);cleanup();assert.equal(document.activeElement,previous);
});

test('clipboard denial never claims copied; successful copy waits for permission result',async()=>{
  let copied=false;const alerts:any[]=[];
  const fail=command('handleCopySummary',{navigator:{clipboard:{writeText:async()=>{throw Error('denied');}}},setCopiedSummary:(v:boolean)=>copied=v,alert:(v:any)=>alerts.push(v),setTimeout});
  await fail('summary');assert.equal(copied,false);assert.equal(alerts.length,1);
  let done!:()=>void;const ok=command('handleCopyCalendarLink',{navigator:{clipboard:{writeText:()=>new Promise<void>(r=>done=r)}},getCalendarLink:()=>'',setCopiedCalendarId:()=>copied=true,setTimeout:()=>{},alert:()=>{}});
  const pending=ok(filing);assert.equal(copied,false);done();assert.equal(await pending,true);assert.equal(copied,true);
});

test('late calendar refresh preserves a newly chosen AI tab instead of restoring the request-time tab',async()=>{
  let tab='ai';const run=command('fetchCalendar',{calendarKey:'owner:all',requestSequence:{current:0},calendarRequest:{current:null},requestKey:{current:'owner:all'},items:[{id:'saved'}],
    setCalendarError:()=>{},setRefreshing:()=>{},setLoading:()=>{},getCacheItem:()=>[],customFetch:async()=>Response.json({items:[]}),
    selectedWatchlistId:'',calendarScope:'all',statusFilter:'upcoming',setItems:()=>{},setCacheItem:()=>{},setLastUpdated:()=>{},
    setStatusFilter:(v:any)=>tab=typeof v==='function'?v(tab):v,setWatchlistSyncFeedback:()=>{},setTimeout,projectCalendarTiming:(v:any)=>v,getCorrectCompanyName:()=>'',getResolvedMeetingDate:()=>''});
  await run(false);assert.equal(tab,'ai');
});
