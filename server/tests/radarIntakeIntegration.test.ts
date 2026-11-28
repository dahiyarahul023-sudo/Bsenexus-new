import { test, after } from 'node:test';
import assert from 'node:assert/strict';
process.env.SUPABASE_URL = 'https://radar-intake-test.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only-service-role';
const previous = globalThis.fetch;
const { DEFAULT_RADAR_INTAKE_RULES } = await import('../services/radarIntakePolicy.js');
const { RADAR_CATEGORIES } = await import('../../src/shared/impactRadar.js');
let published: any[] = [], ruleReads = 0, denied = false;
globalThis.fetch = (async (input: any, init: any) => {
 const url = String(input?.url || input), path = new URL(url).pathname;
 if (!url.startsWith(process.env.SUPABASE_URL!)) return new Response('<rss><channel><item><title>PNC Infratech: independent report alleges accounting irregularities</title><link>https://publisher.example/original</link><pubDate>Sat, 17 Oct 2026 04:00:00 GMT</pubDate><description>The publisher reports an independent research allegation.</description></item></channel></rss>');
 if (path.endsWith('/impact_intake_rules')) { ruleReads++; return new Response(JSON.stringify(denied ? {message:'Unavailable'} : DEFAULT_RADAR_INTAKE_RULES),{status:denied?503:200}); }
 if (path.endsWith('/impact_categories')) return new Response(JSON.stringify(Object.entries(RADAR_CATEGORIES).map(([id,label],i)=>({id,label,active:true,sort_order:i}))));
 if (path.endsWith('/publish_impact_radar_records')) { published.push(...JSON.parse(init.body).p_records); return new Response(null,{status:204}); }
 return new Response('[]');
}) as typeof fetch;
const { refreshRadarIntake, radarIntakeStatus } = await import('../services/impactRadarService.js');
after(()=>{globalThis.fetch=previous;});
test('background intake publishes an attributed news-only event, coalesces calls and exposes rule-store outage', async t => {
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-17T05:00:00Z')});
 try {
  await Promise.all([refreshRadarIntake(),refreshRadarIntake(),refreshRadarIntake()]);
  assert.equal(ruleReads,1);
  const news = published.find(r=>r.event.source.url==='https://publisher.example/original');
  assert.ok(news,'a news-only original must reach the publishing RPC without a filing');
  assert.equal(news.event.category,'governance'); assert.equal(news.event.publishedAt,'2026-10-17T04:00:00.000Z');
  assert.match(news.event.information,/reported:/); assert.equal(radarIntakeStatus().unavailable,false);
  const count=published.length; t.mock.timers.tick(301_000); denied=true;
  await refreshRadarIntake(); assert.equal(published.length,count,'failed registry reads must not silently restore default terms');
  assert.equal(radarIntakeStatus().unavailable,true);
 } finally {t.mock.timers.reset();}
});
