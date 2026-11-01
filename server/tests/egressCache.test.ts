import test from 'node:test';
import assert from 'node:assert/strict';
import { ReadCache } from '../utils/readCache.js';
import { VersionedSnapshot } from '../utils/versionedSnapshot.js';

const deferred = <T>() => { let resolve!: (value:T)=>void; const promise=new Promise<T>(r=>{resolve=r}); return {promise,resolve}; };

test('unchanged owners refresh versions without downloading list bodies; changed/removed/empty owners reconcile', async () => {
  let now=0, scans=0;
  let versions=[{id:'a',version:'1'}, {id:'b',version:'1'}];
  const bodies=new Map([['a',['TCS']],['b',['INFY']]]);
  const fetched:string[][]=[];
  const cache=new VersionedSnapshot<string[]>({ttlMs:60_000,now:()=>now,
    loadVersions:async()=>{scans++;return structuredClone(versions)},
    loadRows:async ids=>{fetched.push(ids);return ids.map(id=>({id,version:versions.find(v=>v.id===id)!.version,value:bodies.get(id)!}))}
  });
  const [first,other]=await Promise.all([cache.get(),cache.get()]);
  assert.deepEqual(first,other);assert.equal(scans,1);assert.deepEqual(fetched,[['a','b']]);
  now=59_999;assert.equal((await cache.get()).checkedAt,0,'cache hits cannot extend owner freshness');
  now=60_000;await cache.get();assert.equal(scans,2);assert.equal(fetched.length,1);
  versions=[{id:'a',version:'2'},{id:'c',version:'1'}];bodies.set('a',[]);bodies.set('c',['LT']);
  now=120_000;const next=await cache.get();
  assert.deepEqual(fetched,[['a','b'],['a','c']]);
  assert.deepEqual(next.rows.map(r=>[r.id,r.value]),[['a',[]],['c',['LT']]]);
});

test('snapshot read failure is retried and never reported as a fresh empty inventory', async () => {
  let fail=true, calls=0;
  const cache=new VersionedSnapshot<string[]>({ttlMs:60_000,loadVersions:async()=>{calls++;if(fail)throw new Error('offline');return []},loadRows:async()=>[]});
  await assert.rejects(cache.get(),/offline/);fail=false;
  assert.deepEqual((await cache.get()).rows,[]);assert.equal(calls,2);
});

test('a mutation during an old snapshot load cannot seed obsolete lists', async () => {
  const held=deferred<{id:string;version:string;value:string[]}[]>();
  let version='1',loadCount=0;
  const cache=new VersionedSnapshot<string[]>({ttlMs:60_000,loadVersions:async()=>[{id:'owner',version}],
    loadRows:async()=> ++loadCount===1 ? held.promise : [{id:'owner',version,value:[]}]
  });
  const old=cache.get();for(let i=0;i<5;i++)await Promise.resolve();
  version='2';cache.invalidate();
  assert.deepEqual((await cache.get()).rows[0].value,[]);
  held.resolve([{id:'owner',version:'1',value:['deleted-stock']}]);
  assert.deepEqual((await old).rows[0].value,[]);
  assert.deepEqual((await cache.get()).rows[0].value,[]);
});

test('row deletion between metadata and body reads does not retain the old version', async () => {
  let version='1',exists=true,now=0;
  const cache=new VersionedSnapshot<string[]>({ttlMs:10,now:()=>now,
    loadVersions:async()=>[{id:'a',version}],loadRows:async()=>exists?[{id:'a',version,value:['TCS']}]:[]});
  await cache.get();version='2';exists=false;now=11;
  assert.deepEqual((await cache.get()).rows,[]);
});

test('public lookup cache coalesces requests, expires misses sooner and bounds ready entries', async () => {
  let now=0,calls=0;
  const cache=new ReadCache<string|null>({maxEntries:2,ttlMs:v=>v===null?15:60,now:()=>now});
  const load=async()=>{calls++;return 'filing'};
  assert.deepEqual(await Promise.all([cache.get('a',load),cache.get('a',load)]),['filing','filing']);assert.equal(calls,1);
  await cache.get('missing',async()=>{calls++;return null});now=15;
  await cache.get('missing',load);assert.equal(calls,3);
  await cache.get('b',load);await cache.get('a',load);assert.equal(calls,5,'oldest entry is evicted');
  now=100;await cache.get('a',load);assert.equal(calls,6);
});

test('lookup errors are not cached and a late pre-write load cannot resurrect an invalidated value', async () => {
  const cache=new ReadCache<string>({maxEntries:2,ttlMs:()=>60_000});
  await assert.rejects(cache.get('a',async()=>{throw new Error('offline')}),/offline/);
  const held=deferred<string>();const old=cache.get('a',()=>held.promise);
  await Promise.resolve();cache.invalidate('a');
  assert.equal(await cache.get('a',async()=>'new'),'new');
  held.resolve('old');assert.equal(await old,'old');
  assert.equal(await cache.get('a',async()=>'wrong'),'new');
});
