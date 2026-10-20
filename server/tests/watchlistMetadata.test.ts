import {test} from 'node:test';
import assert from 'node:assert/strict';
import {addWatchlist,addSymbolToWatchlist,getAllWatchlists,updateSymbolPriorityAcrossAllWatchlists} from '../database/watchlistDao.js';
import {matchesWatchlistIdentity} from '../../src/shared/watchlistIdentity';

test('a new account receives resolved default identities on its first read, without waiting for cache expiry', async () => {
  const lists=await getAllWatchlists(`new-default-identity-${Date.now()}`);
  const tcs=lists.flatMap(list=>list.items).find(item=>item.symbol==='TCS');
  assert.ok(tcs);assert.equal(tcs.scripCode,'532540');assert.match(tcs.companyName,/Tata Consultancy/i);
  assert.equal(matchesWatchlistIdentity({scrip_cd:'532540',companyName:'Tata Consultancy Services Ltd'},tcs),true);
});

test('a searched BSE-only company keeps its name and code after save and priority change', async () => {
  const owner=`watchlist-metadata-${Date.now()}`;
  const id=await addWatchlist('Red',owner);
  await addSymbolToWatchlist(id,'531977','HIGH','Core',owner,{scripCode:'531977',companyName:'Selected BSE Company Ltd'});
  await updateSymbolPriorityAcrossAllWatchlists('531977','LOW',undefined,owner);
  const list=(await getAllWatchlists(owner)).find(list=>list.id===id);
  const item=list.items.find((item:any)=>item.symbol==='531977');
  assert.equal(item.companyName,'Selected BSE Company Ltd'); assert.equal(item.scripCode,'531977'); assert.equal(item.priority,'LOW');
});
