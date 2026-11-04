import { selectCompanyPeers } from '../utils/companyPeers.js';
import { companyFilingStats } from '../../src/shared/companyFilings.js';
import { hasExactScripCode, matchesCompanyFiling } from '../../src/shared/scripMatching.js';
import YahooFinance from 'yahoo-finance2';
import { getStockResultsHistory, getResultsCalendarSnapshot } from './resultsCalendarService.js';
import { classifyMaterialEvent, MaterialEvent } from './timelineClassifier.js';
import { getRecentAnnouncements, getAnnouncementsForScrip, getBseOperatorAnnouncements } from '../database/announcementDao.js';
import { generateDirectSummary } from './gemini.js';
import { parseBseDate } from '../utils/helpers.js';
import { getAllStockEntries } from '../utils/stockResolver.js';

// Known quote symbol aliases for Yahoo Finance / Indian exchanges
const TICKER_QUOTE_ALIASES: Record<string, string[]> = {
  'BSE': ['BSE.NS'],
  'NSE': ['544937.BO'],
  'TATAMOTORS': ['TMCV.NS', 'TMCV.BO', 'TMPV.NS', 'TMPV.BO', '500570.BO'],
  'ZOMATO': ['ZOMATO.NS', 'ZOMATO.BO', 'ETERNAL.NS', 'ETERNAL.BO', '543320.BO'],
  'M&M': ['M&M.NS', 'M&M.BO', '500520.BO'],
};

let yfClient: any = null;
function getYF() {
  if (!yfClient) {
    const rawModule = YahooFinance as any;
    const YFClass = rawModule?.default?.default || rawModule?.default || rawModule;
    if (typeof YFClass === 'function') {
      try {
        yfClient = new YFClass({ suppressNotices: ['yahooSurvey'] });
      } catch {
        yfClient = YFClass;
      }
    } else if (typeof rawModule?.quote === 'function') {
      yfClient = rawModule;
    } else {
      yfClient = YFClass;
    }
  }
  return yfClient;
}

export interface CompanyQuoteContext {
  symbol: string;
  scripCode?: string;
  name: string;
  price: number;
  priceAsOf?: number;
  change: number;
  changePercent: number;
  currency: string;
  exchange: string;
  marketCap?: number;
  peRatio?: number;
  pbRatio?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  dayHigh?: number;
  dayLow?: number;
  volume?: number;
  avgVolume?: number;
  sector?: string;
  industry?: string;
}

export interface CompanyIntelligenceData {
  symbol: string;
  scripCode: string;
  companyName: string;
  quote?: CompanyQuoteContext;
  similarStocks?: ReturnType<typeof selectCompanyPeers>;
  upcomingEvent?: {
    meetingDate: string;
    purpose: string;
    countdownDays: number;
    isDeclared: boolean;
  };
  quarterlyResults: any[];
  materialTimeline: MaterialEvent[];
  recentFilings: any[];
  aiSnapshot?: string;
  filingStats?: ReturnType<typeof companyFilingStats>;
  filingCoverage?: 'stored' | 'partial';
}

// In-memory quote cache (5-minute TTL)
const quoteCache = new Map<string, { data: CompanyQuoteContext; expiry: number }>();

export async function fetchStockQuote(symbol: string): Promise<CompanyQuoteContext | null> {
  if (!symbol) return null;
  const cleanSym = symbol.trim().toUpperCase();

  const cached = quoteCache.get(cleanSym);
  if (cached && Date.now() < cached.expiry) {
    return cached.data;
  }

  const yf = getYF();
  // Restrict ticker lookup strictly to Indian exchanges (NSE .NS and BSE .BO)
  const aliases = TICKER_QUOTE_ALIASES[cleanSym] || [];
  const tickerVariants = ['BSE', 'NSE'].includes(cleanSym) ? aliases : [...aliases, `${cleanSym}.NS`, `${cleanSym}.BO`];

  for (const ticker of tickerVariants) {
    try {
      // PERF (1 Oct 2026 audit PERF-003): yf.quote() has no built-in timeout.
      // Yahoo periodically hangs (rate-limited / IP-blocked) and a hung call
      // blocks the entire getCompanyIntelligence chain indefinitely. Wrap in
      // Promise.race with 2.5s timeout (mirrors marketIndicesService pattern).
      const q = await Promise.race([
        yf.quote(ticker),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('Yahoo Finance timeout')), 2500)
        ),
      ]);
      if (q && q.regularMarketPrice !== undefined) {
        // Enforce Indian Rupees currency and Indian exchange to guarantee India stocks only
        const currency = q.currency || 'INR';
        if (currency !== 'INR' && !ticker.endsWith('.NS') && !ticker.endsWith('.BO')) {
          continue;
        }

        const allEntries = getAllStockEntries();
        const master = allEntries.find(e => e.symbol.toUpperCase() === cleanSym);
        const preferredName = master?.name || q.longName || q.shortName || cleanSym;

        const priceAsOf = q.regularMarketTime instanceof Date ? q.regularMarketTime.getTime() : NaN;
        const quote: CompanyQuoteContext = {
          symbol: cleanSym,
          name: preferredName,
          price: q.regularMarketPrice,
          priceAsOf: Number.isFinite(priceAsOf) && priceAsOf > 0 ? priceAsOf : undefined,
          change: q.regularMarketChange || 0,
          changePercent: q.regularMarketChangePercent || 0,
          currency: 'INR',
          exchange: ticker.endsWith('.NS') ? 'NSE' : 'BSE',
          marketCap: q.marketCap,
          peRatio: q.trailingPE || q.forwardPE,
          fiftyTwoWeekHigh: q.fiftyTwoWeekHigh,
          fiftyTwoWeekLow: q.fiftyTwoWeekLow,
          dayHigh: q.regularMarketDayHigh,
          dayLow: q.regularMarketDayLow,
          volume: q.regularMarketVolume,
          avgVolume: q.averageDailyVolume3Month,
          sector: q.industry || q.sector || master?.sector || undefined,
          industry: q.industry || q.sector || master?.sector || undefined,
        };
        quoteCache.set(cleanSym, { data: quote, expiry: Date.now() + 300000 });
        return quote;
      }
    } catch {
      // Try next variant
    }
  }

  return null;
}

export async function getCompanyIntelligence(scripCode: string, symbol: string): Promise<CompanyIntelligenceData> {
  const targetSym = (symbol || '').trim().toUpperCase();
  const targetScrip = targetSym === 'BSE' ? '' : String(scripCode || getAllStockEntries().find(e => e.symbol.toUpperCase() === targetSym)?.scripCode || '').trim();
  const nseOnly = targetSym === 'BSE';

  // Independent providers run together; the company read has no user-watchlist dependency.
  const filingsRead = nseOnly ? getBseOperatorAnnouncements(true) : getAnnouncementsForScrip(targetScrip, Number.MAX_SAFE_INTEGER, true);
  const [quote, rawHistory, calendarData, storedFilings] = await Promise.all([
    targetSym ? fetchStockQuote(targetSym).catch(() => null) : Promise.resolve(null),
    nseOnly ? Promise.resolve([]) : filingsRead.then(rows => getStockResultsHistory(targetScrip, targetSym, undefined, rows)).then(rows => rows.filter(h => hasExactScripCode(h, targetScrip))),
    nseOnly ? Promise.resolve({items: []}) : getResultsCalendarSnapshot(),
    filingsRead
  ]);

  // Find strictly upcoming or today event from calendarData
  const upcomingItem = (calendarData.items || []).find((c: any) => 
    hasExactScripCode(c, targetScrip) &&
    (c.status === 'UPCOMING' || c.status === 'TODAY' || (typeof c.daysLeft === 'number' && c.daysLeft >= 0))
  );

  let upcomingEvent = undefined;
  if (upcomingItem && (upcomingItem.daysLeft === undefined || upcomingItem.daysLeft >= 0)) {
    const today = new Date().toISOString().split('T')[0];
    const diffMs = new Date(upcomingItem.meetingDate).getTime() - new Date(today).getTime();
    const countdownDays = Math.ceil(diffMs / 86400000);
    const effectiveDays = upcomingItem.daysLeft !== undefined ? upcomingItem.daysLeft : countdownDays;

    if (effectiveDays >= 0) {
      upcomingEvent = {
        meetingDate: upcomingItem.meetingDate,
        purpose: upcomingItem.purpose || 'Board Meeting / Financial Results',
        countdownDays: effectiveDays,
        isDeclared: Boolean(upcomingItem.isDeclared),
        declarationDate: upcomingItem.isDeclared ? (upcomingItem.resultDeclarationTime?.split(',')[0]?.trim() || upcomingItem.meetingDate) : undefined,
        declarationTime: upcomingItem.isDeclared ? upcomingItem.resultDeclarationTime : undefined
      };
    }
  } else {
    // Check rawHistory for any strictly future or today meeting
    const futureMeeting = (rawHistory || []).find((h: any) => {
      if (h.status !== 'Scheduled Upcoming' && h.status !== 'Meeting Today') return false;
      const meetingTs = h.submissionTimestamp || parseBseDate(h.meetingDate);
      return meetingTs && meetingTs >= (Date.now() - 24 * 60 * 60 * 1000);
    });
    if (futureMeeting) {
      const meetingTs = futureMeeting.submissionTimestamp || parseBseDate(futureMeeting.meetingDate);
      const diffMs = meetingTs - Date.now();
      const countdownDays = Math.max(0, Math.ceil(diffMs / 86400000));
      upcomingEvent = {
        meetingDate: futureMeeting.meetingDate,
        purpose: futureMeeting.details || futureMeeting.subject || 'Board Meeting / Financial Results',
        countdownDays,
        isDeclared: Boolean(futureMeeting.isOutcome),
        declarationDate: futureMeeting.declarationDate,
        declarationTime: futureMeeting.declarationTime
      };
    }
  }

  // 3. Process Quarterly Financial Results (Include both declared outcomes and scheduled quarters)
  const resultMap = new Map<string, any>();
  for (const r of rawHistory || []) {
    const key = (r.quarterKey || r.periodOrMeeting || r.meetingDate).trim();
    if (!resultMap.has(key)) {
      resultMap.set(key, r);
    } else {
      const existing = resultMap.get(key);
      // Prefer declared outcome with PDF over pending meeting
      if ((!existing.pdfLink && r.pdfLink) || (!existing.isOutcome && r.isOutcome)) {
        resultMap.set(key, { ...existing, ...r });
      }
    }
  }
  let quarterlyResults = Array.from(resultMap.values()).sort((a, b) => (b.submissionTimestamp || 0) - (a.submissionTimestamp || 0));

  // 4. Extract Material Corporate Events Timeline & All Recent Filings
  const recentAnnouncements = nseOnly ? await getBseOperatorAnnouncements(true) : await getRecentAnnouncements(10000);
  let announcementPool: any[] = recentAnnouncements;
  let filingCoverage: 'stored' | 'partial' = 'stored';
  if (targetScrip) {
    try {
      const durable = storedFilings;
      if (durable.length > 0) {
        const byId = new Map(announcementPool.map((a: any) => [a.id || a.newsId, a]));
        for (const row of durable) byId.set(row.id || row.newsId, row);
        announcementPool = [...byId.values()];
      }
    } catch (e) { filingCoverage = 'partial'; }
  }
  const rawStockAnnouncements = announcementPool.filter((ann: any) => matchesCompanyFiling(ann, targetScrip, targetSym));

  const filingMap = new Map<string, any>();

  // Add all raw announcements from DB
  for (const ann of rawStockAnnouncements) {
    const id = ann.id || ann.newsId || ann.NEWSID;
    if (!id) continue;
    const sub = ann.subject || ann.NEWSSUB || '';
    const det = ann.details || ann.HEADLINE || '';
    const rawTime = ann.bseTime || ann.News_submission_dt || ann.DT_TM || ann.NEWS_DT || '';
    const publicationTimestamp = parseBseDate(rawTime) || ann.bseTimestamp || 0;
    const ts = publicationTimestamp || ann.timestamp || (ann.fetched_at ? new Date(ann.fetched_at).getTime() : Date.now());
    const attachmentFile = ann.ATTACHMENTNAME || ann.attachmentName || ann.attachment || ann.ATTACHMENT || '';
    const pdfLink = ann.pdfLink || ann.pdfUrl || ann.attachmentUrl ||
      (attachmentFile ? (attachmentFile.startsWith('http') ? attachmentFile : `https://www.bseindia.com/xml-data/corpfiling/AttachLive/${attachmentFile}`) : '');

    filingMap.set(id, {
      id,
      subject: sub,
      details: det,
      bseTime: rawTime || new Date(ts).toISOString(),
      pdfLink,
      attachmentName: attachmentFile,
      timestamp: ts,
      publicationTimestamp,
      scripCode: targetScrip,
      symbol: targetSym,
      companyName: ann.companyName,
      category: ann.category,
      priority: ann.priority,
      resultDocumentCheck: ann.resultDocumentCheck
    });
  }

  // Calendar rows remain in Results; only original disclosure records belong in Filings.
  // Explicit Research sync owns archive work, so a public read never blocks on an exchange import.

  if (nseOnly) {
    quarterlyResults = Array.from(filingMap.values()).filter(f => f.category === 'RESULTS' && /financial.*results|audited.*results/i.test(f.subject || '')).map(f => ({
      ...f, periodOrMeeting: 'Financial results filing', declarationDate: f.bseTime, status: 'Filed',
    }));
  }
  const allStockFilings = Array.from(filingMap.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  const timelineEvents: MaterialEvent[] = [];
  for (const filing of allStockFilings) {
    const classified = classifyMaterialEvent(filing);
    if (classified) {
      timelineEvents.push(classified);
    }
  }

  // Deduplicate timeline events
  const uniqueTimeline: MaterialEvent[] = [];
  const seenEvents = new Set<string>();
  for (const ev of timelineEvents) {
    const evKey = `${ev.eventType}_${ev.dateStr}_${ev.title.slice(0, 30)}`;
    if (!seenEvents.has(evKey)) {
      seenEvents.add(evKey);
      uniqueTimeline.push(ev);
    }
  }
  uniqueTimeline.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  const allEntries = getAllStockEntries();
  const masterEntry = allEntries.find(
    e => e.symbol.toUpperCase() === targetSym || (targetScrip && e.scripCode === targetScrip)
  );
  const resolvedDisplayName = masterEntry?.name || quote?.name || targetSym || "BSE Listed Stock";

  return {
    symbol: targetSym || quote?.name || targetScrip,
    scripCode: targetScrip || masterEntry?.scripCode || '',
    companyName: resolvedDisplayName,
    quote: quote || undefined,
    similarStocks: selectCompanyPeers(allEntries, targetSym, targetScrip),
    upcomingEvent,
    quarterlyResults,
    materialTimeline: uniqueTimeline,
    recentFilings: allStockFilings,
    filingStats: companyFilingStats(allStockFilings),
    filingCoverage
  };
}

export async function generateCompanyAiOverview(scripCode: string, symbol: string, lang: 'hinglish' | 'english' = 'hinglish'): Promise<string> {
  const intel = await getCompanyIntelligence(scripCode, symbol);
  
  const filingsSummary = (intel.recentFilings || []).slice(0, 8).map(f => `- ${f.bseTime || 'Recent'}: ${f.subject}`).join('\n');
  const resultsSummary = (intel.quarterlyResults || []).slice(0, 4).map(q => `- ${q.periodOrMeeting}: Declared on ${q.declarationDate || q.meetingDate}`).join('\n');

  const detailsText = `
Price: ${intel.quote?.price ? `₹${intel.quote.price}` : 'N/A'}, 52W: ${intel.quote?.fiftyTwoWeekLow ? `₹${intel.quote.fiftyTwoWeekLow} - ₹${intel.quote.fiftyTwoWeekHigh}` : 'N/A'}
Recent Results:
${resultsSummary || 'None'}
Recent Filings:
${filingsSummary || 'None'}
  `.trim();

  try {
    const summary = await generateDirectSummary(intel.companyName, `360 Corporate Intelligence Brief: ${intel.companyName}`, detailsText, 'OTHER', '', undefined, lang);
    return summary || `Analysis for ${intel.companyName}: Active BSE tracking initialized. ${intel.quarterlyResults.length} quarterly results indexed with ${intel.materialTimeline.length} material corporate actions tracked.`;
  } catch (e: any) {
    return `Analysis for ${intel.companyName}: Active BSE tracking initialized. ${intel.quarterlyResults.length} quarterly results indexed with ${intel.materialTimeline.length} material corporate actions tracked.`;
  }
}

/** Lightweight public card read; no quotes, AI, calendar import or paid work. */
export async function getCompanyFilingCount(scripCode: string, symbol: string) {
  const rows = symbol === 'BSE' ? await getBseOperatorAnnouncements(true) : await getAnnouncementsForScrip(scripCode, Number.MAX_SAFE_INTEGER, true);
  return companyFilingStats(rows.filter(row => matchesCompanyFiling(row, scripCode, symbol)));
}
