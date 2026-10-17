import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const sql = fs.readFileSync('supabase/migrations/20261016180236_impact_radar.sql', 'utf8');
const event = { id: 'matter-1', status: 'scheduled', scheduledDate: '2026-10-17', publishedAt: '2026-10-15T10:00:00Z', updatedAt: '2026-10-15T10:00:00Z' };
const update = { id: 'source-1', eventId: 'matter-1', publishedAt: event.publishedAt };
const publish = (records: any) => db.query('select public.publish_impact_radar_records($1::jsonb)', [JSON.stringify(records)]);
before(async () => { await db.exec('create role anon; create role authenticated; create role service_role bypassrls;'); await db.exec(sql);
 const upgrade = fs.readdirSync('supabase/migrations').find(n => n.endsWith('_impact_radar_integrity_categories.sql'));
 if (upgrade) await db.exec(fs.readFileSync('supabase/migrations/' + upgrade, 'utf8'));
 const material = fs.readdirSync('supabase/migrations').find(n => n.endsWith('_impact_radar_material_intake.sql'));
 if (material) await db.exec(fs.readFileSync('supabase/migrations/' + material, 'utf8')); });
after(() => db.close());
test('migration installs private RLS tables, one timeline, and durable duplicate-safe follows', async () => {
  await publish([{ event, update }]); await publish([{ event, update }]);
  assert.equal((await db.query<any>('select count(*)::int n from impact_radar_events')).rows[0].n, 1);
  assert.equal((await db.query<any>('select count(*)::int n from impact_radar_updates')).rows[0].n, 1);
  await db.exec("insert into impact_radar_follows(user_id,event_id) values('firebase-alice','matter-1') on conflict do nothing;");
  await db.exec("insert into impact_radar_follows(user_id,event_id) values('firebase-alice','matter-1') on conflict do nothing;");
  assert.equal((await db.query<any>('select count(*)::int n from impact_radar_follows')).rows[0].n, 1);
  const rows = await db.query<any>("select relrowsecurity from pg_class where relname in ('impact_radar_events','impact_radar_updates','impact_radar_follows')");
  assert.equal(rows.rows.length, 3); assert.ok(rows.rows.every(r => r.relrowsecurity));
});
test('new evidence updates the case and older intake cannot rewind its state', async () => {
  const later = { ...event, status: 'active', updatedAt: '2026-10-17T10:00:00Z' };
  await publish([{ event: later, update: { ...update, id: 'source-2', publishedAt: later.updatedAt } }]);
  await publish([{ event, update }]);
  assert.equal((await db.query<any>("select status from impact_radar_events where id='matter-1'")).rows[0].status, 'active');
  assert.equal((await db.query<any>('select count(*)::int n from impact_radar_updates')).rows[0].n, 2);
  await assert.rejects(publish([{ event: later, update: { ...update, title: 'rewritten evidence' } }]), /immutable/);
});
test('invalid evidence rolls the batch back instead of leaving partial case records', async () => {
  await assert.rejects(publish([
    { event: { ...event, id: 'rollback-case' }, update: { ...update, id: 'rollback-update', eventId: 'rollback-case' } },
    { event: { ...event, id: 'bad-case', status: 'forecast' }, update: { ...update, id: 'bad-update', eventId: 'bad-case' } },
  ]));
  assert.equal((await db.query<any>("select count(*)::int n from impact_radar_events where id='rollback-case'")).rows[0].n, 0);
});
test('browser roles cannot read or change follows, or call the service publishing function', async () => {
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`);
    try {
      await assert.rejects(db.query('select * from impact_radar_follows'), /permission denied/);
      await assert.rejects(publish([{ event, update }]), /permission denied/);
    } finally { await db.exec('reset role'); }
  }
});
test('later source intake adds evidence without erasing reviewed dates or editorial facts', async () => {
  const reviewed = { ...event, id: 'reviewed-case', information: 'The hearing is listed for the confirmed date.' };
  await publish([{ event: reviewed, update: { ...update, id: 'reviewed-source', eventId: reviewed.id } }]);
  const later = { ...reviewed, status: 'monitoring', scheduledDate: null, information: 'A new source report.', updatedAt: '2026-10-16T10:00:00Z' };
  await publish([{ event: later, update: { id: 'later-source', eventId: reviewed.id, publishedAt: later.updatedAt }, origin: 'intake' }]);
  const row = (await db.query<any>("select status,scheduled_date,data from impact_radar_events where id='reviewed-case'")).rows[0];
  assert.equal(row.status, 'scheduled'); assert.equal(row.data.scheduledDate, reviewed.scheduledDate); assert.equal(row.data.information, reviewed.information); assert.equal(row.data.updatedAt, later.updatedAt);
});

test('F5: categories are seeded, RLS-protected, service writable, and extensible without a code union', async () => {
 const rows = await db.query<any>('select * from impact_categories order by sort_order');
 assert.equal(rows.rows.length, 7);
 assert.equal((await db.query<any>("select relrowsecurity from pg_class where relname='impact_categories'")).rows[0].relrowsecurity, true);
 for (const role of ['anon', 'authenticated']) {
  await db.exec(`set role ${role}`);
  try {
   await assert.rejects(db.query('select * from impact_categories'), /permission denied/);
   await assert.rejects(db.query("insert into impact_categories values('injected','Injected',1,true)"), /permission denied/);
  } finally { await db.exec('reset role'); }
 }
 await db.exec("set role service_role; insert into impact_categories values('court_extra','Court updates',80,true); reset role;");
 const { isRadarEvent } = await import('../../src/shared/impactRadar.js');
 const c = new Set((await db.query<any>('select id from impact_categories')).rows.map(r => r.id));
 const sample = { ...event, id: 'dynamic', category: 'court_extra', title: 'Court hearing listed', authority: 'High Court', companies: [{ name: 'PNC Infratech Ltd', symbol: 'PNCINFRA', scripCode: '539150' }], scheduleConfirmed: true, information: 'A sourced listing.', nextTrigger: null, source: { name: 'BSE', kind: 'disclosure', url: 'https://www.bseindia.com/report.pdf' } };
 assert.equal(isRadarEvent(sample, c), true);
});
test('F9: older event payload with newer evidence advances row and JSON timestamps without rewinding facts', async () => {
 const id = 'monotonic';
 await publish([{ event: { ...event, id, status: 'active', updatedAt: '2026-10-16T10:00:00Z' }, update: { ...update, id: 'monotonic-a', eventId: id } }]);
 await publish([{ event: { ...event, id }, update: { ...update, id: 'monotonic-b', eventId: id, publishedAt: '2026-10-17T10:00:00Z' }, origin: 'intake' }]);
 const row = (await db.query<any>("select status,updated_at,data from impact_radar_events where id='monotonic'")).rows[0];
 assert.equal(row.status, 'active');
 assert.equal(new Date(row.updated_at).toISOString(), '2026-10-17T10:00:00.000Z');
 assert.equal(Date.parse(row.data.updatedAt), Date.parse('2026-10-17T10:00:00Z'));
});
test('material intake rules are private, category-bound and editable without code deployment', async () => {
 const { classifyRadarEvent } = await import('../services/impactRadarService.js');
 const rows = (await db.query<any>('select * from impact_intake_rules order by priority')).rows;
 assert.equal(rows.length, 5);
 assert.equal(classifyRadarEvent('PNC Infratech faces accounting irregularities', rows)?.category, 'governance');
 await db.exec("set role service_role; update impact_intake_rules set terms=array['factory evacuation'] where id='operational_incident'; reset role;");
 const changed = (await db.query<any>('select * from impact_intake_rules')).rows;
 assert.equal(classifyRadarEvent('PNC Infratech reports factory evacuation', changed)?.category, 'operations');
 assert.equal(classifyRadarEvent('PNC Infratech reports factory fire', changed), null);
 await assert.rejects(db.query("insert into impact_intake_rules values('bad','missing','Bad',array['fraud'],'{}',1,true)"), /foreign key/);
 for (const table of ['impact_intake_rules','impact_price_sessions']) {
  assert.equal((await db.query<any>('select relrowsecurity from pg_class where relname=$1', [table])).rows[0].relrowsecurity, true);
  for (const role of ['anon','authenticated']) {
   await db.exec(`set role ${role}`);
   try { await assert.rejects(db.query(`select * from ${table}`), /permission denied/); }
   finally { await db.exec('reset role'); }
  }
 }
});
test('daily price snapshots are duplicate-safe and service role cannot rewrite recorded prices', async () => {
 const row = { symbol:'PNCINFRA', date:'2026-10-13', close:155.44, previousClose:138.25 };
 const insert = "insert into impact_price_sessions(symbol,session_date,data) values('PNCINFRA','2026-10-13',$1) on conflict do nothing";
 await db.exec('set role service_role');
 try {
  await db.query(insert, [JSON.stringify(row)]); await db.query(insert, [JSON.stringify({...row,close:999})]);
  assert.equal((await db.query<any>('select data from impact_price_sessions')).rows[0].data.close, 155.44);
  await assert.rejects(db.query('update impact_price_sessions set data=data'), /permission denied/);
 } finally { await db.exec('reset role'); }
});
