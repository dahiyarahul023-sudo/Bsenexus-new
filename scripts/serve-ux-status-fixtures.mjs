// Local-only fixture server for manual browser verification of actual components.
// No production tokens, databases, payment gateway or notification sends.
import { createServer } from 'vite';
import { transform } from 'esbuild';
const root = process.cwd();
const auth = `import React from 'react'; export const FixtureAuth=React.createContext({}); export const useAuth=()=>React.useContext(FixtureAuth);`;
const api = `
export let scenario='admin', inbox='failure', declared=true;
export const setScenario=v=>{scenario=v}; export const setInbox=v=>{inbox=v}; export const setDeclared=v=>{declared=v};
const day=86400000,now=Date.now();
export const access=()=>({source:scenario,expiresAt:scenario==='admin'?now-day:scenario==='free'?now-day:now+30*day,paidExpiresAt:scenario==='paid'?now+30*day:0,gift:scenario==='gift'?{id:'fixture',validityDays:30,activatedAt:now,expiresAt:now+30*day}:null});
export async function customFetch(url,options={}){if(options.method && options.method!=='GET')return new Response(JSON.stringify({success:false,error:'Writes disabled in fixtures'}),{status:405});await new Promise(r=>setTimeout(r,60));let data={success:true};let status=200;
 if(url.includes('/payments/status'))data={success:true,configured:true,isPro:scenario!=='free',proExpiresAt:now-day,subscriptionAccess:access(),lastPaymentAt:scenario==='paid'?now:null,lastOrderId:null,plan:{id:'pro_monthly',label:'Pro Monthly',amountPaise:29900,validityDays:30,currency:'INR'}};
 else if(url.includes('/payments/history'))data={success:true,payments:[]};
 else if(url.includes('/company-intel/'))data={success:true,companyName:'State Bank of India',scripCode:'500112',symbol:'SBIN',filingCoverage:'stored',filingStats:{last30Days:1,asOf:now},recentFilings:[{id:'f1',subject:'Quarterly financial results',timestamp:now,bseTime:now,pdfLink:'https://www.bseindia.com/fixture.pdf'}],materialTimeline:[],quarterlyResults:[],upcomingEvent:{purpose:'Results',meetingDate:'2026-11-03',countdownDays:0,isDeclared:declared}};
 else if(url.includes('/notifications')){if(inbox==='failure'){status=503;data={success:false,error:'Fixture outage'}}else data={notifications:inbox==='empty'?[]:[{id:'n1',title:'SBIN results filed',message:'Quarterly results available',timestamp:now,type:'RESULT',isRead:false,isWatchlist:true}],muteInAppNotifications:false};}
 else data={success:true,items:[],data:[]};
 return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
}`;
const entry = `
import React,{useState} from 'react';import{createRoot}from'react-dom/client';import{LazyMotion,domAnimation}from'framer-motion';import'/src/index.css';
import{FixtureAuth}from'/@ux-auth';import{setScenario,setInbox,setDeclared,access}from'/@ux-api';
import{SubscriptionCard}from'/src/components/SubscriptionCard.tsx';import{NotificationInbox}from'/src/components/NotificationInbox.tsx';import{CompanyIntelligenceModal}from'/src/components/CompanyIntelligenceModal.tsx';
function App(){const[mode,M]=useState('billing'),[person,P]=useState('admin'),[declared,D]=useState(true),[dark,T]=useState(false);
 const auth={user:{uid:'fixture-'+person+'-'+declared},profile:{uid:'fixture-'+person+'-'+declared,tier:person==='admin'?'admin':'pro',subscriptionAccess:access()},isPro:person!=='free',isAdmin:person==='admin',isOwner:person==='admin',profileUnavailable:false,refreshProfile:async()=>{},openCheckout(){},setReceipt(){},setIsAuthModalOpen(){},setIsProModalOpen(){}};
 return <FixtureAuth.Provider value={auth}><header style={{padding:12,display:'flex',flexWrap:'wrap',gap:8,background:dark?'#111827':'#e2e8f0',color:dark?'white':'black',position:'relative',zIndex:110}}><strong>Isolated UX status fixtures</strong>{['billing','inbox','company'].map(v=><button onClick={()=>M(v)}>{v}</button>)}<label>Access <select value={person} onChange={e=>{setScenario(e.target.value);P(e.target.value)}}>{['admin','paid','trial','gift','free'].map(v=><option>{v}</option>)}</select></label><button onClick={()=>{document.documentElement.classList.toggle('dark');T(!dark)}}>Toggle theme</button><label>Window width <select defaultValue="100%" onChange={e=>document.getElementById('fixture-content').style.width=e.target.value}><option>100%</option><option>390px</option><option>768px</option></select></label></header>
 <div id="fixture-content" style={{margin:'auto',maxWidth:'100%',minHeight:'90vh',padding:16}}>{mode==='billing'?<SubscriptionCard/>:mode==='inbox'?<><nav style={{position:'relative',zIndex:110,background:'#f8fafc',padding:8}}><button onClick={()=>setInbox('failure')}>Simulate outage</button><button onClick={()=>setInbox('content')}>Restore service</button><button onClick={()=>setInbox('empty')}>Return empty</button></nav><NotificationInbox key={auth.user.uid} isOpen onClose={()=>M('billing')} onOpenCompanyIntel={()=>M('company')} onOpenAlertRules={()=>{}} unreadCount={1} onRefreshCount={()=>{}} onBeginRead={()=>()=>{}}/></>:<><nav style={{position:'relative',zIndex:110,background:'#f8fafc',padding:8}}><button onClick={()=>{setDeclared(!declared);D(!declared)}}>Toggle result evidence</button></nav><CompanyIntelligenceModal key={auth.user.uid} isOpen scripCode="500112" symbol="SBIN" companyName="State Bank of India" onClose={()=>M('billing')}/></>}</div></FixtureAuth.Provider>;
}createRoot(document.getElementById('root')).render(<LazyMotion features={domAnimation}><App/></LazyMotion>);`;
const server = await createServer({ root, configFile: root + '/vite.config.ts', server: { host: '127.0.0.1', port: 3217, hmr: false }, plugins: [{
  name: 'isolated-ux-fixtures', enforce: 'pre',
  resolveId(source, importer) {
    if(source === '/@ux-entry') return '\0ux-entry';
    if(source === '/@ux-auth' || importer && /AuthContext$/.test(source)) return '\0ux-auth';
    if(source === '/@ux-api' || importer && /\/api$/.test(source)) return '\0ux-api';
    if(importer && /\/IntelModalContext$/.test(source)) return '\0ux-intel';
    if(importer && /\/aiQuota$/.test(source)) return '\0ux-quota';
    if(importer && /\/SaveNoteButton$/.test(source)) return '\0ux-note';
  },
  load(id) {
    if(id === '\0ux-entry') return transform(entry,{loader:'jsx',jsx:'automatic'}).then(r=>r.code);
    if(id === '\0ux-auth') return auth;
    if(id === '\0ux-api') return api;
    if(id === '\0ux-intel') return 'export const useIntelModal=()=>({openIntelModal(){}})';
    if(id === '\0ux-quota') return 'export const useAiQuota=()=>({canGenerate:true}); export const syncQuotaFromResponse=()=>{}';
    if(id === '\0ux-note') return 'export const SaveNoteButton=()=>null';
  },
  configureServer(v) { v.middlewares.use((req,res,next)=>{
    if(req.url === '/ux-fixtures') { res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><title>BSE Nexus isolated UX status fixtures</title><div id="root"></div><script type="module" src="/@ux-entry"></script>'); } else next();
  }); },
}] });
await server.listen();console.log('Isolated fixtures: http://127.0.0.1:3217/ux-fixtures');
