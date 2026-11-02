import {
  getAllStockEntries,
  type StockMasterEntry,
} from "../utils/stockResolver.js";
import {
  getRecentAnnouncements,
  getAnnouncementsForScrip,
  getCachedCompanyFilings,
} from "../database/announcementDao.js";
import {
  getStockResultsHistory,
  getResultsCalendarSnapshot,
} from "../services/resultsCalendarService.js";
import { AiError } from "./policy.js";
import { parseBseDate } from "../utils/helpers.js";
import { selectCalendarMeetings, type CalendarReadArgs } from "./calendarRead.js";
import { plainFilingText as clean, filingCategories, summaryText, FILING_CATEGORIES } from './filingText';
export function companyCandidates(query: string, approximate = false) {
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
  const partial = aliases.length ? aliases : all.filter(e => e.name.toUpperCase().includes(q) || e.symbol.toUpperCase().includes(q)).slice(0,10);
  if (partial.length || !approximate || q.length < 4 || !/^[A-Z ]+$/.test(q)) return partial;
  const compact = q.replace(/[^A-Z0-9]/g,'');
  const distance = (a: string, b: string) => {
    const row=Array.from({length:b.length+1},(_,i)=>i);
    for(let i=1;i<=a.length;i++){let old=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const prev=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,old+(a[i-1]===b[j-1]?0:1));old=prev;}}
    return row[b.length];
  };
  return all.map(e=>({entry:e,score:Math.min(...[e.symbol,e.name.replace(/\b(?:LIMITED|LTD)\.?$/i,'').trim(),...(e.nameKeywords||[])].map(v=>distance(compact,v.toUpperCase().replace(/[^A-Z0-9]/g,''))))}))
    .filter(e=>e.score <= (compact.length >= 8 ? 2 : 1)).sort((a,b)=>a.score-b.score || a.entry.symbol.localeCompare(b.entry.symbol)).slice(0,5).map(e=>e.entry);
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
function filingHeadline(ann: any, companyName: string, code: string, symbol: string) {
  let text=clean(ann.subject || ann.NEWSSUB,1000);
  const escape=(v:string)=>String(v || '').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  for(const name of [companyName, symbol].filter(Boolean)) {
    const base=String(name).replace(/\s+(?:ltd\.?|limited)$/i,'');
    text=text.replace(new RegExp('^'+escape(base)+'(?:\\s+(?:ltd\\.?|limited))?[, ]*[-–:]\\s*','i'),'');
  }
  if (/^\d{6}$/.test(code)) text=text.replace(new RegExp('^'+code+'\\s*[-–:]\\s*'),'');
  return text;
}
export function formatFiling(ann: any, detail: ReadDetail = "brief") {
  const id = clean(ann.newsId || ann.newsid || ann.news_id || ann.id, 100),
    scrip = String(ann.scrip_cd || ann.scripCode || ann.SCRIP_CD || "");
  const company = companyCandidates(scrip)[0];
  const symbol = company?.symbol || clean(ann.symbol, 30);
  const timestamp = filingTimestamp(ann);
  const categories = filingCategories(ann);
  return {
    id,
    symbol,
    scripCode: scrip,
    companyName:
      company?.name || clean(ann.companyName || ann.company_name, 200).replace(/\bLtd\.,$/i,'Ltd.'),
    headline: filingHeadline(ann, company?.name || ann.companyName, scrip, symbol),
    ...summaryText(ann.aiSummaryEn || ann.aiSummary || ann.more || ann.details, detail),
    summarySource:
      ann.aiSummaryEn || ann.aiSummary ? "stored_summary" : "filing_text",
    category: categories[0],
    categories,
    publishedAt:
      Number.isFinite(Number(timestamp)) && Number(timestamp) > 0
        ? new Date(Number(timestamp)).toISOString()
        : "",
    pdfUrl: officialPdf(ann.pdfLink || ann.attachmentname),
    sourceKind: officialPdf(ann.pdfLink || ann.attachmentname) ? "exchange_filing" : "stored_filing_record",
    nexusUrl: id && (symbol || /^\d{6}$/.test(scrip))
      ? `https://bsenexus.in/filing/${encodeURIComponent(symbol || scrip)}/${encodeURIComponent(id)}`
      : "",
  };
}
function dedupeFilings(rows: any[]) {
  const kept: {row:any;key:string;exchange:string;at:number}[] = [];
  for (const row of rows) {
    const item=formatFiling(row), at=filingTimestamp(row);
    const key=item.scripCode+':'+item.headline.toLowerCase().replace(/[^a-z0-9]/g,'');
    const exchange=String(row.exchange || row.sourceExchange || (/nse/i.test(item.id)?'NSE':/bse/i.test(item.pdfUrl)?'BSE':'')).toUpperCase();
    const duplicate=kept.some(previous=> item.id && item.id===filingId(previous.row) ||
      /^\d{6}$/.test(item.scripCode) && item.headline.length>=12 && at>0 && previous.key===key && exchange && previous.exchange && exchange!==previous.exchange && Math.abs(previous.at-at)<=15*60*1000);
    if(!duplicate)kept.push({row,key,exchange,at});
  }
  return kept.map(item=>item.row);
}
export async function filingsData(args: {
  company?: string; category?: string; limit?: number; before?: string;
  beforeId?: string; after?: string; detail?: ReadDetail;
}, sources: {
  recent?: typeof getRecentAnnouncements; company?: typeof getAnnouncementsForScrip;
  scripCodes?: readonly string[];
} = {}) {
  const entry = args.company ? exactCompany(args.company) : null;
  const raw = entry
    ? await (sources.company ? sources.company(entry.scripCode, 400) : getCachedCompanyFilings(entry.scripCode))
    : sources.scripCodes?.length === 0 ? [] : await (sources.recent || getRecentAnnouncements)(500);
  const allowedCodes = sources.scripCodes ? new Set(sources.scripCodes) : null;
  const before = args.before ? Date.parse(args.before) : Infinity;
  const after = args.after ? Date.parse(args.after) : -Infinity;
  const filtered = raw.filter(ann => {
    const timestamp = filingTimestamp(ann);
    return (!allowedCodes || allowedCodes.has(String(ann.scrip_cd || ann.scripCode || ann.SCRIP_CD || ""))) &&
      (!entry || String(ann.scrip_cd || ann.scripCode || ann.SCRIP_CD || "") === entry.scripCode) &&
      (!args.category || filingCategories(ann).includes(args.category.toUpperCase())) &&
      (after === -Infinity || timestamp >= after);
  }).sort((a, b) => filingTimestamp(b) - filingTimestamp(a) || filingId(a).localeCompare(filingId(b)));
  const unique = dedupeFilings(filtered);
  const distinct = unique.filter(ann => {const timestamp=filingTimestamp(ann);return before === Infinity || timestamp < before || timestamp === before && Boolean(args.beforeId) && filingId(ann).localeCompare(args.beforeId!) > 0;});
  const items = distinct.slice(0, args.limit || 10).map(ann => formatFiling(ann, args.detail));
  const hasMore = distinct.length > items.length;
  return {
    success: true, count: items.length, filings: items, validCategories: [...FILING_CATEGORIES], deduplicatedCount: filtered.length - unique.length,
    timezone: "Asia/Kolkata", generatedAt: new Date().toISOString(),
    newestPublishedAt: filtered.length && filingTimestamp(filtered[0]) ? new Date(filingTimestamp(filtered[0])).toISOString() : null,
    recommendedPollIntervalSeconds: 60,
    coverage: { kind: entry ? "stored_company_filings" : allowedCodes ? "recent_watchlist_window" : "recent_market_window", scanned: raw.length, scanLimit: entry ? 400 : 500, completeArchive: false },
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
    success: true, symbol: e.symbol, scripCode: e.scripCode, companyName: e.name, financialMetricsIncluded: false,
    resultsCount: results.length, results, totalResults: declared.length,
    nextOffset: offset + limit < declared.length ? offset + limit : null,
    declaredOnly: true, excludedNoticesOrUnverified: history.length - declared.length,
    coverageDetails: { completeArchive: false, source: "available_result_history", originalExchangePdfRequired: true },
    generatedAt: new Date().toISOString(), timezone: "Asia/Kolkata",
    coverage: "Available source-backed results filings; financial metrics and generated summaries require original-document verification.",
  };
}
export async function meetingsData(query?: string, daysAhead = 14, options: CalendarReadArgs = {}) {
  const entry = query ? exactCompany(query) : null;
  const snapshot = await getResultsCalendarSnapshot();
  return selectCalendarMeetings(snapshot, { ...options, daysAhead }, entry ? new Set([entry.scripCode]) : undefined);
}
