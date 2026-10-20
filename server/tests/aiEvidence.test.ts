import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { filingsData, resultsData } from "../ai/market.js";
import { parseTool } from "../ai/policy.js";
import { renderPublicCalendarShell, publicCalendarCacheControl } from "../services/publicCalendar.js";
import { readCachedResultsCalendar } from "../services/resultsCalendarService.js";
const date = "2026-10-21T06:00:00.000Z";
const pdf = "https://www.bseindia.com/xml-data/corpfiling/AttachLive/test.pdf";
const ann = (id: string, ts: string, extra = {}) => ({newsId:id,scrip_cd:"532540",bseTime:ts,subject:id,details:"d".repeat(5000),pdfLink:pdf,...extra});
test("filings sort newest first, retain exchange provenance and page tied timestamps without skipping",async()=>{
  const raw=[ann("old","2026-10-19T05:00:00Z"),ann("c",date),ann("a",date),ann("b",date),ann("recent","2026-10-20T05:00:00Z")];
  const sources={recent:async()=>raw} as any;
  const first=await filingsData({limit:2},sources);
  assert.deepEqual(first.filings.map(x=>x.id),["a","b"]);
  assert.equal(first.nextBeforeId,"b");
  assert.equal(first.filings[0].summary.length,600);
  assert.equal(first.filings[0].summaryTruncated,true);
  assert.equal(first.filings[0].sourceKind,"exchange_filing");
  assert.equal(first.filings[0].pdfUrl,pdf);
  const second=await filingsData({limit:2,before:first.nextBefore!,beforeId:first.nextBeforeId!},sources);
  assert.deepEqual(second.filings.map(x=>x.id),["c","recent"]);
  const range=await filingsData({after:"2026-10-20T00:00:00Z",before:date},sources);
  assert.deepEqual(range.filings.map(x=>x.id),["recent"]);
  const full=await filingsData({detail:"full",limit:1},sources);
  assert.equal(full.filings[0].summary.length,4000);assert.equal(full.filings[0].summaryTruncated,true);
  assert.throws(()=>parseTool("filings_search",{beforeId:"b"}));
  assert.throws(()=>parseTool("filings_search",{after:date,before:date}));
});
test("declared results exclude future notices and past meetings inferred as declared without a filing",async()=>{
  const history=[
    {id:"future",isOutcome:false,submissionTimestamp:9999999999999,pdfLink:pdf},
    {id:"inferred",isOutcome:true,submissionTimestamp:9999999999998,pdfLink:""},
    {id:"unsafe",isOutcome:true,pdfLink:"http://127.0.0.1/secret"},
    {id:"old",isOutcome:true,submissionTimestamp:Date.parse("2026-07-20T05:00:00Z"),pdfLink:pdf,aiSummary:"x".repeat(1000)},
    {id:"latest",isOutcome:true,submissionTimestamp:Date.parse(date),pdfLink:pdf,aiSummary:"x".repeat(1000)},
  ] as any;
  const result=await resultsData("TCS",{limit:1},async()=>history);
  assert.equal(result.totalResults,2);assert.equal(result.excludedNoticesOrUnverified,3);
  assert.equal(result.results[0].publishedAt,date);assert.equal(result.results[0].summary.length,600);
  assert.equal(result.nextOffset,1);assert.equal(result.declaredOnly,true);
  const next=await resultsData("TCS",{offset:1,detail:"full"},async()=>history);
  assert.equal(next.results[0].summary.length,1000);assert.equal(next.results[0].summaryTruncated,false);
});
const fixture=(extra={})=>({lastUpdated:Date.parse("2026-10-21T00:00:00Z"),items:[
  {id:"b",symbol:"TCS",scripCode:"532540",companyName:"Tata Consultancy Services",purpose:"Financial results",meetingDate:"2026-10-22",meetingTimestamp:Date.parse("2026-10-22T00:00:00+05:30"),daysLeft:1,status:"UPCOMING",updatedAt:date,privateOwner:"never show",...extra},
]} as any);
test("public calendar replaces sample/hidden copy with matching visible facts and safe structured data",()=>{
  const base=fs.readFileSync("index.html","utf8");
  const html=renderPublicCalendarShell(base,fixture({companyName:'A </script><script>window.attack=1</script> & B'}),Date.parse(date));
  assert.ok(html.includes("data-public-calendar"));
  assert.ok(html.includes("2026-10-22"));assert.ok(html.includes("Last calendar sync"));
  assert.ok(html.includes("api.bseindia.com/BseIndiaAPI/api/BoardMeeting"));
  assert.ok(!html.includes("never show"));
  assert.ok(!html.includes("Heavy Civil Infrastructure Secures Mega Order"));
  assert.ok(!html.includes('display: none;'));
  const jsonScripts=html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)!;
  assert.equal(jsonScripts.length,1);
  const json=JSON.parse(jsonScripts[0].replace(/^<script[^>]*>/,"").replace(/<\/script>$/,""));
  assert.equal(json["@type"],"CollectionPage");
  assert.equal(json.mainEntity.numberOfItems,1);
  assert.ok(!html.includes("<script>window.attack"));
  assert.ok(html.includes('alt="BSE Nexus logo"'));
  assert.ok(html.includes('/src/main.tsx'),"existing application boot remains");
  const empty=renderPublicCalendarShell(base,{items:[],lastUpdated:0},Date.parse(date));
  assert.ok(empty.includes("No scheduled dates are available"));assert.ok(empty.includes("stale or unavailable"));
});
test("public preview does not fetch or refresh and cache cannot cross Indian midnight",()=>{
  const original=globalThis.fetch;let called=false;
  globalThis.fetch=async()=>{called=true;throw new Error("not allowed");};
  try {const snapshot=readCachedResultsCalendar();assert.ok(Array.isArray(snapshot.items));assert.equal(called,false);}
  finally {globalThis.fetch=original;}
  assert.equal(publicCalendarCacheControl(Date.parse("2026-10-20T18:29:59.500Z")),"no-store");
  assert.equal(publicCalendarCacheControl(Date.parse("2026-10-20T18:29:50Z")),"public, max-age=10, s-maxage=10");
  assert.equal(publicCalendarCacheControl(Date.parse(date)),"public, max-age=30, s-maxage=60");
});
test("required brand icon exists as a valid square PNG, not a placeholder path",()=>{
  const icon=fs.readFileSync("public/icon-192.png");
  assert.equal(icon.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
  assert.equal(icon.readUInt32BE(16),192);assert.equal(icon.readUInt32BE(20),192);
});
