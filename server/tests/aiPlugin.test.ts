import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import {
  aiPluginRouter,
  getOpenApiSpec,
  getGeminiToolsSpec,
} from "../api/aiPlugin.js";
import { mountAiIntegration } from "../ai/http.js";

test("published operations match registered GET routes and explicitly declare OAuth", () => {
  const spec = getOpenApiSpec();
  const routes = (aiPluginRouter as any).stack
    .filter((l: any) => l.route)
    .map((l: any) => l.route);
  for (const [path, operation] of Object.entries(spec.paths)) {
    assert.ok(
      routes.some(
        (r: any) => r.path === path.replace("/api/ai", "") && r.methods.get,
      ),
    );
    assert.ok(
      (operation as any).get.security[0].BsenexusOAuth.includes("market:read"),
    );
  }
  assert.equal(getGeminiToolsSpec().functionDeclarations.length, 4);
  assert.match(getGeminiToolsSpec().execution, /must execute/);
});
test("HTTP discovery is accessible, personal calls require OAuth and all denial paths keep CORS/no-store", async () => {
  process.env.AI_CONNECTIONS_ENABLED = "true";
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use("/api/ai", aiPluginRouter);
  mountAiIntegration(app);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = "http://127.0.0.1:" + (server.address() as any).port;
  try {
    for (const method of ["GET", "HEAD", "OPTIONS"]) {
      const res = await fetch(base + "/api/ai/openapi.json", {
        method,
        headers: { Origin: "https://client.example.org" },
      });
      assert.ok([200, 204].includes(res.status));
      assert.equal(res.headers.get("access-control-allow-origin"), "*");
      assert.equal(res.headers.get("cache-control"), "no-store");
    }
    for (const path of [
      "/filings?symbol=500325",
      "/results?symbol=TCS",
      "/board-meetings",
      "/company?query=TCS",
    ]) {
      const res = await fetch(base + "/api/ai/v1" + path);
      assert.equal(res.status, 401);
      assert.ok(res.headers.get("www-authenticate"));
      assert.equal(res.headers.get("access-control-allow-origin"), "*");
      assert.equal(res.headers.get("cache-control"), "no-store");
    }
    const write = await fetch(base + "/api/ai/v1/filings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(write.status, 405);
    const meta = await fetch(
      base + "/.well-known/oauth-authorization-server",
    ).then((r) => r.json());
    assert.deepEqual(meta.code_challenge_methods_supported, ["S256"]);
    assert.ok(meta.registration_endpoint.endsWith("/register"));
    const mcp = await fetch(base + "/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    assert.equal(mcp.status, 401);
    process.env.AI_CONNECTIONS_ENABLED = "false";
    for (const path of [
      "/mcp",
      "/register",
      "/token",
      "/api/ai/v1/company?query=TCS",
    ]) {
      const disabled = await fetch(base + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      // The REST compatibility API only permits GET regardless of enablement.
      assert.equal(disabled.status, path.startsWith("/api/ai") ? 405 : 503);
      assert.equal(disabled.headers.get("cache-control"), "no-store");
    }
    assert.equal(
      (await fetch(base + "/api/ai/v1/company?query=TCS")).status,
      503,
    );
  } finally {
    delete process.env.AI_CONNECTIONS_ENABLED;
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  }
});
