import {
  getAllStockEntries,
  type StockMasterEntry,
} from "../utils/stockResolver.js";
import {
  getRecentAnnouncements,
  getAnnouncementsForScrip,
} from "../database/announcementDao.js";
import {
  getStockResultsHistory,
  getResultsCalendarSnapshot,
} from "../services/resultsCalendarService.js";
import { AiError } from "./policy.js";
import { selectCalendarMeetings, type CalendarReadArgs } from "./calendarRead.js";
const clean = (v: any, max = 4000) =>
  String(v || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\x00-\x08\x0e-\x1f]/g, "")
    .slice(0, max);
export function companyCandidates(query: string) {
  const q = query.trim().toUpperCase();
  if (!q) return [];
  const all = Array.from(
    new Map(getAllStockEntries().map((e) => [e.scripCode, e])).values(),
  ).filter((e) => /^\d{6}$/.test(e.scripCode));
  const exact = all.filter(
    (e) =>
      e.symbol.toUpperCase() === q ||
      e.scripCode === q ||
      e.name.toUpperCase() === q,
  );
  if (exact.length) return exact;
  if (/^\d+$/.test(q)) return [];
  const aliases = all.filter((e) =>
    e.nameKeywords?.some((k) => k.toUpperCase() === q),
  );
  return aliases.length
    ? aliases
    : all
        .filter(
          (e) =>
            e.name.toUpperCase().includes(q) ||
            e.symbol.toUpperCase().includes(q),
        )
        .slice(0, 10);
}
export function exactCompany(query: string): StockMasterEntry {
  const matches = companyCandidates(query);
  if (matches.length !== 1)
    throw new AiError(
      matches.length ? "ambiguous_company" : "company_not_found",
      400,
      matches.length
        ? "Choose the exact company using company_lookup before editing."
        : "Company identity is not available in the verified directory.",
    );
  return matches[0];
}
export function officialPdf(value: any): string {
  try {
    const u = new URL(String(value));
    if (
      u.protocol === "https:" &&
      ["bseindia.com", "nseindia.com"].some(
        (h) => u.hostname === h || u.hostname.endsWith("." + h),
      ) &&
      !u.username &&
      !u.password
    )
      return u.href;
  } catch {}
  return "";
}
export function formatFiling(ann: any) {
  const id = clean(ann.newsId || ann.newsid || ann.news_id || ann.id, 100),
    scrip = String(ann.scrip_cd || ann.scripCode || ann.SCRIP_CD || "");
  const company = companyCandidates(scrip)[0];
  const symbol = company?.symbol || clean(ann.symbol, 30);
  const timestamp =
    ann.bseTimestamp || Date.parse(ann.dt_tm || ann.bseTime || "");
  return {
    id,
    symbol,
    scripCode: scrip,
    companyName:
      company?.name || clean(ann.companyName || ann.company_name, 200),
    headline: clean(ann.subject || ann.NEWSSUB),
    summary: clean(ann.aiSummaryEn || ann.aiSummary || ann.more || ann.details),
    summarySource:
      ann.aiSummaryEn || ann.aiSummary ? "stored_summary" : "filing_text",
    category: clean(
      ann.category || ann.category_name || "Corporate Disclosure",
      100,
    ),
    publishedAt:
      Number.isFinite(Number(timestamp)) && Number(timestamp) > 0
        ? new Date(Number(timestamp)).toISOString()
        : "",
    pdfUrl: officialPdf(ann.pdfLink || ann.attachmentname),
    nexusUrl: id
      ? `https://bsenexus.in/filing/${encodeURIComponent(symbol || scrip)}/${encodeURIComponent(id)}`
      : "",
  };
}
export async function filingsData(args: {
  company?: string;
  category?: string;
  limit?: number;
  before?: string;
}) {
  const entry = args.company ? exactCompany(args.company) : null;
  const raw = entry
    ? await getAnnouncementsForScrip(entry.scripCode, 400)
    : await getRecentAnnouncements(500);
  const before = args.before ? Date.parse(args.before) : Infinity;
  const filtered = raw.filter(
    (ann) =>
      (!entry ||
        String(ann.scrip_cd || ann.scripCode || ann.SCRIP_CD || "") ===
          entry.scripCode) &&
      (!args.category ||
        `${ann.category || ""} ${ann.subject || ""}`
          .toLowerCase()
          .includes(args.category.toLowerCase())) &&
      (before === Infinity ||
        Number(ann.bseTimestamp || Date.parse(ann.dt_tm || "")) < before),
  );
  const items = filtered.slice(0, args.limit || 10).map(formatFiling);
  return {
    success: true,
    count: items.length,
    filings: items,
    coverage: {
      kind: entry ? "stored_company_filings" : "recent_market_window",
      scanned: raw.length,
      scanLimit: entry ? 400 : 500,
      completeArchive: false,
    },
    hasMore: filtered.length > items.length,
    nextBefore: items.at(-1)?.publishedAt || null,
  };
}
export async function resultsData(query: string) {
  const e = exactCompany(query);
  const history = await getStockResultsHistory(e.symbol, e.scripCode);
  const results = history.slice(0, 8).map((h) => ({
    quarterKey: h.quarterKey || "",
    period: h.periodOrMeeting || h.quarterKey || "",
    meetingDate: h.meetingDate || h.boardMeetingDate || "",
    declarationDate: h.declarationDate || "",
    headline: clean(h.subject),
    summary: clean(h.aiSummary || h.details),
    pdfUrl: officialPdf(h.pdfLink),
    nexusResultsUrl: h.quarterKey
      ? `https://bsenexus.in/results/${encodeURIComponent(e.symbol)}/${encodeURIComponent(h.quarterKey)}`
      : "",
  }));
  return {
    success: true,
    symbol: e.symbol,
    scripCode: e.scripCode,
    companyName: e.name,
    resultsCount: results.length,
    results,
    coverage:
      "Available results filings; financial metrics are not independently validated by this endpoint.",
  };
}
export async function meetingsData(query?: string, daysAhead = 14, options: CalendarReadArgs = {}) {
  const entry = query ? exactCompany(query) : null;
  const snapshot = await getResultsCalendarSnapshot();
  return selectCalendarMeetings(snapshot, { ...options, daysAhead }, entry ? new Set([entry.scripCode]) : undefined);
}
