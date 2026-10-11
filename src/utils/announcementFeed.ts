/**
 * announcementFeed.ts — feed merge helper (client).
 *
 * Restart/recovery can return a partial feed snapshot. Keep usable cached
 * records during recovery while refreshing fields from the server, rather
 * than replacing the entire on-device feed with that partial response.
 *
 * mergeAnnouncementFeed() unions by id/newsId (incoming wins field-level, so
 * fresh aiSummary/is_sent flags apply), sorts newest-first, and prunes items
 * older than the feed's 7-day "what's new" window to bound growth.
 */

import { parseFilingTimestamp } from './timeFormat';

const FEED_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function announcementTs(a: any): number {
  // Historical backfill can be ingested today. Its exchange publication date,
  // also displayed on the card, must not become "new" through fetched_at.
  const exchangeTs = parseFilingTimestamp(a?.bseTime || a?.News_submission_dt || a?.DT_TM || a?.NEWS_DT);
  if (exchangeTs > 0) return exchangeTs;
  const timestamp = parseFilingTimestamp(a?.bseTimestamp);
  return timestamp || parseFilingTimestamp(a?.fetched_at);
}

export function mergeAnnouncementFeed(prev: any[], incoming: any[], now: number = Date.now()): any[] {
  const safePrev = Array.isArray(prev) ? prev : [];
  const safeIncoming = Array.isArray(incoming) ? incoming : [];
  const cutoff = now - FEED_WINDOW_MS;
  const map = new Map<string, any>();
  for (const item of safePrev) {
    const k = item?.id || item?.newsId;
    if (k) map.set(String(k), item);
  }
  for (const item of safeIncoming) {
    const k = item?.id || item?.newsId;
    if (!k) continue;
    const key = String(k);
    map.set(key, map.has(key) ? { ...map.get(key), ...item } : item);
  }
  const merged = Array.from(map.values()).filter(a => {
    const ts = announcementTs(a);
    return ts === 0 || ts >= cutoff;
  }).map(a => {
    const timestamp = announcementTs(a);
    return timestamp > 0 && a.bseTimestamp !== timestamp ? { ...a, bseTimestamp: timestamp } : a;
  });
  merged.sort((a, b) => announcementTs(b) - announcementTs(a));
  return merged;
}

export function getAnnouncementFeedStatus({ checked, error, blocked, staleAt, items, now = Date.now() }: {
  checked: boolean; error: string | null; blocked: boolean; staleAt: number | null; items: any[]; now?: number;
}): 'checking' | 'error' | 'delayed' | 'historical' | 'empty' | 'checked' {
  if (error) return 'error';
  if (!checked) return 'checking';
  if (blocked || staleAt !== null) return 'delayed';
  if (items.length === 0) return 'empty';
  const latest = Math.max(0, ...items.map(announcementTs));
  // Old filings may be legitimate (weekend/holiday). Mark history, not outage.
  if (items.length > 0 && (latest === 0 || latest < now - 24 * 60 * 60 * 1000)) return 'historical';
  return 'checked';
}
