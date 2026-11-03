import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyRadarEvent } from '../services/impactRadarService.js';
import { isRadarEventInScope, type RadarEvent } from '../../src/shared/impactRadar.js';
const title='Route Mobile Ltd: Press Release titled "365squared launches AI-powered voice fraud protection solution, 365callguard"';
test('prevention products, safety education and mock incidents do not imply issuer misconduct',()=>{
  for(const text of [title,'Company launches fraud detection software','Company conducts cyber attack simulation drill','Company holds fraud prevention awareness programme'])assert.equal(classifyRadarEvent(text),null,text);
});
test('real allegations, incidents and official action survive nearby prevention language',()=>{
  for(const text of ['SEBI launches investigation into alleged fraud at the company','Company suffers data breach despite fraud prevention controls','Company receives SEBI penalty for fraud; launches remediation programme','PNB staffer arrested in alleged bank fraud case','Company reports accounting irregularities despite fraud prevention controls'])assert.ok(classifyRadarEvent(text),text);
});
test('already stored product-launch false positives are excluded without deleting history',()=>{
 const event={title,information:'The company has published a legal or regulatory disclosure. Read the original filing.',category:'governance'} as RadarEvent;
 assert.equal(isRadarEventInScope(event),false);
 assert.equal(isRadarEventInScope({...event,title:'Company reports accounting fraud allegations'}),true);
});
