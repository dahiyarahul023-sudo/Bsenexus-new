import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileDeclaredCalendar } from '../../src/shared/resultDeclaration.js';
const meetingTimestamp=Date.parse('2026-10-27T00:00:00+05:30');
const item={id:'calendar',scripCode:'532497',meetingTimestamp,isDeclared:false};
const filing={id:'58f029fb-34e7-4ef3-bc35-973ac2d5968e',scripCode:'532497',isOutcome:true,submissionTimestamp:1793091061000,pdfLink:'official.pdf',aiSummaryEn:'Grounded result'};
test('Radico verified inner result reconciles outer card using actual publication clock',()=>{
 const row=reconcileDeclaredCalendar([item],[filing],'532497',Date.parse('2026-10-28'))[0] as any;
 assert.equal(row.isDeclared,true);assert.equal(row.bseTimestamp,1793091061000);assert.equal(row.declarationAnnouncementId,filing.id);assert.equal(row.aiSummaryEn,'Grounded result');
});
test('notice, another company, older quarter, future and absent timestamps never declare a card',()=>{
 for(const patch of [{isOutcome:false},{scripCode:'500049'},{submissionTimestamp:meetingTimestamp-90*86400000},{submissionTimestamp:Date.parse('2027-01-01')},{submissionTimestamp:undefined}]) {
  assert.equal(reconcileDeclaredCalendar([item],[{...filing,...patch}],'532497',Date.parse('2026-10-28'))[0].isDeclared,false);
 }
});
