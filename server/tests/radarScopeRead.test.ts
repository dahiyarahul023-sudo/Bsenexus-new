import { test } from 'node:test';
import assert from 'node:assert/strict';
process.env.SUPABASE_URL = 'https://radar-scope-test.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only-service-role';
const { listRadarEvents, getRadarEvent, getRadarFollowing, publishRadarRecords } = await import('../database/impactRadarDao.js');
const { radarRecordFromSource } = await import('../services/impactRadarService.js');
const base = radarRecordFromSource({sourceId:'one',title:'PNC Infratech enters insolvency',publishedAt:'2026-10-17T10:00:00Z',company:{name:'PNC Infratech Ltd',symbol:'PNCINFRA',scripCode:'539150'},source:{name:'BSE',kind:'disclosure',url:'https://www.bseindia.com/one.pdf'}},Date.parse('2026-10-17T12:00:00Z'))!;
const valid = {...base.event,id:'valid'};
const routine = {...base.event,id:'routine',title:'PNC Infratech: acquisition update',information:'A routine acquisition.',category:'deals'};
test('saved routine events disappear from list/detail/tracking consistently without issuing a delete or publishing them', async () => {
 const previous = globalThis.fetch; const writes:string[]=[];
 globalThis.fetch = (async (input:any,init:any) => {
  const url = new URL(String(input?.url || input));
  const method = init?.method || input?.method || 'GET';
  if (method !== 'GET') writes.push(method);
  if (url.pathname.endsWith('/impact_categories')) return Response.json([{id:'deals',label:'Insolvency & disputes',sort_order:50,active:true}]);
  if (url.pathname.endsWith('/impact_radar_follows')) return Response.json([valid,routine].map(e=>({event_id:e.id,impact_radar_events:{data:e}})));
  if (url.searchParams.has('id')) return Response.json([{data:url.searchParams.get('id')==='eq.routine'?routine:valid}]);
  return Response.json([{data:routine},{data:valid}]);
 }) as typeof fetch;
 try {
  assert.deepEqual((await listRadarEvents()).map(e=>e.id),['valid']);
  assert.equal(await getRadarEvent('routine'),null);
  assert.equal((await getRadarEvent('valid'))?.id,'valid');
  const followed = await getRadarFollowing('alice');
  assert.deepEqual(followed.ids,['valid']); assert.deepEqual(followed.events.map(e=>e.id),['valid']);
  await assert.rejects(publishRadarRecords([{event:routine,update:{...base.update,eventId:'routine'}}]),/Invalid radar records/);
  assert.deepEqual(writes,[],'projection must preserve evidence and follows');
 } finally {globalThis.fetch=previous;}
});
