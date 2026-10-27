import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

test("website retries a stale revision and preserves a simultaneous AI stock edit", async (t) => {
  const previousDirectory = process.cwd();
  process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), "bnx-ai-watchlist-")));
  process.env.SUPABASE_URL = "https://synthetic-fixture.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-test-key";
  process.env.AI_CONNECTIONS_ENABLED = "true";
  const storage = await import("../database/supabase.js");
  storage.resetSupabaseClient();
  const w = await import("../database/watchlistDao.js");
  let row = {
    uid: "cas-owner",
    revision: 0,
    lists: [{ id: "list", name: "Before", is_active: 1, items: [] as any[] }],
  };
  let reads = 0,
    updates = 0,
    upserts = 0;
  t.mock.method(storage.getSupabase(), "from", () => {
    let patch: any, expected: number | undefined;
    const query: any = {
      select() {
        return query;
      },
      eq(key: string, value: any) {
        if (key === "revision") expected = value;
        return query;
      },
      update(value: any) {
        patch = value;
        return query;
      },
      upsert() {
        upserts++;
        throw new Error("A read must not overwrite durable data");
      },
      async maybeSingle() {
        const snapshot = structuredClone(row);
        if (++reads === 1) {
          row.lists[0].items.push({ symbol: "TCS", priority: "HIGH" });
          row.revision++;
        }
        return { data: snapshot, error: null };
      },
      then(resolve: any, reject: any) {
        updates++;
        if (expected !== row.revision)
          return Promise.resolve({ data: [], error: null }).then(
            resolve,
            reject,
          );
        row = { ...row, ...structuredClone(patch), revision: row.revision + 1 };
        return Promise.resolve({
          data: [{ revision: row.revision }],
          error: null,
        }).then(resolve, reject);
      },
    };
    return query;
  });
  try {
    assert.equal(await w.renameWatchlist("list", "After", "cas-owner"), true);
    assert.equal(updates, 2);
    assert.equal(row.lists[0].name, "After");
    assert.equal(row.lists[0].items[0].symbol, "TCS");
    w.invalidateUserWatchlistCache("cas-owner");
    assert.equal((await w.getAllWatchlists("cas-owner"))[0].name, "After");
    assert.equal(upserts, 0);
  } finally {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.AI_CONNECTIONS_ENABLED;
    storage.resetSupabaseClient();
    process.chdir(previousDirectory);
  }
});
