import { addLog } from '../database/logDao.js';
import { isAnnouncementProcessed, saveAnnouncement, saveAnnouncementsBatch, flushLocalDiskSave, getTotalAnnouncementsCount } from '../database/announcementDao.js';
import { getScripCodeForSymbolOrName, determinePriority, isSymbolMatch, isMarketHoursIST } from '../utils/helpers.js';
import { resolveStockDetails } from '../utils/stockResolver.js';
import { getActiveWatchlistSymbols } from '../database/watchlistDao.js';
import { invalidateEnrichedCalendarCache } from './resultsCalendarService.js';
import { bseCircuitBreaker } from '../utils/circuitBreaker.js';

let bseHealth = { status: 'unknown', latency: 0 };
let lastBseErrorDetails = "No recent errors";
let lastBackupStalenessSec: number | null = null;
let lastBackupCheckTime = 0;

// ---- BSE source-block detection (exponential backoff: 20s -> 1min -> 5min) ----
let bseSourceBlocked = false;
let bseBlockedAtMs = 0;
let bseLastEscalationMs = 0;
let bseBlockBackoffLevel = 0; // 0 = not blocked; 1 = 20s; 2 = 60s; 3 = 300s
let bootBackfillDone = false; // one-time deep page walk on the first poll after (re)start
const bseModuleBootMs = Date.now(); // process (re)start time, for honest staleness math
let lastSuccessfulFetchMs = 0; // last time BSE returned a usable (non-null) response

export function isBseSourceBlocked(): boolean {
  return bseSourceBlocked;
}

export function getBseBlockBackoffLevel(): number {
  return bseSourceBlocked ? bseBlockBackoffLevel : 0;
}

function markBseBlocked(reason: string) {
  const now = Date.now();
  if (!bseSourceBlocked) {
    bseSourceBlocked = true;
    bseBlockedAtMs = now;
    bseLastEscalationMs = now;
    bseBlockBackoffLevel = 1;
  } else if (now - bseLastEscalationMs > 15000) {
    bseLastEscalationMs = now;
    bseBlockBackoffLevel = Math.min(3, bseBlockBackoffLevel + 1);
  }
  lastBseErrorDetails = reason;
  addLog('WARNING', 'POLLER', `BSE source blocked (${reason}); backing off at level ${bseBlockBackoffLevel}`).catch(() => {});
}

export function clearBseBlock() {
  if (bseSourceBlocked) {
    bseSourceBlocked = false;
    bseBlockBackoffLevel = 0;
    addLog('INFO', 'POLLER', 'BSE source block cleared; normal polling resumed').catch(() => {});
  }
}

export function getBseHealth() {
  return bseHealth;
}

export function getLastBseError(): string {
  return lastBseErrorDetails;
}

export function getBseFeedStaleness(): { lastSuccessfulFetchMs: number; bootMs: number; blocked: boolean; blockBackoffLevel: number } {
  return {
    lastSuccessfulFetchMs,
    bootMs: bseModuleBootMs,
    blocked: bseSourceBlocked,
    blockBackoffLevel: bseBlockBackoffLevel,
  };
}

export function getBackupStalenessMetrics() {
  return {
    stalenessSec: lastBackupStalenessSec,
    lastChecked: lastBackupCheckTime,
    status: lastBackupStalenessSec === null ? 'UNKNOWN' : (lastBackupStalenessSec <= 20 ? 'OPTIMAL' : 'LAGGING')
  };
}

interface BrowserProfile {
  ua: string;
  platform: string;
  brands: string;
}

const DEFAULT_BROWSER_PROFILE: BrowserProfile = {
  ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  platform: '"Windows"',
  brands: '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"'
};

function getNextBrowserHeaders(): Record<string, string> {
  return {
    "User-Agent": DEFAULT_BROWSER_PROFILE.ua,
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Origin": "https://www.bseindia.com",
    "Referer": "https://www.bseindia.com/",
    "sec-ch-ua": DEFAULT_BROWSER_PROFILE.brands,
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": DEFAULT_BROWSER_PROFILE.platform,
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-site",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache"
  };
}

// Fast adaptive backoffs to ensure rapid recovery
const RETRY_BACKOFF_DELAYS = [400, 1000, 2000];

export function getBseISTDate(offsetDays: number = 0): string {
  // IST is UTC + 5:30
  const now = new Date(Date.now() + (5.5 * 60 * 60 * 1000) - (offsetDays * 24 * 60 * 60 * 1000));
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

async function fetchWithHardenedRetries(url: string, timeoutMs: number = 5000, maxRetries: number = 2): Promise<any[] | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const headers = getNextBrowserHeaders();
      const controller = new AbortController();
      timer = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(url, {
        headers,
        signal: controller.signal,
      });
      // Keep the abort deadline active while reading the response body too.
      if (!res.ok) {
        if (res.status === 403) {
          lastBseErrorDetails = "HTTP 403 Forbidden (BSE Akamai Edge WAF rate limit or cloud IP block)";
          markBseBlocked(lastBseErrorDetails);
        } else if (res.status >= 500) {
          lastBseErrorDetails = `HTTP ${res.status} (BSE Server Maintenance / Outage)`;
        } else {
          lastBseErrorDetails = `HTTP ${res.status} response from BSE`;
        }

        if (attempt < maxRetries) {
          const delay = RETRY_BACKOFF_DELAYS[attempt] || 500;
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        return null;
      }

      const txt = await res.text();
      if (!txt || txt.includes("No Record") || txt.trim() === "{}" || txt.trim() === "[]") return [];
      const data = JSON.parse(txt);
      if (data && data.Table && Array.isArray(data.Table)) {
        const rows = data.Table.filter((r: any) => r && (r.NEWSID || r.NEWSSUB || r.SCRIP_CD || r.SLONGNAME || r.scrip_cd));
        return rows;
      }
      if (Array.isArray(data)) {
        const rows = data.filter((r: any) => r && (r.NEWSID || r.NEWSSUB || r.SCRIP_CD || r.SLONGNAME || r.scrip_cd));
        return rows;
      }
      return [];
    } catch (err: any) {
      lastBseErrorDetails = err?.name === 'AbortError' ? 'Connection Timeout' : (err?.message || 'Network Error');
      if (attempt < maxRetries) {
        const delay = RETRY_BACKOFF_DELAYS[attempt] || 500;
        await new Promise(r => setTimeout(r, delay));
      }
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }
  return null;
}

export async function fetchSingleBsePage(
  page: number, 
  scripCode: string = '', 
  apiType: string = 'AnnSubCategoryGetData', 
  timeoutMs: number = 5000,
  targetDate?: string,
  maxRetries: number = 1
) {
  // Validate and whitelist parameters against injection
  const safeApiType = (apiType === 'AnnGetData') ? 'AnnGetData' : 'AnnSubCategoryGetData';
  const cleanScrip = (scripCode && /^\d{1,8}$/.test(scripCode.trim())) ? scripCode.trim() : '';
  const safePage = Math.max(1, Math.min(100, Math.floor(page) || 1));

  let prevDate: string;
  let toDate: string;
  let searchType: string;

  if (cleanScrip) {
    // When searching for a specific stock/scripCode (e.g. watchlist sync or historical results),
    // BSE accepts a date range with strSearch=P
    prevDate = getBseISTDate(180);
    toDate = getBseISTDate(0);
    searchType = 'P';
  } else {
    // For general market announcements feed, BSE requires matching from/to date (YYYYMMDD)
    const dateStr = targetDate || getBseISTDate(0);
    prevDate = dateStr;
    toDate = dateStr;
    searchType = 'D';
  }

  // Add cache-busting timestamp (_cb) to prevent stale edge cache responses from Akamai CDN
  const url = `https://api.bseindia.com/BseIndiaAPI/api/${safeApiType}/w?pageno=${safePage}&strCat=-1&strPrevDate=${prevDate}&strScrip=${cleanScrip}&strSearch=${searchType}&strToDate=${toDate}&strType=C&_cb=${Date.now()}`;
  
  return await bseCircuitBreaker.execute(
    async () => {
      return await fetchWithHardenedRetries(url, timeoutMs, maxRetries);
    },
    (_err) => {
      // Graceful fallback when circuit breaker is OPEN or request failed
      return null;
    },
    timeoutMs * (maxRetries + 1)
  );
}

function parseItemTimestamp(item: any): number {
  if (!item) return 0;
  const raw = item.News_submission_dt || item.DT_TM || item.NEWS_DT || "";
  if (!raw) return 0;
  const parsed = Date.parse(raw);
  if (!isNaN(parsed)) return parsed;
  return 0;
}

export async function testBSEConnection() {
  const start = Date.now();
  const todayDate = getBseISTDate(0);
  const yesterdayDate = getBseISTDate(1);

  // Check circuit breaker state first
  const breakerState = bseCircuitBreaker.getState();
  if (breakerState === 'OPEN') {
    bseHealth = { status: 'down', latency: -1 };
    return { 
      success: false, 
      error: "BSE API circuit breaker is currently OPEN (cooling down to protect server resources). Will retry automatically." 
    };
  }

  // Try primary endpoint (today, strSearch=D)
  let table = await fetchSingleBsePage(1, '', 'AnnSubCategoryGetData', 6000, todayDate);
  // Fallback 1: try strSearch=P for today
  if (table === null) {
    const fallbackPUrl = `https://api.bseindia.com/BseIndiaAPI/api/AnnSubCategoryGetData/w?pageno=1&strCat=-1&strPrevDate=${todayDate}&strScrip=&strSearch=P&strToDate=${todayDate}&strType=C&_cb=${Date.now()}`;
    table = await fetchWithHardenedRetries(fallbackPUrl, 6000, 1);
  }
  // Fallback 2: try yesterday's filings
  if (table === null) {
    table = await fetchSingleBsePage(1, '', 'AnnSubCategoryGetData', 6000, yesterdayDate);
  }
  // Fallback 3: try a major scrip code (Reliance 500325)
  if (table === null) {
    table = await fetchSingleBsePage(1, '500325', 'AnnSubCategoryGetData', 6000);
  }

  const latency = Date.now() - start;
  if (table && table.length > 0) {
    bseHealth = { status: 'stable', latency };
    const firstItem = table[0];
    const company = firstItem.SLONGNAME || firstItem.NEWSSUB || firstItem.scrip_cd || "BSE Stock";
    return { success: true, company, count: table.length };
  } else if (Array.isArray(table)) {
    bseHealth = { status: 'stable', latency };
    return { success: true, company: "BSE Connected", count: 0 };
  } else {
    bseHealth = { status: 'down', latency: -1 };
    return { success: false, error: "BSE API temporarily unreachable. Will retry automatically on next interval." };
  }
}

export async function fetchParallelBackupSource(): Promise<{ items: any[]; source: string; latestTs: number }> {
  const todayDate = getBseISTDate(0);
  // Real working backup: AnnSubCategoryGetData with strSearch=P
  const backupUrl = `https://api.bseindia.com/BseIndiaAPI/api/AnnSubCategoryGetData/w?pageno=1&strCat=-1&strPrevDate=${todayDate}&strScrip=&strSearch=P&strToDate=${todayDate}&strType=C&_cb=${Date.now()}`;
  const backupItems = await fetchWithHardenedRetries(backupUrl, 4000, 1) || [];
  let latestTs = 0;
  for (const it of backupItems) {
    const ts = parseItemTimestamp(it);
    if (ts > latestTs) latestTs = ts;
  }
  return { items: backupItems, source: 'PARALLEL_BACKUP_SEARCH_P', latestTs };
}

let nseSessionCookie = '';
let nseSessionExpiry = 0;

async function getNSECorporateCookie(): Promise<string> {
  const now = Date.now();
  if (nseSessionCookie && now < nseSessionExpiry) {
    return nseSessionCookie;
  }
  try {
    const res = await fetch('https://www.nseindia.com', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      signal: AbortSignal.timeout(5000)
    });
    const raw = (res.headers as any).getSetCookie ? (res.headers as any).getSetCookie() : [res.headers.get('set-cookie')];
    nseSessionCookie = (raw || []).map((c: any) => (c || '').split(';')[0]).filter(Boolean).join('; ');
    nseSessionExpiry = now + (10 * 60 * 1000);
    return nseSessionCookie;
  } catch (_e) {
    return nseSessionCookie;
  }
}

export async function fetchNSECorporateAnnouncements(): Promise<any[]> {
  try {
    const cookie = await getNSECorporateCookie();
    const res = await fetch('https://www.nseindia.com/api/corporate-announcements?index=equities', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        'Referer': 'https://www.nseindia.com/companies-listing/corporate-filings-announcements',
        'Cookie': cookie,
        'Accept': 'application/json, text/plain, */*'
      },
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) return [];
    const items = await res.json();
    if (!Array.isArray(items)) return [];

    return items.map((item: any) => {
      const symbol = (item.symbol || '').trim();
      const scrip_cd = getScripCodeForSymbolOrName(symbol) || '';
      const newsId = `corp_nse_${item.seq_id || item.dt || Date.now()}`;
      const companyName = item.sm_name || symbol || 'NSE Stock';
      const subject = item.attchmntText || item.desc || 'Corporate Announcement';
      const details = item.desc ? `${item.desc}${item.attchmntText ? ' - ' + item.attchmntText : ''}` : (item.attchmntText || '');
      const pdfLink = item.attchmntFile || '';
      const dateStr = item.an_dt || item.sort_date || '';

      return {
        NEWSID: newsId,
        SCRIP_CD: scrip_cd,
        scrip_cd,
        symbol,
        SLONGNAME: companyName,
        NEWSSUB: subject,
        HEADLINE: details,
        ATTACHMENTNAME: pdfLink ? pdfLink.split('/').pop() : '',
        pdfLink,
        DT_TM: dateStr,
        News_submission_dt: dateStr,
        NEWS_DT: dateStr,
        _source: 'NSE_LIVE_FEED'
      };
    });
  } catch (_err) {
    return [];
  }
}

export async function fetchBSEAnnouncements() {
  const start = Date.now();
  const todayDate = getBseISTDate(0);
  const yesterdayDate = getBseISTDate(1);
  let source = 'BSE_PRIMARY';

  const isBootCycle = !bootBackfillDone;
  const maxDeepPages = 3; // Bound restart bursts to the same window as normal polling.
  
  // Primary live endpoint: AnnSubCategoryGetData page 1 returns ~50 latest filings
  let table = await fetchSingleBsePage(1, '', 'AnnSubCategoryGetData', 5000, todayDate);
  
  // A valid-but-empty primary may differ from the alternate search. Try the
  // existing recovery endpoint before treating it as no new filings.
  let checkedAlternate = false;
  if (table === null || table.length === 0) {
    checkedAlternate = true;
    lastBackupCheckTime = Date.now();
    source = 'BSE_FALLBACK_SEARCH_P';
    const fallbackPUrl = `https://api.bseindia.com/BseIndiaAPI/api/AnnSubCategoryGetData/w?pageno=1&strCat=-1&strPrevDate=${todayDate}&strScrip=&strSearch=P&strToDate=${todayDate}&strType=C&_cb=${Date.now()}`;
    const alternate = await fetchWithHardenedRetries(fallbackPUrl, 5000, 1);
    if (alternate !== null) table = alternate;
    if (alternate && alternate.length > 0) {
      await addLog('INFO', 'POLLER', `Primary BSE endpoint degraded; switched to BSE_FALLBACK_SEARCH_P in ${Date.now() - start}ms`);
    }
  }

  // If still null, attempt Fallback 2: yesterday's filings
  if (table === null) {
    source = 'BSE_FALLBACK_YESTERDAY';
    table = await fetchSingleBsePage(1, '', 'AnnSubCategoryGetData', 5000, yesterdayDate);
    if (table) {
      await addLog('INFO', 'POLLER', `Today's BSE endpoint unreachable; recovered with BSE_FALLBACK_YESTERDAY in ${Date.now() - start}ms`);
    }
  }

  // Use the existing minute-spaced sample for recovery, not only telemetry.
  // Alternate rows must reach the monitor, which owns persistence/dedupe.
  if (!checkedAlternate && source !== 'BSE_FALLBACK_YESTERDAY' && table && table.length > 0) {
    const now = Date.now();
    if (now - lastBackupCheckTime > 60000) {
      lastBackupCheckTime = now;
      const backupRes = await fetchParallelBackupSource();
      if (backupRes.items.length > 0) {
        const primaryLatestTs = Math.max(...table.map((i: any) => parseItemTimestamp(i)));
        if (primaryLatestTs > 0 && backupRes.latestTs > 0) {
          lastBackupStalenessSec = Math.max(0, Math.round((primaryLatestTs - backupRes.latestTs) / 1000));
        }
        table = [...table, ...backupRes.items.map(item => ({ ...item, _source: backupRes.source }))];
      }
    }
  }

  // Block-signal check on today's page 1: HTTP 200 with data
  const todayHadRows = source !== 'BSE_FALLBACK_YESTERDAY' && Array.isArray(table) && table.length > 0;
  if (todayHadRows) {
    clearBseBlock();
  } else if (table !== null && source !== 'BSE_FALLBACK_YESTERDAY' && isMarketHoursIST()) {
    markBseBlocked("BSE returned 'No Record Found' during market hours (likely rate-limited)");
  }

  // Delta-only deep walk: page 1 holds the latest ~50 rows. Walk deeper pages
  // ONLY while every item on the previous page is new (unseen NEWSID)
  if (todayHadRows && Array.isArray(table) && table.length >= 50) {
    let prevPageAllNew = true;
    for (const it of table) {
      if (!it.NEWSID || await isAnnouncementProcessed(it.NEWSID)) { prevPageAllNew = false; break; }
    }
    let page = 1;
    while (prevPageAllNew && page < maxDeepPages) {
      page++;
      // Pace only deeper pages; page 1 stays immediate in boot and normal cycles.
      await new Promise(r => setTimeout(r, 2500));
      const next = await fetchSingleBsePage(page, '', 'AnnSubCategoryGetData', 4500, todayDate) || [];
      if (next.length === 0) break;
      table = [...table, ...next];
      prevPageAllNew = next.length >= 50;
      if (prevPageAllNew) {
        for (const it of next) {
          if (!it.NEWSID || await isAnnouncementProcessed(it.NEWSID)) { prevPageAllNew = false; break; }
        }
      }
    }
    if (isBootCycle && page > 1) {
      await addLog('INFO', 'POLLER', `Boot backfill walked ${page} BSE pages to fill post-restart gap`);
    }
  }
  bootBackfillDone = true;

  // If today has fewer than 30 filings (e.g. market just opened or overnight),
  // merge yesterday's filings so that the feed has complete historical continuity!
  if (table && Array.isArray(table) && table.length < 30) {
    const yestItems = await fetchSingleBsePage(1, '', 'AnnSubCategoryGetData', 4500, yesterdayDate) || [];
    table = [...table, ...yestItems.map(item => ({ ...item, _source: 'BSE_HISTORY_YESTERDAY' }))];
  }

  const totalLatency = Date.now() - start;

  if (table && Array.isArray(table) && table.length > 0) {
    bseHealth = { status: totalLatency > 4000 ? 'degraded' : 'stable', latency: Math.round(totalLatency) };
    // History returned by yesterday's fallback does not verify today's source.
    if (source !== 'BSE_FALLBACK_YESTERDAY' && !bseSourceBlocked) lastSuccessfulFetchMs = Date.now();
    else bseHealth = { status: 'degraded', latency: Math.round(totalLatency) };
    
    // Deduplicate by NEWSID and attach diagnostic metadata
    const uniqueMap = new Map();
    if (table && Array.isArray(table)) {
      for (const item of table) {
        if (item.NEWSID && !uniqueMap.has(item.NEWSID)) {
          item._source = item._source || source;
          item._fetchLatency = totalLatency;
          uniqueMap.set(item.NEWSID, item);
        }
      }
    }

    // Live NSE corporate announcements merge: ensures zero-lag coverage even when
    // BSE has an Akamai WAF block, edge delay, or late evening lull
    try {
      const nseRows = await fetchNSECorporateAnnouncements();
      if (nseRows && nseRows.length > 0) {
        for (const item of nseRows) {
          if (item.NEWSID && !uniqueMap.has(item.NEWSID)) {
            uniqueMap.set(item.NEWSID, item);
          }
        }
      }
    } catch (_nseErr) {
      // NSE is an enhancement/fallback; network hiccups never crash monitor
    }

    if (uniqueMap.size > 0) {
      bseHealth = { status: totalLatency > 4000 ? 'degraded' : 'stable', latency: Math.round(totalLatency) };
      if (!bseSourceBlocked) lastSuccessfulFetchMs = Date.now();
      return Array.from(uniqueMap.values());
    }
  }

  // If table had no rows or was null, attempt NSE feed directly before declaring source down
  try {
    const nseRows = await fetchNSECorporateAnnouncements();
    if (nseRows && nseRows.length > 0) {
      bseHealth = { status: 'stable', latency: 450 };
      lastSuccessfulFetchMs = Date.now();
      return nseRows;
    }
  } catch (_e) {}
  
  if (table !== null) {
    bseHealth = { status: bseSourceBlocked ? 'degraded' : 'stable', latency: Math.round(totalLatency) };
    if (source !== 'BSE_FALLBACK_YESTERDAY' && !bseSourceBlocked) lastSuccessfulFetchMs = Date.now();
    return [];
  }
  bseHealth = { status: 'down', latency: -1 };
  return null;
}

export async function syncWatchlistHistoricalData() {
  try {
    const activeSymbols = await getActiveWatchlistSymbols();
    if (!activeSymbols || activeSymbols.length === 0) {
      return { success: true, count: 0, symbolsCount: 0 };
    }

    let totalSaved = 0;
    
    // 1. Fetch latest live page 1 to ensure fresh general filings are captured
    const liveItems = await fetchSingleBsePage(1, '', 'AnnSubCategoryGetData', 3000);
    const announcementsToSave: any[] = [];
    if (liveItems && Array.isArray(liveItems)) {
      for (const item of liveItems) {
        const newsId = item.NEWSID;
        if (!newsId) continue;

        const companyName = item.SLONGNAME || item.scrip_cd || "BSE Stock";
        const subject = item.NEWSSUB || "No Subject";
        const details = item.HEADLINE || "";
        const scrip_cd = String(item.scrip_cd || item.SCRIP_CD || '');

        let isWatchlistMatch = false;
        for (const sym of activeSymbols) {
          if (isSymbolMatch(companyName, subject, sym, scrip_cd)) {
            isWatchlistMatch = true;
            break;
          }
        }

        if (isWatchlistMatch) {
          const pdfLink = item.ATTACHMENTNAME ? `https://www.bseindia.com/xml-data/corpfiling/AttachLive/${item.ATTACHMENTNAME}` : "";
          const priority = determinePriority(subject, details);
          
          announcementsToSave.push({
            newsId,
            companyName,
            subject,
            details,
            pdfLink,
            scrip_cd,
            bseTime: item.News_submission_dt || item.DT_TM || item.NEWS_DT,
            priority: priority.level,
            category: priority.category,
            isWatchlist: true
          });
        }
      }
    }

    if (announcementsToSave.length > 0) {
      const res = await saveAnnouncementsBatch(announcementsToSave);
      totalSaved += (res.inserted + res.updated);
    }

    // 2. Fetch historical announcements per scrip code for each symbol in active Watchlists
    const processedScripCodes = new Set<string>();
    
    // Polite bounded pacing (2 symbols at a time with 250ms delay) to prevent Akamai WAF bans
    const batchSize = 2;
    for (let i = 0; i < activeSymbols.length; i += batchSize) {
      const batch = activeSymbols.slice(i, i + batchSize);
      await Promise.all(batch.map(async (sym) => {
        let scripCode = getScripCodeForSymbolOrName(sym);
        if (!scripCode) {
          const resolved = await resolveStockDetails(sym);
          if (resolved) scripCode = resolved.scripCode;
        }

        if (!scripCode || processedScripCodes.has(scripCode)) return;
        processedScripCodes.add(scripCode);

        // Fetch latest filings for this scripCode (page 1 is sufficient; older data is already cached)
        const page1 = await fetchSingleBsePage(1, scripCode, 'AnnSubCategoryGetData', 4000) || [];
        let scripItems = page1;

        if (scripItems.length === 0) {
          const fb1 = await fetchSingleBsePage(1, scripCode, 'AnnGetData', 4000) || [];
          scripItems = fb1;
        }

        if (scripItems && Array.isArray(scripItems)) {
          const scripAnnouncements: any[] = [];
          for (const item of scripItems) {
            const newsId = item.NEWSID;
            if (!newsId) continue;

            const companyName = item.SLONGNAME || item.scrip_cd || sym;
            const subject = item.NEWSSUB || "No Subject";
            const details = item.HEADLINE || "";
            const scrip_cd = String(item.scrip_cd || item.SCRIP_CD || scripCode);

            const pdfLink = item.pdfLink || (item.ATTACHMENTNAME ? `https://www.bseindia.com/xml-data/corpfiling/AttachLive/${item.ATTACHMENTNAME}` : "");
            const priority = determinePriority(subject, details);

            scripAnnouncements.push({
              newsId,
              companyName,
              subject,
              details,
              pdfLink,
              scrip_cd,
              bseTime: item.News_submission_dt || item.DT_TM || item.NEWS_DT,
              priority: priority.level,
              category: priority.category,
              isWatchlist: true
            });
          }

          if (scripAnnouncements.length > 0) {
            const res = await saveAnnouncementsBatch(scripAnnouncements);
            totalSaved += (res.inserted + res.updated);
          }
        }
      }));
      // Gentle pacing delay between symbol batches
      if (i + batchSize < activeSymbols.length) {
        await new Promise(r => setTimeout(r, 250));
      }
    }

    flushLocalDiskSave();
    invalidateEnrichedCalendarCache();
    const totalInRepo = getTotalAnnouncementsCount();

    await addLog('INFO', 'BSE', `Watchlist historical sync complete: ${totalInRepo} total records in repository (+${totalSaved} filings processed across ${activeSymbols.length} active watchlist stocks)`);
    return { success: true, count: totalInRepo, newlyLoaded: totalSaved, symbolsCount: activeSymbols.length };
  } catch (err: any) {
    await addLog('ERROR', 'BSE', `Watchlist sync failed: ${err?.message || err}`);
    return { success: false, error: err?.message || String(err) };
  }
}

export async function syncSingleStockHistoricalData(symbolOrScrip: string): Promise<{ success: boolean; count: number; scripCode?: string; symbol?: string; newlyLoaded?: number; error?: string }> {
  try {
    if (!symbolOrScrip) return { success: false, count: 0, error: "Symbol or Scrip Code is required" };
    
    // Resolve scrip code dynamically
    let scripCode = getScripCodeForSymbolOrName(symbolOrScrip);
    let resolvedSym = symbolOrScrip.toUpperCase().trim();

    if (!scripCode) {
      const resolved = await resolveStockDetails(symbolOrScrip);
      if (resolved) {
        scripCode = resolved.scripCode;
        resolvedSym = resolved.symbol;
      }
    }

    if (!scripCode) {
      await addLog('WARNING', 'BSE', `Could not resolve BSE Scrip Code for "${symbolOrScrip}". Data sync will rely on general feed.`);
      return { success: false, count: 0, error: `BSE Scrip Code not found for ${symbolOrScrip}` };
    }

    await addLog('INFO', 'BSE', `Initiating live data fetch for ${resolvedSym} (BSE Scrip: ${scripCode})...`);

    // Fetch page 1 from AnnSubCategoryGetData and AnnGetData
    let totalSaved = 0;
    const page1 = await fetchSingleBsePage(1, scripCode, 'AnnSubCategoryGetData', 5000);
    let items = page1 || [];

    if (items.length === 0) {
      const fb1 = await fetchSingleBsePage(1, scripCode, 'AnnGetData', 5000);
      items = fb1 || [];
    }

    if (items && Array.isArray(items)) {
      const stockAnnouncements: any[] = [];
      for (const item of items) {
        const newsId = item.NEWSID;
        if (!newsId) continue;

        const companyName = item.SLONGNAME || item.scrip_cd || resolvedSym;
        const subject = item.NEWSSUB || "No Subject";
        const details = item.HEADLINE || "";
        const scrip_cd = String(item.scrip_cd || item.SCRIP_CD || scripCode);

        const pdfLink = item.ATTACHMENTNAME ? `https://www.bseindia.com/xml-data/corpfiling/AttachLive/${item.ATTACHMENTNAME}` : "";
        const priority = determinePriority(subject, details);

        stockAnnouncements.push({
          newsId,
          companyName,
          subject,
          details,
          pdfLink,
          scrip_cd,
          bseTime: item.News_submission_dt || item.DT_TM || item.NEWS_DT,
          priority: priority.level,
          category: priority.category,
          isWatchlist: true
        });
      }

      if (stockAnnouncements.length > 0) {
        const res = await saveAnnouncementsBatch(stockAnnouncements);
        totalSaved += (res.inserted + res.updated);
      }
    }

    flushLocalDiskSave();
    invalidateEnrichedCalendarCache();
    const totalInRepo = getTotalAnnouncementsCount();

    await addLog('INFO', 'BSE', `Synced ${totalSaved} filings for ${resolvedSym} (BSE: ${scripCode}). Total repository records: ${totalInRepo}`);
    return { success: true, count: totalInRepo, newlyLoaded: totalSaved, scripCode, symbol: resolvedSym };
  } catch (err: any) {
    await addLog('ERROR', 'BSE', `Single stock sync error for ${symbolOrScrip}: ${err.message}`);
    return { success: false, count: 0, error: err.message };
  }
}

export async function backfillRecentAnnouncements(daysBack = 4) {
  try {
    const activeSymbols = await getActiveWatchlistSymbols().catch(() => []);
    let totalIngested = 0;
    
    // Scan through dates from today backwards to daysBack
    for (let offset = 0; offset <= daysBack; offset++) {
      const dateStr = getBseISTDate(offset);
      // Fetch up to 3 pages per date (50 items each)
      for (let p = 1; p <= 3; p++) {
        const items = await fetchSingleBsePage(p, '', 'AnnSubCategoryGetData', 5000, dateStr);
        if (!items || items.length === 0) break;

        const pageAnnouncements: any[] = [];
        for (const item of items) {
          const newsId = item.NEWSID;
          if (!newsId) continue;
          if (await isAnnouncementProcessed(newsId)) continue;

          const companyName = item.SLONGNAME || item.scrip_cd || "BSE Stock";
          const subject = item.NEWSSUB || "No Subject";
          const details = item.HEADLINE || "";
          const scrip_cd = String(item.scrip_cd || item.SCRIP_CD || '');

          const isWatchlist = activeSymbols.some(sym => isSymbolMatch(companyName, subject, sym, scrip_cd));
          const pdfLink = item.ATTACHMENTNAME ? `https://www.bseindia.com/xml-data/corpfiling/AttachLive/${item.ATTACHMENTNAME}` : "";
          const priority = determinePriority(subject, details);

          pageAnnouncements.push({
            newsId,
            companyName,
            subject,
            details,
            pdfLink,
            scrip_cd,
            bseTime: item.News_submission_dt || item.DT_TM || item.NEWS_DT,
            priority: priority.level,
            category: priority.category,
            isWatchlist
          });
        }

        if (pageAnnouncements.length > 0) {
          const res = await saveAnnouncementsBatch(pageAnnouncements);
          totalIngested += (res.inserted + res.updated);
        }

        // If page has fewer than 50 items, no need to query subsequent pages for this date
        if (items.length < 50) break;
      }
    }

    if (totalIngested > 0) {
      flushLocalDiskSave();
      invalidateEnrichedCalendarCache();
      await addLog('INFO', 'BSE', `Backfilled ${totalIngested} recent announcements across last ${daysBack} days`);
    }
    return { success: true, count: totalIngested };
  } catch (err: any) {
    console.error("Backfill announcements error:", err.message);
    return { success: false, error: err.message };
  }
}



