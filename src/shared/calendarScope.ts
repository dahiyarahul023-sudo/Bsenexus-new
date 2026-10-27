export type CalendarScope = 'all' | 'fno' | 'watchlist';

export function parseCalendarScope(value: unknown): CalendarScope | 'market' | null {
  return value === 'all' || value === 'fno' || value === 'watchlist' || value === 'market' ? value : null;
}

export const calendarPreferenceKey = (owner: string) => `nexus_calendar_scope_v1:${owner}`;
export const calendarCacheKey = (owner: string, scope: CalendarScope, listId = '') =>
  `results_calendar_v2:${JSON.stringify([owner, scope, scope === 'watchlist' ? listId : ''])}`;

export function readCalendarScope(storage: Pick<Storage, 'getItem'> | undefined, owner: string): CalendarScope {
  try {
    const value = parseCalendarScope(storage?.getItem(calendarPreferenceKey(owner)));
    return value && value !== 'market' ? value : 'all';
  } catch { return 'all'; }
}

export function saveCalendarScope(storage: Pick<Storage, 'setItem'> | undefined, owner: string, scope: CalendarScope) {
  try { storage?.setItem(calendarPreferenceKey(owner), scope); } catch { /* Browser storage may be disabled. */ }
}

export const isCalendarWatchlistActive = (list: any) => list?.is_active === true || list?.is_active === 1;
