// Real gift components/CSS with explicit synthetic auth/API adapters. No emails,
// payment, Firebase or production database calls. Does not certify live providers.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';
const token = 'bnx_gift_' + 'a'.repeat(43), inviteId = '11111111-1111-4111-8111-111111111111';
const bootstrap = fs.readFileSync('index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const fixtures = { items: [], calls: [], failRead: false, readStatus: 503, readError: 'Fixture storage unavailable', delay: false };
const cache = await mkdtemp(path.join(os.tmpdir(), 'gift-browser-'));
const auth = `import {useSyncExternalStore} from 'react';
let account=null;const listeners=new Set();
const person=uid=>({uid,email:uid==='owner'?'owner@example.com':uid==='other'?'other@example.com':'recipient@example.com',isAnonymous:false,getIdToken:async()=> 'fixture-firebase-token-'+uid});
window.giftSetAccount=uid=>{account=uid?person(uid):null;listeners.forEach(f=>f())};
export function useAuth(){const user=useSyncExternalStore(f=>{listeners.add(f);return()=>listeners.delete(f)},()=>account);return {user,authLoading:false,setIsAuthModalOpen:()=>window.giftSetAccount('recipient'),setIsAdminPinModalOpen:()=>{},refreshProfile:async()=>{},logout:async()=>window.giftSetAccount(null)}};`;
const entry = `import React from 'react';import {createRoot} from 'react-dom/client';import {AdminGiftAccess} from '/src/components/AdminGiftAccess.tsx';import {GiftActivationPage} from '/src/components/GiftActivationPage.tsx';
const mode=new URLSearchParams(location.search).get('mode');if(mode==='admin')window.giftSetAccount('owner');createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode,null,React.createElement(mode==='admin'?AdminGiftAccess:GiftActivationPage)));`;
const server = await createServer({configFile:false,cacheDir:cache,server:{host:'127.0.0.1',port:0,hmr:false},optimizeDeps:{entries:[],include:['react','react-dom','react-dom/client','react/jsx-runtime','react/jsx-dev-runtime']},plugins:[{
 name:'gift-offline-adapters',enforce:'pre',resolveId(source,importer){
  if(source==='/@gift-fixture')return '\0gift-entry';
  if(importer && /\/(AdminGiftAccess|GiftActivationPage)\.tsx$/.test(importer)) {
   if(source==='../context/AuthContext')return '\0gift-auth';
   if(source==='../api')return '\0gift-api';
  }
 },load(id){if(id==='\0gift-entry')return entry;if(id==='\0gift-auth')return auth;if(id==='\0gift-api')return 'export const customFetch=(...args)=>fetch(...args);';},
 configureServer(vite){vite.middlewares.use(async(req,res,next)=>{
  if(req.url.startsWith('/fixture') || req.url.startsWith('/activate-gift')){
   res.setHeader('Content-Type','text/html');res.end(await vite.transformIndexHtml(req.url,`<!doctype html><html><head><script>${bootstrap}</script><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font-family:Arial,sans-serif}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="/@gift-fixture"></script></body></html>`));return;
  }
  if(!req.url.startsWith('/api/gifts'))return next();
  const chunks=[];for await(const c of req)chunks.push(c);const input=JSON.parse(Buffer.concat(chunks).toString()||'{}');fixtures.calls.push({url:req.url,method:req.method,input});
  res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
  if(fixtures.delay)await new Promise(r=>setTimeout(r,200));
  const reply=(data,status=200)=>{res.statusCode=status;res.end(JSON.stringify(data));};
  if(req.method==='GET')return fixtures.failRead?reply({success:false,error:fixtures.readError},fixtures.readStatus):reply({success:true,items:fixtures.items,hasMore:false,mailConfigured:true});
  if(req.url==='/api/gifts/admin') {const item={id:inviteId,email:input.email,validityDays:input.validityDays,note:input.note,claimUntil:Date.now()+7*86400000,createdAt:Date.now(),status:'pending',delivery:'accepted',activatedAt:null,expiresAt:null};fixtures.items=[item];return reply({success:true,invite:item});}
  if(req.url.endsWith('/revoke')){fixtures.items[0].status='revoked';return reply({success:true,invite:fixtures.items[0]});}
  if(req.url.endsWith('/resend'))return reply({success:true,invite:fixtures.items[0]});
  if(input.firebaseIdToken?.endsWith('other'))return reply({success:false,error:'Use the email this invitation was sent to.'},409);
  const claimed=req.url.endsWith('/claim');return reply({success:true,invite:{id:inviteId,email:'recipient@example.com',validityDays:30,claimUntil:Date.now()+86400000,status:claimed?'activated':'pending',activatedAt:claimed?Date.now():null,expiresAt:claimed?Date.now()+30*86400000:null},alreadyActivated:false,paidExpiresAt:Date.now()+10*86400000});
 });}
}]});
let browser;
try{
 await server.listen();const origin='http://127.0.0.1:'+server.httpServer.address().port;
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{}),...(process.env.PLAYWRIGHT_CHROMIUM_ARGS?{args:JSON.parse(process.env.PLAYWRIGHT_CHROMIUM_ARGS)}:{})});
 for(const width of [320,390,768,1440]){
  fixtures.items=[];fixtures.calls=[];fixtures.failRead=false;fixtures.readStatus=503;fixtures.readError='Fixture storage unavailable';const context=await browser.newContext({viewport:{width,height:850},reducedMotion:'reduce'});const errors=[];
  await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());const page=await context.newPage();page.on('pageerror',e=>{errors.push(e.message);console.error('BROWSER_PAGE_ERROR',e.message)});
  await page.goto(origin+'/fixture?mode=admin',{waitUntil:'networkidle'});if(errors.length)throw new Error(errors.join(' | '));await page.getByText('No invitations yet.').waitFor();
  await page.getByLabel('Email',{exact:true}).fill('recipient@example.com');await page.getByLabel('Pro access (days)').fill('30');await page.getByRole('button',{name:'Review invitation'}).click();
  assert.equal(fixtures.calls.filter(c=>c.method==='POST').length,0,'Review cannot send');await page.getByRole('button',{name:'Send activation email'}).click();await page.getByRole('button',{name:'Resend new link'}).waitFor();
  await page.getByRole('button',{name:'Revoke',exact:true}).click();assert.equal(fixtures.calls.filter(c=>c.url.endsWith('/revoke')).length,0);await page.getByRole('button',{name:'Confirm revoke'}).click();await page.getByText(/30 days · revoked/).waitFor();
  fixtures.failRead=true;await page.getByRole('button',{name:'Refresh',exact:true}).click();await page.getByRole('alert').waitFor();fixtures.failRead=false;await page.getByRole('button',{name:'Refresh invitations'}).click();await page.getByRole('alert').waitFor({state:'hidden'});
  await page.getByLabel('Email',{exact:true}).fill('draft@example.com');await page.getByLabel('Pro access (days)').fill('45');
  fixtures.failRead=true;fixtures.readStatus=404;fixtures.readError='API route not found';
  const writesBeforeMissing=fixtures.calls.filter(c=>c.method==='POST').length;
  await page.getByRole('button',{name:'Refresh',exact:true}).click();await page.getByText(/Gift Access is missing from the connected server/).waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  if(width===390)await page.screenshot({path:'/tmp/gift-missing-backend-390.png',fullPage:true});
  assert.equal(await page.getByLabel('Email',{exact:true}).inputValue(),'draft@example.com');assert.equal(await page.getByLabel('Pro access (days)').inputValue(),'45');
  assert.equal(await page.getByRole('button',{name:'Review invitation'}).isDisabled(),true);assert.equal(fixtures.calls.filter(c=>c.method==='POST').length,writesBeforeMissing);
  fixtures.readStatus=409;fixtures.readError='Gift access is not enabled yet.';await page.getByRole('button',{name:'Refresh invitations'}).click();await page.getByText('Gift access is not enabled yet.').waitFor();
  fixtures.failRead=false;await page.getByRole('button',{name:'Refresh invitations'}).click();await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Review invitation'&&!b.disabled));
  await page.goto(origin+'/activate-gift#token='+token,{waitUntil:'networkidle'});assert.equal(new URL(page.url()).hash,'');assert.equal(fixtures.calls.filter(c=>c.url.endsWith('/claim')).length,0);
  await page.getByRole('button',{name:'Sign in to continue'}).click();await page.getByRole('button',{name:'Check invitation'}).click();await page.getByRole('button',{name:'Confirm activation'}).waitFor();assert.equal(fixtures.calls.filter(c=>c.url.endsWith('/claim')).length,0,'Preview cannot activate');
  await page.getByText(/You already have paid Pro until/).waitFor();
  await page.getByRole('button',{name:'Confirm activation'}).focus();await page.keyboard.press('Enter');await page.getByRole('heading',{name:'Gift Pro is active'}).waitFor();assert.equal(fixtures.calls.filter(c=>c.url.endsWith('/claim')).length,1);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.locator('html').evaluate(el=>el.classList.add('dark'));assert.ok(await page.getByRole('heading',{name:'Gift Pro is active'}).isVisible());
  if(width===390)await page.screenshot({path:'/tmp/gift-activation-390.png',fullPage:true});
  await page.reload({waitUntil:'networkidle'});await page.getByText(/After a page reload/).waitFor();
  await page.goto(origin+'/activate-gift#token='+token,{waitUntil:'networkidle'});await page.evaluate(()=>window.giftSetAccount('other'));await page.getByRole('button',{name:'Check invitation'}).click();await page.getByRole('alert').waitFor();await page.getByRole('button',{name:'Switch account'}).click();await page.getByRole('button',{name:'Sign in to continue'}).waitFor();
  assert.deepEqual(errors,[]);console.log('GIFT_BROWSER',JSON.stringify({width,adminReview:true,create:true,revoke:true,errorRetry:true,guest:true,previewBeforeClaim:true,keyboardClaim:true,wrongAccount:true,refreshNoToken:true,overflow:false,pageErrors:errors.length}));await context.close();
 }
}finally{await browser?.close();await server.close();await rm(cache,{recursive:true,force:true});}
