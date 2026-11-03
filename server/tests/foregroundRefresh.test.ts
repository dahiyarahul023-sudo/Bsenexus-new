import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
function fixture(callback:()=>Promise<void>|void,enabled=true){
 let clock=0,tick:()=>void=()=>{};const document=new EventTarget() as EventTarget&{hidden:boolean};document.hidden=false;
 const window=new EventTarget() as any;window.setInterval=(fn:()=>void)=>{tick=fn;return 1};window.clearInterval=()=>{};
 let effect:()=>any=()=>{};
 const exports:any={};class Clock extends Date{static now(){return clock}}
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/hooks/useForegroundRefresh.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,document,window,Date:Clock,console,require:()=>({useRef:(value:any)=>({current:value}),useEffect:(fn:()=>void)=>{effect=fn}})});
 exports.useForegroundRefresh(callback,60_000,enabled,'owner:calendar');const cleanup=effect();
 return {window,document,cleanup,advance:(ms:number)=>{clock+=ms},tick:()=>tick()};
}
test('iPhone foreground/pageshow/online events refresh the same day, coalesce pending reads and stop on cleanup',async()=>{
 let calls=0,release:()=>void=()=>{};const f=fixture(()=>{calls++;return new Promise<void>(r=>{release=r})});
 assert.equal(calls,1);f.advance(3000);
 for(const event of ['pageshow','focus','online'])f.window.dispatchEvent(new Event(event));
 assert.equal(calls,1,'one pending read handles a resume burst');release();await new Promise(r=>setImmediate(r));
 f.window.dispatchEvent(new Event('pageshow'));assert.equal(calls,2);
 release();await new Promise(r=>setImmediate(r));f.document.hidden=true;f.advance(60_000);f.tick();assert.equal(calls,2);
 f.document.hidden=false;f.document.dispatchEvent(new Event('visibilitychange'));assert.equal(calls,3);
 f.cleanup();release();await new Promise(r=>setImmediate(r));f.advance(60_000);f.tick();f.window.dispatchEvent(new Event('focus'));assert.equal(calls,3);
});
test('retained inactive screens do not fetch or register resume work',()=>{
 let calls=0;const f=fixture(()=>{calls++},false);f.advance(60_000);f.tick();f.window.dispatchEvent(new Event('focus'));assert.equal(calls,0);
});
