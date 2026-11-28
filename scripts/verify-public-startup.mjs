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
  const signIn = page.getByRole('button',{name:'Sign In',exact:true});
  await signIn.focus();
  await signIn.click();
  const authDialog = page.getByRole('dialog',{name:'Login to your account'});
  await authDialog.waitFor();
  assert.equal(await authDialog.evaluate(el => el.contains(document.activeElement)),true);
  assert.equal(await authDialog.getByRole('textbox',{name:'Email or username'}).evaluate(el => getComputedStyle(el).fontSize),'16px');
  const closeBox = await authDialog.getByRole('button',{name:'Close',exact:true}).boundingBox();
  assert.ok(closeBox && closeBox.height >= 44 && closeBox.width >= 44);
  for (let index = 0; index < 14; index++) {
   await page.keyboard.press('Tab');
   assert.equal(await authDialog.evaluate(el => el.contains(document.activeElement)),true);
  }
  await page.keyboard.press('Escape');
  await authDialog.waitFor({state:'hidden'});
  assert.equal(await signIn.evaluate(el => el === document.activeElement),true);
  await page.getByText('Preview the calendar and filing analysis',{exact:true}).click();
  const exampleFilters=page.getByRole('group',{name:'Filter example catalysts',exact:true});
  if(failExamples){
   const retryPreview=page.getByRole('button',{name:'Retry preview',exact:true});
   await retryPreview.waitFor();
   assert.equal(await page.getByRole('heading',{name:'BSE filings and earnings, in one place',exact:true}).isVisible(),true,'demo failure keeps the page usable');
   failExamples=false;
   const entryRequestCount=requests.filter(url=>url===`${origin}/${entry}`).length;
   await retryPreview.click();
   await exampleFilters.waitFor();
   assert.equal(requests.filter(url=>url===`${origin}/${entry}`).length,entryRequestCount,'preview retry stays in the current document');
  }
  await exampleFilters.waitFor();
  assert.equal(requests.some(url=>url.endsWith('/'+examples)),true,'opening details loads the demo chunk');
  console.log(JSON.stringify({width,earlyLanding:true,closedDemosDeferred:true,openDemosLoaded:true,signInDialog:true,dialogFocusRestored:true,noOverflow:true}));
  await context.close();
 }
}finally{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
