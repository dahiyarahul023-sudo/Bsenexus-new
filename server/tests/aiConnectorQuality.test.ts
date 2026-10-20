import { test } from "node:test";
import assert from "node:assert/strict";
import { calendarWindow, istDay, selectCalendarMeetings, compactWatchlistStock } from "../ai/calendarRead.js";
import { createAiToolRunner } from "../ai/tools.js";
import { AiError, parseTool } from "../ai/policy.js";
import type { ResultCalendarItem } from "../services/resultsCalendarService.js";
const fixed = Date.parse("2026-10-20T20:00:00Z"); // Already 21 Oct in India.
const event = (code: string, day: string, extra = {}): ResultCalendarItem => ({
  id: code + "_" + day, symbol: code === "532540" ? "TCS" : "RELIANCE",
  scripCode: code, companyName: code, purpose: "Financial results",
  meetingDate: day, meetingTimestamp: Date.parse(day + "T00:00:00+05:30"),
  daysLeft: 999, status: "UPCOMING", updatedAt: new Date(fixed).toISOString(),
  marketUniverse: false, ...extra,
});
test("relative dates use Indian calendar days including the UTC/IST midnight boundary", () => {
  assert.equal(istDay(Date.parse("2026-10-20T18:29:59Z")), "2026-10-20");
  assert.equal(istDay(Date.parse("2026-10-20T18:30:00Z")), "2026-10-21");
  const tomorrow = calendarWindow({fromDate:"tomorrow",toDate:"tomorrow"},fixed);
  assert.equal(tomorrow.fromDate,"2026-10-22");
  assert.equal(tomorrow.toDate,"2026-10-22");
  for(const args of [{fromDate:"2026-02-30"},{fromDate:"yesterday"},{fromDate:"2026-10-20"},{fromDate:"2027-01-01"},{fromDate:"tomorrow",toDate:"today"}])
    assert.throws(()=>calendarWindow(args,fixed),AiError);
  assert.throws(()=>parseTool("meetings_read",{limit:26}),AiError);
  assert.throws(()=>parseTool("watchlist_results_upcoming",{uid:"bob"}),AiError);
});
test("nearest dates are sorted before pagination and watchlist matching precedes the market cap", () => {
  const unrelated = Array.from({length:30},(_,i)=>event(String(600000+i),"2026-10-22",{marketUniverse:true}));
  const snapshot={lastUpdated:fixed,items:[
    ...unrelated,event("500325","2026-10-25"),event("532540","2026-10-21"),
    event("500325","2026-10-22"),event("532540","2026-10-20"),
    event("532540","2026-10-21",{isDeclared:true}),
    event("500325","2026-10-22",{id:"duplicate"}),
  ]};
  const codes=new Set(["532540","500325"]);
  const first=selectCalendarMeetings(snapshot,{limit:2},codes,fixed);
  assert.deepEqual(first.meetings.map(m=>m.meetingDate),["2026-10-21","2026-10-22"]);
  assert.deepEqual(first.meetings.map(m=>m.daysLeft),[0,1]);
  assert.equal(first.totalMatches,3);assert.equal(first.nextOffset,2);
  assert.equal(first.referenceDate,"2026-10-21");assert.equal(first.stale,false);
  const second=selectCalendarMeetings(snapshot,{limit:2,offset:2},codes,fixed);
  assert.deepEqual(second.meetings.map(m=>m.meetingDate),["2026-10-25"]);assert.equal(second.nextOffset,null);
  const tomorrow=selectCalendarMeetings(snapshot,{fromDate:"tomorrow",toDate:"tomorrow"},codes,fixed);
  assert.equal(tomorrow.count,1);assert.equal(tomorrow.meetings[0].scripCode,"500325");
  assert.equal(tomorrow.coverage.completeMarket,false);
  const stale=selectCalendarMeetings({...snapshot,lastUpdated:0},{},codes,fixed);
  assert.equal(stale.stale,true);assert.equal(stale.lastSyncedAt,null);
});
const identity=(scopes=["watchlists:read","market:read"],pro=true)=>({
  grant:{uid:"alice",id:"grant-a",scopes},profile:{uid:"alice"},pro,
  limits:{daily:200,perMinute:20,writes:50},
}) as any;
function fixture(lists: any[], opts: { scopes?:string[];pro?:boolean;calendarError?:boolean;quotaError?:boolean }={}) {
  const calls: any[]=[];
  const today=istDay(Date.now());
  const run=createAiToolRunner({
    state:async()=>identity(opts.scopes,opts.pro),
    rpc:async(name,args)=>{calls.push({name,args});if(opts.quotaError)throw new AiError("quota_exceeded",429);return {remaining:10};},
    db:async action=>{
      const q={
        select:(_fields:string)=>q,
        eq:(key:string,value:string)=>{calls.push({filter:key,value});assert.equal(key,"uid");assert.equal(value,"alice");return q;},
        maybeSingle:async()=>({data:{lists},error:null}),
      };
      const response = await action({from:(table:string)=>{assert.equal(table,"user_watchlists");return q;}} as any);
      if (response.error) throw response.error;
      return response.data;
    },
    calendar:async()=>{calls.push({calendar:true});if(opts.calendarError)throw new AiError("calendar_unavailable",503);return {lastUpdated:Date.now(),items:[event("532540",today),event("500325",today)]};},
  });
  return {run,calls};
}
test("one watchlist-results call uses durable owner filtering and one quota reservation",async()=>{
  const {run,calls}=fixture([{id:"mine",is_active:1,items:[{symbol:"TCS",scripCode:"532540"}]},{id:"paused",is_active:0,items:[{symbol:"RELIANCE",scripCode:"500325"}]}]);
  const result=await run("token","watchlist_results_upcoming",{});
  assert.equal(result.count,1);assert.equal(result.meetings[0].scripCode,"532540");
  assert.equal(result.watchlistStockCount,1);
  assert.equal(calls.filter(c=>c.name==="reserve_ai_connection").length,1);
  assert.equal(calls.find(c=>c.name)?.args.p_write,false);
  assert.ok(calls.some(c=>c.filter==="uid"&&c.value==="alice"));
  const specific=await run("token","watchlist_results_upcoming",{watchlistId:"paused"});
  assert.equal(specific.meetings[0].scripCode,"500325");
  await assert.rejects(run("token","watchlist_results_upcoming",{watchlistId:"bob-private"}),(e:any)=>e.status===404);
});
test("permissions, plan, quota, empty watchlists and source outages never fall back to another scope",async()=>{
  for(const opts of [{scopes:["market:read"]},{scopes:["watchlists:read"]},{pro:false}]){
    const {run,calls}=fixture([],opts);
    await assert.rejects(run("token","watchlist_results_upcoming",{}),(e:any)=>e.status===403);
    assert.equal(calls.length,0);
  }
  const empty=fixture([]);assert.equal((await empty.run("token","watchlist_results_upcoming",{})).count,0);
  assert.ok(!empty.calls.some(c=>c.calendar));
  const exhausted=fixture([{id:"mine",items:["TCS"]}],{quotaError:true});
  await assert.rejects(exhausted.run("token","watchlist_results_upcoming",{}),(e:any)=>e.status===429);
  assert.ok(!exhausted.calls.some(c=>c.calendar||c.filter));
  const down=fixture([{id:"mine",items:["TCS"]}],{calendarError:true});
  await assert.rejects(down.run("token","watchlist_results_upcoming",{}),(e:any)=>e.status===503);
});
test("watchlist stock reads expose bounded fields and keep page navigation without raw stored payloads",async()=>{
  const raw=Array.from({length:26},(_,i)=>({symbol:"TCS",scripCode:"532540",companyName:"Tata Consultancy Services",priority:"HIGH",category:"IT",details:"large private field".repeat(3000),deliveryToken:"never return",nested:{owner:"bob"},id:i}));
  const {run}=fixture([{id:"mine",name:"Mine",items:raw}]);
  const page=await run("token","watchlist_stocks_read",{watchlistId:"mine"});
  assert.equal(page.items.length,25);assert.equal(page.nextOffset,25);
  assert.deepEqual(Object.keys(page.items[0]).sort(),["symbol","scripCode","companyName","priority","category"].sort());
  const before=Buffer.byteLength(JSON.stringify({items:raw.slice(0,25),nextOffset:25}));
  const after=Buffer.byteLength(JSON.stringify(page));
  assert.ok(after<before/10);
  console.log("WATCHLIST_PAYLOAD_BYTES",JSON.stringify({synthetic:true,before,after}));
  const metadata=await run("token","watchlists_read",{});
  assert.equal(metadata.watchlists[0].preview.length,5);
  assert.ok(!JSON.stringify(metadata).includes("deliveryToken"));
  assert.deepEqual(compactWatchlistStock(" tcs "),{symbol:"TCS"});
});
