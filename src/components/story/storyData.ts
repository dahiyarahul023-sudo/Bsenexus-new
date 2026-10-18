import { isDateMarketHoliday } from '../../utils/marketHolidays';
import { createStoryFeedClient } from './storyFeedClient';
import type { StoryChapter, StorySlide } from './storyTypes';
export type { StoryChapter, StorySlide } from './storyTypes';
export { MAX_MAJOR_STORY_AGE_MS } from './storyBuilder';
export const MAX_MAJOR_STORY_AGE_HOURS = 18;

export interface MarketSessionInfo {
  hour: number;
  minute: number;
  dateStr: string;
  dayOfWeek: number;
  isTradingDay: boolean;
  isMarketHours: boolean;
  showMarketMoves: boolean;
  sessionEdition: 'MORNING_RADAR' | 'MARKET_WRAP' | 'WEEKEND_EDITION';
  editionLabel: string;
  editionBadge: string;
  storySessionId: string;
}

export function getISTMarketSession(now: Date = new Date()): MarketSessionInfo {
  const istFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = istFormatter.formatToParts(now);
  const partMap: Record<string, string> = {};
  for (const p of parts) partMap[p.type] = p.value;

  const year = partMap.year;
  const month = partMap.month;
  const day = partMap.day;
  const hour = parseInt(partMap.hour || '0', 10) % 24;
  const minute = parseInt(partMap.minute || '0', 10);
  const dateStr = `${year}-${month}-${day}`;

  const dayOfWeek = new Date(`${dateStr}T12:00:00Z`).getUTCDay(); // 0=Sun, 6=Sat

  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isHoliday = Boolean(isDateMarketHoliday(dateStr));
  const isTradingDay = !isWeekend && !isHoliday;

  // Trading day between 09:00 AM and 15:30 (3:30 PM):
  // Yesterday's market moves are expired and MUST be removed.
  // At 15:30 (3:30 PM), fresh closing moves arrive.
  const totalMinutes = hour * 60 + minute;
  const isMorningToMarketHours = isTradingDay && totalMinutes >= 540 && totalMinutes < 930;
  const isMarketHours = isTradingDay && totalMinutes >= 555 && totalMinutes < 930;

  let showMarketMoves = false;
  let sessionEdition: 'MORNING_RADAR' | 'MARKET_WRAP' | 'WEEKEND_EDITION' = 'MARKET_WRAP';
  let editionLabel = "Market Wrap & Moves";
  let editionBadge = "3:30 PM CLOSING EDITION";
  let storySessionId = `${dateStr}_closing`;

  if (isWeekend || isHoliday) {
    sessionEdition = 'WEEKEND_EDITION';
    editionLabel = isHoliday ? "Holiday Market Radar" : "Weekend Market Brief";
    editionBadge = isHoliday ? "HOLIDAY EDITION" : "WEEKEND EDITION";
    showMarketMoves = false;
    storySessionId = `${dateStr}_weekend`;
  } else if (isMorningToMarketHours) {
    // 09:00 AM to 03:30 PM on trading day: previous session moves EXPIRED!
    showMarketMoves = false;
    sessionEdition = 'MORNING_RADAR';
    editionLabel = "Morning Market Radar";
    editionBadge = "09:00 AM MORNING EDITION";
    storySessionId = `${dateStr}_morning`;
  } else {
    // From 15:30 (3:30 PM) until next day 09:00 AM: fresh closing wrap
    showMarketMoves = true;
    sessionEdition = 'MARKET_WRAP';
    editionLabel = "Dalal Street Closing Wrap & Movers";
    editionBadge = "3:30 PM CLOSING EDITION";
    storySessionId = `${dateStr}_closing`;
  }

  return {
    hour,
    minute,
    dateStr,
    dayOfWeek,
    isTradingDay,
    isMarketHours,
    showMarketMoves,
    sessionEdition,
    editionLabel,
    editionBadge,
    storySessionId
  };
}

export function getStorySessionStorageKey(): string {
  const session = getISTMarketSession();
  return `bse_story_viewed_${session.storySessionId}`;
}

export function parseBseDate(dateStr?: string): number {
  if (!dateStr) return 0;
  const str = String(dateStr).trim();
  if (!str) return 0;

  // 1. /Date(123456789)/
  const msMatch = str.match(/\/Date\((\d+)\)\//);
  if (msMatch) {
    const ts = parseInt(msMatch[1], 10);
    return isNaN(ts) ? 0 : ts;
  }

  // 2. Standard ISO with Z or explicit offset
  if (/^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/i.test(str)) {
    const ts = Date.parse(str.replace(' ', 'T'));
    if (!isNaN(ts)) return ts;
  }

  // 3. YYYY-MM-DDTHH:mm:ss without offset (native BSE IST +05:30)
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/);
  if (isoMatch) {
    const [, y, m, d, hh, mm, ss, ms] = isoMatch;
    const isoString = `${y}-${m}-${d}T${hh}:${mm}:${ss}${ms ? '.' + ms.padEnd(3, '0').slice(0, 3) : ''}+05:30`;
    const ts = Date.parse(isoString);
    if (!isNaN(ts)) return ts;
  }

  // 4. Date only: YYYY-MM-DD
  const dateOnlyMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, y, m, d] = dateOnlyMatch;
    const isoString = `${y}-${m}-${d}T00:00:00+05:30`;
    const ts = Date.parse(isoString);
    if (!isNaN(ts)) return ts;
  }

  // 5. DD/MM/YYYY HH:mm:ss
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?)?$/i);
  if (dmyMatch) {
    const [, d, m, y, hhStr, mmStr = '00', ssStr = '00', ampm] = dmyMatch;
    let hh = hhStr !== undefined ? parseInt(hhStr, 10) : 0;
    const mm = parseInt(mmStr, 10);
    const ss = parseInt(ssStr, 10);
    if (ampm) {
      if (ampm.toUpperCase() === 'PM' && hh < 12) hh += 12;
      if (ampm.toUpperCase() === 'AM' && hh === 12) hh = 0;
    }
    const isoString = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}+05:30`;
    const ts = Date.parse(isoString);
    if (!isNaN(ts)) return ts;
  }

  const fallback = Date.parse(str);
  return isNaN(fallback) ? 0 : fallback;
}


// Templates never contain sample financial facts. Only a validated public feed creates slides.
const storyFeed = createStoryFeedClient({
  session: getISTMarketSession,
  request: async force => {
    const { customFetch } = await import('../../api');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await customFetch(`/api/story/feed${force ? '?refresh=true' : ''}`, { signal: controller.signal });
      if (!response.ok) throw new Error('The story feed could not be loaded');
      return await response.json();
    } finally { clearTimeout(timeout); }
  },
});
export function getInitialStoryChapters(): StoryChapter[] { return storyFeed.peek(); }
export function getAllSlides(chapters: StoryChapter[]): StorySlide[] { return chapters.flatMap(chapter => chapter.slides); }
export function fetchLiveStoryChapters(forceRefresh = false): Promise<StoryChapter[]> { return storyFeed.load(forceRefresh); }
