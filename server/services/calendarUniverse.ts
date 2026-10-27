import source from '../config/fnoCalendarStocks.json' with { type: 'json' };
import { getAllStockEntries, resolveStockDetailsSync } from '../utils/stockResolver.js';
import { isCalendarWatchlistActive, type CalendarScope } from '../../src/shared/calendarScope.js';
import { calendarDayStart, projectCalendarTiming } from '../../src/shared/calendarTiming.js';

const codeOf = (v: unknown) => /^\d{6}$/.test(String(v ?? '').trim()) ? String(v).trim() : '';
const nameKey = (v: string) => v.toUpperCase().replace(/\b(?:LIMITED|LTD)\.?$/g, '').replace(/[^A-Z0-9]/g, '');
const master = getAllStockEntries();
export const FNO_CALENDAR_VERSION = source.sourceSha256;

/** Supplied BSE security codes are authoritative. Asset Codes are never symbols. */
export const FNO_CALENDAR_STOCKS = source.stocks.map(stock => {
  const exact = master.find(entry => entry.scripCode === stock.scripCode)
    || master.find(entry => nameKey(entry.name) === nameKey(stock.companyName));
  return { ...stock, symbol: exact?.symbol || stock.scripCode };
});
const byCode = new Map(FNO_CALENDAR_STOCKS.map(stock => [stock.scripCode, stock]));
const bySymbol = new Map(FNO_CALENDAR_STOCKS.filter(stock => !/^\d/.test(stock.symbol)).map(stock => [stock.symbol, stock]));
export const isFnoCalendarCode = (code: unknown) => byCode.has(codeOf(code));

export interface CalendarTarget { scripCode: string; symbol: string; companyName: string; isWatchlist: boolean }

export function calendarIdentity(raw: any): Omit<CalendarTarget, 'isWatchlist'> | null {
  const sym = String(typeof raw === 'string' ? raw : raw?.symbol || raw?.scripCode || '').split(':')[0].trim().toUpperCase();
  const suppliedCode = typeof raw === 'object' ? codeOf(raw?.scripCode) : '';
  const knownFno = bySymbol.get(sym);
  const resolved = resolveStockDetailsSync(sym);
  const scripCode = suppliedCode || knownFno?.scripCode || codeOf(sym) || codeOf(resolved?.scripCode);
  if (!scripCode) return null;
  const fno = byCode.get(scripCode);
  const exact = master.find(entry => entry.scripCode === scripCode);
  const matchesSymbol = !knownFno || knownFno.scripCode === scripCode;
  return {
    scripCode,
    symbol: matchesSymbol && sym && !/^\d/.test(sym) ? sym : fno?.symbol || exact?.symbol || scripCode,
    companyName: fno?.companyName || exact?.name || String(raw?.companyName || scripCode),
  };
}

export function buildCalendarTargets(rawStocks: any[], includeFno = true): Map<string, CalendarTarget> {
  const targets = new Map<string, CalendarTarget>();
  if (includeFno) for (const stock of FNO_CALENDAR_STOCKS) targets.set(stock.scripCode, { ...stock, isWatchlist: false });
  for (const raw of rawStocks) {
    const stock = calendarIdentity(raw);
    if (stock) targets.set(stock.scripCode, { ...stock, isWatchlist: true });
  }
  return targets;
}

export function calendarWatchlistCodes(lists: any[], selectedId?: string): Set<string> {
  return new Set(lists.filter(list => isCalendarWatchlistActive(list) && (!selectedId || String(list.id) === selectedId))
    .flatMap(list => Array.isArray(list.items) ? list.items : [])
    .map(calendarIdentity).filter((stock): stock is NonNullable<typeof stock> => Boolean(stock)).map(stock => stock.scripCode));
}

interface Meeting { id: string; scripCode: string; meetingTimestamp: number; purpose: string; isNotified?: boolean }
/** Replace future schedules for successful securities; a rolling source cannot erase recorded past meetings. */
export function mergeCalendarMeetings<T extends Meeting>(previous: T[], fetched: T[], successfulCodes: Set<string>, retainBefore = 0): T[] {
  const old = new Map(previous.map(item => [`${item.scripCode}:${item.meetingTimestamp}`, item]));
  const result = new Map<string, T>();
  for (const item of [...previous.filter(item => !successfulCodes.has(item.scripCode) || item.meetingTimestamp < retainBefore), ...fetched]) {
    const key = `${item.scripCode}:${item.meetingTimestamp}`;
    const existing = result.get(key);
    if (existing) {
      if (item.purpose && !existing.purpose.toLowerCase().includes(item.purpose.toLowerCase())) existing.purpose += ` & ${item.purpose}`;
    } else {
      const saved = old.get(key);
      result.set(key, { ...item, id: saved?.id || item.id, ...(saved?.isNotified ? { isNotified: true } : {}) });
    }
  }
  return [...result.values()];
}

export function selectCalendarScope<T extends Meeting>(items: T[], scope: CalendarScope, ownCodes: Set<string>): T[] {
  const selected = items.filter(item => scope === 'watchlist' ? ownCodes.has(item.scripCode)
    : scope === 'fno' ? isFnoCalendarCode(item.scripCode)
    : ownCodes.has(item.scripCode) || isFnoCalendarCode(item.scripCode));
  return mergeCalendarMeetings([], selected, new Set());
}

export function currentUpcomingMeetings<T extends Meeting & { daysLeft: number; status?: string; isDeclared?: boolean }>(items: T[], now = Date.now()): T[] {
  return items.filter(item => /^\d{6}$/.test(item.scripCode) && Number.isFinite(new Date(item.meetingTimestamp).getTime()) && item.meetingTimestamp >= 86400000)
    .map(item => projectCalendarTiming({ ...item, status: item.status || '', meetingDate: new Date(item.meetingTimestamp).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }) }, now))
    .filter(item => item.daysLeft >= 0);
}

export function automaticCalendarMeetings<T extends Meeting & { daysLeft: number; status?: string; isDeclared?: boolean }>(items: T[], watchlistCodes: Set<string>, notifiedIds: Set<string>, claimed = new Set<string>()): T[] {
  return currentUpcomingMeetings(items).filter(item => !item.isDeclared && watchlistCodes.has(item.scripCode) && !notifiedIds.has(item.id)
    && !claimed.has(`${item.scripCode}:${calendarDayStart(item.meetingTimestamp)}`)).slice(0, 3);
}
