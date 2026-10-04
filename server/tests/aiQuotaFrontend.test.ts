import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseServerAiQuota,getAiQuotaStatus} from '../../src/utils/aiQuota.js';

test('quota UI accepts coherent server counts and identifies admin null Infinity serialization',()=>{
  const pro=parseServerAiQuota({tier:'pro',dailyLimit:100,usedToday:1,remaining:99,canGenerate:true});
  assert.equal(pro?.usedToday,1);assert.equal(pro?.remaining,99);assert.equal(pro?.source,'server');
  assert.equal(parseServerAiQuota({tier:'pro',dailyLimit:100,usedToday:100,remaining:0,canGenerate:false})?.canGenerate,false);
  const admin=parseServerAiQuota({tier:'admin',dailyLimit:null,usedToday:0,remaining:null,canGenerate:true});
  assert.equal(admin?.dailyLimit,Infinity);assert.equal(admin?.remaining,Infinity);
  assert.match(admin!.message!,/admin/);
});

test('quota UI rejects missing, negative, mismatched and falsely unlimited Pro counters',()=>{
  const valid={tier:'pro',dailyLimit:100,usedToday:1,remaining:99,canGenerate:true};
  for(const data of [null,{}, {...valid,usedToday:undefined},{...valid,usedToday:-1},{...valid,usedToday:101},{...valid,remaining:100},{...valid,remaining:'99'},{...valid,dailyLimit:null,remaining:null},{...valid,canGenerate:false},{...valid,tier:'owner'},{...valid,usedToday:1.5}])assert.equal(parseServerAiQuota(data),null);
});

test('free one-time demos and guest zero access are distinct from daily Pro allowance',()=>{
  const free=parseServerAiQuota({tier:'free',dailyLimit:1,usedToday:1,remaining:0,canGenerate:false});
  assert.match(free!.message!,/one-time/);assert.equal(free?.canGenerate,false);
  assert.equal(parseServerAiQuota({tier:'free',dailyLimit:100,usedToday:0,remaining:100,canGenerate:true}),null);
  assert.equal(parseServerAiQuota({tier:'guest',dailyLimit:0,usedToday:0,remaining:0,canGenerate:false})?.remaining,0);
});

test('cached profile eligibility cannot fabricate a full/verified quota before the authenticated server read',()=>{
  const pro=getAiQuotaStatus({uid:'other-account',email:'synthetic@example.test'},null,true,false);
  assert.equal(pro.source,'checking');assert.equal(pro.remaining,0);assert.equal(pro.canGenerate,false);
  const admin=getAiQuotaStatus({uid:'other-account'},null,true,true);
  assert.equal(admin.source,'checking');assert.equal(admin.canGenerate,false);
  assert.equal(getAiQuotaStatus(null).source,'guest');
});
