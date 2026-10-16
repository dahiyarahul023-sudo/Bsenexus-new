import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const sql = fs.readFileSync('supabase/migrations/20261016180236_impact_radar.sql', 'utf8');
const event = { id: 'matter-1', status: 'scheduled', scheduledDate: '2026-10-17', publishedAt: '2026-10-15T10:00:00Z', updatedAt: '2026-10-15T10:00:00Z' };
const update = { id: 'source-1', eventId: 'matter-1', publishedAt: event.publishedAt };
const publish = (records: any) => db.query('select public.publish_impact_radar_records($1::jsonb)', [JSON.stringify(records)]);
before(async () => { await db.exec('create role anon; create role authenticated; create role service_role bypassrls;'); await db.exec(sql); });
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
