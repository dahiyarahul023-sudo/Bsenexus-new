import {test} from 'node:test';
import assert from 'node:assert/strict';
import {groupRadarCompanies} from '../../src/utils/radarCompanyGroups';
import type {RadarEvent} from '../../src/shared/impactRadar';

test('same-company disclosures occupy one card while each distinct proceeding remains readable', () => {
  const event=(id:string,code:string,updatedAt:string)=>({id,companies:[{scripCode:code,symbol:code,name:'Company Ltd'}],updatedAt,publishedAt:updatedAt}) as RadarEvent;
  const first=event('case-one','123456','2026-10-19T09:00:00Z'),later=event('case-two','123456','2026-10-19T10:00:00Z'),other=event('other-company','234567','2026-10-19T08:00:00Z');
  const groups=groupRadarCompanies([first,other,later,first]);
  assert.equal(groups.length,2);assert.equal(groups[0].latest.id,'case-two');assert.deepEqual(groups[0].reports.map(e=>e.id),['case-two','case-one']);
  assert.equal(first.id,'case-one','grouping never rewrites durable event or follow identities');
});
