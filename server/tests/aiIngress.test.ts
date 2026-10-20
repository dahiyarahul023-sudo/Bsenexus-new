import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import { request as httpRequest } from "node:http";
import { mountAiIntegration } from "../ai/http.js";
import { aiOAuthProvider } from "../ai/oauth.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

test("canonical OAuth discovery survives a trusted ingress host rewrite without trusting arbitrary hosts", async () => {
  const old = process.env.AI_CONNECTIONS_ENABLED;
  const oldMode = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  process.env.AI_CONNECTIONS_ENABLED = "true";
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  mountAiIntegration(app);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const headers = {
    Host: "internal-service.run.app",
    "X-Forwarded-Host": "bsenexus.in",
  };
  try {
    for (const path of [
      "/.well-known/oauth-authorization-server",
      "/.well-known/oauth-protected-resource",
      "/.well-known/oauth-protected-resource/mcp",
    ]) {
      const response = await fetch(base + path, { headers });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      const data = await response.json();
      assert.equal(
        data.issuer || data.resource,
        data.issuer ? "https://bsenexus.in/" : "https://bsenexus.in/mcp",
      );
    }
    assert.equal((await fetch(base + "/mcp", { headers })).status, 401);
    for (const host of ["evil.example.org", "bsenexus.in.evil.example.org"]) {
      assert.equal(
        (
          await fetch(base + "/.well-known/oauth-authorization-server", {
            headers: { ...headers, "X-Forwarded-Host": host },
          })
        ).status,
        403,
      );
    }
    app.set("trust proxy", false);
    assert.equal(
      (
        await fetch(base + "/.well-known/oauth-authorization-server", {
          headers,
        })
      ).status,
      403,
    );
    app.set("trust proxy", 1);
    const missingHost = await new Promise<number>((resolve, reject) => {
      const request = httpRequest(base + "/.well-known/oauth-authorization-server", { setHost: false }, (response) => {
        response.resume();
        resolve(response.statusCode || 0);
      });
      request.on("error", reject);
      request.end();
    });
    assert.ok([400, 403].includes(missingHost));
    for (const origin of [
      "https://evil.example.org",
      "null",
      "https://bsenexus.in.evil.example.org",
    ]) {
      const denied = await fetch(base + "/mcp", {
        headers: { ...headers, Origin: origin },
      });
      assert.equal(denied.status, 403);
      assert.equal(
        (
          await fetch(base + "/mcp", {
            method: "OPTIONS",
            headers: { ...headers, Origin: origin },
          })
        ).status,
        403,
      );
    }
    for (const origin of [
      "https://bsenexus.in",
      "https://chatgpt.com",
      "https://gemini.google.com",
      "https://claude.ai",
    ]) {
      assert.equal(
        (
          await fetch(base + "/mcp", {
            headers: { ...headers, Origin: origin },
          })
        ).status,
        401,
      );
      assert.equal(
        (
          await fetch(base + "/mcp", {
            method: "OPTIONS",
            headers: { ...headers, Origin: origin },
          })
        ).status,
        204,
      );
    }
    process.env.AI_CONNECTIONS_ENABLED = "false";
    assert.equal((await fetch(base + "/mcp", { headers })).status, 503);
  } finally {
    if (old === undefined) delete process.env.AI_CONNECTIONS_ENABLED;
    else process.env.AI_CONNECTIONS_ENABLED = old;
    if (oldMode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = oldMode;
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("a remote SDK client initializes and discovers scoped tools after bearer authentication", async () => {
  const old = process.env.AI_CONNECTIONS_ENABLED;
  process.env.AI_CONNECTIONS_ENABLED = "true";
  const original = aiOAuthProvider.verifyAccessToken;
  const token = "bnx_at_" + "a".repeat(43);
  // Protocol smoke only: SQL/real-token security is covered independently.
  aiOAuthProvider.verifyAccessToken = async (value) => {
    assert.equal(value, token);
    return { token, clientId: "synthetic-client", scopes: ["account:read", "market:read"], expiresAt: Math.floor(Date.now() / 1000) + 60, resource: new URL("https://bsenexus.in/mcp"), extra: { uid: "synthetic-owner", grantId: "synthetic-grant" } };
  };
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  mountAiIntegration(app);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const url = new URL(`http://127.0.0.1:${(server.address() as any).port}/mcp`);
  const client = new Client({ name: "BSE test client", version: "1.0.0" });
  try {
    const cookieOnly = await fetch(url, { headers: { Cookie: "authToken=site-session" } });
    assert.equal(cookieOnly.status, 401);
    assert.match(cookieOnly.headers.get("www-authenticate") || "", /oauth-protected-resource\/mcp/);
    await client.connect(new StreamableHTTPClientTransport(url, { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
    const { tools } = await client.listTools();
    assert.ok(tools.some((tool) => tool.name === "filings_search"));
    assert.ok(tools.some((tool) => tool.name === "watchlist_create"));
    assert.ok(!tools.some((tool) => /admin|payments|execute_sql/.test(tool.name)));
    assert.ok(tools.every((tool) => tool.inputSchema.type === "object"));
    const profile = tools.find((tool) => tool.name === "get_profile")!;
    assert.equal(profile.outputSchema?.type, "object");
    assert.deepEqual(profile.outputSchema?.required, ["id", "name"]);
    const denied = await client.callTool({ name: "filings_search", arguments: { unexpected: "not permitted" } });
    assert.equal(denied.isError, true, "registration must retain runtime input validation");
  } finally {
    await client.close();
    aiOAuthProvider.verifyAccessToken = original;
    if (old === undefined) delete process.env.AI_CONNECTIONS_ENABLED;
    else process.env.AI_CONNECTIONS_ENABLED = old;
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
