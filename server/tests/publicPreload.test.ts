import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { landingPreloadFiles, publicLandingPreload } from '../../scripts/vite-public-preload.mjs';

const bundle = {
  'home.js': {type:'chunk',fileName:'home.js',facadeModuleId:'/repo/src/components/LandingPage.tsx',imports:['main.js'],dynamicImports:['examples.js']},
  'main.js': {type:'chunk',fileName:'main.js',imports:['shared.js']},
  'shared.js': {type:'chunk',fileName:'shared.js',imports:['main.js']},
  'examples.js': {type:'chunk',fileName:'examples.js',imports:[]},
};

test('public preload walks the full static closure once and never preloads closed demos',()=>{
  assert.deepEqual(landingPreloadFiles(bundle),['home.js','main.js','shared.js']);
  assert.throws(()=>landingPreloadFiles({}),/LandingPage/);
  assert.throws(()=>landingPreloadFiles({'home.js':bundle['home.js']}),/Missing public preload chunk/);
});

test('public preload runs only on a clean, uncached root and preserves the CSP nonce placeholder',()=>{
  const plugin:any=publicLandingPreload();plugin.configResolved({base:'/'});
  const tags=plugin.transformIndexHtml.handler('',{bundle});
  assert.equal(tags[0].attrs.nonce,'__CSP_NONCE__');
  for(const [pathname,search,cached,expected] of [['/','',false,3],['/','?cf_order_id=fixture',false,0],['/','?tab=settings',false,0],['/activate-gift','',false,0],['/settings','',false,0],['/','',true,0]] as const){
    const requested:string[]=[];
    vm.runInNewContext(tags[0].children,{location:{pathname,search},localStorage:{getItem:()=>cached?'cached':null},document:{createElement:()=>({}),head:{appendChild:(link:any)=>requested.push(link.href)}}});
    assert.equal(requested.length,expected,`${pathname}${search} cached=${cached}`);
    assert.equal(requested.some(url=>url.includes('examples')),false);
  }
});
