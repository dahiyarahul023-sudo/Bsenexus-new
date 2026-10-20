// Optional browser regression: PLAYWRIGHT_MODULE points to an isolated Playwright
// install. Run with node --import tsx; no production credentials or grants.
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { once } from 'node:events';
import { pathToFileURL } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { mountAiIntegration } from '../server/ai/http.ts';
import { resetSupabaseClient } from '../server/database/supabase.ts';
import { hashSecret } from '../server/ai/policy.ts';
import { SPA_PATHS, normalizeSpaPath } from '../server/utils/spaRoutes.ts';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const client={client_id:'00000000-0000-0000-0000-000000000001',redirect_uris:['https://example.com/callback'],token_endpoint_auth_method:'none'};
const servers=[];
const listen=async app=>{const s=app.listen(0,'127.0.0.1');servers.push(s);await once(s,'listening');return 'http://127.0.0.1:'+s.address().port;};
const writes=[];
let vite,browser;
try {
  const db=express();db.use(express.json());
  db.get('/rest/v1/ai_connection_clients',(_req,res)=>res.json({metadata:client}));
  db.post('/rest/v1/rpc/begin_ai_connection_request',(req,res)=>{writes.push(req.body);res.json({success:true});});
  process.env.SUPABASE_URL=await listen(db);
  process.env.SUPABASE_SERVICE_ROLE_KEY='synthetic-browser-fixture-not-a-real-key';
  process.env.AI_CONNECTIONS_ENABLED='true';
  process.env.AI_PUBLIC_ORIGIN='https://bsenexus.in';
  resetSupabaseClient();
  const upstream=express();upstream.set('trust proxy',1);upstream.use(express.json());
  mountAiIntegration(upstream);
  vite=await createViteServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
  upstream.get('*',async(req,res,next)=>{
    if(!new Set(SPA_PATHS).has(normalizeSpaPath(req.path)))return next();
    try {res.type('html').send(await vite.transformIndexHtml(req.originalUrl,fs.readFileSync(path.join(process.cwd(),'index.html'),'utf8')));} catch(e){next(e);}
  });
  upstream.use(vite.middlewares);
  const origin=await listen(upstream);
  const gateway=express();
  // Reproduce the real ingress: consume upstream HTTP redirects while keeping
  // the original URL visible to the browser. Browser navigation must fix it.
  gateway.use(async(req,res,next)=>{
    try {
      const response=await fetch(origin+req.originalUrl,{redirect:'follow',headers:{'X-Forwarded-Host':'bsenexus.in','X-Forwarded-Proto':'https'},signal:AbortSignal.timeout(8000)});
      const body=Buffer.from(await response.arrayBuffer());
      for(const name of ['content-type','cache-control','referrer-policy','x-robots-tag']){const v=response.headers.get(name);if(v)res.setHeader(name,v);}
      res.status(response.status).send(body);
    }catch(e){next(e);}
  });
  const base=await listen(gateway);
  browser=await chromium.launch();
  const query=new URLSearchParams({response_type:'code',client_id:client.client_id,redirect_uri:client.redirect_uris[0],code_challenge:'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',code_challenge_method:'S256',state:'synthetic-browser-state'});
  for(const width of [390,768,1440]){
    const context=await browser.newContext({viewport:{width,height:900}});
    const page=await context.newPage();const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    // Prevent external services during anonymous rendering.
    await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
    await page.goto(base+'/authorize?'+query,{waitUntil:'domcontentloaded'});
    await page.waitForURL(url=>url.pathname==='/plugin'&&url.searchParams.has('request'),{timeout:20000});
    await page.getByRole('heading',{name:'Choose what your AI can do',exact:true}).waitFor({timeout:20000});
    await page.getByRole('button',{name:'Sign in to continue',exact:true}).waitFor({timeout:20000});
    const token=new URL(page.url()).searchParams.get('request');
    assert.match(token,/^bnx_req_[A-Za-z0-9_-]{43}$/);
    assert.ok(writes.some(w=>w.p_hash===hashSecret(token)),'browser carries the exact persisted consent binding');
    assert.equal(await page.getByRole('heading',{name:'Page Not Found',exact:true}).count(),0);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.reload({waitUntil:'domcontentloaded'});
    await page.getByRole('heading',{name:'Choose what your AI can do',exact:true}).waitFor();
    assert.equal(new URL(page.url()).searchParams.get('request'),token);
    await page.getByRole('button',{name:'Cancel setup',exact:true}).click();
    await page.waitForURL(url=>url.pathname==='/plugin'&&!url.searchParams.has('request'));
    await page.getByRole('heading',{name:'Use BSE Nexus in your AI',exact:true}).waitFor();
    await page.goBack({waitUntil:'domcontentloaded'});
    await page.getByRole('heading',{name:'Choose what your AI can do',exact:true}).waitFor();
    assert.equal(new URL(page.url()).searchParams.get('request'),token);
    assert.deepEqual(errors,[]);
    console.log('FIXTURE_BROWSER',JSON.stringify({width,consent:true,refresh:true,back:true,overflow:false,pageErrors:errors.length}));
    await context.close();
  }
  // Meta refresh also works without JS; a manual link remains available.
  const noJs=await browser.newContext({javaScriptEnabled:false});
  const page=await noJs.newPage();
  await page.goto(base+'/authorize?'+query);
  await page.waitForURL(url=>url.pathname==='/plugin'&&url.searchParams.has('request'));
  console.log('FIXTURE_NO_JS browser reached consent URL');
  await noJs.close();
  assert.ok(writes.every(w=>w.p_params.state==='synthetic-browser-state'));
} finally {
  await browser?.close();await vite?.close();
  for(const s of servers)s.closeAllConnections();
  await Promise.all(servers.map(s=>new Promise(r=>s.close(r))));
  resetSupabaseClient();
}
