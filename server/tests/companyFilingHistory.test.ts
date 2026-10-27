import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { companyFilingStats, pageItems } from '../../src/shared/companyFilings.js';
import { hasExactScripCode } from '../../src/shared/scripMatching.js';
import { isBseFiling } from '../../src/shared/filingSource.js';
import { importHistoricalFilings } from '../services/historicalFilings.js';
const now = Date.parse('2026-10-22T12:00:00Z');

test('83 stored filings retain all pages and the independent 30-day count; unknown dates and meetings never inflate it', () => {
  const rows = Array.from({ length: 83 }, (_, i) => ({ id: `filing-${i}`, timestamp: now - (i < 16 ? i : i + 40) * 86_400_000 }));
  const stats = companyFilingStats([...rows, rows[0], { id:'bm_123', timestamp:now }, {id:'hist_123',timestamp:now}],now);
  assert.equal(stats.last30Days,16); assert.equal(stats.total,83);
  const combined = [1,2,3,4].flatMap(page => pageItems(rows,page).items);
  assert.deepEqual(combined,rows);
  assert.equal(pageItems(rows,4).items.length,8);
  assert.equal(pageItems(rows,50).current,4);
  assert.equal(companyFilingStats([{id:'unknown'},{id:'future',timestamp:now+86400000}],now).last30Days,0);
});

function storedReader(rows: any[], unavailable = false) {
  const calls: any[] = [];
  const exports: any = {};
  const module = ts.transpileModule(readFileSync('server/database/announcementDao.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(module,{exports,console,Date,AbortSignal,process:{env:{NODE_ENV:'production'}},require(path:string) {
    if (path.endsWith('/scripMatching.js')) return {hasExactScripCode,projectFilingIdentity:(row:any)=>row};
    if (path.endsWith('/filingSource.js')) return {isBseFiling};
    if (path.endsWith('/localStore.js')) return {readLocalJson:()=>[]};
    if (path.endsWith('/bloomFilter.js')) return {BloomFilter:class {add() {}}};
    if (path.endsWith('/helpers.js')) return {parseBseDate:(value:string)=>Date.parse(value)||0};
    if (path.endsWith('/supabase.js')) return {isSupabaseConfigured:()=>true,getSupabase:()=>({from() {
      let after='',limit=0;
      const query:any={select:()=>query,eq:()=>query,order:()=>query,limit:(n:number)=>{limit=n;return query;},gt:(_field:string,id:string)=>{after=id;return query;},abortSignal:async()=>{
        calls.push({after,limit});return {data:rows.filter(row=>row.id>after).slice(0,limit),error:unavailable?new Error('offline'):null};
      }};return query;
    }})};
    return {};
  }});
  return {read:exports.getAnnouncementsForScrip,calls};
}
test('actual durable DAO reaches beyond both 25 and 400 rows with stable keyset pages; outage cannot become a confirmed zero', async () => {
  const rows=Array.from({length:1103},(_,i)=>({id:String(i).padStart(5,'0'),scrip_cd:'532424',data:{scrip_cd:'532424',bseTime:'2026-10-20T10:00:00Z'}}));
  const reader=storedReader(rows);
  assert.equal((await reader.read('532424',Number.MAX_SAFE_INTEGER,true)).length,1103);
  assert.deepEqual(reader.calls,[{after:'',limit:500},{after:'00499',limit:500},{after:'00999',limit:500}]);
  await assert.rejects(storedReader([],true).read('532424',Number.MAX_SAFE_INTEGER,true),/unavailable/);
});

test('five-year archive requests all categories over the actual date range with paced pages, including valid empty windows', async () => {
  const requests:URL[]=[]; let pauses=0;
  await importHistoricalFilings('532424',5,()=>{}, {now:()=>now,pause:async()=>{pauses++;},request:async(url:any)=>{
    requests.push(new URL(url));return Response.json({Table:[]});
  },save:async()=>{throw new Error('empty windows cannot save records');},confirm:async()=>{}});
  assert.equal(requests[0].searchParams.get('strPrevDate'),'20211022');
  assert.equal(requests.at(-1)!.searchParams.get('strToDate'),'20261022');
  assert.ok(requests.length>10); assert.equal(pauses,requests.length-1);
  assert.ok(requests.every(url=>url.searchParams.get('strCat')==='-1'&&url.searchParams.get('strScrip')==='532424'));
});

test('archive imports all pages, dedupes boundary rows, excludes other companies, and confirms storage before reporting progress', async () => {
  let firstWindow:string|undefined;const saved:any[]=[];const confirmed:string[][]=[];let processed=0;
  await importHistoricalFilings('532424',1,count=>{processed+=count;}, {now:()=>now,pause:async()=>{},request:async(url:any)=>{
    const p=new URL(url).searchParams; firstWindow??=p.get('strPrevDate')!;
    if(p.get('strPrevDate')!==firstWindow)return Response.json({Table:[]});
    const page=Number(p.get('pageno'));
    return Response.json({Table:page===1?[{NEWSID:'one',SCRIP_CD:'532424',NEWSSUB:'Dividend',News_submission_dt:'2026-01-01T10:00:00Z'},
      {NEWSID:'wrong',SCRIP_CD:'500325',News_submission_dt:'2026-01-01T10:00:00Z'}]:page===2?[{NEWSID:'one',SCRIP_CD:'532424',News_submission_dt:'2026-01-01T10:00:00Z'},
      {NEWSID:'two',SCRIP_CD:'532424',NEWSSUB:'Regulatory order',News_submission_dt:'2026-01-02T10:00:00Z'}]:[]});
  },save:async(items:any)=>{saved.push(...items);return {total:items.length,inserted:items.length,updated:0,skipped:0};},confirm:async(ids)=>{assert.equal(processed,confirmed.length);confirmed.push(ids);}});
  assert.deepEqual(saved.map(row=>row.newsId),['one','two']); assert.equal(processed,2); assert.equal(confirmed.length,2);
});
for(const scenario of ['blocked','malformed','storage'] as const) test(`archive ${scenario} is a failure, never a successful zero import`, async()=>{
  await assert.rejects(importHistoricalFilings('532424',1,()=>{}, {now:()=>now,pause:async()=>{},request:async()=>scenario==='blocked'?new Response('',{status:403}):scenario==='malformed'?new Response('<html>Blocked</html>'):Response.json({Table:[{NEWSID:'one',SCRIP_CD:'532424',News_submission_dt:'2026-01-01T10:00:00Z'}]}),save:async()=>({total:1,inserted:1,updated:0,skipped:0}),confirm:async()=>{throw new Error('storage unavailable');}}),scenario==='blocked'?/HTTP 403/:scenario==='malformed'?/unreadable/:/storage/);
});

test('archive refuses invalid identities, fractional years and missing publication timestamps before successful completion', async()=>{
  for(const [code,years] of [['bad',1],['532424',1.5],['532424',6]] as const) await assert.rejects(importHistoricalFilings(code,years,()=>{}),/Valid BSE/);
  await assert.rejects(importHistoricalFilings('532424',1,()=>{}, {now:()=>now,pause:async()=>{},request:async()=>Response.json({Table:[{NEWSID:'unknown-date',SCRIP_CD:'532424'}]}),save:async()=>{throw new Error('must not save');},confirm:async()=>{}}),/publication date/);
});

test('the actual company modal uses the same hook order when closed, opened and reopened', () => {
  const requireActual = createRequire(new URL('../../src/components/CompanyIntelligenceModal.tsx', import.meta.url));
  const hooks: string[] = [];
  const react = requireActual('react');
  const fakeReact = { ...react,
    useState(value: any) { hooks.push('state'); return [typeof value === 'function' ? value() : value, () => {}]; },
    useRef(value: any) { hooks.push('ref'); return { current: value }; },
    useMemo(fn: () => any) { hooks.push('memo'); return fn(); },
    useCallback(fn: any) { hooks.push('callback'); return fn; },
    useEffect() { hooks.push('effect'); },
    useLayoutEffect() { hooks.push('layout-effect'); },
  };
  const exports: any = {};
  const code = ts.transpileModule(readFileSync('src/components/CompanyIntelligenceModal.tsx', 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  vm.runInNewContext(code, { exports, console, require(path: string) {
    if (path === 'react') return fakeReact;
    if (path.endsWith('/IntelModalContext')) return { useIntelModal: () => ({ openIntelModal() {} }) };
    if (path.endsWith('/AuthContext')) return { useAuth: () => ({ user: null, profile: null }) };
    if (path.endsWith('/aiQuota')) return { useAiQuota: () => ({}) };
    if (path.endsWith('/useBodyScrollLock')) return { useBodyScrollLock() {} };
    if (path.endsWith('/companyFilings')) return { pageItems };
    if (path.endsWith('/cashfree')) return { getLowestPlanPrice: () => 89 };
    if (path.endsWith('/timeFormat')) return {};
    if (path.startsWith('.')) return {};
    return requireActual(path);
  } });
  const run = (isOpen: boolean) => {
    hooks.length = 0;
    exports.CompanyIntelligenceModal({ isOpen, scripCode: '532424', symbol: 'GODREJCP', onClose() {} });
    return [...hooks];
  };
  const closed = run(false);
  assert.deepEqual(run(true), closed);
  assert.deepEqual(run(false), closed);
  assert.deepEqual(run(true), closed);
});
