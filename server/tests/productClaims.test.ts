import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { sourceHealthLabel } from '../../src/utils/sourceHealth';
import { selectHomeNews } from '../../src/utils/homeNews';
import * as facts from '../../src/shared/productFacts';
function load(file:string) {
 const actual=createRequire(new URL('../../'+file,import.meta.url));const exports:any={};
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 vm.runInNewContext(code,{exports,console,require(path:string){
  if(path.endsWith('/productFacts'))return facts;
  if(path.endsWith('/ui/PlanCard'))return load('src/components/ui/PlanCard.tsx');
  if(path.endsWith('/config/plans')||path.endsWith('/motionTokens'))return actual(path);
  if(path.startsWith('.'))return new Proxy({},{get:()=>()=>null});
  return actual(path);
 }});
 return exports;
}
function render(file:string,name:string,props:object={}) {return renderToStaticMarkup(React.createElement(load(file)[name],props));}
test('rendered landing uses the actual allowance and avoids unsupported speed/unlimited claims',()=>{
 const html=render('src/components/LandingPage.tsx','LandingPage',{theme:'light',setTheme(){},onEnterTerminal(){}});
 assert.ok(html.includes(facts.AI_ALLOWANCE_COPY));
 assert.ok(!/sub-second|unlimited AI|0\.8s|Save 40%/.test(html));
});
test('calendar and extraction examples are labelled before their illustrative data',()=>{
 const calendar=render('src/components/landing/UpcomingCatalystsGrid.tsx','UpcomingCatalystsGrid',{onEnterTerminal(){}});
 assert.ok(calendar.includes(facts.EXAMPLE_DATA_COPY));
 const extraction=render('src/components/landing/ResultsScrollDeck.tsx','ResultsScrollDeck',{onEnterTerminal(){}});
 assert.ok(extraction.includes('Demo · Quarterly Earnings Deck'));
 assert.ok(!extraction.includes('Today, 11:24'));
});
test('source labels never invent 58ms or equate request duration with delivery time',()=>{
 assert.deepEqual(sourceHealthLabel(),{status:'BSE source unverified',request:'Source latency unverified'});
 assert.equal(sourceHealthLabel({status:'stable',latency:120}).request,'Source request (120ms)');
 assert.equal(sourceHealthLabel({status:'down'}).status,'BSE source unavailable');
 assert.equal(sourceHealthLabel({latency:NaN}).request,'Source latency unverified');
});
test('Home and backend issuer matching agree on verified short names without sector-word matches',()=>{
 const stories=['Solar Industries wins contract','Solar manufacturing jobs rise','Indian markets rally'].map((title,i)=>({id:String(i),title,link:`https://publisher.example/${i}`,source:'Publisher',snippet:'',publishedAt:new Date().toISOString(),category:'market'}));
 assert.deepEqual(selectHomeNews(stories,['SOLARINDS','Solar Industries India'],Date.now(),true).map(x=>x.id),['0']);
});
