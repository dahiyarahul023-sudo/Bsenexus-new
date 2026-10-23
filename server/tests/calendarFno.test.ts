import { test } from 'node:test';
import assert from 'node:assert/strict';
import { automaticCalendarMeetings, buildCalendarTargets, calendarIdentity, calendarWatchlistCodes, FNO_CALENDAR_STOCKS, mergeCalendarMeetings, selectCalendarScope } from '../services/calendarUniverse.js';
import { calendarCacheKey, calendarPreferenceKey, parseCalendarScope, readCalendarScope, saveCalendarScope } from '../../src/shared/calendarScope.js';

const meeting = (scripCode: string, time = 1, purpose = 'Financial Results') => ({ id: `${scripCode}_${time}`, scripCode, meetingTimestamp: time, purpose, daysLeft: 0, isNotified: false });

test('uploaded stock universe has 211 distinct BSE identities, excluding index asset codes', () => {
  assert.equal(FNO_CALENDAR_STOCKS.length, 211);
  assert.equal(new Set(FNO_CALENDAR_STOCKS.map(stock => stock.scripCode)).size, 211);
  assert.ok(FNO_CALENDAR_STOCKS.every(stock => /^\d{6}$/.test(stock.scripCode) && /[a-z]/i.test(stock.companyName)));
  const stocks = new Map(FNO_CALENDAR_STOCKS.map(stock => [stock.scripCode, stock]));
  assert.match(stocks.get('500034')!.companyName, /BAJAJ FINANCE/i);
  assert.match(stocks.get('532977')!.companyName, /BAJAJ AUTO/i);
  assert.match(stocks.get('544307')!.companyName, /Vishal Mega Mart/i);
  assert.match(stocks.get('532187')!.companyName, /INDUSIND BANK/i);
  assert.equal(stocks.has('532209'), false, 'incorrect legacy IndusInd code must not enter the F&O universe');
  assert.equal(stocks.get('541153')!.symbol, 'BANDHANBNK', 'BDBK asset code is not a stock symbol');
});

test('Vishal and other stocks outside the symbol master survive code-based calendar intake', () => {
  const targets = buildCalendarTargets([{ symbol: 'UNLISTED_IN_MASTER', scripCode: '512345', companyName: 'Example Small Company' }]);
  assert.equal(targets.size, 212);
  assert.match(targets.get('544307')!.companyName, /Vishal Mega Mart/i);
  assert.equal(targets.get('544307')!.isWatchlist, false);
  assert.equal(targets.get('512345')!.isWatchlist, true);
  assert.equal(calendarIdentity('INDUSINDBK')!.scripCode, '532187');
  assert.equal(calendarIdentity('UNRESOLVED'), null);
  assert.equal(calendarIdentity({ symbol: 'UNRESOLVED', scripCode: '123' }), null);
  assert.equal(buildCalendarTargets(['RELIANCE', { symbol: 'RIL-ALIAS', scripCode: '500325' }]).size, 211);
});

test('All is own active watchlists union F&O; F&O retains overlap; another owner is excluded', () => {
  const rows = [meeting('500325'), meeting('507685'), meeting('512345'), meeting('543711'), meeting('500325', 1, 'Dividend'), meeting('500325', 2)];
  const own = new Set(['500325', '512345']);
  assert.deepEqual(selectCalendarScope(rows, 'all', own).map(row => row.id), ['500325_1', '507685_1', '512345_1', '500325_2']);
  assert.equal(selectCalendarScope(rows, 'fno', own).filter(row => row.scripCode === '500325').length, 2, 'separate meeting dates survive');
  assert.deepEqual(selectCalendarScope(rows, 'watchlist', own).map(row => row.id), ['500325_1', '512345_1', '500325_2']);
  assert.deepEqual(selectCalendarScope(rows, 'watchlist', new Set()), []);
  assert.equal(selectCalendarScope(rows, 'all', new Set()).some(row => row.scripCode === '512345'), false);
});

test('watchlist membership respects inactive lists, explicit codes and missing list IDs', () => {
  const lists = [
    { id: 'one', is_active: true, items: [{ symbol: 'VMM', scripCode: '544307' }] },
    { id: 'two', is_active: 1, items: ['RELIANCE'] },
    { id: 'inactive', is_active: false, items: ['WIPRO'] },
    { id: 'inactive-number', is_active: 0, items: ['TCS'] },
  ];
  assert.deepEqual([...calendarWatchlistCodes(lists)], ['544307', '500325']);
  assert.deepEqual([...calendarWatchlistCodes(lists, 'one')], ['544307']);
  assert.equal(calendarWatchlistCodes(lists, 'missing').size, 0);
});

test('partial upstream failure preserves cached meetings; successful reschedule replaces only its security', () => {
  const old = [{ ...meeting('500325'), id: 'old-notified-id', isNotified: true }, meeting('544307')];
  const merged = mergeCalendarMeetings(old, [meeting('500325')], new Set(['500325']));
  assert.ok(merged.some(row => row.scripCode === '544307'));
  assert.equal(merged.find(row => row.scripCode === '500325')!.id, 'old-notified-id');
  assert.equal(merged.find(row => row.scripCode === '500325')!.isNotified, true);
  assert.deepEqual(mergeCalendarMeetings(old, [meeting('500325', 2)], new Set(['500325'])).map(row => row.id), ['544307_1', '500325_2']);
  assert.deepEqual(mergeCalendarMeetings(old, [], new Set(['500325'])).map(row => row.id), ['544307_1']);
});

test('a successful rolling-source refresh retains yesterday and older archive dates while replacing future schedules', () => {
  const today = Date.parse('2026-10-23T00:00:00+05:30');
  const past = { ...meeting('517354', today - 86400000), id: 'oct22-saved-id', isNotified: true };
  const cancelled = meeting('517354', today + 86400000);
  const next = meeting('517354', today + 3 * 86400000);
  const merged = mergeCalendarMeetings([past, cancelled], [next], new Set(['517354']), today);
  assert.deepEqual(merged.map(item => item.id), ['oct22-saved-id', next.id]);
  assert.equal(merged[0].isNotified, true);
  assert.deepEqual(mergeCalendarMeetings([past, cancelled], [], new Set(['517354']), today).map(item => item.id), ['oct22-saved-id']);
});

test('F&O-only calendar coverage cannot extend automatic Telegram recipients or trigger dates', () => {
  const items = [meeting('544307'), meeting('500325'), { ...meeting('507685'), daysLeft: -1 }];
  assert.deepEqual(automaticCalendarMeetings(items, new Set(['500325']), new Set()).map(row => row.scripCode), ['500325']);
  assert.deepEqual(automaticCalendarMeetings(items, new Set(['500325']), new Set(['500325_1'])), []);
  assert.deepEqual(automaticCalendarMeetings(items, new Set(), new Set()), []);
});

test('first visit is All; last choice, account isolation and denied storage behave correctly', () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  assert.equal(readCalendarScope(storage, 'rahul'), 'all');
  saveCalendarScope(storage, 'rahul', 'watchlist');
  assert.equal(readCalendarScope(storage, 'rahul'), 'watchlist');
  assert.equal(readCalendarScope(storage, 'another-user'), 'all');
  storage.setItem(calendarPreferenceKey('rahul'), 'broken');
  assert.equal(readCalendarScope(storage, 'rahul'), 'all');
  const blocked = { getItem: () => { throw Error('denied'); }, setItem: () => { throw Error('denied'); } };
  assert.equal(readCalendarScope(blocked, 'rahul'), 'all');
  assert.doesNotThrow(() => saveCalendarScope(blocked, 'rahul', 'fno'));
  const keys = new Set([calendarCacheKey('a', 'all'), calendarCacheKey('b', 'all'), calendarCacheKey('a', 'fno'), calendarCacheKey('a', 'watchlist'), calendarCacheKey('a', 'watchlist', 'one')]);
  assert.equal(keys.size, 5);
  assert.equal(calendarCacheKey('a', 'all', 'ignored'), calendarCacheKey('a', 'all'));
  for (const invalid of ['', 'FNO', [], {}, 1, undefined]) assert.equal(parseCalendarScope(invalid), null);
});
