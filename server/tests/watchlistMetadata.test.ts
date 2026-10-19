import {test} from 'node:test';
import assert from 'node:assert/strict';
import {addWatchlist,addSymbolToWatchlist,getAllWatchlists,updateSymbolPriorityAcrossAllWatchlists} from '../database/watchlistDao.js';

test('a searched BSE-only company keeps its name and code after save and priority change', async () => {
  const owner=`watchlist-metadata-${Date.now()}`;
  const id=await addWatchlist('Red',owner);
  await addSymbolToWatchlist(id,'531977','HIGH','Core',owner,{scripCode:'531977',companyName:'Selected BSE Company Ltd'});
  await updateSymbolPriorityAcrossAllWatchlists('531977','LOW',undefined,owner);
  const list=(await getAllWatchlists(owner)).find(list=>list.id===id);
  const item=list.items.find((item:any)=>item.symbol==='531977');
  assert.equal(item.companyName,'Selected BSE Company Ltd'); assert.equal(item.scripCode,'531977'); assert.equal(item.priority,'LOW');
});
