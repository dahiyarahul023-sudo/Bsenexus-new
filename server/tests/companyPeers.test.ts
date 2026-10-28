import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectCompanyPeers } from '../utils/companyPeers.js';
import { getAllStockEntries } from '../utils/stockResolver.js';

test('Federal Bank gets bounded private-bank peers using existing names and exact BSE codes', () => {
  const entries = getAllStockEntries();
  const peers = selectCompanyPeers(entries, 'FEDERALBNK', '500469');
  assert.equal(peers.industry, 'Private sector banks');
  assert.equal(peers.stocks.length, 4);
  assert.ok(peers.stocks.some(stock => stock.symbol === 'RBLBANK'));
  for (const stock of peers.stocks) {
    assert.notEqual(stock.scripCode, '500469');
    assert.ok(entries.some(entry => entry.scripCode === stock.scripCode && entry.name === stock.name));
    assert.ok(!['SBIN', 'BAJFINANCE'].includes(stock.symbol));
  }
});
test('Bajaj Auto shows two/three wheeler manufacturers, never Bajaj Finance or passenger cars', () => {
  const peers = selectCompanyPeers(getAllStockEntries(), 'BAJAJAUTO', '532977');
  assert.equal(peers.industry, 'Two & three wheelers');
  assert.ok(peers.stocks.some(stock => stock.symbol === 'TVSMOTOR'));
  assert.ok(peers.stocks.every(stock => ['TVSMOTOR', 'HEROMOTOCO', 'EICHERMOT'].includes(stock.symbol)));
});
test('exact sector fallback deduplicates codes, excludes self, rejects broad or missing categories', () => {
  const target = {symbol:'ALPHA',scripCode:'500001',name:'Alpha',sector:'Specialty chemicals'};
  const entries = [target, {symbol:'BETA',scripCode:'500002',name:'Beta',sector:' Specialty Chemicals '},
    {symbol:'BETA-ALIAS',scripCode:'500002',name:'Beta alias',sector:'Specialty chemicals'},
    {symbol:'BAD',scripCode:'',name:'No identity',sector:'Specialty chemicals'},
    {symbol:'GAMMA',scripCode:'500003',name:'Gamma',sector:'Chemicals'}];
  assert.deepEqual(selectCompanyPeers(entries,'ALPHA','500001').stocks.map(stock=>stock.symbol),['BETA']);
  assert.deepEqual(selectCompanyPeers(entries,'UNKNOWN','').stocks,[]);
  assert.deepEqual(selectCompanyPeers([{...target,sector:'Financial Services'}],'ALPHA','500001').stocks,[]);
  assert.deepEqual(selectCompanyPeers([{...target,sector:undefined}],'ALPHA','500001').stocks,[]);
});

test('BEL has exact catalogue defence peers independent of watchlist, quotes or F&O selection',()=>{
  const entries=getAllStockEntries(), peers=selectCompanyPeers(entries,'BEL','500049');
  assert.equal(peers.industry,'Defence, aerospace & shipbuilding');
  assert.ok(peers.stocks.some(s=>s.symbol==='HAL'&&s.scripCode==='541154'));
  assert.ok(peers.stocks.some(s=>s.symbol==='BDL'&&s.scripCode==='541143'));
  assert.ok(peers.stocks.length<=4);assert.ok(peers.stocks.every(s=>s.scripCode!=='500049'));
  assert.deepEqual(selectCompanyPeers(entries,'BEL','999999').stocks,[]);
});
