// Actual Radar controls and detail, synthetic source/price/API providers. No production traffic.
import {createServer} from 'vite';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const root=process.cwd(),now=Date.parse('2026-11-03T03:30:00Z');
const source={name:'BSE',kind:'disclosure',url:'https://www.bseindia.com/report.pdf'};
const company={symbol:'YESBANK',name:'Yes Bank Ltd',scripCode:'532648'};
const base={category:'legal',authority:'High Court',status:'monitoring',scheduledDate:null,scheduleConfirmed:false,nextTrigger:null,source};
const pending={...base,id:'pending',title:'Court granted interim stay',information:'The court granted an interim stay on an adjudication order.',companies:[company],publishedAt:'2026-11-02T12:00:00Z',updatedAt:'2026-11-02T12:00:00Z'};
const observed={...base,id:'observed',title:'Operating licence revoked',information:'The operating licence has been revoked.',companies:[{symbol:'PNCINFRA',name:'PNC Infratech Ltd',scripCode:'539150'}],publishedAt:'2026-10-26T12:00:00Z',updatedAt:'2026-10-26T12:00:00Z'};
const row=e=>({version:1,id:e.id+':'+e.companies[0].scripCode,eventId:e.id,updateId:e.id,scripCode:e.companies[0].scripCode,symbol:e.companies[0].symbol,companyName:e.companies[0].name,category:e.category,fact:e.id==='pending'?'relief':'licence',scope:e.id==='pending'?'interim':'unspecified',amounts:[],authority:e.authority,excerpt:e.information,source,publishedAt:e.publishedAt,checkedAt:new Date(now-60000).toISOString(),sessionDate:e.id==='pending'?'2026-11-03':'2026-10-27',state:e.id==='pending'?'awaiting-session':'observed'});
const price={date:'2026-10-27',symbol:'PNCINFRA',series:'EQ',close:94,previousClose:100,changePercent:-6,sourceUrl:'https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_20261027_F_0000.csv.zip'};
const research={status:'ready',checkedAt:new Date(now).toISOString(),rows:[row(pending),{...row(observed),observation:{session:price,rangePercent:null,volatile:true,baselineMedian:null,baselineCount:2,unusual:null}}],patterns:[]};
let unavailable=false;
const entry=`import React from 'react';import{createRoot}from'react-dom/client';import{LazyMotion,domAnimation}from'framer-motion';import{ImpactRadar}from'/src/components/ImpactRadar.tsx';import '/src/index.css';createRoot(document.getElementById('root')).render(<LazyMotion features={domAnimation}><main className="bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white" style={{minHeight:'100vh',padding:12}}><ImpactRadar active identity="guest" onNavigate={()=>{}}/></main></LazyMotion>);`;
const server=await createServer({root,configFile:root+'/vite.config.ts',server:{host:'127.0.0.1',port:0,hmr:false},plugins:[{name:'radar-qa',enforce:'pre',resolveId(s,i){if(s==='/@radar-qa')return '\0radar-qa';if(i&&/AuthContext/.test(s))return '\0auth';if(i&&s.endsWith('/api'))return '\0api';},load(id){if(id==='\0auth')return 'export const useAuth=()=>({setIsAuthModalOpen(){}})';if(id==='\0api')return 'export const customFetch=(...a)=>fetch(...a)';if(id==='\0radar-qa')return entry;},async transform(s,id){if(id==='\0radar-qa')return (await import('esbuild')).transform(s,{loader:'jsx',jsx:'automatic'});},configureServer(v){v.middlewares.use(async(req,res,next)=>{
 if(req.url.startsWith('/api/impact-radar')){res.setHeader('Content-Type','application/json');let out;
 const activeResearch=unavailable?{...research,status:'unavailable',rows:[]}:research;
 if(req.url.endsWith('/categories'))out={success:true,categories:[]};
 else if(req.url.endsWith('/movement'))out={success:true,id:req.url.split('/').at(-2),movement:{basis:'report-date',anchorDate:'2026-11-03',afterClose:true,status:'unavailable',checkedAt:new Date(now).toISOString(),companies:[]}};
 else if(req.url==='/api/impact-radar')out={success:true,items:[observed,pending],intake:{checkedAt:now},research:activeResearch};
 else {const e=req.url.endsWith('pending')?pending:observed;out={success:true,event:e,updates:[],related:[],research:activeResearch};}
 return res.end(JSON.stringify(out));}
 if(req.url==='/radar-fixture'){res.setHeader('Content-Type','text/html');return res.end(await v.transformIndexHtml(req.url,'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="root"></div><script type="module" src="/@radar-qa"></script></body></html>'));}next();
 });}}]});await server.listen();let browser;
try {
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
 await page.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());await page.clock.install({time:new Date(now)});await page.goto(origin+'/radar-fixture');
 await page.getByText('Morning watch',{exact:true}).waitFor();
 for(const width of [360,390,768,1440])for(const dark of [false,true]){
  await page.setViewportSize({width,height:844});await page.locator('html').evaluate((e,d)=>e.classList.toggle('dark',d),dark);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 }
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:/See more/}).click();
 const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Morning watch',exact:true}).click();
 assert.equal(await dialog.locator('article').count(),1);assert.match(await dialog.locator('article').innerText(),/Yes Bank/);
 await dialog.getByRole('button',{name:'Volatility observed',exact:true}).click();assert.equal(await dialog.locator('article').count(),1);assert.match(await dialog.locator('article').innerText(),/PNC/);
 await dialog.getByRole('button',{name:/^PNC Infratech Ltd: Operating licence revoked/}).click();await dialog.getByRole('heading',{name:'What changed & market reaction'}).waitFor();
 await dialog.getByText(/Close change -6.00%/).waitFor();
 for(const width of [360,390,768,1440])for(const dark of [false,true]){await page.setViewportSize({width,height:844});await page.locator('html').evaluate((e,d)=>e.classList.toggle('dark',d),dark);assert.equal(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,'dialog has no horizontal overflow');}
 assert.equal(await dialog.getByText(/Daily data cannot/).isVisible(),false,'method starts collapsed');
 await dialog.getByText('Pattern archive · 30 / 60 / 365 days',{exact:true}).click();await dialog.getByText(/No completed comparable samples yet/).waitFor();
 await page.keyboard.press('Escape');await page.getByRole('button',{name:/See more/}).waitFor();
 unavailable=true;await page.getByRole('button',{name:'Refresh Impact Radar',exact:true}).click();await page.getByRole('button',{name:/See more/}).click();
 await dialog.getByRole('group',{name:'Market reaction'}).getByRole('button',{name:'All reactions',exact:true}).click();
 await dialog.getByText(/Reaction research is unavailable/).waitFor();assert.equal(await dialog.getByText('Volatility observed',{exact:true}).count()>=1,true,'saved observed badge survives research outage');
 assert.deepEqual(errors,[]);console.log('Radar research browser passed: morning priority, volatility filter, sourced detail, missing history, retained outage, modal dismissal, 360/390/768/1440 widths and light/dark.');
}finally{await browser?.close();await server.close();}
