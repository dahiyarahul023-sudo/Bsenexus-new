import test from 'node:test';
import assert from 'node:assert/strict';
import { readHomeResource } from '../../src/utils/homeResources.js';
test('malformed calendar JSON does not invalidate a successful personal list read',async()=>{
  const request=(async(url:string)=>url.includes('watchlists')?Response.json([{id:'mine'}]):new Response('{broken')) as typeof fetch;
  const signal=new AbortController().signal;
  const [list,calendar]=await Promise.all([readHomeResource<any[]>(request,'/watchlists',signal,Array.isArray),readHomeResource(request,'/calendar',signal,Array.isArray)]);
  assert.equal(list.ok,true);assert.deepEqual(calendar,{ok:false,status:503});
});
test('denial remains distinguishable from transient transport failure and parent cancellation',async()=>{
  const controller=new AbortController();
  assert.deepEqual(await readHomeResource((async()=>new Response('',{status:403})) as typeof fetch,'/',controller.signal,Array.isArray),{ok:false,status:403});
  assert.deepEqual(await readHomeResource((async()=>{throw Error('offline');}) as typeof fetch,'/',controller.signal,Array.isArray),{ok:false,status:503});
  controller.abort();await assert.rejects(readHomeResource((async()=>{throw controller.signal.reason;}) as typeof fetch,'/',controller.signal,Array.isArray));
});
