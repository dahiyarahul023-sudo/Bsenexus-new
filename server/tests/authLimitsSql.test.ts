import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const sql = fs.readFileSync('supabase/migrations/20261030120109_auth_account_limits_schema.sql', 'utf8');
test('empty database receives exact staging columns and a service-only RLS table; replay preserves counters', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
    await assert.rejects(db.query('select * from public.auth_account_limits'), /does not exist/); // old migration set
    await db.exec(sql);
    const contract = () => db.query<any>("select column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema='public' and table_name='auth_account_limits' order by ordinal_position");
    const before = (await contract()).rows;
    assert.deepEqual(before, [
      { column_name: 'id', data_type: 'text', is_nullable: 'NO', column_default: null },
      { column_name: 'data', data_type: 'jsonb', is_nullable: 'NO', column_default: "'{}'::jsonb" },
      { column_name: 'updated_at', data_type: 'timestamp with time zone', is_nullable: 'NO', column_default: 'now()' },
    ]);
    assert.equal((await db.query<any>("select relrowsecurity from pg_class where oid='public.auth_account_limits'::regclass")).rows[0].relrowsecurity, true);
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      try { await assert.rejects(db.query('select * from auth_account_limits'), /permission denied/); await assert.rejects(db.query("insert into auth_account_limits(id) values('attacker')"), /permission denied/); }
      finally { await db.exec('reset role'); }
    }
    await db.exec('set role service_role');
    try {
      await db.exec("insert into auth_account_limits(id) values('locked'); update auth_account_limits set data='{\"failedAttempts\":5}' where id='locked';");
      const row = (await db.query<any>('select * from auth_account_limits')).rows[0]; assert.equal(row.data.failedAttempts, 5); assert.ok(row.updated_at);
    } finally { await db.exec('reset role'); }
    await db.exec(sql);
    assert.deepEqual((await contract()).rows, before);
    assert.equal((await db.query<any>("select data from auth_account_limits where id='locked'")).rows[0].data.failedAttempts, 5);
    await assert.rejects(db.exec("insert into auth_account_limits(id) values('locked')"), /duplicate key/);
  } finally { await db.close(); }
});
