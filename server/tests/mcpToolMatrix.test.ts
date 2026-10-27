import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { once } from 'node:events';
import express from 'express';
import { PGlite } from '@electric-sql/pglite';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createAiToolRunner } from '../ai/tools';
import { TOOL_SPECS, SCOPES, AiError } from '../ai/policy';
import { mountAiIntegration } from '../ai/http';
import { aiOAuthProvider } from '../ai/oauth';
import { selectCalendarMeetings, istDay } from '../ai/calendarRead';
import { filingsData, resultsData } from '../ai/market';
import { filingSummaryVersion } from '../ai/filingSummary';

// Real registered SDK tools + real runner + actual SQL mutation/receipt functions.
// Synthetic identity and public market/PDF fixtures avoid external accounts or paid calls.
test('every advertised MCP tool executes with scoped fixtures; every private write/read rejects another owner',async t=>{
 const db=new PGlite(),clientId='00000000-0000-0000-0000-000000000007';
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create table users(uid text primary key,tier text,pro_expires_at bigint,display_name text,notification_prefs jsonb default '{}',mute_in_app_notifications boolean);
 create table payment_entitlements(uid text primary key,pro_expires_at bigint);
 create table user_watchlists(uid text primary key,lists jsonb,updated_at timestamptz default now());
 create table user_notes(id text primary key,user_id text,note jsonb,updated_at timestamptz default now());
 insert into users(uid,tier,pro_expires_at,display_name) values('matrix-a','pro',9999999999999,'Reviewer A'),('matrix-b','pro',9999999999999,'Reviewer B');`);
 await db.exec(fs.readFileSync('supabase/migrations/20261020072807_ai_connections.sql','utf8'));
 await db.query('insert into ai_connection_clients(id,metadata) values($1,$2)',[clientId,'{}']);
 const grants:any={};for(const uid of ['matrix-a','matrix-b'])grants[uid]=(await db.query<any>('insert into ai_connection_grants(uid,client_id,scopes) values($1,$2,$3) returning id',[uid,clientId,SCOPES])).rows[0].id;
 const listA='1700000000000',listB='1700000000001',noteA='note-a',noteB='note-b';
 for(const [uid,list,note] of [['matrix-a',listA,noteA],['matrix-b',listB,noteB]]){
  await db.query('insert into user_watchlists(uid,lists) values($1,$2)',[uid,JSON.stringify([{id:list,name:uid+' private list',is_active:1,items:[{symbol:'TCS',scripCode:'532540'}]}])]);
  await db.query('insert into user_notes(id,user_id,note) values($1,$2,$3)',[note,uid,JSON.stringify({id:note,userId:uid,text:uid+' private note'})]);
 }
 const rpc=async(name:string,args:any)=>{const values=name==='reserve_ai_connection'?[args.p_uid,args.p_write,args.p_daily,args.p_minute,args.p_write_limit,args.p_request,args.p_fingerprint,args.p_tool]:[args.p_uid,args.p_request,args.p_fingerprint,args.p_tool,JSON.stringify(args.p_args),args.p_grant];const value=(await db.query<any>(`select public.${name}(${values.map((_,i)=>'$'+(i+1)).join(',')}) r`,values)).rows[0].r;if(value.error)throw new AiError(value.error,value.error==='not_found'?404:value.error==='scope_required'?403:409);return value;};
 const query=async(action:any)=>{
  const factory=(table:string)=>{assert.ok(['user_watchlists','user_notes','ai_connection_operations'].includes(table));let fields='*',filters:{key:string;value:any}[]=[],values:any[]=[],order='',range='',update:any;
   const q:any={select:(f:string)=>{fields=f;return q},eq:(key:string,value:any)=>{filters.push({key,value});return q},is:(key:string,value:any)=>{filters.push({key,value});return q},order:(key:string)=>{order=' order by '+key+' desc';return q},range:(first:number,last:number)=>{range=` limit ${last-first+1} offset ${first}`;return q},update:(data:any)=>{update=data;return q}};
   const execute=async(single=false)=>{values=[];const updateSql=update?'update '+table+' set '+Object.entries(update).map(([key,value])=>{values.push(JSON.stringify(value));return key+'=$'+values.length}).join(','):'select '+fields+' from '+table;
    const where=filters.map(({key,value})=>{if(value===null)return key+' is null';values.push(value);return key+'=$'+values.length}).join(' and ');
    const rows=(await db.query(updateSql+(where?' where '+where:'')+(update?' returning '+fields:order+range),values)).rows;return {data:single?(rows[0]||null):rows,error:null};};q.maybeSingle=()=>execute(true);q.then=(resolve:any,reject:any)=>execute().then(resolve,reject);return q;};
  const response=await action({from:factory});return response.data;
 };
 const profileState=async(token:string)=>{const uid=token==='other'?'matrix-b':'matrix-a';const row=(await db.query<any>('select * from users where uid=$1',[uid])).rows[0];return {grant:{uid,id:grants[uid],scopes:[...SCOPES]},profile:{uid,displayName:row.display_name,notificationPreferences:row.notification_prefs},pro:true,limits:{daily:1000,perMinute:200,writes:200}} as any;};
 const pdf='https://www.bseindia.com/xml-data/corpfiling/AttachLive/test.pdf',filing={id:'fixture-filing',newsId:'fixture-filing',subject:'Approved financial results',scrip_cd:'532540',pdfLink:pdf,bseTime:new Date().toISOString()};
 const calendar={lastUpdated:Date.now(),items:[{id:'tcs-date',symbol:'TCS',scripCode:'532540',companyName:'TCS',meetingTimestamp:Date.now(),meetingDate:istDay(Date.now()),purpose:'Financial results',status:'TODAY'}]} as any;
 const run=createAiToolRunner({state:profileState,rpc,db:query,calendar:async()=>calendar,filings:args=>filingsData(args,{recent:async()=>[filing],company:async()=>[filing]} as any),results:(company,options)=>resultsData(company,options,async()=>[{...filing,id:filing.id,isOutcome:true,submissionTimestamp:Date.now()}] as any),meetings:async(_query,daysAhead,options)=>selectCalendarMeetings(calendar,{...options,daysAhead}),notifications:async(uid)=>[{id:uid+'-notification',title:uid+' private notification',message:'fixture',isRead:false,timestamp:Date.now()}] as any,filing:async()=>filing as any,summarize:async(_item,language)=>({summary:'The original document reports the approved result with source evidence.',language,generationMode:'pdf_ai',documentAnalyzed:true,documentCoverage:'full_pdf',inputTruncated:false,summaryTruncated:false,pdfUrl:pdf,sourceVersion:filingSummaryVersion(filing),documentSha256:'a'.repeat(64),generatedAt:new Date().toISOString(),provider:'fixture',model:'fixture',schemaVersion:1}),cacheSummary:()=>{},quota:{consume:async()=>({allowed:true,reservationId:'synthetic'} as any),refund:async()=>{},complete:()=>{},claimFree:async()=>true,releaseFree:async()=>{}}});
 const input:any={account_context:{},company_lookup:{query:'TCS'},filings_search:{},results_read:{company:'TCS'},meetings_read:{},watchlist_results_upcoming:{},watchlists_read:{},watchlist_create:{name:'New review list'},watchlist_rename:{watchlistId:listA,name:'Renamed review'},watchlist_toggle:{watchlistId:listA,active:true},watchlist_add_stock:{watchlistId:listA,company:'INFY'},watchlist_remove_stock:{watchlistId:listA,company:'INFY'},watchlist_priority:{watchlistId:listA,company:'TCS',priority:'LOW'},preferences_update:{summaryLanguage:'english'},watchlist_stocks_read:{watchlistId:listA},notes_read:{},note_create:{text:'A new review note'},note_update:{noteId:noteA,text:'Updated review note'},notifications_read:{},alert_preferences_read:{},alert_preferences_update:{creditRatings:false},filing_summary:{filingId:filing.id}};
 for(const [name,spec] of Object.entries(TOOL_SPECS))if(spec.write)input[name].requestId='matrix_valid_'+name;
 const token='bnx_at_'+'a'.repeat(43),old=process.env.AI_CONNECTIONS_ENABLED,original=aiOAuthProvider.verifyAccessToken;
 process.env.AI_CONNECTIONS_ENABLED='true';aiOAuthProvider.verifyAccessToken=async()=>({token,clientId,scopes:[...SCOPES],expiresAt:Math.floor(Date.now()/1000)+60,resource:new URL('https://bsenexus.in/mcp'),extra:{uid:'matrix-a',grantId:grants['matrix-a']}});
 const app=express();app.use(express.json());mountAiIntegration(app,{runTool:run,profileState});const server=app.listen(0,'127.0.0.1');await once(server,'listening');const client=new Client({name:'Directory fixtures',version:'1'});
 try {
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${(server.address() as any).port}/mcp`),{requestInit:{headers:{Authorization:'Bearer '+token}}}));const wire=await client.listTools();assert.equal(wire.tools.length,23);
  for(const tool of wire.tools)await t.test('wire '+tool.name,async()=>{const result=await client.callTool({name:tool.name,arguments:input[tool.name]||{}});assert.notEqual(result.isError,true,JSON.stringify(result));assert.ok(!JSON.stringify(result).includes('matrix-b private'));});
  for(const [name,spec] of Object.entries(TOOL_SPECS)){
   await assert.rejects(run(token,name,{...input[name],uid:'matrix-b'}),(e:any)=>e.code==='invalid_arguments',name+' rejects owner injection');
   if(spec.write)assert.deepEqual(await run(token,name,input[name]),await run(token,name,input[name]),name+' repeats saved outcome');
   const denied=createAiToolRunner({state:async()=>({...await profileState(token),grant:{uid:'matrix-a',id:grants['matrix-a'],scopes:[]}}),rpc:async()=>{throw new Error('must not reserve denied operation')}});await assert.rejects(denied(token,name,input[name]),(e:any)=>e.code==='scope_required');
  }
  for(const name of ['watchlist_stocks_read','watchlist_results_upcoming','watchlist_rename','watchlist_toggle','watchlist_add_stock','watchlist_remove_stock','watchlist_priority','note_update']){
    const args={...input[name],...(name.startsWith('watchlist')?{watchlistId:listB}:{noteId:noteB}),...(TOOL_SPECS[name as keyof typeof TOOL_SPECS].write?{requestId:'foreign_id_'+name}:{})};
    await assert.rejects(run(token,name,args),(e:any)=>e.code==='not_found',name+' denies guessed foreign IDs');
  }
  for(const name of ['watchlists_read','notes_read','notifications_read','alert_preferences_read'])assert.ok(!JSON.stringify(await run(token,name,{})).includes('matrix-b private'));
  const foreign=(await db.query<any>('select lists from user_watchlists where uid=$1',['matrix-b'])).rows[0].lists;assert.equal(foreign[0].name,'matrix-b private list');assert.equal((await db.query<any>('select note from user_notes where id=$1',[noteB])).rows[0].note.text,'matrix-b private note');
 } finally {await client.close();aiOAuthProvider.verifyAccessToken=original;if(old===undefined)delete process.env.AI_CONNECTIONS_ENABLED;else process.env.AI_CONNECTIONS_ENABLED=old;server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await db.close();}
});
