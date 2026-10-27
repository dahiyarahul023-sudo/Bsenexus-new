import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const day = Date.parse('2026-10-23T00:00:00+05:30');
before(async () => {
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create table public.results_calendar(id text primary key,scrip_code text,data jsonb);');
  for (const [id, timestamp] of [['legacy-one', day], ['legacy-duplicate-purpose', day + 1000], ['invalid', 'bad']] as const) {
    await db.query('insert into public.results_calendar values($1,$2,$3)', [id, '500325', JSON.stringify({meetingTimestamp: timestamp, isNotified: false})]);
  }
  await db.exec(fs.readFileSync('supabase/migrations/20261024171520_calendar_telegram_delivery_ledger.sql', 'utf8'));
});
after(() => db.close());
const claim = (code: string, date = day) => db.query(`insert into public.calendar_telegram_deliveries(scrip_code,meeting_day,state,claim_token)
  values($1,$2,'reserved','00000000-0000-4000-8000-000000000001') on conflict(scrip_code,meeting_day) do nothing returning scrip_code`, [code, date]);

test('cutover suppresses known meetings even when mutable flags are false, using one Indian-day identity', async () => {
  const rows = (await db.query<any>('select * from public.calendar_telegram_deliveries')).rows;
  assert.equal(rows.length, 1);
  assert.equal(Number(rows[0].meeting_day), day);
  assert.equal(rows[0].state, 'suppressed');
  assert.equal((await claim('500325')).rows.length, 0);
  await db.query("update public.results_calendar set data=jsonb_build_object('isNotified',false)");
  assert.equal((await claim('500325')).rows.length, 0, 'a calendar refresh cannot undo delivery history');
});

test('the unique constraint gives concurrent workers one reservation and retains it across restarts', async () => {
  const outcomes = await Promise.all(Array.from({length: 8}, () => claim('532540')));
  assert.equal(outcomes.flatMap(x => x.rows).length, 1);
  assert.equal((await claim('532540')).rows.length, 0);
  assert.equal((await claim('532540', day + 86400000)).rows.length, 1, 'a genuinely rescheduled date is a different meeting');
});

test('browser roles have neither ledger access nor claim privileges', async () => {
  assert.equal((await db.query<any>("select relrowsecurity from pg_class where oid='public.calendar_telegram_deliveries'::regclass")).rows[0].relrowsecurity, true);
  for (const role of ['anon', 'authenticated']) {
    for (const permission of ['SELECT','INSERT','UPDATE','DELETE']) {
      assert.equal((await db.query<any>('select has_table_privilege($1,$2,$3) as allowed', [role,'public.calendar_telegram_deliveries',permission])).rows[0].allowed, false);
    }
  }
  assert.equal((await db.query<any>("select has_table_privilege('service_role','public.calendar_telegram_deliveries','INSERT') as allowed")).rows[0].allowed, true);
});
