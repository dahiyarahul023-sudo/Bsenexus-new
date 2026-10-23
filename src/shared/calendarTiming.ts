const DAY = 86_400_000;
const IST_OFFSET = 5.5 * 3_600_000;

/** Calendar membership is tied to the Indian civil day, independent of device timezone. */
export const calendarDayKey = (now = Date.now()) => Math.floor((now + IST_OFFSET) / DAY);
export const calendarDayStart = (now = Date.now()) => calendarDayKey(now) * DAY - IST_OFFSET;

export function projectCalendarTiming<T extends { meetingTimestamp: number; daysLeft: number; status: string }>(item: T, now = Date.now()): T {
  if (!Number.isFinite(item.meetingTimestamp) || item.meetingTimestamp <= 0) return item;
  const daysLeft = calendarDayKey(item.meetingTimestamp) - calendarDayKey(now);
  const status = daysLeft === 0 ? 'TODAY' : daysLeft > 0 ? 'UPCOMING' : daysLeft >= -30 ? 'RECENT' : 'PAST';
  return daysLeft === item.daysLeft && status === item.status ? item : { ...item, daysLeft, status };
}
