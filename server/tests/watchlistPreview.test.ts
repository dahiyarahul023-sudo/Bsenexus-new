import test from 'node:test';
import assert from 'node:assert/strict';
import { latestWatchlistUpdates } from '../../src/utils/watchlistPreview';

const now = Date.parse('2026-10-21T10:00:00Z');
const lists = [{ is_active: true, items: [
  { symbol: 'APLAPOLLO', scripCode: '533758', companyName: 'APL Apollo Tubes Limited' },
  { symbol: 'RELIANCE', scripCode: '500325', companyName: 'Reliance Industries Ltd' },
] }];
test('Home shows newest single filing per exact security before taking two companies', () => {
  const filings = [
    { id: 'older-apollo', scrip_cd: '533758', companyName: 'APL Apollo Tubes Ltd', bseTime: '2026-10-21T08:00:00Z' },
    { id: 'reliance', scripCode: '500325', bseTime: '2026-10-21T07:00:00Z' },
    { id: 'latest-apollo', SCRIP_CD: 533758, companyName: 'APL Apollo Tubes Limited', bseTime: '2026-10-21T09:00:00Z' },
    { id: 'wrong-security', scripCode: '999999', symbol: 'RELIANCE', bseTime: '2026-10-21T09:30:00Z' },
  ];
  assert.deepEqual(latestWatchlistUpdates(filings, lists, 2, now).map(row => row.id), ['latest-apollo', 'reliance']);
  assert.equal(filings[0].id, 'older-apollo', 'selection must not reorder the shared feed');
});
test('exchange publication outranks a recently ingested historical update', () => {
  const filings = [
    { id: 'historical', scripCode: '533758', bseTime: '2026-10-19T09:00:00Z', fetched_at: now },
    { id: 'recent', scripCode: '533758', bseTime: '2026-10-21T09:00:00Z' },
  ];
  assert.deepEqual(latestWatchlistUpdates(filings, lists, 2, now).map(row => row.id), ['recent']);
  assert.deepEqual(latestWatchlistUpdates(filings, [{ ...lists[0], is_active: false }], 2, now), []);
});
test('symbol-only securities remain exact and empty previews stay empty', () => {
  const stocks = [{ is_active: 1, items: ['TCS', 'ITC'] }];
  const filings = [{ id: 'one', symbol: 'TCS', bseTimestamp: now - 1 }, { id: 'two', symbol: 'TCS', bseTimestamp: now - 2 }, { id: 'three', symbol: 'ITC', bseTimestamp: now - 3 }, { id: 'four', symbol: 'ITCOTHER', bseTimestamp: now }];
  assert.deepEqual(latestWatchlistUpdates(filings, stocks, 2, now).map(row => row.id), ['one', 'three']);
  assert.deepEqual(latestWatchlistUpdates([], stocks), []);
});
