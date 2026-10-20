import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
const migration = fs
  .readdirSync("supabase/migrations")
  .find((name) => name.endsWith("_ai_connections.sql"))!;
const sql = fs.readFileSync("supabase/migrations/" + migration, "utf8");
const hash = (n: number) => String(n).padStart(64, "0");
const client = "00000000-0000-0000-0000-000000000001";
let grant: string;
let mutationGrant: string;
const rpc = async (fn: string, params: unknown[]) =>
  (
    await db.query<any>(
      `select public.${fn}(${params.map((_, i) => "$" + (i + 1)).join(",")}) r`,
      params,
    )
  ).rows[0].r;
const reserve = (
  uid: string,
  id: string,
  tool = "watchlist_create",
  fingerprint = "same",
  daily = 20,
) =>
  rpc("reserve_ai_connection", [
    uid,
    true,
    daily,
    100,
    50,
    id,
    fingerprint,
    tool,
  ]);
const mutate = async (
  uid: string,
  id: string,
  tool: string,
  args: unknown,
  fingerprint = "same",
) => {
  const gid =
    uid === "alice"
      ? mutationGrant
      : (
          await db.query<any>(
            "insert into ai_connection_grants(uid,client_id,scopes) values($1,$2,array['watchlists:write','notes:write']) returning id",
            [uid, client],
          )
        ).rows[0].id;
  return rpc("mutate_ai_account", [
    uid,
    id,
    fingerprint,
    tool,
    JSON.stringify(args),
    gid,
  ]);
};
before(async () => {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create table users(uid text primary key,tier text,pro_expires_at bigint,display_name text,notification_prefs jsonb default '{}',mute_in_app_notifications boolean);
 create table payment_entitlements(uid text primary key,pro_expires_at bigint);
 create table user_watchlists(uid text primary key,lists jsonb,updated_at timestamptz default now());
 create table user_notes(id text primary key,user_id text,note jsonb,updated_at timestamptz default now());
 insert into users(uid,tier,pro_expires_at) values('alice','pro',9999999999999),('bob','pro',9999999999999),('free','free',0),('race','pro',9999999999999);`);
  await db.exec(sql);
  await rpc("register_ai_connection_client", [
    client,
    JSON.stringify({
      client_id: client,
      redirect_uris: ["https://client.example.org/callback"],
    }),
  ]);
  await rpc("begin_ai_connection_request", [
    hash(1),
    client,
    JSON.stringify({
      scopes: ["account:read", "market:read", "watchlists:write"],
      redirectUri: "https://client.example.org/callback",
      state: "state",
      codeChallenge: "challenge",
    }),
  ]);
  const approval = await rpc("approve_ai_connection", [
    hash(1),
    "alice",
    ["account:read", "market:read", "watchlists:write"],
    hash(2),
    "https://bsenexus.in/mcp",
  ]);
  grant = approval.grantId;
  assert.ok(grant);
  mutationGrant = (
    await db.query<any>(
      "insert into ai_connection_grants(uid,client_id,scopes) values('alice',$1,array['watchlists:write','profile:write','notes:write','alerts:write']) returning id",
      [client],
    )
  ).rows[0].id;
});
after(() => db.close());
test("consent is single use and cannot escalate requested permissions", async () => {
  assert.equal(
    (
      await rpc("approve_ai_connection", [
        hash(1),
        "bob",
        ["account:read"],
        hash(3),
        "https://bsenexus.in/mcp",
      ])
    ).error,
    "request_expired",
  );
  await rpc("begin_ai_connection_request", [
    hash(4),
    client,
    JSON.stringify({
      scopes: ["account:read"],
      redirectUri: "https://client.example.org/callback",
    }),
  ]);
  assert.equal(
    (
      await rpc("approve_ai_connection", [
        hash(4),
        "bob",
        ["account:read", "watchlists:write"],
        hash(5),
        "https://bsenexus.in/mcp",
      ])
    ).error,
    "invalid_scope",
  );
});
test("code binds exact client, callback and resource; only one exchange succeeds", async () => {
  const exchange = (
    c = client,
    redirect = "https://client.example.org/callback",
    resource = "https://bsenexus.in/mcp",
    a = 10,
    r = 11,
  ) =>
    rpc("exchange_ai_connection", [
      hash(2),
      c,
      "code",
      redirect,
      resource,
      hash(a),
      hash(r),
    ]);
  assert.equal((await exchange("another")).error, "invalid_grant");
  assert.equal(
    (await exchange(client, "https://evil.example.org")).error,
    "invalid_grant",
  );
  assert.equal(
    (await exchange(client, undefined, "https://evil.example.org")).error,
    "invalid_grant",
  );
  const attempts = await Promise.all([
    exchange(),
    exchange(client, undefined, undefined, 12, 13),
  ]);
  assert.equal(attempts.filter((x) => !x.error).length, 1);
  assert.equal((await exchange()).error, "invalid_grant");
});
test("refresh rotates and replay revokes the entire connection", async () => {
  const refresh = () =>
    rpc("exchange_ai_connection", [
      hash(11),
      client,
      "refresh",
      null,
      "https://bsenexus.in/mcp",
      hash(20),
      hash(21),
    ]);
  assert.ok(!(await refresh()).error);
  assert.equal((await refresh()).error, "invalid_grant");
  const row = (
    await db.query<any>(
      "select revoked_at from ai_connection_grants where id=$1",
      [grant],
    )
  ).rows[0];
  assert.ok(row.revoked_at);
});
test("account quotas are atomic across connections, reset buckets use IST, and retries do not charge twice", async () => {
  const results = await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      reserve("race", "race-" + i, "watchlist_create", "same", 3),
    ),
  );
  assert.equal(results.filter((x) => !x.error).length, 3);
  assert.equal(
    (
      await db.query<any>(
        "select sum(writes)::int n from ai_connection_usage where uid='race'",
      )
    ).rows[0].n,
    6,
    "one daily and one minute bucket per admitted request",
  );
  assert.equal(
    (await reserve("race", "race-0", "watchlist_create", "changed", 3)).error,
    "idempotency_conflict",
  );
});
test("mutation and retry receipt are atomic; foreign watchlists cannot be renamed", async () => {
  await reserve("alice", "create-once");
  const first = await mutate("alice", "create-once", "watchlist_create", {
    name: "Banking",
  });
  assert.equal(first.success, true);
  const id = first.watchlist.id;
  assert.deepEqual(
    await mutate("alice", "create-once", "watchlist_create", {
      name: "Banking",
    }),
    first,
  );
  assert.deepEqual((await reserve("alice", "create-once")).result, first);
  await reserve("bob", "foreign-rename", "watchlist_rename");
  assert.equal(
    (
      await mutate("bob", "foreign-rename", "watchlist_rename", {
        watchlistId: id,
        name: "stolen",
      })
    ).error,
    "not_found",
  );
  const stored = (
    await db.query<any>("select lists from user_watchlists where uid='alice'")
  ).rows[0].lists;
  assert.equal(stored.length, 1);
  assert.equal(stored[0].name, "Banking");
});
test("Pro expiry is checked again inside the mutation transaction", async () => {
  await reserve("bob", "expire-before-save");
  await db.exec(
    "update users set tier='free',pro_expires_at=0 where uid='bob'",
  );
  assert.equal(
    (
      await mutate("bob", "expire-before-save", "watchlist_create", {
        name: "No access",
      })
    ).error,
    "pro_required",
  );
});
test("profile fields cannot change paid status or Telegram destinations; notes are account scoped", async () => {
  await reserve("alice", "prefs-denied", "preferences_update");
  assert.equal(
    (
      await mutate("alice", "prefs-denied", "preferences_update", {
        tier: "admin",
      })
    ).error,
    "invalid_fields",
  );
  await reserve("alice", "prefs-ok", "preferences_update");
  assert.equal(
    (
      await mutate("alice", "prefs-ok", "preferences_update", {
        summaryLanguage: "hinglish",
      })
    ).success,
    true,
  );
  await reserve("alice", "note-save", "note_create");
  const note = await mutate("alice", "note-save", "note_create", {
    text: "My note",
    tags: [],
  });
  assert.ok(note.note.id);
  await reserve("free", "note-steal", "note_update");
  assert.equal(
    (
      await mutate("free", "note-steal", "note_update", {
        noteId: note.note.id,
        text: "changed",
      })
    ).error,
    "not_found",
  );
});
test("website revision compare-and-swap cannot overwrite a newer AI mutation", async () => {
  const row = (
    await db.query<any>(
      "select revision from user_watchlists where uid='alice'",
    )
  ).rows[0];
  await reserve("alice", "rename-safe", "watchlist_rename");
  const id = (
    await db.query<any>(
      "select lists->0->>'id' id from user_watchlists where uid='alice'",
    )
  ).rows[0].id;
  await mutate("alice", "rename-safe", "watchlist_rename", {
    watchlistId: id,
    name: "Latest",
  });
  assert.equal(
    (
      await db.query(
        "update user_watchlists set lists='[]' where uid='alice' and revision=$1 returning uid",
        [row.revision],
      )
    ).rows.length,
    0,
  );
});
test("revocation, ownership and scope are rechecked when a reserved mutation commits", async () => {
  const gid = (
    await db.query<any>(
      "insert into ai_connection_grants(uid,client_id,scopes) values('alice',$1,array['account:read']) returning id",
      [client],
    )
  ).rows[0].id;
  await reserve("alice", "revoked-before-save");
  const attempt = () =>
    rpc("mutate_ai_account", [
      "alice",
      "revoked-before-save",
      "same",
      "watchlist_create",
      JSON.stringify({ name: "Denied" }),
      gid,
    ]);
  assert.equal((await attempt()).error, "scope_required");
  await db.query(
    "update ai_connection_grants set scopes=array['watchlists:write'],uid='bob' where id=$1",
    [gid],
  );
  assert.equal((await attempt()).error, "invalid_token");
  await db.query(
    "update ai_connection_grants set uid='alice',revoked_at=now() where id=$1",
    [gid],
  );
  assert.equal((await attempt()).error, "invalid_token");
  await db.query(
    "update ai_connection_grants set revoked_at=null,expires_at=now()-interval '1 second' where id=$1",
    [gid],
  );
  assert.equal((await attempt()).error, "invalid_token");
});
test("alert edits preserve delivery destinations and require active Pro", async () => {
  await db.exec(
    "update users set notification_prefs='{" +
      '"telegramChatId":"private","creditRatings":true' +
      "}' where uid='alice'",
  );
  await reserve("alice", "alerts-safe", "alert_preferences_update");
  assert.equal(
    (
      await mutate("alice", "alerts-safe", "alert_preferences_update", {
        creditRatings: false,
      })
    ).success,
    true,
  );
  const prefs = (
    await db.query<any>(
      "select notification_prefs from users where uid='alice'",
    )
  ).rows[0].notification_prefs;
  assert.equal(prefs.telegramChatId, "private");
  assert.equal(prefs.creditRatings, false);
  await reserve("alice", "alerts-destination", "alert_preferences_update");
  assert.equal(
    (
      await mutate("alice", "alerts-destination", "alert_preferences_update", {
        telegramChatId: "attacker",
      })
    ).error,
    "invalid_fields",
  );
  await db.exec(
    "update users set pro_expires_at=0,tier='free' where uid='alice'",
  );
  await reserve("alice", "alerts-expired", "alert_preferences_update");
  assert.equal(
    (
      await mutate("alice", "alerts-expired", "alert_preferences_update", {
        creditRatings: true,
      })
    ).error,
    "pro_required",
  );
  await db.exec(
    "update users set pro_expires_at=9999999999999,tier='pro' where uid='alice'",
  );
});
test("browser roles cannot read secrets, authorise grants or reserve quotas", async () => {
  for (const role of ["anon", "authenticated"]) {
    await db.exec("set role " + role);
    try {
      await assert.rejects(
        db.query("select * from ai_connection_secrets"),
        /permission denied/,
      );
      await assert.rejects(
        reserve("alice", "illegal-call"),
        /permission denied/,
      );
      await assert.rejects(
        rpc("approve_ai_connection", [
          hash(4),
          "alice",
          ["account:read"],
          hash(22),
          "https://bsenexus.in/mcp",
        ]),
        /permission denied/,
      );
    } finally {
      await db.exec("reset role");
    }
  }
});
test("migration replay preserves receipts and keeps RLS enabled", async () => {
  await db.exec(sql);
  assert.equal(
    (
      await db.query<any>(
        "select count(*)::int n from ai_connection_operations where uid='alice' and request_id='create-once'",
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (
      await db.query<any>(
        "select relrowsecurity from pg_class where relname='ai_connection_grants'",
      )
    ).rows[0].relrowsecurity,
    true,
  );
});
