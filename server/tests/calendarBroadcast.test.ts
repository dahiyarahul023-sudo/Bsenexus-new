import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { currentUpcomingMeetings } from '../services/calendarUniverse.js';

// Execute the actual production broadcast function with only transport/storage
// dependencies replaced. This also checks the real message renderer, not a copy.
const source = fs.readFileSync('server/services/resultsCalendarService.ts','utf8');
const ast = ts.createSourceFile('calendar.ts',source,ts.ScriptTarget.Latest,true);
const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'broadcastUpcomingMeetingsToTelegram')!;
const compiled = ts.transpileModule(fn.getText(ast),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const today = Date.parse('2026-10-24T00:00:00+05:30');
const item = (id:string, timestamp:number) => ({id,scripCode:'500325',symbol:'RELIANCE',companyName:'Fixture company',purpose:'Results',meetingDate:'23 Oct 2026',meetingTimestamp:timestamp,daysLeft:0,status:'TODAY'});

function load(items:any[], fail=false) {
  const exports:any={}, messages:string[]=[], forced:boolean[]=[], notified=new Set<string>();
  vm.runInNewContext(compiled,{exports, currentUpcomingMeetings, notifiedMeetingIds:notified,
    getResultsCalendarData:async()=>({items}), generateServerGoogleCalUrl:()=> 'https://calendar.google.com/calendar/render?fixture=1',
    saveNotifiedMeetings(){}, addLog:async()=>{},
    deliverCalendarTelegram:async(row:any,render:(row:any)=>string,options:any)=>{
      const text=render(row);assert.equal(typeof text,'string');assert.ok(text.length>50);messages.push(text);forced.push(Boolean(options.force));return !fail;
    },
  });
  return {broadcast:exports.broadcastUpcomingMeetingsToTelegram,messages,forced,notified};
}

test('actual manual broadcast excludes stale yesterday and renders a nonempty current-date message',async context=>{
  context.mock.timers.enable({apis:['Date'],now:today+3600000});
  const f=load([item('old',today-86400000),item('current',today)]);
  const result=await f.broadcast();
  assert.equal(result.count,1);assert.equal(result.totalUpcoming,1);
  assert.match(f.messages[0],/24 Oct 2026/);assert.doesNotMatch(f.messages[0],/23 Oct 2026/);
  assert.match(f.messages[0],/TODAY/);assert.equal(f.notified.has('old'),false);assert.equal(f.notified.has('current'),true);
});

test('failed delivery is not counted or cached as a confirmed notification; force stays explicit',async context=>{
  context.mock.timers.enable({apis:['Date'],now:today+3600000});
  const f=load([item('current',today)],true);
  assert.equal((await f.broadcast()).count,0);assert.equal(f.notified.size,0);assert.deepEqual(f.forced,[false]);
  await f.broadcast({forceAll:true});assert.deepEqual(f.forced,[false,true]);
});
