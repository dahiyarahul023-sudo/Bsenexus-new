import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function client(request: any) {
  const output=ts.transpileModule(readFileSync('src/utils/runupPriorityClient.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports:any={};vm.runInNewContext(output,{exports,AbortSignal,Error,require:()=>({customFetch:request})});return exports;
}
const input={scripCode:'511243',symbol:'CHOLAFIN',resultDate:'28 Oct 2026',windowDays:10};
const signal=()=>new AbortController().signal;

test('structured admin denial identifies the existing PIN recovery and never retries the mutation',async()=>{
  let calls=0;const api=client(async()=>{calls++;return Response.json({success:false,adminElevationRequired:true},{status:403});});
  await assert.rejects(api.changeRunupPriority(input,signal()),(error:any)=>error.recovery==='admin-pin'&&/Master PIN/.test(error.message));
  assert.equal(calls,1);
});

test('HTML or normalized non-JSON 403 is a blocked response, not a claimed PIN expiry or confirmed update',async()=>{
  for(const body of [new Response('<html>Forbidden</html>',{status:403}),Response.json({success:false,error:'Server returned non-JSON response (403)'},{status:403})]) {
    const api=client(async()=>body);
    await assert.rejects(api.changeRunupPriority(input,signal()),(error:any)=>error.recovery==='retry'&&/preview/.test(error.message)&&!/Master PIN/.test(error.message));
  }
});

test('success requires HTTP success, a confirmed count and a usable disclosure list',async()=>{
  const calls:any[]=[];const api=client(async(url:any,options:any)=>{calls.push({url,options});return Response.json({success:true,boostedCount:2,announcements:[{id:'one'}]});});
  const result=await api.changeRunupPriority(input,signal());assert.equal(result.boostedCount,2);assert.equal(result.announcements[0].id,'one');
  assert.equal(calls.length,1);assert.match(calls[0].url,/511243\/boost-runup-priority/);
  assert.equal(JSON.parse(calls[0].options.body).windowDays,10);assert.equal(calls[0].options.method,'POST');
  await assert.rejects(client(async()=>new Response('<html>unexpected</html>')).changeRunupPriority(input,signal()),/Refresh the filings/);
  for(const response of [Response.json({success:true,boostedCount:2,announcements:[]},{status:403}),Response.json({success:true,boostedCount:'2',announcements:[]})])
    await assert.rejects(client(async()=>response).changeRunupPriority(input,signal()));
  await assert.rejects(client(async()=>Response.json({success:false},{status:401})).changeRunupPriority(input,signal()),(error:any)=>error.recovery==='sign-in');
});

function handler(command: any, options:{admin?:boolean;readFails?:boolean}={}) {
  const ast=ts.createSourceFile('calendar.ts',readFileSync('src/components/ResultsCalendar.tsx','utf8'),ts.ScriptTarget.Latest,true);
  let declaration:ts.VariableDeclaration|undefined;
  const visit=(node:ts.Node)=>{if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='handleBoostRunupPriority')declaration=node;ts.forEachChild(node,visit);};visit(ast);
  assert.ok(declaration);
  const source=ts.transpileModule('export const '+declaration.getText(ast)+';',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const feedback:any[]=[],busy:boolean[]=[],rows:any[]=[],drawers:any[]=[];let pins=0,logins=0,reads=0,refreshes=0;
  const api=client(async()=>Response.json({}));const exports:any={};
  const selection={current:'owner:511243:28 Oct 2026'},controller={current:null as AbortController|null};
  vm.runInNewContext(source,{exports,isAdmin:options.admin??true,boostRunupController:controller,runupSelectionRef:selection,runupWindowDays:10,expandedRunupDate:'28 Oct 2026',AbortController,AbortSignal,
    changeRunupPriority:command,RunupPriorityError:api.RunupPriorityError,
    setBoostRunupMsg:(value:any)=>feedback.push(value),setIsBoostingRunup:(value:boolean)=>busy.push(value),setRunupAnnouncements:(value:any)=>drawers.push(value),
    setIsAdminPinModalOpen:()=>pins++,setIsAuthModalOpen:()=>logins++,setStockHistory:(value:any)=>rows.push(value),
    watchResultHistory:async(_identity:any,_signal:any,update:any,auto:boolean)=>{reads++;assert.equal(auto,false);if(options.readFails)throw new Error('read unavailable');update([{id:'result'}]);},
    fetchCalendar:()=>{refreshes++;},
  });
  return {run:exports.handleBoostRunupPriority,feedback,busy,rows,drawers,selection,controller,Error:api.RunupPriorityError,stats:()=>({pins,logins,reads,refreshes})};
}

test('actual priority handler opens PIN recovery for explicit server denial and preserves the server guard',async()=>{
  let error:any;const f=handler(async()=>{throw error;});error=new f.Error('Verify Master PIN','admin-pin');
  await f.run('511243','CHOLAFIN','28 Oct 2026',10);
  assert.equal(f.feedback.at(-1).type,'error');assert.equal(f.feedback.at(-1).requiresPin,true);
  assert.deepEqual(f.stats(),{pins:1,logins:0,reads:0,refreshes:0});assert.equal(f.busy.at(-1),false);
  let calls=0;const denied=handler(async()=>{calls++;},{admin:false});await denied.run('511243','CHOLAFIN','28 Oct 2026');assert.equal(calls,0);
});

test('actual handler coalesces a double tap and optional read failure keeps the confirmed priority update',async()=>{
  let resolve!:(value:any)=>void;let mutations=0;
  const f=handler(()=>{mutations++;return new Promise(r=>resolve=r);},{readFails:true});
  const first=f.run('511243','CHOLAFIN','28 Oct 2026',10);await f.run('511243','CHOLAFIN','28 Oct 2026',10);
  resolve({boostedCount:2,announcements:[{id:'one'}]});await first;
  assert.equal(mutations,1);assert.equal(f.feedback.at(-1).type,'warning');assert.match(f.feedback.at(-1).message,/Set 2 announcements/);
  assert.equal(f.stats().reads,1);assert.equal(f.stats().refreshes,1);assert.equal(f.busy.at(-1),false);
});

test('late priority response cannot populate another company or open an obsolete auth prompt',async()=>{
  let resolve!:(value:any)=>void;const f=handler(()=>new Promise(r=>resolve=r));const pending=f.run('511243','CHOLAFIN','28 Oct 2026',10);
  f.selection.current='owner:532977:27 Oct 2026';resolve({boostedCount:2,announcements:[{id:'old-company'}]});await pending;
  assert.deepEqual(f.feedback,[null]);assert.equal(f.rows.length,0);assert.equal(f.drawers.length,0);assert.equal(f.stats().refreshes,0);
});
