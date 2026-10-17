import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyRadarEvent, radarRecordFromSource } from '../services/impactRadarService.js';
import { DEFAULT_RADAR_INTAKE_RULES } from '../services/radarIntakePolicy.js';
import { radarHeadline, isRadarEventInScope } from '../../src/shared/impactRadar.js';

const company = { name: 'KPI Green Energy Ltd', symbol: 'KPIGREEN', scripCode: '542323' };
const now = Date.parse('2026-10-17T12:00:00Z');
const input = { sourceId: 'test', title: '', company, publishedAt: '2026-10-17T11:00:00Z', source: { name: 'BSE', kind: 'disclosure' as const, url: 'https://www.bseindia.com/source.pdf' } };
test('routine corporate transactions and statutory SEBI/NCLT boilerplate stay outside Radar', () => {
 const oldRules = DEFAULT_RADAR_INTAKE_RULES.map(r => r.id === 'corporate_transaction' ? { ...r, terms: ['acquisition','merger','demerger','takeover','insolvency','arbitration'] } : r);
 for (const title of [
  'KPI Green Energy Ltd - 542323 - Announcement under Regulation 30 (LODR)-Updates on Acquisition',
  'Bajaj Finserv: Acquisition - incorporation of a wholly owned subsidiary',
  'Company announces merger and takeover',
  'NCLT order approves the scheme of merger',
  'SEBI approves acquisition',
  'Disclosure under Regulation 30 of SEBI (LODR) Regulations, 2015 with respect to Receipt of Purchase Order',
  'Disclosure under SEBI (LODR) Regulations, 2015 with respect to receipt of purchase order',
  'Intimation under Regulation 30 of SEBI (LODR) Regulations, 2015: Letter of Acceptance',
  'The Exchange has received disclosure under Regulation 29(2) of SEBI (Substantial Acquisition of Shares & Takeovers) Regulations, 2011',
 ]) {
  assert.equal(classifyRadarEvent(title), null, title);
  assert.equal(classifyRadarEvent(title, oldRules), null, 'stale database terms: ' + title);
 }
});
test('deal-related risk, insolvency and disputes qualify independently of routine deal words', () => {
 for (const [title,category] of [
  ['KPI Green Energy: High Court stays acquisition', 'legal'],
  ['KPI Green Energy: CCI investigation into proposed acquisition', 'governance'],
  ['KPI Green Energy: CCI blocks merger', 'restriction'],
  ['KPI Green Energy: SEBI penalty over takeover disclosures', 'liability'],
  ['KPI Green Energy enters insolvency', 'deals'],
  ['KPI Green Energy: CIRP admitted by NCLT', 'deals'],
  ['KPI Green Energy: arbitration dispute over acquisition', 'deals'],
  ['KPI Green Energy faces accounting fraud allegations', 'governance'],
  ['KPI Green Energy: plant fire halts production', 'operations'],
  ['KPI Green Energy: adjudication order from Commissioner of Customs', 'legal'],
 ]) assert.equal(classifyRadarEvent(title)?.category, category, title);
});
test('existing routine cards are hidden while valid insolvency and custom-term events remain in scope', () => {
 const record = radarRecordFromSource({ ...input, title: 'KPI Green Energy enters insolvency' }, now)!;
 assert.ok(record); assert.equal(isRadarEventInScope(record.event), true);
 for (const title of ['KPI Green Energy: Updates on Acquisition', 'NCLT order approves merger', 'Corporate transaction development update']) {
  assert.equal(isRadarEventInScope({...record.event,title,information:'Routine corporate transaction update.'}), false, title);
 }
 const rules = [{...DEFAULT_RADAR_INTAKE_RULES[1],terms:['factory evacuation']}];
 const custom = radarRecordFromSource({...input,title:'KPI Green Energy reports factory evacuation',rules},now);
 assert.ok(custom); assert.equal(isRadarEventInScope(custom.event),true);
});
test('generic regulatory headings use a specific source sentence and preserve original timeline evidence', () => {
 const title = 'Announcement under Regulation 30 (LODR)-Other Regulatory Disclosures';
 const evidence = 'High Court stays acquisition pending hearing.';
 const record = radarRecordFromSource({ ...input, title, evidence }, now);
 assert.ok(record); assert.equal(record.update.title, title);
 assert.equal(radarHeadline(record.event), `${company.name}: ${evidence}`);
 assert.equal(record.event.information, evidence);
 assert.equal(radarRecordFromSource({ ...input, title: 'High Court development update' }, now), null);
 assert.equal(radarRecordFromSource({ ...input, title: 'Corporate transaction development update', evidence: 'Please find attached the update.' }, now), null);
});
