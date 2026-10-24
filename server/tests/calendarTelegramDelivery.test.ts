import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { currentUpcomingMeetings } from '../services/calendarUniverse.js';

const source = ts.transpileModule(fs.readFileSync('server/services/calendarTelegramDelivery.ts','utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
}).outputText;
const now = Date.parse('2026-10-24T12:00:00+05:30');
const row = {id:'original',scripCode:'500325',meetingTimestamp:Date.parse('2026-10-24T00:00:00+05:30'),purpose:'Financial Results',daysLeft:0,status:'TODAY'};
function fixture(options: { failure?: boolean; storageDown?: boolean; receiptDown?: boolean; configured?: boolean; afterClaim?: () => void } = {}) {
  const ledger = new Set<string>(), messages: string[] = [], receipts: boolean[] = [];
  const load = () => {
    const exports: any = {};
    vm.runInNewContext(source, {exports, Date, process:{env:{}}, console:{warn(){}}, require(name:string) {
      if(name.endsWith('calendarUniverse.js')) return {currentUpcomingMeetings};
      if(name.endsWith('settingsDao.js')) return {getSettings:async()=>options.configured===false?{}:{botToken:'fixture-only',chatId:'fixture-only'}};
      if(name.endsWith('telegram.js')) return {sendToTelegram:async(text:string)=>{messages.push(text);return {success:!options.failure,messageId:7};}};
      if(name.endsWith('calendarTelegramDao.js')) return {
        claimCalendarTelegram:async(code:string,date:number,force=false)=>{
          if(options.storageDown)throw Error('ledger unavailable');
          const key=`${code}:${date}`;if(ledger.has(key)&&!force)return null;ledger.add(key);options.afterClaim?.();return {key};
        },
        finishCalendarTelegram:async(_claim:any,result:any)=>{receipts.push(result.success);if(options.receiptDown)throw Error('receipt unavailable');},
      };
      throw Error(`Unexpected import: ${name}`);
    }});
    return exports.deliverCalendarTelegram as (item:typeof row, message:(item:typeof row)=>string, options?:any)=>Promise<boolean>;
  };
  return {load,ledger,messages,receipts};
}

test('concurrent instances and fresh modules after restart cannot repeat a reserved automatic alert',async context=>{
  context.mock.timers.enable({apis:['Date'],now});const f=fixture();
  const results=await Promise.all(Array.from({length:6},()=>f.load()(row,x=>x.status)));
  assert.equal(results.filter(Boolean).length,1);assert.equal(f.messages.length,1);
  assert.equal(await f.load()({...row,id:'different-cache-id'},x=>x.status),false);assert.equal(f.messages.length,1);
});

test('missing configuration, stale dates, declarations and storage outages never reach Telegram',async context=>{
  context.mock.timers.enable({apis:['Date'],now});const f=fixture();
  assert.equal(await f.load()({...row,meetingTimestamp:row.meetingTimestamp-86400000},()=> 'stale'),false);
  assert.equal(await f.load()({...row,isDeclared:true} as any,()=> 'declared'),false);
  assert.equal(f.ledger.size,0);assert.equal(f.messages.length,0);
  const down=fixture({storageDown:true});await assert.rejects(down.load()(row,()=> 'x'));assert.equal(down.messages.length,0);
  const off=fixture({configured:false});assert.equal(await off.load()(row,()=> 'x'),false);assert.equal(off.ledger.size,0);
});

test('uncertain provider outcomes and failed receipt persistence retain the reservation instead of retrying',async context=>{
  context.mock.timers.enable({apis:['Date'],now});
  for(const options of [{failure:true},{receiptDown:true}]){
    const f=fixture(options);await f.load()(row,()=> 'fixture');await f.load()(row,()=> 'retry');
    assert.equal(f.messages.length,1);assert.equal(f.ledger.size,1);
    assert.deepEqual(f.receipts,[!options.failure]);
  }
});

test('crossing midnight while waiting for storage cannot send yesterday as Today',async context=>{
  context.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-24T23:59:59+05:30')});
  const f=fixture({afterClaim:()=>context.mock.timers.setTime(Date.parse('2026-10-25T00:00:00+05:30'))});
  assert.equal(await f.load()(row,()=> 'old today'),false);assert.equal(f.messages.length,0);assert.equal(f.ledger.size,1);
});

test('only explicit manual force may resend; it still cannot send a past meeting',async context=>{
  context.mock.timers.enable({apis:['Date'],now});const f=fixture();
  await f.load()(row,()=> 'initial');assert.equal(await f.load()(row,()=> 'explicit repeat',{force:true}),true);
  assert.equal(await f.load()({...row,meetingTimestamp:row.meetingTimestamp-86400000},()=> 'past',{force:true}),false);
  assert.equal(f.messages.length,2);
});
