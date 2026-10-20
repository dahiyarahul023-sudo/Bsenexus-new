import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import compression from "compression";
import { once } from "node:events";
import { mountAiIntegration } from "../ai/http.js";
import { aiDb } from "../database/aiConnectionsDao.js";
import { resetSupabaseClient } from "../database/supabase.js";

const client = {
  client_id: "00000000-0000-0000-0000-000000000001",
  client_name: "Synthetic authorization fixture",
  redirect_uris: ["https://example.com/mcp-callback"],
  token_endpoint_auth_method: "none",
  grant_types: ["authorization_code", "refresh_token"],
  response_types: ["code"],
};
const query = (extra: Record<string, string> = {}) => new URLSearchParams({
  response_type: "code", client_id: client.client_id,
  redirect_uri: client.redirect_uris[0],
  code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
  code_challenge_method: "S256", state: "fixture-state", ...extra,
});
type Mode = "ok" | "lookup-stall" | "write-stall" | "write-error" | "late-write";
async function fixture(run: (f: {
  request: (params?: URLSearchParams, headers?: Record<string, string>) => Promise<Response>;
  setMode: (mode: Mode) => void;
  writes: any[];
  release: () => void;
}) => Promise<void>) {
  const envNames = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "AI_PUBLIC_ORIGIN", "AI_CONNECTIONS_ENABLED", "NODE_ENV"] as const;
  const old = Object.fromEntries(envNames.map(k => [k, process.env[k]]));
  let mode: Mode = "ok";
  let pending: express.Response | undefined;
  const writes: any[] = [];
  const db = express(); db.use(express.json());
  db.get("/rest/v1/ai_connection_clients", (req, res) => {
    if (mode === "lookup-stall") return;
    res.json(req.query.id === "eq." + client.client_id ? { metadata: client } : null);
  });
  db.post("/rest/v1/rpc/:name", (req, res) => {
    if (req.params.name === "register_ai_connection_client") return res.json({ success: true });
    assert.equal(req.params.name, "begin_ai_connection_request");
    writes.push(req.body);
    if (mode === "write-stall") return;
    if (mode === "late-write") { pending = res; return; }
    if (mode === "write-error") return res.status(503).json({ message: "synthetic failure" });
    res.json({ success: true });
  });
  const dbServer = db.listen(0, "127.0.0.1");
  await once(dbServer, "listening");
  process.env.SUPABASE_URL = "http://127.0.0.1:" + (dbServer.address() as any).port;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-ci-key-not-a-real-credential";
  process.env.AI_PUBLIC_ORIGIN = "https://bsenexus.in";
  process.env.AI_CONNECTIONS_ENABLED = "true";
  process.env.NODE_ENV = "production";
  resetSupabaseClient();
  const app = express(); app.set("trust proxy", 1);
  app.use(compression()); app.use(express.json());
  mountAiIntegration(app);
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  const base = "http://127.0.0.1:" + (server.address() as any).port;
  const headers = { Host: "internal-service.run.app", "X-Forwarded-Host": "bsenexus.in", "X-Forwarded-Proto": "https" };
  try {
    await run({
      request: (params = query(), overrides = {}) => fetch(base + "/authorize?" + params, {
        headers: { ...headers, ...overrides }, redirect: "manual", signal: AbortSignal.timeout(4500),
      }),
      setMode: value => { mode = value; },
      writes,
      release: () => { if (pending && !pending.destroyed) pending.json({ success: true }); },
    });
  } finally {
    server.closeAllConnections(); dbServer.closeAllConnections();
    await Promise.all([new Promise<void>(r => server.close(() => r())), new Promise<void>(r => dbServer.close(() => r()))]);
    resetSupabaseClient();
    for (const key of envNames) { if (old[key] === undefined) delete process.env[key]; else process.env[key] = old[key]; }
  }
}

test("valid anonymous authorization persists exact binding and completes consent redirect behind trusted ingress", async () => {
  await fixture(async ({ request, writes }) => {
    for (const accept of ["text/html", "application/json", "*/*"]) {
      const r = await request(query({ resource: "https://bsenexus.in/mcp", scope: "market:read notes:write" }), { Accept: accept });
      assert.equal(r.status, 303);
      const location = new URL(r.headers.get("location")!, "https://bsenexus.in");
      assert.equal(location.origin, "https://bsenexus.in");
      assert.equal(location.pathname, "/plugin");
      assert.match(location.searchParams.get("request")!, /^bnx_req_[A-Za-z0-9_-]{43}$/);
      assert.equal(r.headers.get("cache-control"), "no-store");
      assert.equal(r.headers.get("referrer-policy"), "no-referrer");
      await r.text();
    }
    assert.equal(writes.length, 3);
    assert.equal(new Set(writes.map(w => w.p_hash)).size, 3);
    for (const w of writes) {
      assert.match(w.p_hash, /^[a-f0-9]{64}$/);
      assert.equal(w.p_client, client.client_id);
      assert.equal(w.p_params.redirectUri, client.redirect_uris[0]);
      assert.equal(w.p_params.state, "fixture-state");
      assert.equal(w.p_params.resource, "https://bsenexus.in/mcp");
      assert.deepEqual(w.p_params.scopes, ["account:read", "market:read", "notes:write"]);
    }
  });
});
test("invalid authorization and untrusted hosts terminate without creating consent records", async () => {
  await fixture(async ({ request, writes }) => {
    assert.equal((await request(new URLSearchParams())).status, 400);
    const unknown = await request(query({ client_id: "00000000-0000-0000-0000-000000000099" }));
    assert.equal(unknown.status, 400); assert.equal((await unknown.json()).error, "invalid_client");
    const wrong = await request(query({ redirect_uri: "https://evil.example.org/callback" }));
    assert.equal(wrong.status, 400); assert.equal((await wrong.json()).error_description, "Unregistered redirect_uri");
    assert.equal((await request(query(), { "X-Forwarded-Host": "evil.example.org" })).status, 403);
    for (const extra of [{ state: "" }, { code_challenge_method: "plain" }, { scope: "admin:write" }, { resource: "https://evil.example.org/mcp" }]) {
      const r = await request(query(extra));
      assert.equal(r.status, 302);
      assert.ok(new URL(r.headers.get("location")!).searchParams.get("error"));
    }
    assert.equal(writes.length, 0);
  });
});
test("client lookup and pending-consent storage stalls return OAuth errors before the five-second client limit", async () => {
  await fixture(async ({ request, setMode, writes }) => {
    for (const mode of ["lookup-stall", "write-stall"] as const) {
      setMode(mode);
      const start = Date.now(); const r = await request();
      assert.ok(Date.now() - start < 4000);
      assert.ok(r.status >= 500 && r.status <= 503);
      assert.ok((await r.json()).error);
      assert.equal(r.headers.get("location"), null);
    }
    assert.equal(writes.length, 1);
  });
});
test("storage failure and late completion cannot issue an approval or second redirect", async () => {
  await fixture(async ({ request, setMode, release, writes }) => {
    setMode("write-error");
    let r = await request();
    assert.equal(r.status, 503); assert.equal((await r.json()).error, "temporarily_unavailable");
    setMode("late-write");
    r = await request();
    assert.equal(r.status, 503); assert.equal((await r.json()).error, "temporarily_unavailable");
    assert.equal(r.headers.get("location"), null);
    release();
    await new Promise(r => setTimeout(r, 30));
    assert.equal(writes.length, 2, "timeout does not automatically retry an uncertain write");
  });
});
test("storage deadline settles even when a dependency ignores its abort signal", async () => {
  await fixture(async () => {
    let aborted = false;
    const controller = new AbortController();
    const dependency = {
      abortSignal(signal: AbortSignal) { signal.addEventListener("abort", () => { aborted = true; }); return this; },
      then() { /* never settles, even after cancellation */ },
    };
    const started = Date.now();
    const timer = setTimeout(() => controller.abort(), 30);
    try {
      // Optional deadline signal must bound a non-cooperating PromiseLike too.
      await assert.rejects(aiDb(() => dependency as any, { signal: controller.signal }), (e: any) => e.code === "connection_storage_unavailable");
      assert.ok(Date.now() - started < 500);
      assert.equal(aborted, true);
    } finally { clearTimeout(timer); }
  });
});
