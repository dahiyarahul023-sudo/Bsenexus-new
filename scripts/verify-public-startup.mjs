// Actual production assets with synthetic API responses. No live providers or writes.
import express from 'express';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
const manifest=JSON.parse(readFileSync('dist/.vite/manifest.json','utf8'));
const entry=manifest['index.html'].file;
const landing=Object.values(manifest).find(item=>item.src==='src/components/LandingPage.tsx'||item.name==='LandingPage').file;
const examples=manifest['src/components/landing/LandingExamples.tsx'].file;
const app=express();
app.use('/api',(_req,res)=>res.json({}));
app.get('/auth/status',(_req,res)=>res.json({isAuthenticated:false,isAdmin:false}));
app.use(express.static(path.resolve('dist')));
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
 const origin='http://127.0.0.1:'+server.address().port;
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'});
  const page=await context.newPage();const requests=[];let entryReady=false,earlyLanding=false,failExamples=width===390;
  await page.route('**/*',async route=>{
   const url=route.request().url();
   if(!url.startsWith(origin))return route.abort();
   requests.push(url);
   if(failExamples&&url.endsWith('/'+examples))return route.abort();
   if(url===`${origin}/${landing}`&&!entryReady)earlyLanding=true;
   if(url===`${origin}/${entry}`){await new Promise(resolve=>setTimeout(resolve,750));entryReady=true;}
   return route.continue();
  });
  await page.goto(origin);
  await page.getByRole('heading',{name:'BSE filings and earnings, in one place',exact:true}).waitFor();
  assert.equal(earlyLanding,true,'landing discovery precedes main-bundle completion');
  assert.equal(requests.some(url=>url.endsWith('/'+examples)),false,'closed demos stay off the network');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.getByText('Preview the calendar and filing analysis',{exact:true}).click();
  if(failExamples){
   await page.getByRole('button',{name:'Reload preview',exact:true}).waitFor();
   assert.equal(await page.getByRole('heading',{name:'BSE filings and earnings, in one place',exact:true}).isVisible(),true,'demo failure keeps the page usable');
   failExamples=false;
   await page.getByRole('button',{name:'Reload preview',exact:true}).click();
   await page.getByRole('heading',{name:'BSE filings and earnings, in one place',exact:true}).waitFor();
   await page.getByText('Preview the calendar and filing analysis',{exact:true}).click();
  }
  await page.getByRole('heading',{name:'Explore Board Meetings & Catalysts',exact:true}).waitFor();
  assert.equal(requests.some(url=>url.endsWith('/'+examples)),true,'opening details loads the demo chunk');
  await page.getByRole('button',{name:'Sign In',exact:true}).click();
  await page.locator('[role="dialog"][aria-labelledby="auth-modal-title"]').waitFor();
  console.log(JSON.stringify({width,earlyLanding:true,closedDemosDeferred:true,openDemosLoaded:true,signInDialog:true,noOverflow:true}));
  await context.close();
 }
}finally{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
