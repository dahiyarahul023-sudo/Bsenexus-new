import { hasExactScripCode } from './scripMatching';
import { calendarDayKey } from './calendarTiming';
import { parseFilingTimestamp } from '../utils/timeFormat';

/** A scheduled meeting or a filing category never proves a result declaration. */
export function hasCalendarResultToday(items: any[], code: string, now = Date.now()): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  return items.some(item => {
    const published = parseFilingTimestamp(item.resultDeclarationTime || item.bseTimestamp);
    return hasExactScripCode(item, code) && item.isDeclared === true &&
      Number.isFinite(item.meetingTimestamp) && calendarDayKey(item.meetingTimestamp) === calendarDayKey(now) &&
      published > 0 && published <= now && calendarDayKey(published) === calendarDayKey(now);
  });
}
