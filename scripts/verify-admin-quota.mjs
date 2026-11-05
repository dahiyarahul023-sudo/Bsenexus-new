// Actual auth/context/reset components with synthetic providers. No live PIN or quota writes.
import {createServer,transformWithEsbuild} from 'vite';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const root=process.cwd();
const firebase=`let account=null;const listeners=new Set();const makeToken=()=> 'header.'+btoa(JSON.stringify({exp:Date.now()/1000+3600}))+'.signature';
const person={uid:'fixture-owner',email:'dahiyarahul023@gmail.com',emailVerified:true,isAnonymous:false,displayName:'Fixture Owner',getIdToken:async force=>{if(force)window.forcedRefreshes=(window.forcedRefreshes||0)+1;return makeToken()}};
export const auth={get currentUser(){return account}},googleProvider={},initAppCheck=()=>null;
export const onAuthStateChanged=(instance,fn)=>{listeners.add(fn);queueMicrotask(()=>listeners.has(fn)&&fn(account));return()=>listeners.delete(fn)};
window.setFixtureAccount=on=>{account=on?person:null;listeners.forEach(fn=>fn(account))};
export const signInWithPopup=async()=>{window.setFixtureAccount(true);return{user:person}};export const signOut=async()=>window.setFixtureAccount(false);
export const signInWithEmailAndPassword=signInWithPopup,createUserWithEmailAndPassword=signInWithPopup,fetchSignInMethodsForEmail=async()=>[],updateProfile=async()=>{},sendEmailVerification=async()=>{},signInAnonymously=signInWithPopup;`;
const entry=`import React from 'react';import{createRoot}from'react-dom/client';import{AuthProvider,useAuth}from'/src/context/AuthContext.tsx';import{AiUsageCard}from'/src/components/AiUsageCard.tsx';import{AdminPinModal}from'/src/components/AdminPinModal.tsx';import'/src/index.css';
function Probe(){const a=useAuth();return <><button onClick={()=>a.loginWithGoogle()}>Fixture Google sign-in</button><button onClick={()=>window.setFixtureAccount(false)}>End Firebase session</button><pre id="identity">{JSON.stringify({uid:a.user?.uid||null,admin:a.isAdmin,owner:a.isOwner,elevated:a.isElevated,signin:a.isAuthModalOpen})}</pre><AiUsageCard/><AdminPinModal/></>};createRoot(document.getElementById('root')).render(<AuthProvider><Probe/></AuthProvider>);`;
let until=0,resetCalls=0,verifyCalls=0,failStatus=false;
const server=await createServer({root,configFile:root+'/vite.config.ts',server:{host:'127.0.0.1',port:0,hmr:false},plugins:[{
 name:'quota-fixture',enforce:'pre',resolveId(s,i){
 if(s==='/@quota-fixture')return '\0quota-entry';
 if(s==='firebase/auth'||s.endsWith('/firebase')||s==='./firebase')return '\0quota-firebase';
 if(i?.endsWith('AuthContext.tsx')&&s==='../utils/recaptcha')return '\0quota-recaptcha';
 if(i?.endsWith('AuthContext.tsx')&&s==='../utils/cashfree')return '\0quota-payment';
 if(i?.endsWith('AiUsageCard.tsx')&&s==='../utils/aiQuota')return '\0quota-meter';
 },load(id){if(id==='\0quota-entry')return {code:entry,loader:'jsx'};if(id==='\0quota-firebase')return firebase;if(id==='\0quota-recaptcha')return 'export const executeRecaptcha=async()=>({bypassed:true})';if(id==='\0quota-payment')return 'export const recoverPendingPayments=async()=>({recoveredCount:0})';if(id==='\0quota-meter')return `import{useAuth}from'/src/context/AuthContext.tsx';export const useAiQuota=()=>{const a=useAuth();return a.isAdmin?{source:'server',tier:'admin'}:{source:'guest',message:'Sign in'};}`;},
 transform(s,id){if(id==='\0quota-entry')return transformWithEsbuild(s,id,{loader:'jsx',jsx:'automatic'})},
 configureServer(v){v.middlewares.use(async(req,res,next)=>{
 if(req.url==='/fixture'){res.setHeader('Content-Type','text/html');res.end(await v.transformIndexHtml(req.url,'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/@quota-fixture"></script></body></html>'));return}
 if(!req.url.startsWith('/auth/')&&!req.url.startsWith('/api/'))return next();
 let body='';for await(const b of req)body+=b;const data=JSON.parse(body||'{}');res.setHeader('Content-Type','application/json');const reply=(data,status=200)=>{res.statusCode=status;res.end(JSON.stringify(data))};
 const bearer=req.headers.authorization?.slice(7);let fresh=false;try{fresh=JSON.parse(Buffer.from(bearer.split('.')[1],'base64').toString()).exp*1000>Date.now()}catch{}
 if(req.url==='/auth/status'&&failStatus)return reply({error:'fixture outage'},503);
 if(req.url==='/auth/status')return reply({isAuthenticated:fresh,user:fresh?{uid:'fixture-owner'}:null,isAdmin:fresh,isOwner:fresh,isElevated:fresh&&until>Date.now(),adminElevatedUntil:until});
 if(req.url==='/auth/verify-pin'){verifyCalls++;if(!fresh)return reply({code:'ADMIN_AUTH_REQUIRED',authRequired:true},403);if(data.pin!=='fixture-pin')return reply({error:'Invalid fixture PIN'},401);until=Date.now()+900000;return reply({success:true})}
 if(req.url==='/api/billing/reset-quota'){resetCalls++;if(until<=Date.now())return reply({adminElevationRequired:true,error:'Verify Master PIN'},403);return reply({success:true,resetCount:2,message:'2 fixture records reset'})}
 if(req.url==='/api/users/profile')return reply({profile:{uid:'fixture-owner',email:'dahiyarahul023@gmail.com',tier:'admin',notificationPreferences:{}}});
 return reply({success:true});
 });}
}]});
let browser;
try{await server.listen();const origin='http://127.0.0.1:'+server.httpServer.address().port;
 for(const width of [390,1440]){
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{}),...(process.env.PLAYWRIGHT_CHROMIUM_ARGS?{args:JSON.parse(process.env.PLAYWRIGHT_CHROMIUM_ARGS)}:{})});
  until=0;resetCalls=0;verifyCalls=0;failStatus=false;const context=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
  await page.addInitScript(()=>{localStorage.setItem('bse_nexus_auth_session',JSON.stringify({user:{uid:'cached-owner',email:'dahiyarahul023@gmail.com'},profile:{uid:'cached-owner',tier:'admin'}}));localStorage.setItem('bse_nexus_fb_id_token','header.'+btoa(JSON.stringify({exp:1}))+'.signature')});
  await page.goto(origin+'/fixture');await page.waitForFunction(()=>JSON.parse(document.querySelector('#identity')?.textContent||'{}').signin===true);
  assert.equal(await page.getByRole('button',{name:'Reset All Daily Quotas'}).count(),0);assert.equal(await page.evaluate(()=>localStorage.getItem('bse_nexus_fb_id_token')),null);
  await page.getByRole('button',{name:'Fixture Google sign-in'}).click();await page.getByRole('button',{name:'Reset All Daily Quotas'}).waitFor();
  assert.equal(JSON.parse(await page.locator('#identity').textContent()).elevated,false);
  await page.getByRole('button',{name:'Reset All Daily Quotas'}).click();await page.getByRole('dialog',{name:'Admin 2-Factor Verification'}).waitFor();assert.equal(resetCalls,0);
  await page.getByLabel('Master Security PIN',{exact:true}).fill('wrong-pin');await page.getByRole('button',{name:'Confirm Access'}).click();await page.getByText('Invalid fixture PIN',{exact:true}).waitFor();assert.equal(resetCalls,0);
  await page.getByLabel('Master Security PIN',{exact:true}).fill('fixture-pin');await page.getByRole('button',{name:'Confirm Access'}).click();await page.getByText('2 fixture records reset',{exact:true}).waitFor();assert.equal(resetCalls,1);assert.equal(verifyCalls,2);assert.ok(await page.evaluate(()=>window.forcedRefreshes>=2));
  until=Date.now()-1;await page.getByRole('button',{name:'Reset All Daily Quotas'}).click();await page.getByRole('dialog',{name:'Admin 2-Factor Verification'}).waitFor();assert.equal(resetCalls,2);
  const close=page.getByRole('button',{name:'Close Admin PIN Verification'});await close.focus();await page.keyboard.press('Shift+Tab');assert.equal(await page.getByRole('button',{name:'Confirm Access'}).evaluate(e=>e===document.activeElement),true);await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(resetCalls,2);
  assert.equal(await page.getByRole('button',{name:'Reset All Daily Quotas'}).evaluate(e=>e===document.activeElement),true);
  await page.getByRole('button',{name:'Reset All Daily Quotas'}).click();await page.getByRole('dialog').waitFor();failStatus=true;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(resetCalls,3);failStatus=false;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.getByRole('button',{name:'Reset All Daily Quotas'}).waitFor();
  await page.getByRole('button',{name:'Reset All Daily Quotas'}).click();await page.getByRole('dialog').waitFor();await page.evaluate(()=>window.setFixtureAccount(false));await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(resetCalls,3);assert.equal(JSON.parse(await page.locator('#identity').textContent()).admin,false);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);console.log(JSON.stringify({width,cachedAdminRejected:true,pinBeforeReset:true,wrongPinNoReset:true,correctPinResetCount:2,denialReopensPin:true,cancelNoReplay:true,accountSwitchCancels:true,statusOutageCancels:true,focusTrapRestore:true,overflow:false,pageErrors:0}));await context.close();await browser.close();browser=null;
 }
}finally{await browser?.close();await server.close();}
