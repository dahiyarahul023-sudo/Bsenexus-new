import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {radarSourceStatus} from '../database/radarSourceDao.js';

test('new instances start pending; partial news outages do not turn a successful filing scan into a delay', () => {
  assert.deepEqual(radarSourceStatus(null,600_000),{checkedAt:null,unavailable:false,stale:false,pending:true,newsUnavailable:false});
  const check={checkedAt:600_000,available:true,newsAvailable:false};
  assert.deepEqual(radarSourceStatus(check,600_001),{checkedAt:600_000,unavailable:false,stale:false,pending:false,newsUnavailable:true});
  assert.equal(radarSourceStatus(check,960_000).stale,true);
  assert.equal(radarSourceStatus({...check,available:false},600_001).unavailable,true);
});
test('shared check history is private, retains the newest result under out-of-order writes and upgrades idempotently', async () => {
  const db=new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
    const file=fs.readdirSync('supabase/migrations').find(name=>name.endsWith('_radar_source_checks.sql'))!;
    const sql=fs.readFileSync('supabase/migrations/'+file,'utf8');await db.exec(sql);await db.exec(sql);
    await db.exec("set role service_role; insert into impact_radar_source_checks values('2026-10-19T10:00:00Z',true,true),('2026-10-19T09:00:00Z',false,false); reset role;");
    assert.equal((await db.query<any>('select available from impact_radar_source_checks order by checked_at desc limit 1')).rows[0].available,true);
    assert.equal((await db.query<any>("select relrowsecurity from pg_class where relname='impact_radar_source_checks'")).rows[0].relrowsecurity,true);
    for(const role of ['anon','authenticated']) {await db.exec(`set role ${role}`);try {await assert.rejects(db.query('select * from impact_radar_source_checks'),/permission denied/);}finally{await db.exec('reset role');}}
  } finally {await db.close();}
});
