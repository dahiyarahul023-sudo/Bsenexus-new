import {test,after} from 'node:test';
import assert from 'node:assert/strict';
process.env.SUPABASE_URL='https://radar-prices-test.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY='test-only-private-price-store';
let failed=false;const calls:{url:string;init:any}[]=[];const original=globalThis.fetch;
const price={symbol:'YESBANK',date:'2026-10-16',series:'EQ',close:17.5,previousClose:18.12,changePercent:(17.5/18.12-1)*100,sourceUrl:'https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_20261016_F_0000.csv.zip'};
globalThis.fetch=(async(input:any,init:any)=>{
 calls.push({url:String(input?.url||input),init});
 const data=init?.method==='POST'?null:[{symbol:price.symbol,session_date:price.date,data:price},{symbol:'WRONG',session_date:price.date,data:price}];
 return new Response(JSON.stringify(failed?{message:'unavailable'}:data),{status:failed?400:200,headers:{'Content-Type':'application/json'}});
}) as typeof fetch;
const {readRadarPriceSessions,readLatestRadarPriceSessions,saveRadarPriceSessions,RadarPriceStorageError}=await import('../database/radarPriceDao.js');
after(()=>{globalThis.fetch=original;});
test('persistent reads filter mismatched security rows and use the bounded multi-context query',async()=>{
 const rows=await readRadarPriceSessions(['YESBANK','532648'],['2026-10-16']);
 assert.deepEqual(rows,[price]);const url=new URL(calls.at(-1)!.url);assert.equal(url.searchParams.get('limit'),'144');assert.ok(url.searchParams.get('symbol')?.includes('532648'));
});
test('database failures remain explicit and cannot be mistaken for empty prices or successful saving',async()=>{
 failed=true;try{await assert.rejects(readRadarPriceSessions(['YESBANK'],[price.date]),RadarPriceStorageError);assert.equal(await saveRadarPriceSessions([price]),false);}finally{failed=false;}
 assert.equal(await saveRadarPriceSessions([price]),true);const call=calls.at(-1)!;assert.equal(new URL(call.url).searchParams.get('on_conflict'),'symbol,session_date');
 assert.match(new Headers(call.init.headers).get('prefer')||'',/resolution=ignore-duplicates/);
});

test('latest stored history uses a security-bound descending query without an eight-day cutoff',async()=>{
 const rows=await readLatestRadarPriceSessions(['YESBANK'],'2026-10-18');assert.deepEqual(rows,[price]);const url=new URL(calls.at(-1)!.url);
 assert.equal(url.searchParams.get('symbol'),'eq.YESBANK');assert.equal(url.searchParams.get('order'),'session_date.desc');assert.equal(url.searchParams.get('limit'),'1');assert.equal(url.searchParams.get('session_date'),'lte.2026-10-18');
 failed=true;try{await assert.rejects(readLatestRadarPriceSessions(['YESBANK'],'2026-10-18'),RadarPriceStorageError);}finally{failed=false;}
});
