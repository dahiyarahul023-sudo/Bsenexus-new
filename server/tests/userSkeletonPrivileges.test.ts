import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('user skeleton migration denies browser roles and preserves existing paid users on retries', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create table public.users(uid text primary key, tier text, created_at bigint, last_login_at bigint);
      grant select, insert on public.users to service_role;
      create function public.ensure_user_skeleton(p_uid text,p_now bigint) returns void
      language plpgsql security definer as $$ begin
        insert into users values(p_uid,'free',p_now,p_now) on conflict(uid) do nothing; end $$;`);
    const migration = fs.readFileSync('supabase/migrations/20261011031315_restrict_user_skeleton_rpc.sql', 'utf8');
    await db.exec(migration);
    await db.exec(migration); // Safe to retry without widening privileges.
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query("select public.ensure_user_skeleton('foreign-user',1)"), /permission denied for function/);
      await db.exec('reset role');
    }
    await db.exec("insert into users values('paid-user','pro',10,20); set role service_role");
    await db.query("select public.ensure_user_skeleton('new-user',100)");
    await db.query("select public.ensure_user_skeleton('new-user',200)");
    await db.query("select public.ensure_user_skeleton('paid-user',300)");
    await db.exec('reset role');
    assert.deepEqual((await db.query('select * from users order by uid')).rows, [
      { uid: 'new-user', tier: 'free', created_at: 100, last_login_at: 100 },
      { uid: 'paid-user', tier: 'pro', created_at: 10, last_login_at: 20 },
    ]);
    const result = await db.query<{ prosecdef: boolean; proconfig: string[] }>("select prosecdef,proconfig from pg_proc where oid='public.ensure_user_skeleton(text,bigint)'::regprocedure");
    assert.equal(result.rows[0].prosecdef, false);
    assert.deepEqual(result.rows[0].proconfig, ['search_path=""']);
  } finally { await db.close(); }
});
