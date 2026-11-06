import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness() {
  let now=1_000_000,requests=0,settingsReads=0,fail=false,hold=false;
  let release:(()=>void)|undefined;
  const code=ts.transpileModule(fs.readFileSync('server/services/telegram.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports:any={};
  const dependencies:any={
    '../database/settingsDao.js':{getSettings:async()=>{settingsReads++;return {botToken:'fixture-only',chatId:'fixture-chat'};}},
    '../database/logDao.js':{addLog:async()=>{}},
    '../utils/circuitBreaker.js':{telegramCircuitBreaker:{getState:()=> 'CLOSED',execute:async(fn:any,fallback:any)=>{try{return await fn();}catch(error){return fallback(error);}}}},
  };
  class Clock extends Date { static now(){return now;} }
  vm.runInNewContext(code,{exports,Date:Clock,process:{env:{}},AbortSignal,require:(name:string)=>dependencies[name],fetch:async(url:string)=>{
    if(url.endsWith('/getMe')){requests++;if(hold)await new Promise<void>(resolve=>{release=resolve;});if(fail)throw Error('fixture outage');return {ok:true,json:async()=>({ok:true,result:{username:'FixtureBot'}})};}
    return {ok:true,json:async()=>({result:{message_id:7,date:Math.floor(now/1000)}})};
  }});
  return {api:exports,stats:()=>({requests,settingsReads}),advance:(ms:number)=>{now+=ms;},setFail:(value:boolean)=>{fail=value;},setHold:(value:boolean)=>{hold=value;},release:()=>release?.()};
}

test('many concurrent health readers share one request and refresh only at two minutes',async()=>{
  const h=harness();await h.api.updateTelegramHealth();
  for(let i=0;i<50;i++)h.api.getTelegramHealth();
  await Promise.all(Array.from({length:30},()=>h.api.updateTelegramHealth()));
  assert.equal(h.stats().requests,1);assert.equal(h.stats().settingsReads,1);
  h.advance(119999);await h.api.updateTelegramHealth();assert.equal(h.stats().requests,1);
  h.advance(1);await Promise.all(Array.from({length:30},()=>h.api.updateTelegramHealth()));assert.equal(h.stats().requests,2);
});

test('a failed health probe is bounded by the same cache and recovers after expiry',async()=>{
  const h=harness();await h.api.updateTelegramHealth();h.advance(120000);h.setFail(true);
  await h.api.updateTelegramHealth();assert.equal(h.api.getTelegramHealth().status,'down');
  await h.api.updateTelegramHealth();assert.equal(h.stats().requests,2);
  h.advance(120000);h.setFail(false);await h.api.updateTelegramHealth();assert.equal(h.api.getTelegramHealth().status,'connected');assert.equal(h.stats().requests,3);
});

test('an older in-flight health probe cannot replace a newer successful send',async()=>{
  const h=harness();await h.api.updateTelegramHealth();h.advance(120000);h.setHold(true);h.setFail(true);
  const probe=h.api.updateTelegramHealth();await new Promise(resolve=>setImmediate(resolve));
  assert.equal((await h.api.sendToTelegram('fixture message')).messageId,7);
  h.release();await probe;assert.equal(h.api.getTelegramHealth().status,'stable');
  await h.api.updateTelegramHealth();assert.equal(h.stats().requests,2);
});
