import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  applyCalendarScope,
  MARKET_CALENDAR_UNIVERSE,
  type ResultCalendarItem,
} from '../services/resultsCalendarService.js';

function item(symbol: string, scripCode: string, marketUniverse?: boolean): ResultCalendarItem {
  return {
    id: `${scripCode}_1`,
    symbol,
    scripCode,
    companyName: symbol,
    purpose: 'Financial Results',
    meetingDate: '2026-10-15',
    meetingTimestamp: 1,
    daysLeft: 8,
    status: 'UPCOMING',
    updatedAt: new Date().toISOString(),
    marketUniverse,
  };
}

describe('Results calendar market scope', () => {
  test('Wipro and Tech Mahindra are in the default market universe', () => {
    assert.ok(MARKET_CALENDAR_UNIVERSE.includes('WIPRO'), 'WIPRO missing from universe');
    assert.ok(MARKET_CALENDAR_UNIVERSE.includes('TECHM'), 'TECHM missing from universe');
  });

  test('market scope returns universe items not on the user watchlist', () => {
    const items = [
      item('WIPRO', '507685', true),
      item('TECHM', '532755', true),
      item('RELIANCE', '500325', true),
      item('SOMEWL', '999999', false), // watchlist-only item
    ];
    const out = applyCalendarScope(items, 'market', new Set(['RELIANCE']), new Set(['500325']));
    const syms = out.map(i => i.symbol).sort();
    assert.deepEqual(syms, ['TECHM', 'WIPRO']);
  });

  test('market scope excludes by scrip code too', () => {
    const items = [item('WIPRO', '507685', true)];
    const out = applyCalendarScope(items, 'market', new Set(), new Set(['507685']));
    assert.equal(out.length, 0);
  });

  test('market scope is empty for anonymous users with no universe items', () => {
    const items = [item('SOMEWL', '999999', false), item('OTHER', '888888')];
    const out = applyCalendarScope(items, 'market', new Set(), new Set());
    assert.equal(out.length, 0);
  });

  test('watchlist scope returns items unchanged', () => {
    const items = [item('WIPRO', '507685', true), item('SOMEWL', '999999', false)];
    const out = applyCalendarScope(items, 'watchlist', new Set(['WIPRO']), new Set());
    assert.equal(out.length, 2);
  });

  test('BAJFINANCE is in default market universe with scrip 500034', () => {
    assert.ok(MARKET_CALENDAR_UNIVERSE.includes('BAJFINANCE'), 'BAJFINANCE missing from universe');
  });

  test('scrip 500034 is identified as Bajaj Finance Ltd not Bajaj Auto', () => {
    const it = item('BAJFINANCE', '500034', true);
    assert.equal(it.scripCode, '500034');
    assert.notEqual(it.scripCode, '532977'); // 532977 is Bajaj Auto
  });
});
