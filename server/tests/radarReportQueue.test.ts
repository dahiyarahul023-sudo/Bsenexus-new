import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deflateRawSync} from 'node:zlib';
import {getRadarMovement} from '../services/radarMovementService.js';
function archive(csv:string,day:string){
 const name=Buffer.from(`BhavCopy_NSE_CM_0_0_0_${day.replaceAll('-','')}_F_0000.csv`),plain=Buffer.from(csv),compressed=deflateRawSync(plain);
 const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(8,8);local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(plain.length,22);local.writeUInt16LE(name.length,26);
 const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50);central.writeUInt16LE(8,10);central.writeUInt32LE(compressed.length,20);central.writeUInt32LE(plain.length,24);central.writeUInt16LE(name.length,28);
 const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);end.writeUInt32LE(central.length+name.length,12);end.writeUInt32LE(local.length+name.length+compressed.length,16);
 return Buffer.concat([local,name,compressed,central,name,end]);
}
test('concurrent different history windows wait for bounded report slots rather than dropping valid prices',async()=>{
 const previous=globalThis.fetch;let active=0,peak=0,calls=0;
 globalThis.fetch=(async(input:any)=>{
  calls++;active++;peak=Math.max(peak,active);
  await new Promise<void>(resolve=>setImmediate(resolve));
  active--;
  const match=String(input).match(/_(2026)(10)(\d{2})_F/)!;const day=`${match[1]}-${match[2]}-${match[3]}`;
  return new Response(new Uint8Array(archive(`TradDt,Sgmt,Src,FinInstrmTp,TckrSymb,SctySrs,ClsPric,PrvsClsgPric,TtlTradgVol\n${day},CM,NSE,STK,PNCINFRA,EQ,100,100,500`,day)));
 }) as typeof fetch;
 const store={read:async()=>[],save:async()=>true};
 try{
  const events=[1,4,7,10,13].map(n=>({id:'queue-'+n,title:'PNC Infratech court order',companies:[{symbol:'PNCINFRA',name:'PNC Infratech Ltd',scripCode:'539150'}],source:{name:'BSE',kind:'disclosure' as const,url:'https://www.bseindia.com/source.pdf'},category:'legal',authority:'High Court',status:'monitoring' as const,scheduledDate:null,scheduleConfirmed:false,information:'A sourced order.',nextTrigger:null,publishedAt:`2026-10-${String(n).padStart(2,'0')}T10:00:00Z`,updatedAt:`2026-10-${String(n).padStart(2,'0')}T10:00:00Z`}));
  const results=await Promise.all(events.map(e=>getRadarMovement(e,Date.parse('2026-10-18T12:00:00Z'),undefined,store)));
  assert.ok(peak<=4);assert.equal(calls,15);assert.ok(results.every(r=>r.status==='available'&&r.companies[0].sessions.length===3));
 }finally{globalThis.fetch=previous;}
});
