// Synthetic, public-only renderer/browser regression. No account or exchange calls.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { once } from 'node:events';
import { pathToFileURL } from 'node:url';
import { renderPublicCalendarShell, publicCalendarCacheControl } from '../server/services/publicCalendar.ts';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const now=Date.parse('2026-10-21T06:00:00Z');
const snapshot={lastUpdated:now,items:Array.from({length:3},(_,i)=>({
  id:'fixture-'+i,symbol:'TCS',scripCode:String(532540+i),
  companyName:i===0?'A very long company name '.repeat(10):'Synthetic company '+i,
  purpose:'Quarterly financial results',meetingDate:'2026-10-'+(22+i),
  meetingTimestamp:Date.parse('2026-10-'+(22+i)+'T00:00:00+05:30'),
  daysLeft:99,status:'UPCOMING',updatedAt:new Date(now).toISOString(),
  privateOwner:'must never enter the page',
}))};
const baseHtml=fs.readFileSync('index.html','utf8');
const app=express();app.use(express.static('public'));
app.get('/before',(_req,res)=>res.type('html').send(baseHtml));
app.get('/results-calendar',(req,res)=>res.set('Cache-Control',publicCalendarCacheControl(now)).type('html').send(renderPublicCalendarShell(baseHtml,req.query.empty?{items:[],lastUpdated:0}:snapshot,now)));
const server=app.listen(0,'127.0.0.1');await once(server,'listening');
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch();
const screenshots=path.join(process.env.RUNNER_TEMP,'public-calendar-evidence');fs.mkdirSync(screenshots,{recursive:true});
try{
  for(const width of [390,768,1440]){
    const context=await browser.newContext({javaScriptEnabled:false,viewport:{width,height:900}});
    await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
    const page=await context.newPage();
    await page.goto(base+'/before',{waitUntil:'networkidle'});
    await page.screenshot({path:path.join(screenshots,'before-'+width+'.png'),fullPage:true});
    const response=await page.goto(base+'/results-calendar',{waitUntil:'networkidle'});
    assert.equal(response.status(),200);
    assert.equal(response.headers()['cache-control'],'public, max-age=30, s-maxage=60');
    await page.getByRole('heading',{name:'Upcoming BSE results calendar',exact:true}).waitFor();
    assert.equal(await page.getByRole('link',{name:/View BSE source/}).count(),3);
    assert.ok(await page.getByRole('img',{name:'BSE Nexus logo'}).evaluate(img=>img.complete&&img.naturalWidth===192));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    assert.ok(!(await page.locator('body').innerText()).includes('must never enter the page'));
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>document.activeElement.tagName),'A');
    await page.screenshot({path:path.join(screenshots,'calendar-'+width+'.png'),fullPage:true});
    await page.reload({waitUntil:'networkidle'});
    await page.getByRole('heading',{name:'Upcoming BSE results calendar',exact:true}).waitFor();
    await page.goto(base+'/results-calendar?empty=1');
    await page.getByText('No scheduled dates are available in this cached window.',{exact:true}).waitFor();
    assert.equal(await page.getByRole('link',{name:/View BSE source/}).count(),0);
    console.log('PUBLIC_CALENDAR_BROWSER',JSON.stringify({width,javascript:false,rows:3,logo:true,overflow:false,keyboard:true,refresh:true,empty:true}));
    await context.close();
  }
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
