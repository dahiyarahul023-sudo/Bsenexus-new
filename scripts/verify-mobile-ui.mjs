// Actual components with synthetic account/API adapters; no live providers or production mutations.
import {createServer} from 'vite';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const root=process.cwd();
const auth=`export function useAuth(){return {user:{uid:'fixture'},profile:{uid:'fixture',tier:'pro'},isPro:true,isAdmin:false}}`;
const entry=`import React,{useState} from 'react';import{createRoot}from'react-dom/client';import{LazyMotion,domAnimation}from'framer-motion';import '/src/index.css';import{CalendarDateBadge3D}from'/src/components/ui/CalendarDateBadge3D.tsx';import{RichDateTile}from'/src/components/ui/RichVisual.tsx';import{CommunitySocialBanner}from'/src/components/landing/CommunitySocialBanner.tsx';import ParticleRibbons from '/src/components/ui/ParticleRibbons.tsx';import {CompanyIntelligenceModal} from '/src/components/CompanyIntelligenceModal.tsx';import{NotificationInbox}from'/src/components/NotificationInbox.tsx';import{useUnreadNotificationCount}from'/src/hooks/useUnreadNotificationCount.ts';function App(){const[mode,M]=useState('visuals');const {count,refresh,beginRead}=useUnreadNotificationCount('fixture');return <><nav style={{position:'relative',zIndex:20,background:'#ddd',padding:10}}>{['visuals','hub','inbox'].map(t=><button onClick={()=>M(t)} style={{padding:8}}>{t}</button>)}<button onClick={()=>document.documentElement.classList.toggle('dark')} style={{padding:8}}>Toggle theme</button><span data-testid="count">{count} unread</span></nav>{mode==='hub'?<CompanyIntelligenceModal isOpen scripCode="512070" symbol="UPL" companyName="UPL Limited" onClose={()=>M('visuals')}/>:mode==='inbox'?<NotificationInbox isOpen onClose={()=>M('visuals')} unreadCount={count} onRefreshCount={refresh} onBeginRead={beginRead} onOpenCompanyIntel={()=>{}} onOpenAlertRules={()=>{}}/>:<main style={{minHeight:1800}} className="bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"><ParticleRibbons/><section style={{position:'relative',zIndex:2,padding:28,display:'flex',gap:20,alignItems:'center'}}><CalendarDateBadge3D month="NOV" date="02" day="MON"/><RichDateTile month="NOV" day="02"/><CalendarDateBadge3D month="CAL" date="24" size="icon"/></section><CommunitySocialBanner/></main>}</>};createRoot(document.getElementById('root')).render(<LazyMotion features={domAnimation}><App/></LazyMotion>);`;
let unread=3, failRead=false;const now=Date.now();
const intel={companyName:'UPL Limited',scripCode:'512070',symbol:'UPL',filingCoverage:'stored',filingStats:{last30Days:6,asOf:now},recentFilings:Array.from({length:8},(_,i)=>({id:'f'+i,subject:'Stored filing '+i,timestamp:now-(i<6?i:50)*86400000,pdfLink:'https://www.bseindia.com/xml-data/corpfiling/AttachLive/fixture.pdf'})),materialTimeline:Array.from({length:5},(_,i)=>({id:'e'+i,title:'Event '+i,eventType:i<3?'GOVERNANCE':'DIVIDEND',timestamp:now-i*86400000,isHighImpact:i===0})),quarterlyResults:[]};
const server=await createServer({root,configFile:root+'/vite.config.ts',server:{host:'127.0.0.1',port:0,hmr:false},plugins:[{name:'qa-adapters',enforce:'pre',resolveId(s,i){if(s==='/@qa')return '\0qa';if(i&&/AuthContext/.test(s))return '\0auth';if(i&&s.endsWith('/api'))return '\0api';if(i&&s.endsWith('/IntelModalContext'))return '\0intel';if(i&&s.endsWith('/aiQuota'))return '\0quota';if(i&&s.endsWith('/SaveNoteButton'))return '\0note'},load(id){if(id==='\0qa')return {code:entry,loader:'jsx'};if(id==='\0auth')return auth;if(id==='\0api')return 'export const customFetch=(...a)=>fetch(...a)';if(id==='\0intel')return 'export const useIntelModal=()=>({openIntelModal(){}})';if(id==='\0quota')return 'export const useAiQuota=()=>({canGenerate:true});export const syncQuotaFromResponse=()=>{}';if(id==='\0note')return 'export const SaveNoteButton=()=>null';},transform(s,id){if(id==='\0qa')return import(root+'/node_modules/esbuild/lib/main.js').then(e=>e.transform(s,{loader:'jsx',jsx:'automatic'}))},configureServer(v){v.middlewares.use(async(req,res,next)=>{if(req.url.startsWith('/api/')){res.setHeader('Content-Type','application/json');if(req.url.includes('unread-count'))return res.end(JSON.stringify({unreadCount:unread}));if(req.url.includes('/read')){await new Promise(r=>setTimeout(r,750));if(failRead){res.statusCode=503;return res.end('{}')}unread=0;return res.end('{"success":true}')}if(req.url.includes('/notifications'))return res.end(JSON.stringify({notifications:Array.from({length:3},(_,i)=>({id:'n'+i,title:'Fixture notification '+i,message:'Test alert',type:'GENERAL',priority:'LOW',timestamp:now,isRead:unread===0}))}));if(req.url.includes('/company-intel'))return res.end(JSON.stringify(intel));return res.end('{}')}
if(req.url.startsWith('/preview')){res.setHeader('Content-Type','text/html');return res.end('<html><body style="margin:0;background:#bbb"><iframe title="Phone preview" src="/fixture" style="width:390px;height:844px;border:0"></iframe><a href="/fixture">Desktop preview</a></body></html>')}
if(req.url==='/fixture'){res.setHeader('Content-Type','text/html');res.end(await v.transformIndexHtml(req.url,'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="root"></div><script type="module" src="/@qa"></script></body></html>'));return}next()})}}]});await server.listen();
let browser;
try {
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
 const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
 await page.goto(origin+'/fixture');
 await page.getByRole('button',{name:'visuals',exact:true}).waitFor();
 for(const width of [360,390,768,1440]) {
  await page.setViewportSize({width,height:844});
  for(const dark of [false,true]) {
   const current=await page.locator('html').getAttribute('class');
   if(Boolean(current?.includes('dark'))!==dark)await page.getByRole('button',{name:'Toggle theme'}).click();
   const calendar=await page.locator('.calendar-material').first().boundingBox();assert.ok(calendar.width>=36 && calendar.width<=56);
   const channels=page.getByRole('region',{name:'Official Social Channels and Active Trader Community'});
   const instagram=channels.getByRole('link',{name:/Instagram/});assert.ok(await instagram.isVisible());
   const box=await instagram.boundingBox();if(width<640)assert.ok(box.height<=76,'mobile links remain compact');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no page overflow');
  }
 }
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'hub',exact:true}).click();
 await page.getByRole('button',{name:'View 6 stored filings in the last 30 days',exact:true}).click();
 await page.getByText('BSE filings · last 30 days (6 items)',{exact:true}).waitFor();
 assert.equal(await page.getByText('Stored filing 7',{exact:true}).count(),0);
 await page.getByRole('button',{name:'Show all',exact:true}).click();
 await page.getByText('Stored filing 7',{exact:true}).waitFor();
 await page.getByRole('button',{name:/Company Hub/}).click();
 await page.getByRole('button',{name:/View Governance updates/}).click();
 assert.equal(await page.getByText('Event 3',{exact:true}).count(),0);
 assert.equal(await page.getByText('Event 0',{exact:true}).count(),1);
 await page.getByRole('button',{name:'Close',exact:true}).last().click();
 await page.getByRole('button',{name:'inbox',exact:true}).click();
 await page.getByText('3 new',{exact:true}).waitFor();
 const accepted=page.waitForResponse(response=>response.url().includes('/read-all')&&response.status()===200);
 await page.getByRole('button',{name:'Mark all read',exact:true}).click();
 // This assertion precedes the delayed POST acknowledgement.
 assert.equal(await page.getByText('3 new',{exact:true}).count(),0);
 assert.equal(await page.getByTestId('count').textContent(),'0 unread');
 await accepted;
 await page.getByText('Read',{exact:true}).first().waitFor();
 await page.getByRole('button',{name:'Close notification inbox'}).click();
 unread=3;failRead=true;
 await page.getByRole('button',{name:'inbox',exact:true}).click();
 await page.getByText('3 new',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Mark all read',exact:true}).click();
 await page.getByText('Read status could not be saved. Please retry.',{exact:true}).waitFor();
 assert.equal(await page.getByTestId('count').textContent(),'3 unread');
 assert.deepEqual(errors,[]);
 console.log('Mobile UI: 360/390/768/1440 light/dark, exact fact drill-down, immediate badge and failed-read rollback passed (synthetic providers).');
} finally {await browser?.close();await server.close();}

