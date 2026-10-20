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
import { parseBseDate } from "../utils/helpers.js";
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
export function filingTimestamp(ann: any): number {
  const numeric = Number(ann.bseTimestamp || ann.submissionTimestamp);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  return parseBseDate(ann.dt_tm || ann.bseTime || ann.declarationDate || "") || 0;
}
const filingId = (ann: any) => clean(ann.newsId || ann.newsid || ann.news_id || ann.id, 100);
export type ReadDetail = "brief" | "full";
function summaryText(value: any, detail: ReadDetail) {
  const max = detail === "full" ? 4000 : 600;
  const valueText = clean(value, max + 1);
  return { summary: valueText.slice(0, max), summaryTruncated: valueText.length > max };
}
export function formatFiling(ann: any, detail: ReadDetail = "brief") {
  const id = clean(ann.newsId || ann.newsid || ann.news_id || ann.id, 100),
    scrip = String(ann.scrip_cd || ann.scripCode || ann.SCRIP_CD || "");
  const company = companyCandidates(scrip)[0];
  const symbol = company?.symbol || clean(ann.symbol, 30);
  const timestamp = filingTimestamp(ann);
  return {
    id,
    symbol,
    scripCode: scrip,
    companyName:
      company?.name || clean(ann.companyName || ann.company_name, 200),
    headline: clean(ann.subject || ann.NEWSSUB, 1000),
    ...summaryText(ann.aiSummaryEn || ann.aiSummary || ann.more || ann.details, detail),
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
    sourceKind: officialPdf(ann.pdfLink || ann.attachmentname) ? "exchange_filing" : "stored_filing_record",
    nexusUrl: id
      ? `https://bsenexus.in/filing/${encodeURIComponent(symbol || scrip)}/${encodeURIComponent(id)}`
      : "",
  };
}
export async function filingsData(args: {
  company?: string; category?: string; limit?: number; before?: string;
  beforeId?: string; after?: string; detail?: ReadDetail;
}, sources: {
  recent?: typeof getRecentAnnouncements; company?: typeof getAnnouncementsForScrip;
} = {}) {
  const entry = args.company ? exactCompany(args.company) : null;
  const raw = entry
    ? await (sources.company || getAnnouncementsForScrip)(entry.scripCode, 400)
    : await (sources.recent || getRecentAnnouncements)(500);
  const before = args.before ? Date.parse(args.before) : Infinity;
  const after = args.after ? Date.parse(args.after) : -Infinity;
  const filtered = raw.filter(ann => {
    const timestamp = filingTimestamp(ann);
    return (!entry || String(ann.scrip_cd || ann.scripCode || ann.SCRIP_CD || "") === entry.scripCode) &&
      (!args.category || `${ann.category || ""} ${ann.subject || ""}`.toLowerCase().includes(args.category.toLowerCase())) &&
      (after === -Infinity || timestamp >= after) &&
      (before === Infinity || timestamp < before || (timestamp === before && Boolean(args.beforeId) && filingId(ann).localeCompare(args.beforeId!) > 0));
  }).sort((a, b) => filingTimestamp(b) - filingTimestamp(a) || filingId(a).localeCompare(filingId(b)));
  const items = filtered.slice(0, args.limit || 10).map(ann => formatFiling(ann, args.detail));
  const hasMore = filtered.length > items.length;
  return {
    success: true, count: items.length, filings: items,
    timezone: "Asia/Kolkata", generatedAt: new Date().toISOString(),
    newestPublishedAt: filtered.length && filingTimestamp(filtered[0]) ? new Date(filingTimestamp(filtered[0])).toISOString() : null,
    coverage: { kind: entry ? "stored_company_filings" : "recent_market_window", scanned: raw.length, scanLimit: entry ? 400 : 500, completeArchive: false },
    hasMore,
    nextBefore: items.at(-1)?.publishedAt || null,
    nextBeforeId: hasMore ? items.at(-1)?.id || null : null,
  };
}
export async function resultsData(query: string, options: { limit?: number; offset?: number; detail?: ReadDetail } = {},
  readHistory: typeof getStockResultsHistory = getStockResultsHistory) {
  const e = exactCompany(query);
  const history = await readHistory(e.symbol, e.scripCode);
  // Meeting dates, including a past meeting inferred as declared, are not
  // original result filings. Require both an outcome and exchange evidence.
  const declared = history.filter(h => h.isOutcome === true && Boolean(officialPdf(h.pdfLink)))
    .sort((a, b) => filingTimestamp(b) - filingTimestamp(a) || a.id.localeCompare(b.id));
  const offset = options.offset || 0, limit = options.limit || 8;
  const results = declared.slice(offset, offset + limit).map(h => ({
    quarterKey: h.quarterKey || "", period: h.periodOrMeeting || h.quarterKey || "",
    meetingDate: h.meetingDate || h.boardMeetingDate || "",
    declarationDate: h.declarationDate || "",
    publishedAt: filingTimestamp(h) ? new Date(filingTimestamp(h)).toISOString() : "",
    headline: clean(h.subject, 1000),
    ...summaryText(h.aiSummary || h.details, options.detail || "brief"),
    summarySource: h.aiSummary ? "stored_summary" : "filing_text",
    pdfUrl: officialPdf(h.pdfLink),
    nexusResultsUrl: h.quarterKey ? `https://bsenexus.in/results/${encodeURIComponent(e.symbol)}/${encodeURIComponent(h.quarterKey)}` : "",
  }));
  return {
    success: true, symbol: e.symbol, scripCode: e.scripCode, companyName: e.name,
    resultsCount: results.length, results, totalResults: declared.length,
    nextOffset: offset + limit < declared.length ? offset + limit : null,
    declaredOnly: true, excludedNoticesOrUnverified: history.length - declared.length,
    generatedAt: new Date().toISOString(), timezone: "Asia/Kolkata",
    coverage: "Available source-backed results filings; financial metrics and generated summaries require original-document verification.",
  };
}
export async function meetingsData(query?: string, daysAhead = 14, options: CalendarReadArgs = {}) {
  const entry = query ? exactCompany(query) : null;
  const snapshot = await getResultsCalendarSnapshot();
  return selectCalendarMeetings(snapshot, { ...options, daysAhead }, entry ? new Set([entry.scripCode]) : undefined);
}
