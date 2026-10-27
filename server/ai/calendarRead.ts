import { resolveStockDetailsSync } from "../utils/stockResolver";
import { AiError, publicOrigin } from "./policy.js";
import type { ResultCalendarItem } from "../services/resultsCalendarService.js";
import { FNO_CALENDAR_STOCKS } from "../services/calendarUniverse.js";
const calendarIdentities = new Map(FNO_CALENDAR_STOCKS.map(stock => [stock.scripCode, stock]));
const DAY = 86400000;
export const istDay = (time: number) => new Date(time + 19800000).toISOString().slice(0, 10);
const dayNumber = (day: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new AiError("invalid_date", 400, "Use today, tomorrow or YYYY-MM-DD.");
  const n = Date.parse(day + "T00:00:00Z");
  if (!Number.isFinite(n) || new Date(n).toISOString().slice(0, 10) !== day)
    throw new AiError("invalid_date", 400, "The requested date does not exist.");
  return n;
};
const text = (v: unknown, max: number) => String(v ?? "").replace(/<[^>]*>/g, " ").replace(/[\x00-\x1f]/g, "").slice(0, max);
export interface CalendarReadArgs {
  fromDate?: string;
  toDate?: string;
  daysAhead?: number;
  limit?: number;
  offset?: number;
}
export function calendarWindow(args: CalendarReadArgs, now = Date.now()) {
  const referenceDate = istDay(now), today = dayNumber(referenceDate);
  const resolve = (v: string) => v === "today" ? today : v === "tomorrow" ? today + DAY : dayNumber(v);
  const from = resolve(args.fromDate || "today");
  const to = args.toDate ? resolve(args.toDate) : Math.min(from + (args.daysAhead ?? 14) * DAY, today + 60 * DAY);
  if (from < today || from > today + 60 * DAY || to < from || to > today + 60 * DAY)
    throw new AiError("invalid_date_range", 400, "Choose an inclusive upcoming range within 60 days of today in Asia/Kolkata.");
  return { referenceDate, from, to, fromDate: new Date(from).toISOString().slice(0, 10), toDate: new Date(to).toISOString().slice(0, 10) };
}
export function compactWatchlistStock(raw: any) {
  const object = raw && typeof raw === "object" ? raw : {};
  const reportedSymbol = text(typeof raw === "string" ? raw : object.symbol, 60).trim().toUpperCase();
  const code = String(object.scripCode || "");
  const verified = /^\d{6}$/.test(code) ? resolveStockDetailsSync(code) : null;
  const reported = reportedSymbol ? resolveStockDetailsSync(reportedSymbol) : null;
  const identityConflict = Boolean(verified && reported && verified.scripCode !== reported.scripCode);
  return {
    symbol: verified?.symbol || reportedSymbol,
    ...(identityConflict ? {identityConflict:true} : {}),
    ...( /^\d{6}$/.test(code) ? { scripCode: code } : {}),
    ...(object.companyName ? { companyName: text(verified?.name || object.companyName, 160) } : {}),
    ...( ["HIGH", "MEDIUM", "LOW"].includes(object.priority) ? { priority: object.priority } : {}),
    ...(object.category ? { category: text(object.category, 80) } : {}),
  };
}
export function selectCalendarMeetings(
  snapshot: { items: ResultCalendarItem[]; lastUpdated: number },
  args: CalendarReadArgs,
  codes?: Set<string>,
  now = Date.now(),
) {
  const window = calendarWindow(args, now);
  const seen = new Set<string>();
  const matching = snapshot.items
    .filter(m => !codes || codes.has(String(m.scripCode)))
    .filter(m => !m.isDeclared && Number.isFinite(m.meetingTimestamp) && m.meetingTimestamp > 0)
    .map(m => ({ item: m, day: istDay(m.meetingTimestamp) }))
    .filter(m => m.day >= window.fromDate && m.day <= window.toDate)
    .sort((a, b) => a.day.localeCompare(b.day) || String(a.item.scripCode).localeCompare(String(b.item.scripCode)) || a.item.id.localeCompare(b.item.id))
    .filter(({item, day}) => {const key = String(item.scripCode) + ":" + day;if(seen.has(key))return false;seen.add(key);return true;});
  const offset = args.offset ?? 0, limit = args.limit ?? 20;
  const page = matching.slice(offset, offset + limit);
  const meetings = page.map(({item: m, day}) => {
    const code = String(m.scripCode);
    const resolved = resolveStockDetailsSync(code);
    const calendar = calendarIdentities.get(code);
    // The resolver deliberately returns a code-only placeholder for unknown
    // securities. That truthy placeholder must not hide a known calendar name.
    const resolvedName = resolved?.name && !/^\d+$/.test(resolved.name.trim()) ? resolved.name : undefined;
    return {
      symbol: text(resolved?.symbol || calendar?.symbol || m.symbol, 60), scripCode: code,
      companyName: text(resolvedName || calendar?.companyName || m.companyName, 160),
      meetingDate: day, daysLeft: Math.round((dayNumber(day) - dayNumber(window.referenceDate)) / DAY),
      purpose: text(m.purpose || "Results-related board meeting", 240),
    };
  });
  const updated = Number(snapshot.lastUpdated);
  return {
    success: true, count: meetings.length, totalMatches: matching.length, meetings,
    nextOffset: offset + limit < matching.length ? offset + limit : null,
    timezone: "Asia/Kolkata", referenceDate: window.referenceDate,
    fromDate: window.fromDate, toDate: window.toDate, order: "meetingDate_ascending",
    generatedAt: new Date(now).toISOString(),
    lastSyncedAt: Number.isFinite(updated) && updated > 0 ? new Date(updated).toISOString() : null,
    stale: !Number.isFinite(updated) || updated <= 0 || now - updated > 12 * 60 * 60 * 1000,
    source: "Stored BSE results-related board-meeting notices; scheduled dates, not declared financial results.",
    nexusCalendarUrl: publicOrigin() + "/results-calendar",
    coverage: { completeMarket: false, scanned: snapshot.items.length, note: "No match means no date in available coverage for this range; it does not prove that no result is scheduled." },
  };
}
