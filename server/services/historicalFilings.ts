import { cachedResultDocumentCheck, isAmbiguousBoardOutcome } from '../../src/shared/resultFiling.js';
import { checkResultDocument } from './resultDocumentEvidence.js';
import { withHttpDeadline } from '../utils/httpDeadline.js';
import { randomUUID } from 'node:crypto';
import { hasExactScripCode } from '../../src/shared/scripMatching.js';
import { saveAnnouncementsBatch, getAnnouncementsForScrip, flushLocalDiskSave, flushSupabaseWriteQueue } from '../database/announcementDao.js';
import { getSupabase, isSupabaseConfigured } from '../database/supabase.js';
import { parseBseDate, determinePriority } from '../utils/helpers.js';

export interface HistorySyncStatus {
  id: string; scripCode: string; years: number; state: 'running' | 'complete' | 'failed';
  processed: number; pages: number; unverifiedDocuments?: number; startedAt: number; updatedAt: number; error?: string;
}
const jobs = new Map<string, { status: HistorySyncStatus; promise: Promise<void> }>();
// Retain the existing calendar adapter's exchange request headers.
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Referer: 'https://www.bseindia.com/', Origin: 'https://www.bseindia.com',
  Accept: 'application/json, text/plain, */*', 'Cache-Control': 'no-cache',
};
const dateKey = (ts: number) => new Date(ts).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).replaceAll('-', '');

/** All categories, exact identity, actual requested years, paced pages and bounded ambiguous-outcome PDF checks; no PDFs are persisted. */
export async function importHistoricalFilings(scripCode: string, years: number, progress: (count: number) => void,
  dependencies: { request?: typeof fetch; save?: typeof saveAnnouncementsBatch; confirm?: (ids: string[]) => Promise<void>; pause?: () => Promise<void>; now?: () => number; verify?: typeof checkResultDocument; existing?: () => Promise<any[]>; unverified?: () => void } = {}) {
  if (!/^\d{6}$/.test(scripCode) || !Number.isInteger(years) || years < 1 || years > 5) throw new Error('Valid BSE code and 1–5 whole years required');
  const now = (dependencies.now || Date.now)();
  const cutoff = now - years * 365.25 * 86_400_000;
  const deadline = now + 10 * 60_000;
  const request = dependencies.request || fetch;
  const save = dependencies.save || saveAnnouncementsBatch;
  const pause = dependencies.pause || (() => new Promise<void>(resolve => setTimeout(resolve, 800)));
  const proofsToConfirm = new Map<string, any>();
  const confirm = dependencies.confirm || (async (ids: string[]) => {
    if (!isSupabaseConfigured()) {
      if (process.env.NODE_ENV === 'production') throw new Error('Durable archive storage unavailable');
      flushLocalDiskSave(); return;
    }
    await flushSupabaseWriteQueue(8000);
    const { data, error } = await getSupabase().from('announcements').select('id,data').in('id', ids).abortSignal(AbortSignal.timeout(4000));
    if (error || new Set((data || []).map(row => row.id)).size !== new Set(ids).size) throw new Error('Archive storage confirmation pending; retry to verify saved records');
    for (const row of data || []) {
      const expected = proofsToConfirm.get(row.id);
      if (expected && (row.data?.resultDocumentCheck?.documentSha256 !== expected.documentSha256 ||
          row.data?.resultDocumentCheck?.checkedAt !== expected.checkedAt || row.data?.resultDocumentCheck?.excerpt !== expected.excerpt))
        throw new Error('Result evidence storage confirmation pending; retry sync');
    }
  });
  const existing = new Map((await (dependencies.existing || (() => getAnnouncementsForScrip(scripCode)))()).map(item => [String(item.id || item.newsId), item]));
  let documentChecks = 0;
  const seen = new Set<string>();
  let firstRequest = true;
  // Six-month windows respect the existing exchange archive date limits.
  for (let from = cutoff; from <= now;) {
    const to = Math.min(now, from + 179 * 86_400_000);
    let previousPage = '';
    let cumulativeRows = 0;
    for (let page = 1;; page++) {
      if ((dependencies.now || Date.now)() > deadline) throw new Error('Archive time budget reached; saved pages remain available. Retry the requested period.');
      if (!firstRequest) await pause();
      firstRequest = false;
      const params = new URLSearchParams({ pageno: String(page), strCat: '-1', strPrevDate: dateKey(from),
        strScrip: scripCode, strSearch: 'P', strToDate: dateKey(to), strType: 'C' });
      const text = await withHttpDeadline(async signal => {
        const response = await request(`https://api.bseindia.com/BseIndiaAPI/api/AnnSubCategoryGetData/w?${params}`, { headers, signal });
        if (!response.ok) throw new Error(`BSE archive unavailable (HTTP ${response.status}); saved pages remain available`);
        return response.text();
      }, 9000);
      let body: any;
      try { body = JSON.parse(text); } catch { throw new Error('BSE archive returned an unreadable response'); }
      const rows = Array.isArray(body?.Table) ? body.Table : Array.isArray(body) ? body : null;
      if (!rows) throw new Error('BSE archive response could not be verified');
      progress(0);
      if (!rows.length) break;
      if (rows.every((row: any) => !hasExactScripCode(row, scripCode))) throw new Error('BSE archive returned another security; saved pages remain available');
      const signature = rows.map((row: any) => row.NEWSID).join('|');
      if (signature === previousPage || page > 1000) throw new Error('BSE archive pagination stalled; saved pages remain available');
      previousPage = signature;
      const items = rows.flatMap((row: any) => {
        const id = String(row.NEWSID || '');
        if (!id || !hasExactScripCode(row, scripCode) || seen.has(id)) return [];
        const rawTime = row.News_submission_dt || row.DT_TM || row.NEWS_DT;
        const ts = parseBseDate(rawTime);
        if (!ts) throw new Error('A BSE archive publication date could not be verified');
        if (ts < cutoff || ts > now) return [];
        seen.add(id);
        const subject = row.NEWSSUB || 'Exchange disclosure', details = row.HEADLINE || '';
        const priority = determinePriority(subject, details);
        return [{ newsId: id, scrip_cd: scripCode, companyName: row.SLONGNAME || '', subject, details,
          bseTime: rawTime, pdfLink: row.ATTACHMENTNAME ? `https://www.bseindia.com/xml-data/corpfiling/AttachLive/${row.ATTACHMENTNAME}` : '',
          priority: priority.level, category: priority.category, isWatchlist: true }];
      });
      if (items.length) {
        for (const item of items) {
          if (!isAmbiguousBoardOutcome(item)) continue;
          const proof = cachedResultDocumentCheck({ ...item, resultDocumentCheck: existing.get(item.newsId)?.resultDocumentCheck });
          if (proof) { Object.assign(item, { resultDocumentCheck: proof }); continue; }
          if (documentChecks >= 16 * years || (dependencies.now || Date.now)() > deadline - 20000) {
            dependencies.unverified?.(); continue;
          }
          documentChecks++;
          try {
            const evidence = await (dependencies.verify || checkResultDocument)(item);
            if (evidence) Object.assign(item, { resultDocumentCheck: evidence });
            else dependencies.unverified?.();
          } catch { dependencies.unverified?.(); }
        }
        for (const item of items) { const proof = cachedResultDocumentCheck(item); if (proof) proofsToConfirm.set(item.newsId, proof); }
        await save(items);
        await confirm(items.map((item: any) => item.newsId));
        progress(items.length);
      }
      cumulativeRows += rows.length;
      const total = Number(body?.Table1?.[0]?.ROWCNT ?? body?.Table1?.[0]?.TOTALRECORDS);
      if (Number.isFinite(total) && total > 0 && cumulativeRows >= total) break;
      if (rows.length < 50) break;
      // An explicit empty next page is required when no reliable total is supplied.
    }
    if (to === now) break;
    from = to + 86_400_000;
  }
}

export function startHistorySync(scripCode: string, years: number): HistorySyncStatus {
  if (!/^\d{6}$/.test(scripCode) || !Number.isInteger(years) || years < 1 || years > 5) throw new Error('Valid BSE code and 1–5 whole years required');
  const now = Date.now(), key = `${scripCode}:${years}`;
  for (const [id, job] of jobs) if (job.status.state !== 'running' && now - job.status.updatedAt > 3600_000) jobs.delete(id);
  const existing = jobs.get(key);
  if (existing && (existing.status.state === 'running' || (existing.status.state === 'complete' && now - existing.status.updatedAt < 60_000))) return { ...existing.status };
  if ([...jobs.values()].filter(job => job.status.state === 'running').length >= 2) throw new Error('Archive workers busy; please retry shortly');
  const status: HistorySyncStatus = { id: randomUUID(), scripCode, years, state: 'running', processed: 0, pages: 0, startedAt: now, updatedAt: now };
  const job = { status, promise: Promise.resolve() };
  jobs.set(key, job);
  job.promise = importHistoricalFilings(scripCode, years, count => {
    if (count === 0) status.pages++; else status.processed += count;
    status.updatedAt = Date.now();
  }, { unverified: () => { status.unverifiedDocuments = (status.unverifiedDocuments || 0) + 1; } }).then(async () => {
    const { invalidateEnrichedCalendarCache } = await import('./resultsCalendarService.js');
    invalidateEnrichedCalendarCache();
    flushLocalDiskSave();
    status.state = 'complete';
  }).catch((error: Error) => {
    status.state = 'failed'; status.error = error.message;
  }).finally(() => { status.updatedAt = Date.now(); });
  return { ...status };
}
export function historySyncStatus(scripCode: string, years: number, id?: string): HistorySyncStatus | null {
  const status = jobs.get(`${scripCode}:${years}`)?.status;
  return status && (!id || status.id === id) ? { ...status } : null;
}
export async function waitHistorySync(scripCode: string, years: number): Promise<HistorySyncStatus> {
  startHistorySync(scripCode, years);
  await jobs.get(`${scripCode}:${years}`)!.promise;
  return historySyncStatus(scripCode, years)!;
}
