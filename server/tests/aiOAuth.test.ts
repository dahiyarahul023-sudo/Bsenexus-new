import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import express from "express";
import { once } from "node:events";
import { tokenHandler } from "@modelcontextprotocol/sdk/server/auth/handlers/token.js";
import { BsenexusOAuthProvider } from "../ai/oauth.js";

test("OAuth provider rejects unsafe registration metadata before touching storage", async () => {
  const provider = new BsenexusOAuthProvider();
  for (const meta of [
    {
      token_endpoint_auth_method: "client_secret_post",
      redirect_uris: ["https://client.example.org/cb"],
    },
    {
      token_endpoint_auth_method: "none",
      redirect_uris: ["http://127.0.0.1/cb"],
    },
    {
      token_endpoint_auth_method: "none",
      redirect_uris: ["https://client.example.org/cb#fragment"],
    },
  ])
    await assert.rejects(provider.clientsStore.registerClient(meta as any));
});
test("the pinned OAuth SDK enforces S256 PKCE before exchanging a code", async () => {
  const verifier = "v".repeat(50),
    challenge = createHash("sha256").update(verifier).digest("base64url");
  let exchanged = 0;
  const client = {
    client_id: "known-client",
    redirect_uris: ["https://client.example.org/callback"],
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
  };
  const provider = {
    clientsStore: {
      getClient: async (id: string) =>
        id === client.client_id ? client : undefined,
    },
    challengeForAuthorizationCode: async () => challenge,
    exchangeAuthorizationCode: async () => {
      exchanged++;
      return {
        access_token: "synthetic",
        token_type: "Bearer",
        expires_in: 900,
      };
    },
  } as any;
  const app = express();
  app.use("/token", tokenHandler({ provider, rateLimit: false }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const url = "http://127.0.0.1:" + (server.address() as any).port + "/token";
  const exchange = (v: string, id = "known-client") =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: id,
        code: "synthetic-code",
        code_verifier: v,
        redirect_uri: client.redirect_uris[0],
      }),
    });
  try {
    assert.equal((await exchange("bad-verifier")).status, 400);
    assert.equal(exchanged, 0);
    const unknown = await exchange(verifier, "unknown-client");
    assert.equal(unknown.status, 400);
    assert.equal((await unknown.json()).error, "invalid_client");
    assert.equal(exchanged, 0);
    assert.equal((await exchange(verifier)).status, 200);
    assert.equal(exchanged, 1);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  }
});
