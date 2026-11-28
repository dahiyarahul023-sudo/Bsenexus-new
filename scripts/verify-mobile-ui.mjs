// Actual components with synthetic account/API adapters; no live providers or production mutations.
import {createServer} from 'vite';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=process.cwd();
const auth=`export function useAuth(){return {user:{uid:'fixture'},profile:{uid:'fixture',tier:'pro'},isPro:true,isAdmin:new URLSearchParams(location.search).get('admin')==='1'}}`;
const entry=`import {HomeForYou} from '/src/components/HomeForYou.tsx';import {IntelModalProvider,useIntelModal} from '/src/context/IntelModalContext.tsx';import {ResultsCalendar} from '/src/components/ResultsCalendar.tsx';import {WatchlistManager} from '/src/components/WatchlistManager.tsx';import React,{useState} from 'react';import{createRoot}from'react-dom/client';import{LazyMotion,domAnimation}from'framer-motion';import '/src/index.css';import{CalendarDateBadge3D}from'/src/components/ui/CalendarDateBadge3D.tsx';import{RichDateTile}from'/src/components/ui/RichVisual.tsx';import{CommunitySocialBanner}from'/src/components/landing/CommunitySocialBanner.tsx';import {ParticleRibbons} from '/src/components/ui/ParticleRibbons.tsx';import {CompanyIntelligenceModal} from '/src/components/CompanyIntelligenceModal.tsx';import{NotificationInbox}from'/src/components/NotificationInbox.tsx';import{useUnreadNotificationCount}from'/src/hooks/useUnreadNotificationCount.ts';function IntelDialog(){const{isIntelModalOpen,selectedStock,closeIntelModal}=useIntelModal();return isIntelModalOpen?<CompanyIntelligenceModal isOpen onClose={closeIntelModal} {...selectedStock}/>:null}function App(){const[mode,M]=useState('visuals');const {count,refresh,beginRead}=useUnreadNotificationCount('fixture');return <><nav style={{position:'relative',zIndex:20,background:'#ddd',padding:10}}>{['visuals','hub','inbox','calendar','watchlist','home'].map(t=><button onClick={()=>M(t)} style={{padding:8}}>{t}</button>)}<button onClick={()=>document.documentElement.classList.toggle('dark')} style={{padding:8}}>Toggle theme</button><span data-testid="count">{count} unread</span></nav>{mode==='home'?<HomeForYou onNavigate={tab=>M(tab==='results-calendar'?'calendar':'watchlist')}/>:mode==='calendar'?<ResultsCalendar isActive/>:mode==='watchlist'?<WatchlistManager isActive/>:mode==='hub'?<CompanyIntelligenceModal isOpen scripCode="512070" symbol="UPL" companyName="UPL Limited" onClose={()=>M('visuals')}/>:mode==='inbox'?<NotificationInbox isOpen onClose={()=>M('visuals')} unreadCount={count} onRefreshCount={refresh} onBeginRead={beginRead} onOpenCompanyIntel={()=>{}} onOpenAlertRules={()=>{}}/>:<main style={{minHeight:1800}} className="bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"><ParticleRibbons/><section style={{position:'relative',zIndex:2,padding:28,display:'flex',gap:20,alignItems:'center'}}><CalendarDateBadge3D month="NOV" date="02" day="MON"/><RichDateTile month="NOV" day="02"/><CalendarDateBadge3D month="CAL" date="24" size="icon"/></section><CommunitySocialBanner/></main>}<IntelDialog/></>};createRoot(document.getElementById('root')).render(<LazyMotion features={domAnimation}><IntelModalProvider><App/></IntelModalProvider></LazyMotion>);`;
let unread=3, failRead=false, companyReads=0, failCompany=false, calendarDeclared=false, calendarReads=0, failHomeFilings=false, includeFutureMeetings=false;
let failWatchlistFilings=false;
const now=Date.now();
const futureMeetings=Array.from({length:27},(_,index)=>{
 const date=now+(index+1)*86400000;
 const meetingDate=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',day:'2-digit',month:'2-digit',year:'numeric'}).format(date);
 return {id:'future-'+index,scripCode:String(550000+index),symbol:'FIXTURE'+index,companyName:'Fixture Company '+index,meetingDate,meetingTimestamp:date,daysLeft:index+1,status:'UPCOMING',purpose:'Financial results'};
});
const intel={companyName:'UPL Limited',scripCode:'512070',symbol:'UPL',filingCoverage:'stored',filingStats:{last30Days:6,asOf:now},recentFilings:Array.from({length:8},(_,i)=>({id:'f'+i,subject:'Stored filing '+i,timestamp:now-(i<6?i:50)*86400000,pdfLink:'https://www.bseindia.com/xml-data/corpfiling/AttachLive/fixture.pdf'})),materialTimeline:Array.from({length:5},(_,i)=>({id:'e'+i,title:'Event '+i,eventType:i<3?'GOVERNANCE':'DIVIDEND',timestamp:now-i*86400000,isHighImpact:i===0})),quarterlyResults:[]};
const server=await createServer({root,configFile:root+'/vite.config.ts',server:{host:'127.0.0.1',port:0,hmr:false},plugins:[{name:'qa-adapters',enforce:'pre',resolveId(s,i){if(s==='/@qa')return '\0qa';if(i&&/AuthContext/.test(s))return '\0auth';if(i&&s.endsWith('/api'))return '\0api';if(i&&s.endsWith('/aiQuota'))return '\0quota';if(i&&s.endsWith('/SaveNoteButton'))return '\0note'},load(id){if(id==='\0qa')return {code:entry,loader:'jsx'};if(id==='\0auth')return auth;if(id==='\0api')return 'export const customFetch=(...a)=>fetch(...a)';if(id==='\0quota')return 'export const useAiQuota=()=>({canGenerate:true});export const syncQuotaFromResponse=()=>{}';if(id==='\0note')return 'export const SaveNoteButton=()=>null';},transform(s,id){if(id==='\0qa')return import(root+'/node_modules/esbuild/lib/main.js').then(e=>e.transform(s,{loader:'jsx',jsx:'automatic'}))},configureServer(v){v.middlewares.use(async(req,res,next)=>{if(req.url.startsWith('/api/')){res.setHeader('Content-Type','application/json');if(req.url.includes('/results-calendar')){calendarReads++;return res.end(JSON.stringify({lastUpdated:now-5*3600000,resultsCheckedAt:now,items:[{id:'solar',symbol:'SOLARINDS',scripCode:'532725',companyName:'Solar Industries India Ltd',meetingDate:new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',day:'2-digit',month:'2-digit',year:'numeric'}).format(now),meetingTimestamp:Math.floor((now+19800000)/86400000)*86400000-19800000,daysLeft:0,status:'TODAY',isDeclared:calendarDeclared,resultDeclarationTime:calendarDeclared?new Date(now).toISOString():undefined,purpose:'Financial results'},...(includeFutureMeetings?futureMeetings:[])]}))}
if(req.url.startsWith('/api/watchlists'))return res.end(JSON.stringify([{id:'list',name:'Fixture',is_active:1,items:[{symbol:'SOLARINDS',scripCode:'532725',companyName:'Solar Industries India Ltd',priority:'HIGH'},{symbol:'ASHOKLEY',scripCode:'500477',companyName:'Ashok Leyland Ltd',priority:'HIGH'}]}]));
if(req.url.startsWith('/api/company-filing-counts'))return res.end(JSON.stringify({success:true,items:{532725:{last30Days:0,available:true},500477:{last30Days:6,available:true}}}));
if(req.url.startsWith('/api/announcements')){if((failHomeFilings&&req.url.includes('limit=100&symbols='))||(failWatchlistFilings&&req.url.includes('limit=2500&symbols='))){res.statusCode=503;return res.end('{}')}return res.end(JSON.stringify([{id:'ashok-notice',scrip_cd:'500477',companyName:'Ashok Leyland Ltd',subject:'Board Meeting Intimation for To Inter-Alia Consider And Approve The Unaudited Financial Results',bseTime:new Date(now).toISOString(),priority:'HIGH',category:'RESULTS'}]));}
if(req.url.includes('unread-count'))return res.end(JSON.stringify({unreadCount:unread}));if(req.url.includes('/read')){await new Promise(r=>setTimeout(r,750));if(failRead){res.statusCode=503;return res.end('{}')}unread=0;return res.end('{"success":true}')}if(req.url.includes('/notifications'))return res.end(JSON.stringify({notifications:Array.from({length:3},(_,i)=>({id:'n'+i,title:'Fixture notification '+i,message:'Test alert',type:'GENERAL',priority:'LOW',timestamp:now,isRead:unread===0}))}));if(req.url.includes('/company-intel')){companyReads++;if(failCompany){res.statusCode=503;return res.end('{}')}const company=req.url.includes('500477')?{...intel,companyName:'Ashok Leyland Ltd',symbol:'ASHOKLEY',scripCode:'500477'}:intel;return res.end(JSON.stringify(company))}return res.end('{}')}
if(req.url.startsWith('/preview')){res.setHeader('Content-Type','text/html');return res.end('<html><body style="margin:0;background:#bbb"><iframe title="Phone preview" src="/fixture" style="width:390px;height:844px;border:0"></iframe><a href="/fixture">Desktop preview</a></body></html>')}
if(req.url.split('?')[0]==='/fixture'){res.setHeader('Content-Type','text/html');res.end(await v.transformIndexHtml(req.url,'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="root"></div><script type="module" src="/@qa"></script></body></html>'));return}next()})}}]});await server.listen();
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
 const beforeReopen=companyReads;
 await page.getByRole('button',{name:'hub',exact:true}).click();
 await page.getByRole('button',{name:'View 6 stored filings in the last 30 days',exact:true}).waitFor();
 assert.equal(companyReads,beforeReopen,'fresh reopen retains the same-owner snapshot');
 assert.equal(await page.getByText(/Loading company data/).count(),0);
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
 await page.getByRole('button',{name:'Close notification inbox'}).click();
 await page.clock.install({time:new Date(now)});
 await page.getByRole('button',{name:'calendar',exact:true}).click();
 await page.getByRole('button',{name:'Today',exact:true}).click();
 await page.getByText('Awaiting filing',{exact:true}).waitFor();
 calendarDeclared=true;
 const beforeResume=calendarReads;
 await page.clock.fastForward(3000);
 await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));
 await page.getByText('✓ Declared today',{exact:true}).waitFor();
 assert.ok(calendarReads>beforeResume,'same-day standalone resume fetches new declarations');
 await page.getByRole('button',{name:'watchlist',exact:true}).click();
 await page.locator('#stock-card-ASHOKLEY').waitFor();
 await page.getByText('Results declared today',{exact:true}).waitFor();
 const ash=page.locator('#stock-card-ASHOKLEY');
 assert.equal(await ash.getByText('Results declared today',{exact:true}).count(),0,'meeting intimation is a new filing');
 const solar=page.locator('#stock-card-SOLARINDS');
 assert.equal(await solar.getByText('High impact',{exact:true}).count(),0,'personal priority cannot mark company news as high impact');
 for(const width of [360,390,768,1440]){
  await page.setViewportSize({width,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'watchlist has no page overflow');
  const box=await ash.boundingBox();
  if(width<640){
   assert.ok(box.height<=155,'watchlist company fits a compact phone row');
   const priority=await ash.getByRole('button',{name:/Change priority/}).boundingBox();
   assert.ok(priority.height>=44,'priority gives thumbs a 44px target');
  }
 }
 await page.setViewportSize({width:390,height:844});
 const refreshWatchlist=page.getByRole('button',{name:'Refresh',exact:true});
 failWatchlistFilings=true;
 await refreshWatchlist.click();
 const refreshAlert=page.getByText('Filings could not be refreshed. Please retry.',{exact:true});
 await refreshAlert.waitFor();
 assert.equal(await ash.isVisible(),true,'failed refresh keeps the last loaded list');
 failWatchlistFilings=false;
 await page.getByRole('button',{name:'Retry',exact:true}).click();
 await refreshAlert.waitFor({state:'hidden'});
 await refreshWatchlist.waitFor();
 assert.equal(await ash.isVisible(),true,'confirmed retry retains the company row');
 await ash.getByRole('button',{name:'6 filings · 30d'}).press('Enter');
 await page.getByRole('heading',{name:'BSE filings · last 30 days (6 items)'}).waitFor();
 assert.equal(await page.getByText('Stored filing 7',{exact:true}).count(),0,'older filing excluded from scoped entry');
 await page.getByRole('button',{name:'Show all',exact:true}).click();
 await page.getByText('Stored filing 7',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Close Company Intelligence Modal',exact:true}).click();
 await ash.getByRole('button',{name:/Open company overview/}).click();
 await page.getByRole('button',{name:/View 6 stored filings in the last 30 days/}).waitFor();
 await page.getByRole('button',{name:'Close Company Intelligence Modal',exact:true}).click();
 await page.getByRole('button',{name:'home',exact:true}).click();
 const filingButton=page.getByRole('button',{name:/Ashok Leyland.*Details/});
 await filingButton.waitFor();
 const watched=page.getByRole('heading',{name:'Your Watchlist Updates'});
 const results=page.getByRole('heading',{name:/Your Results/});
 const radar=page.getByRole('heading',{name:/Impact Radar/}).first();
 await radar.waitFor();
 assert.ok(await watched.evaluate((element, other)=>Boolean(element.compareDocumentPosition(other)&Node.DOCUMENT_POSITION_FOLLOWING),await results.elementHandle()));
 assert.ok(await results.evaluate((element, other)=>Boolean(element.compareDocumentPosition(other)&Node.DOCUMENT_POSITION_FOLLOWING),await radar.elementHandle()));
 await filingButton.press('Enter');
 await page.getByRole('dialog',{name:'Filing details'}).waitFor();
 await page.keyboard.press('Escape');
 await page.getByRole('dialog',{name:'Filing details'}).waitFor({state:'hidden'});
 assert.equal(await filingButton.evaluate(button=>document.activeElement===button),true);
 await page.getByRole('button',{name:/Solar Industries.*Declared today/}).click();
 await page.getByRole('dialog',{name:'Result details'}).getByText(/^Result declared ·/).waitFor();
 await page.getByRole('button',{name:'Close result details'}).click();
 await page.getByRole('button',{name:'visuals',exact:true}).click();
 failHomeFilings=true;
 await page.getByRole('button',{name:'home',exact:true}).click();
 await page.getByText('Watchlist filings could not be checked.',{exact:false}).waitFor();
 assert.equal(await page.getByText(/Nothing urgent from your watchlist/).count(),0);
 failHomeFilings=false;
 await page.getByRole('button',{name:'Retry filings'}).click();
 await filingButton.waitFor();
 includeFutureMeetings=true;
 await page.getByRole('button',{name:'calendar',exact:true}).click();
 await page.getByRole('button',{name:'Today',exact:true}).click();
 const pageSelect=page.getByRole('button',{name:'Select this page (1)',exact:true});
 await pageSelect.waitFor();
 assert.equal(await page.getByRole('button',{name:/Select all matching upcoming/}).count(),0);
 assert.equal(await page.getByRole('button',{name:'Operations',exact:true}).count(),0);
 await pageSelect.click();
 await page.getByText('1 meeting selected',{exact:true}).waitFor();
 const downloadEvent=page.waitForEvent('download');
 await page.getByRole('button',{name:'Export .ics (1)',exact:true}).click();
 const calendarFile=await readFile(await (await downloadEvent).path(),'utf8');
 assert.equal((calendarFile.match(/BEGIN:VEVENT/g)||[]).length,1);
 assert.match(calendarFile,/SOLARINDS/);
 assert.doesNotMatch(calendarFile,/FIXTURE/);
 await page.getByRole('button',{name:'Upcoming',exact:true}).click();
 await page.getByRole('button',{name:'Select all matching upcoming (27)',exact:true}).click();
 await page.getByText('27 meetings selected · 2 on other pages',{exact:true}).waitFor();
 await page.getByRole('textbox',{name:'Search earnings calendar'}).fill('Fixture Company 12');
 await page.getByRole('button',{name:'Select this page (1)',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:/Export \.ics/}).count(),0);
 assert.equal(await page.locator('details').filter({hasText:'Calendar help'}).getAttribute('open'),null);

 await page.goto(origin+'/fixture?admin=1');
 await page.getByRole('button',{name:'calendar',exact:true}).click();
 await page.getByRole('button',{name:'Filter',exact:true}).click();
 const filters=page.getByRole('dialog',{name:'Earnings filters'});
 await filters.waitFor();
 assert.equal(await filters.getByRole('button',{name:'Quick Sync',exact:true}).count(),0);
 await page.getByRole('button',{name:'Close earnings filters',exact:true}).click();
 await page.getByRole('button',{name:'Operations',exact:true}).click();
 const operations=page.getByRole('dialog',{name:'Calendar operations'});
 await operations.getByRole('button',{name:'Quick Sync',exact:true}).waitFor();
 assert.equal(await operations.getByRole('button',{name:'Done',exact:true}).count(),0);
 let sent=0;
 page.on('request',req=>{if(req.url().includes('/telegram-broadcast'))sent++});
 page.once('dialog',async dialog=>{assert.match(dialog.message(),/filters do not apply/);await dialog.dismiss()});
 await operations.getByRole('button',{name:'Broadcast schedule',exact:true}).click();
 assert.equal(sent,0);
 await page.getByRole('button',{name:'Close calendar operations',exact:true}).click();
 assert.deepEqual(errors,[]);
 console.log('Mobile UI: layout, scoped filing navigation, personal Home order, keyboard and retry, inbox rollback, company cache, calendar resume, scoped ICS and separate admin operations passed (synthetic providers).');
} finally {await browser?.close();await server.close();}

