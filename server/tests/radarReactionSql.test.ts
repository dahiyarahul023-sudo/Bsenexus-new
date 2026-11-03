import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {evaluateRadarReaction} from '../../src/shared/radarReaction';
const db=new PGlite();
const source={name:'BSE',kind:'disclosure' as const,url:'https://www.bseindia.com/report.pdf'};
const company={symbol:'YESBANK',name:'Yes Bank Ltd',scripCode:'532648'};
const event={id:'case',status:'monitoring' as const,title:'Court granted interim stay',information:'Court granted interim stay on a penalty.',category:'legal',authority:'High Court',companies:[company],scheduledDate:null,scheduleConfirmed:false,nextTrigger:null,source,publishedAt:'2026-10-26T12:00:00Z',updatedAt:'2026-10-26T12:00:00Z'};
const update={id:'source-1',eventId:'case',source,title:event.title,information:event.information,publishedAt:event.publishedAt};
const price={symbol:'YESBANK',date:'2026-10-27',series:'EQ',close:106,previousClose:100,changePercent:6,sourceUrl:'https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_20261027_F_0000.csv.zip'};
const now=Date.parse('2026-10-28T12:00:00Z'),r=evaluateRadarReaction(event,update,company,[price],now);
const save=(rows:any[])=>db.query('select save_radar_reactions($1::jsonb)',[JSON.stringify(rows)]);
before(async()=>{
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
 await db.exec(readFileSync('supabase/migrations/20261016180236_impact_radar.sql','utf8'));
 await db.exec("create table public.impact_price_sessions(symbol text,session_date date,data jsonb,primary key(symbol,session_date));grant select on public.impact_price_sessions to service_role;");
 await db.exec(readFileSync('supabase/migrations/20261103152432_radar_reaction_learning.sql','utf8'));
 await db.query('select publish_impact_radar_records($1)',[JSON.stringify([{event,update}])]);
 await db.query('insert into impact_price_sessions values($1,$2,$3)',[price.symbol,price.date,JSON.stringify(price)]);
});after(()=>db.close());
test('private RLS tables and RPCs deny anon/authenticated, and service_role can save source-bound observations',async()=>{
 for(const role of ['anon','authenticated']) {await db.exec(`set role ${role}`);try{await assert.rejects(db.query('select * from impact_radar_reactions'),/permission denied/);await assert.rejects(save([r]),/permission denied/);await assert.rejects(db.query('select radar_reaction_patterns(now())'),/permission denied/);}finally{await db.exec('reset role');}}
 assert.equal((await db.query<any>("select relrowsecurity from pg_class where relname='impact_radar_reactions'")).rows[0].relrowsecurity,true);
 await db.exec('set role service_role');try{await save([r]);await save([r]);}finally{await db.exec('reset role');}
 assert.equal((await db.query<any>('select count(*)::int n from impact_radar_reactions')).rows[0].n,1);
});
test('late pending retries cannot erase observed evidence; wrong source or unstored price cannot enter learning',async()=>{
 await save([r]);await save([{...r,checkedAt:'2026-10-29T12:00:00Z',state:'awaiting-data',observation:undefined}]);
 assert.equal((await db.query<any>('select state from impact_radar_reactions')).rows[0].state,'observed');
 await assert.rejects(save([{...r,source:{...source,url:'https://www.bseindia.com/other.pdf'}}]),/mismatch/);
 await assert.rejects(save([{...r,observation:{...r.observation,session:{...price,close:999}}}]),/stored official price/);
});
test('30/60/365-day patterns deduplicate company/session reports and ignore rows without observations',async()=>{
 const second={...update,id:'source-2'};await db.query('select publish_impact_radar_records($1)',[JSON.stringify([{event,update:second}])]);
 await save([{...r,id:'source-2:532648',updateId:'source-2'}]);
 const patterns=(await db.query<any>('select radar_reaction_patterns($1) p',['2026-11-03T12:00:00Z'])).rows[0].p;
 assert.equal(patterns.length,3);for(const p of patterns){assert.equal(p.samples,1);assert.equal(p.volatile,1);assert.equal(p.medianAbsMove,6);}
});
test('overlapping different proceedings are excluded from learned patterns rather than assigned a cause',async()=>{
 const another={...event,id:'another-case'},u={...update,id:'different-source',eventId:another.id};
 await db.query('select publish_impact_radar_records($1)',[JSON.stringify([{event:another,update:u}])]);
 await save([{...r,id:'different-source:532648',eventId:another.id,updateId:u.id}]);
 const patterns=(await db.query<any>('select radar_reaction_patterns($1) p',['2026-11-03T12:00:00Z'])).rows[0].p;
 assert.deepEqual(patterns,[]);
 assert.equal((await db.query<any>('select count(*)::int n from impact_radar_reactions')).rows[0].n,3,'observations are retained for audit');
});
