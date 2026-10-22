import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
const migration=fs.readFileSync('supabase/migrations/20261022042548_radar_history_archive.sql','utf8');
const e={id:'history-matter',title:'PNCINFRA Supreme Court order',companies:[{symbol:'PNCINFRA',name:'PNC Infratech Ltd',scripCode:'539150'}],information:'Sourced proceeding',authority:'Supreme Court',status:'closed',scheduledDate:null,publishedAt:'2022-10-10T04:00:00Z',updatedAt:'2022-10-10T04:00:00Z'};
const u={id:'history-evidence',eventId:e.id,title:'Original order',publishedAt:e.publishedAt};
const publish=(event:any,update:any)=>db.query('select publish_impact_radar_records($1::jsonb)',[JSON.stringify([{event,update}])]);
before(async()=>{
  await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id text,bucket_id text,metadata jsonb);");
  for(const suffix of ['_impact_radar.sql','_impact_radar_integrity_categories.sql','_impact_radar_material_intake.sql']) {
    const name=fs.readdirSync('supabase/migrations').find(n=>n.endsWith(suffix))!;await db.exec(fs.readFileSync('supabase/migrations/'+name,'utf8'));
  }
  await publish(e,u);await db.exec(migration);
});
after(()=>db.close());
test('first-public backfill and later older evidence stay stable across newer case updates',async()=>{
  assert.equal(new Date((await db.query<any>('select first_public_at from impact_radar_events where id=$1',[e.id])).rows[0].first_public_at).toISOString(),'2022-10-10T04:00:00.000Z');
  await publish({...e,publishedAt:'2022-11-10T04:00:00Z',updatedAt:'2022-11-10T04:00:00Z'},{...u,id:'later',publishedAt:'2022-11-10T04:00:00Z'});
  await publish(e,{...u,id:'earlier',publishedAt:'2022-10-09T04:00:00Z'});
  const row=(await db.query<any>('select first_public_at,updated_at from impact_radar_events where id=$1',[e.id])).rows[0];
  assert.equal(new Date(row.first_public_at).toISOString(),'2022-10-09T04:00:00.000Z');assert.equal(new Date(row.updated_at).toISOString(),'2022-11-10T04:00:00.000Z');
});
test('history keyset reads beyond 200 records, stable ties, exact security search and inclusive IST date bounds',async()=>{
  for(let i=0;i<210;i++)await publish({...e,id:`page-${String(i).padStart(3,'0')}`},{...u,id:`page-update-${i}`,eventId:`page-${String(i).padStart(3,'0')}`});
  const first=(await db.query<any>("select * from search_radar_history('PNCINFRA',null,null,null,null,51)")).rows;
  assert.equal(first.length,51);assert.ok(first[0].id>first[1].id);
  let cursor:any=null,ids:string[]=[];
  for(let i=0;i<6;i++) {
    const page=(await db.query<any>("select * from search_radar_history('539150',null,null,$1,$2,51)",[cursor?.first_public_at||null,cursor?.id||null])).rows;
    ids.push(...page.map(p=>p.id));cursor=page.at(-1);if(page.length<51)break;
  }
  assert.equal(ids.length,211);assert.equal(new Set(ids).size,211);
  assert.equal((await db.query<any>("select * from search_radar_history('', '2022-10-10','2022-10-10',null,null,51)")).rows.length,51);
});
test('private tables/functions and archive bucket expose no browser grants',async()=>{
  assert.equal((await db.query<any>("select public from storage.buckets where id='radar-history'")).rows[0].public,false);
  for(const role of ['anon','authenticated']) {
    await db.exec(`set role ${role}`);
    try {
      for(const table of ['impact_radar_archives','impact_radar_update_keys','impact_radar_research','impact_market_days'])await assert.rejects(db.query(`select * from ${table}`),/permission denied/);
      await assert.rejects(db.query('select * from search_radar_history()'),/permission denied/);
      await assert.rejects(db.query("select compact_radar_archive('history-matter',$1)",['a'.repeat(64)]),/permission denied/);
    }finally{await db.exec('reset role');}
  }
});
async function manifest(id:string,backup:boolean) {
  const s=(await db.query<any>('select radar_archive_snapshot($1) value',[id])).rows[0].value;
  await db.query("insert into impact_radar_archives(event_id,sha256,object_path,event_version,update_count,update_digest,compressed_bytes,first_update,primary_verified_at,backup_file_id,backup_verified_at) values($1,$2,$3,$4,$5,$6,100,$7,now(),$8,$9)",[id,'a'.repeat(64),id+'/a.json.gz',s.eventVersion,s.updates.length,s.updateDigest,JSON.stringify(s.updates[0]),backup?'verified-file':null,backup?new Date().toISOString():null]);
}
test('compaction requires two copies, closed age, exact snapshot digest; active and concurrent changes stay hot',async()=>{
  await manifest(e.id,false);
  await assert.rejects(db.query('select compact_radar_archive($1,$2)',[e.id,'a'.repeat(64)]),/not eligible/);
  await db.query('update impact_radar_archives set backup_file_id=$1,backup_verified_at=now() where event_id=$2',['backup',e.id]);
  await publish({...e,updatedAt:'2022-12-01T04:00:00Z'},{...u,id:'arrived-after-snapshot',publishedAt:'2022-12-01T04:00:00Z'});
  await assert.rejects(db.query('select compact_radar_archive($1,$2)',[e.id,'a'.repeat(64)]),/not eligible|changed/);
  assert.equal((await db.query<any>('select count(*)::int n from impact_radar_updates where event_id=$1',[e.id])).rows[0].n,4);
  const active={...e,id:'active-old',status:'active'};await publish(active,{...u,id:'active-u',eventId:active.id});await manifest(active.id,true);
  await assert.rejects(db.query('select compact_radar_archive($1,$2)',[active.id,'a'.repeat(64)]),/not eligible/);
});
test('verified old closed compaction preserves follows, searchable case, first-public and replay immutability',async()=>{
  const id='old-closed';await publish({...e,id},{...u,id:'old-u',eventId:id});await manifest(id,true);
  await db.query('insert into impact_radar_follows(user_id,event_id) values($1,$2)',['alice',id]);
  assert.equal((await db.query<any>('select compact_radar_archive($1,$2) removed',[id,'a'.repeat(64)])).rows[0].removed,1);
  assert.equal((await db.query<any>('select count(*)::int n from impact_radar_updates where event_id=$1',[id])).rows[0].n,0);
  assert.equal((await db.query<any>('select count(*)::int n from impact_radar_follows where event_id=$1',[id])).rows[0].n,1);
  await publish({...e,id},{...u,id:'old-u',eventId:id});
  assert.equal((await db.query<any>('select count(*)::int n from impact_radar_updates where event_id=$1',[id])).rows[0].n,0,'replay consults permanent key, not missing hot body');
  await assert.rejects(publish({...e,id},{...u,id:'old-u',eventId:id,title:'Different evidence'}),/immutable/);
  assert.ok((await db.query<any>('select first_public_at from impact_radar_events where id=$1',[id])).rows[0]);
  assert.equal((await db.query<any>('select compact_radar_archive($1,$2) removed',[id,'a'.repeat(64)])).rows[0].removed,0);
});
test('archive leases serialize workers, require the matching release token and recover after expiry',async()=>{
  const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
  const claim=async(token:string)=>(await db.query<any>('select claim_radar_archive($1,$2) claimed',[e.id,token])).rows[0].claimed;
  assert.equal(await claim(a),true);assert.equal(await claim(b),false);
  await db.query('select release_radar_archive($1,$2)',[e.id,b]);assert.equal(await claim(b),false);
  await db.query('select release_radar_archive($1,$2)',[e.id,a]);assert.equal(await claim(b),true);
  await db.query("update impact_radar_archive_jobs set lease_until=now()-interval '1 minute' where event_id=$1",[e.id]);assert.equal(await claim(a),true);
});
test('storage budget metrics count all files and expose unknown sizes instead of silently assuming zero',async()=>{
  await db.exec(`insert into storage.objects values('one','radar-history','{"size":100}'),('two','other-bucket','{"size":"250"}'),('unknown','other-bucket','{}')`);
  const r=(await db.query<any>('select radar_storage_usage() usage')).rows[0].usage;
  assert.equal(Number(r.allStorageBytes),350);assert.equal(Number(r.unknownStorageSizes),1);assert.ok(Number(r.cases)>200);
});
