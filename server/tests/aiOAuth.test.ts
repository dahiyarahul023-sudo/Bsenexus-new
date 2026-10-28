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
      redirect_uris: ["http://127.0.0.2/cb"],
    },
    {
      token_endpoint_auth_method: "none",
      redirect_uris: ["https://client.example.org/cb#fragment"],
    },
  ])
    await assert.rejects(provider.clientsStore.registerClient(meta as any));
  // Omitted token_endpoint_auth_method defaults to "none" (RFC 7591) and proceeds to URL validation
  await assert.rejects(
    provider.clientsStore.registerClient({
      redirect_uris: ["http://insecure-http.example.org/cb"],
    } as any),
    /Callbacks must be public HTTPS URLs/,
  );
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

test('real OAuth provider registers Claude JSON callbacks and preserves S256 native loopback port rules',async()=>{
  const { clientRegistrationHandler }=await import('@modelcontextprotocol/sdk/server/auth/handlers/register.js');
  const { authorizationHandler }=await import('@modelcontextprotocol/sdk/server/auth/handlers/authorize.js');
  const stored=new Map<string,any>(),requests:any[]=[];
  const provider=new BsenexusOAuthProvider({rpc:async(name,args)=>{if(name==='register_ai_connection_client'){stored.set(args.p_id as string,args.p_metadata);return {success:true}}requests.push(args);return {success:true};},db:async action=>{let id='';const q={select:()=>q,eq:(_key:string,value:string)=>{id=value;return q},maybeSingle:async()=>({data:stored.has(id)?{metadata:stored.get(id)}:null,error:null})};const result=await action({from:()=>q} as any);return result.data;}});
  const app=express();app.use('/register',clientRegistrationHandler({clientsStore:provider.clientsStore,rateLimit:false}));app.use('/authorize',authorizationHandler({provider,rateLimit:false}));
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${(server.address() as any).port}`;
  try {
    const registered=await fetch(base+'/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({client_name:'Directory fixture',token_endpoint_auth_method:'none',grant_types:['authorization_code','refresh_token'],response_types:['code'],redirect_uris:['https://claude.ai/api/mcp/auth_callback','http://localhost:1234/callback','http://127.0.0.1:1234/callback']})});
    assert.equal(registered.status,201);const client=await registered.json();assert.equal(client.client_secret,undefined);
    const authorize=async(redirect:string,method='S256')=>fetch(base+'/authorize?'+new URLSearchParams({client_id:client.client_id,redirect_uri:redirect,response_type:'code',scope:'market:read',state:'synthetic-state',code_challenge:'c'.repeat(43),code_challenge_method:method,resource:'https://bsenexus.in/mcp'}),{redirect:'manual'});
    for(const redirect of ['https://claude.ai/api/mcp/auth_callback','http://localhost:55555/callback','http://127.0.0.1:55556/callback']){const response=await authorize(redirect);assert.equal(response.status,200);assert.match(await response.text(),/Connecting to Bsenexus/);assert.equal(requests.at(-1).p_params.redirectUri,redirect);}
    const before=requests.length;assert.equal((await authorize('http://localhost:55555/callback','plain')).status,302);assert.equal(requests.length,before,'invalid PKCE cannot persist a consent request');
    assert.equal((await authorize('http://localhost:55555/other')).status,400);assert.equal(requests.length,before);
    assert.equal((await fetch(base+'/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token_endpoint_auth_method:'none',grant_types:['client_credentials'],redirect_uris:['https://claude.ai/api/mcp/auth_callback']})})).status,400);
  } finally {server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
