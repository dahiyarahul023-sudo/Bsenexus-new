import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

function load(file:string) {
  const actual=createRequire(new URL('../../'+file,import.meta.url));
  const exports:any={};
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  vm.runInNewContext(code,{exports,require(path:string){
    if(path.endsWith('.css')) return {};
    if(path==='./notes/SaveNoteButton') return {SaveNoteButton:({label}:any)=>React.createElement('button',{'aria-label':label},'Note')};
    return actual(path);
  }});
  return exports;
}
test('editor exposes all four priority filters and full company identities without a clipped stock viewport',()=>{
  const {WatchlistEditor}=load('src/components/WatchlistEditor.tsx');
  const props={lists:[{id:'red',name:'Red',is_active:1,items:[{symbol:'TCS',scripCode:'532540',companyName:'Tata Consultancy Services Ltd',priority:'HIGH'},{symbol:'531977',scripCode:'531977',companyName:'Named BSE-only Company Ltd',priority:'LOW'}]}],activeId:'ALL',creating:false,editingId:null,listName:'',editName:'',symbol:'',priority:'HIGH',category:'',query:'',filter:'ALL',suggestions:[],showSuggestions:false,searching:false,searchError:false,addError:null,adding:false};
  const html=renderToStaticMarkup(React.createElement(WatchlistEditor,props));
  for(const label of ['All stocks','High','Medium','Low','Tata Consultancy Services Ltd','Named BSE-only Company Ltd','BSE 532540']) assert.ok(html.includes(label),label);
  assert.equal((html.match(/class="watchlist-editor-stock"/g)||[]).length,2);
  assert.match(html,/Showing 2 of 2 stocks/);assert.doesNotMatch(html,/h-\[480px\]|overflow-y-auto/);
  const filtered=renderToStaticMarkup(React.createElement(WatchlistEditor,{...props,query:'531977',filter:'LOW'}));
  assert.match(filtered,/Showing 1 of 2 stocks/);assert.match(filtered,/Named BSE-only Company Ltd/);assert.doesNotMatch(filtered,/Tata Consultancy Services Ltd/);
});
test('switch exposes explicit On/Off semantics with a contained track and thumb',()=>{
  const {Switch}=load('src/components/ui/Switch.tsx');
  for(const checked of [true,false]) {
    const html=renderToStaticMarkup(React.createElement(Switch,{checked,label:'Financial Results',onChange(){}}));
    assert.match(html,/role="switch"/);assert.match(html,new RegExp(`aria-checked="${checked}"`));assert.match(html,/aria-label="Financial Results"/);
    assert.match(html,/bse-switch-track/);assert.match(html,/bse-switch-thumb/);assert.doesNotMatch(html,/<svg/);
  }
});
