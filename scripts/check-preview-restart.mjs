// Actual App + Vite lifecycle with offline providers. Hold the Settings import,
// close its server, fail that request, then recover against a replacement server.
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createServer} from 'vite';
import {chromium} from 'playwright';

process.env.DISABLE_HMR = 'true';
process.env.VITE_SENTRY_DSN = '';
const cacheDir = await mkdtemp(path.join(os.tmpdir(), 'bnx-preview-restart-'));
let server, browser;
async function start(port = 0) {
  const instance = await createServer({cacheDir, server:{host:'127.0.0.1',port,strictPort:true},plugins:[{
    name:'restart-offline-fixtures',configureServer(vite){vite.middlewares.use((req,res,next)=>{
      if(!req.url.startsWith('/api/'))return next();
      res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
      res.end(JSON.stringify({success:true,settings:{},items:[],data:[],announcements:[],news:[],watchlists:[],indices:[],stories:[],profile:null,enabled:false,sentryDsn:null}));
    });}
  }]});
  await instance.listen();return instance;
}
try {
  browser = await chromium.launch({headless:true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{}),
    ...(process.env.PLAYWRIGHT_CHROMIUM_ARGS?{args:JSON.parse(process.env.PLAYWRIGHT_CHROMIUM_ARGS)}:{})});
  for(const width of (process.env.RESTART_TEST_WIDTH ? [Number(process.env.RESTART_TEST_WIDTH)] : [390,768,1440])) {
    server=await start();const port=server.httpServer.address().port,origin='http://127.0.0.1:'+port;
    const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
    await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.fulfill({status:200,contentType:'application/json',body:'{}'}));
    const page=await context.newPage();let navigations=0;const unexpected=[];
    page.on('request',request=>{if(request.isNavigationRequest()&&request.frame()===page.mainFrame())navigations++;});
    page.on('console',message=>{if(/Invalid hook call|Cannot read properties of null|Rendered (?:more|fewer) hooks|beforeSendTransaction.*ignored/i.test(message.text()))unexpected.push(message.text());});
    await page.goto(origin+'/announcements',{waitUntil:'networkidle'});
    let release,seen;const held=new Promise(resolve=>release=resolve),pending=new Promise(resolve=>seen=resolve);
    await page.route('**/src/components/SettingsTab.tsx*',async route=>{seen();await held;await route.abort('failed');});
    // Direct same-app navigation retains the existing React document at every width.
    await page.evaluate(()=>{history.pushState({},'','/settings');dispatchEvent(new PopStateEvent('popstate'));});
    let deadline;try{await Promise.race([pending,new Promise((_,reject)=>{deadline=setTimeout(()=>reject(Error('Settings import was not requested')),12000);})]);}finally{clearTimeout(deadline);}
    const before=navigations;
    await server.close();server=undefined;release();
    // Allow the existing bounded lazy-import retries and former 350ms auto-reload.
    await new Promise(resolve=>setTimeout(resolve,3500));
    console.log('RESTART_DOCUMENT',JSON.stringify({width,before,navigations,url:page.url()}));
    assert.equal(navigations,before,'A stopped preview must not trigger an automatic page reload');
    await page.getByRole('heading',{name:"This section couldn't load",exact:true}).waitFor({timeout:10000});
    assert.ok(await page.getByRole('button',{name:'Reload app',exact:true}).isVisible());
    assert.equal(await page.getByRole('button',{name:'Try again',exact:true}).count(),0,'A cached failed import needs a fresh document');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    if(width===390)await page.screenshot({path:'/tmp/preview-restart-recovery-390.png',fullPage:true});
    server=await start(port);
    await page.unroute('**/src/components/SettingsTab.tsx*');
    await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}),page.getByRole('button',{name:'Reload app',exact:true}).click()]);
    await page.getByRole('heading',{name:'Settings',exact:true}).waitFor();
    assert.equal(navigations,before+1);assert.deepEqual(unexpected,[]);
    console.log('PREVIEW_RESTART',JSON.stringify({width,heldSettingsImport:true,serverClosed:true,noAutoReload:true,manualFreshDocument:true,settingsRecovered:true,unexpectedErrors:unexpected.length}));
    await context.close();await server.close();server=undefined;
  }
}finally{await browser?.close();await server?.close();await rm(cacheDir,{recursive:true,force:true});}
