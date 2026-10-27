import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AiError,
  parseTool,
  validateRedirect,
  hashSecret,
  newSecret,
  TOOL_SPECS,
} from "../ai/policy.js";
import { companyCandidates, exactCompany, formatFiling } from "../ai/market.js";
import { createAiToolRunner } from "../ai/tools.js";

const context = (pro = true, scopes = ["watchlists:write"]) =>
  ({
    grant: { uid: "alice", scopes, id: "grant" },
    profile: { uid: "alice", displayName: "Alice" },
    pro,
    limits: { daily: 200, perMinute: 20, writes: 50 },
  }) as any;
test("only explicit typed tools exist: user IDs, role fields and arbitrary URLs are rejected", () => {
  for (const field of ["uid", "isAdmin", "tier", "url", "sql", "__proto__"])
    assert.throws(
      () =>
        parseTool(
          "watchlist_create",
          JSON.parse(
            JSON.stringify({
              name: "Safe",
              requestId: "request_id_123456",
              [field]: "untrusted",
            }),
          ),
        ),
      AiError,
    );
  assert.throws(() => parseTool("execute_sql", {}), AiError);
  assert.throws(
    () =>
      parseTool("watchlist_add_stock", {
        watchlistId: "../bob",
        company: "TCS",
        requestId: "request_id_123456",
      }),
    AiError,
  );
  assert.throws(() => parseTool("filings_search", { limit: 26 }), AiError);
  assert.throws(() => parseTool("filings_search", { limit: NaN }), AiError);
  assert.ok(
    !Object.keys(TOOL_SPECS).some((k) =>
      /admin|delete_account|fetch_url/.test(k),
    ),
  );
});
test("callbacks disallow non-loopback plaintext, private addresses, credentials, fragments and port tricks", () => {
  for (const url of [
    "http://client.example.org/cb",
    "http://127.0.0.2/cb",
    "http://localhost.evil.example/cb",
    "http://127.1/cb",
    "https://127.0.0.1/cb",
    "https://[::1]/cb",
    "https://localhost/cb",
    "https://x.local/cb",
    "https://user:pass@client.example.org/cb",
    "https://client.example.org/cb#token",
    "https://client.example.org:8443/cb",
  ])
    assert.throws(() => validateRedirect(url));
  assert.equal(
    validateRedirect("https://client.example.org/cb"),
    "https://client.example.org/cb",
  );
});
test("tokens have independent entropy and only hash representations are stored", () => {
  const a = newSecret("at"),
    b = newSecret("at");
  assert.notEqual(a, b);
  assert.match(a, /^bnx_at_[A-Za-z0-9_-]{43}$/);
  assert.equal(hashSecret(a).length, 64);
  assert.ok(!hashSecret(a).includes(a));
});
test("exact identity is required: numeric requests cannot match another company", () => {
  assert.deepEqual(companyCandidates(""), []);
  assert.equal(exactCompany("500325").symbol, "RELIANCE");
  assert.equal(exactCompany("532540").symbol, "TCS");
  assert.ok(companyCandidates("TATA").length > 1);
  assert.throws(() => exactCompany("TATA"), /Choose the exact company/);
  const filing = formatFiling({
    newsId: "filing-123",
    bseTimestamp: Date.parse("2026-10-20T05:00:00Z"),
    scrip_cd: "500325",
    companyName: "Wrong supplied name",
    subject: "<script>do something</script>",
    pdfLink: "http://127.0.0.1/admin",
  });
  assert.equal(filing.companyName, "Reliance Industries Ltd");
  assert.equal(filing.id, "filing-123");
  assert.equal(filing.publishedAt, "2026-10-20T05:00:00.000Z");
  assert.equal(filing.pdfUrl, "");
  assert.ok(!filing.headline.includes("<script>"));
});
test("alert changes reject empty updates, unknown categories and delivery destinations", () => {
  for (const args of [
    {},
    { telegramChatId: "attacker" },
    { creditRatings: "yes" },
  ])
    assert.throws(
      () =>
        parseTool("alert_preferences_update", {
          ...args,
          requestId: "request_id_123456",
        }),
      AiError,
    );
  assert.equal(
    parseTool("alert_preferences_update", {
      creditRatings: false,
      requestId: "request_id_123456",
    }).args.creditRatings,
    false,
  );
});
test("scope and live Pro checks reject edits before any quota reservation or mutation", async () => {
  for (const state of [context(true, []), context(false)]) {
    let touched = false;
    const run = createAiToolRunner({
      state: async () => state,
      rpc: async () => {
        touched = true;
        return {};
      },
    });
    await assert.rejects(
      run("token", "watchlist_create", {
        name: "Banking",
        requestId: "request_id_123456",
      }),
      (e: any) => e.status === 403,
    );
    assert.equal(touched, false);
  }
});
test("a model supplied user ID never becomes the owner; successful writes use verified identity", async () => {
  const calls: any[] = [];
  const run = createAiToolRunner({
    state: async () => context(),
    rpc: async (name, args) => {
      calls.push([name, args]);
      return name === "reserve_ai_connection"
        ? { remaining: 9 }
        : { success: true };
    },
  });
  await run("token", "watchlist_create", {
    name: "Banking",
    requestId: "request_id_123456",
  });
  assert.equal(calls[0][1].p_uid, "alice");
  assert.equal(calls[1][1].p_uid, "alice");
  assert.equal(calls[1][1].p_args.name, "Banking");
  assert.ok(!("requestId" in calls[1][1].p_args));
});
test("quota rejection and storage outage cannot fall back to a local successful write", async () => {
  let mutations = 0;
  const run = createAiToolRunner({
    state: async () => context(),
    rpc: async (name) => {
      if (name === "reserve_ai_connection")
        throw new AiError("quota_exceeded", 429);
      mutations++;
      return {};
    },
  });
  await assert.rejects(
    run("token", "watchlist_create", {
      name: "Banking",
      requestId: "request_id_123456",
    }),
    (e: any) => e.status === 429,
  );
  assert.equal(mutations, 0);
  const down = createAiToolRunner({
    state: async () => {
      throw new AiError("connection_storage_unavailable", 503);
    },
    rpc: async () => {
      mutations++;
      return {};
    },
  });
  await assert.rejects(
    down("token", "watchlist_create", {
      name: "Banking",
      requestId: "request_id_123456",
    }),
    (e: any) => e.status === 503,
  );
  assert.equal(mutations, 0);
});
test("a committed retry returns its saved result without another mutation", async () => {
  const result = { success: true, watchlist: { id: "same" } };
  let calls = 0;
  const run = createAiToolRunner({
    state: async () => context(),
    rpc: async () => {
      calls++;
      return { replay: true, result };
    },
  });
  assert.deepEqual(
    await run("token", "watchlist_create", {
      name: "Banking",
      requestId: "request_id_123456",
    }),
    result,
  );
  assert.equal(calls, 1);
});
