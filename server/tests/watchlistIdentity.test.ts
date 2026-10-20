import {test} from 'node:test';
import assert from 'node:assert/strict';
import {activeWatchlistIdentities,matchesWatchlistIdentity} from '../../src/shared/watchlistIdentity';

test('short tickers never admit unrelated company-name substrings into the home watchlist', () => {
  const lt = {symbol:'LT',scripCode:'500510',companyName:'Larsen & Toubro Ltd'};
  assert.equal(matchesWatchlistIdentity({companyName:'Shalibhadra Finance Ltd',scrip_cd:'511754'},lt),false);
  assert.equal(matchesWatchlistIdentity({companyName:'NBCC (India) Limited',scrip_cd:'534309'},lt),false);
  assert.equal(matchesWatchlistIdentity({companyName:'Larsen & Toubro Ltd',scrip_cd:'500510'},lt),true);
  assert.equal(matchesWatchlistIdentity({companyName:'LTIMindtree Limited'}, {symbol:'LT'}),false);
});
test('only active lists supply exact codes and conflicting filing identity fails closed', () => {
  const stocks=activeWatchlistIdentities([{is_active:1,items:[{symbol:'TCS',scripCode:'532540',companyName:'Tata Consultancy Services Ltd'}]},{is_active:0,items:[{symbol:'NBCC',scripCode:'534309'}]}]);
  assert.equal(stocks.length,1);
  assert.equal(matchesWatchlistIdentity({scrip_cd:532540},stocks[0]),true);
  assert.equal(matchesWatchlistIdentity({scrip_cd:'532540',scripCode:'534309',symbol:'TCS'},stocks[0]),false);
  assert.equal(matchesWatchlistIdentity({companyName:'Tata Consultancy Services Limited'},stocks[0]),true);
});
