import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchStockInText } from '../services/stockNewsService.js';
test('sector/common words cannot stand in for a complete issuer',()=>{
  assert.equal(matchStockInText('India solar manufacturing can generate jobs','SOLARINDS','Solar Industries India Ltd'),false);
  assert.equal(matchStockInText('India elected president of International Solar Alliance','SOLARINDS','Solar Industries India Ltd'),false);
  assert.equal(matchStockInText('Indian markets: ten things to know','INDIANB','Indian Bank'),false);
  assert.equal(matchStockInText('Indian banking sector growth','INDIANB','Indian Bank'),false);
  assert.equal(matchStockInText('IndusInd Bank gains','INDIANB','Indian Bank'),false);
});
test('actual company names, vetted aliases and literal symbols still match',()=>{
  for(const text of ['Solar Industries wins contract','SOLARINDS quarterly results','Solar Industries India reports results'])assert.equal(matchStockInText(text,'SOLARINDS','Solar Industries India Ltd'),true,text);
  assert.equal(matchStockInText('Indian Bank reports quarterly results','INDIANB','Indian Bank'),true);
  assert.equal(matchStockInText('SBI raises deposits','SBIN','State Bank of India'),true);
  assert.equal(matchStockInText('TCS reports results','TCS','Tata Consultancy Services Ltd'),true);
  assert.equal(matchStockInText('J&K Bank reports growth','J&KBANK','Jammu and Kashmir Bank Ltd'),true);
  assert.equal(matchStockInText('A+B results','A+B','Example Ltd'),true);
  assert.equal(matchStockInText('AAAB results','A+B','Example Ltd'),false);
  assert.equal(matchStockInText('Any text','',''),false);
});
