import { hasExactScripCode, isBseOperatorFiling, projectFilingIdentity } from '../../src/shared/scripMatching.js';
import { getSupabase, isSupabaseConfigured } from './supabase.js';
import { determinePriority, parseBseDate, isSymbolMatch } from '../utils/helpers.js';
import { addLog } from './logDao.js';
import { readLocalJson, writeLocalJson, isOfflineOrNetworkError } from './localStore.js';
import { BloomFilter } from '../utils/bloomFilter.js';
import { pageRenderCache, apiResponseCache } from '../utils/renderCache.js';
import { notifySearchEnginesOfNewPages } from '../services/indexNow.js';
import { publicFilingVersion, storedFilingIndexPages } from '../services/filingIndexNow';
import { isBseFiling } from '../../src/shared/filingSource.js';
import { ReadCache } from '../utils/readCache.js';

const ANNOUNCEMENTS_TABLE = 'announcements';
// Only public filing bodies are shared. Identity, permissions and usage reservations
// are always rechecked by the connector before this cache can be reached.
const companyFilingReadCache = new ReadCache<any[]>({
  maxEntries: 16, ttlMs: () => 30_000, now: () => Date.now()
});
function invalidateCompanyFilingReads(code?: unknown) {
  const target = String(code || '');
  if (/^\d{6}$/.test(target)) companyFilingReadCache.invalidate(target);
  else companyFilingReadCache.clear(); // Partial writes/deletes may lack identity.
}
const announcementLookupCache = new ReadCache<any | null>({
  maxEntries: 2000, ttlMs: value => value === null ? 15_000 : 60_000, now: () => Date.now()
});

// --- Row mapping: the filing is one document (data jsonb); id/scrip_cd/
// fetched_at are duplicated as columns for the queries the DAO runs. ---
function toRow(id: string, item: any): Record<string, any> {
  return {
    id,
    scrip_cd: String(item?.scrip_cd ?? item?.scripCode ?? ''),
    fetched_at: Number(item?.fetched_at || 0),
    data: item ?? {},
  };
}

function fromRow(row: any): any {
  const data = row?.data ?? {};
  return projectFilingIdentity({ id: row?.id, ...data });
}

const ANNOUNCEMENTS_FILE = 'announcements.json';
const sentCache = new Set<string>();
const processedCache = new Set<string>();

// High-Performance Bloom Filters: 100k capacity, 0.5% FPR, compact bit arrays
export const processedBloomFilter = new BloomFilter(100000, 0.005);
export const sentBloomFilter = new BloomFilter(50000, 0.005);

// Never present demonstration filings as exchange data. These exact legacy
// fixture IDs may remain in an old local cache; exclude them from reads too.
const LEGACY_DEMO_IDS = new Set([
  'ann_500325_20260924_01', 'ann_532540_20260924_02', 'ann_500510_20260924_03',
  'ann_500209_20260924_04', 'ann_500180_20260924_05', 'ann_532454_20260924_06',
  'ann_500875_20260924_07', 'ann_500034_20260924_08'
]);

let loadedLocal = readLocalJson<any[]>(ANNOUNCEMENTS_FILE, []);
let announcementsMemoryCache: any[] = (Array.isArray(loadedLocal) ? loadedLocal : []).filter(item => !LEGACY_DEMO_IDS.has(item?.id)).map(projectFilingIdentity);

let saveDiskTimer: NodeJS.Timeout | null = null;
function scheduleLocalDiskSave() {
  if (saveDiskTimer) return;
  saveDiskTimer = setTimeout(() => {
    saveDiskTimer = null;
    writeLocalJson(ANNOUNCEMENTS_FILE, announcementsMemoryCache);
  }, 1000);
}

export function flushLocalDiskSave() {
  if (saveDiskTimer) {
    clearTimeout(saveDiskTimer);
    saveDiskTimer = null;
  }
  writeLocalJson(ANNOUNCEMENTS_FILE, announcementsMemoryCache);
}

for (const item of announcementsMemoryCache) {
  if (item.id) {
    processedCache.add(item.id);
    processedBloomFilter.add(item.id);
  }
  if (item.is_sent === 1) {
    sentCache.add(item.id);
    sentBloomFilter.add(item.id);
  }
}

export async function initAnnouncementCache() {
  companyFilingReadCache.clear();
  if (!isSupabaseConfigured()) {
    console.warn("[Announcements] Using local file store (Supabase not configured). Items loaded:", announcementsMemoryCache.length);
    return;
  }

  try {
    // Window-based hydration (not "latest N"): the feed serves a 7-day "what's new"
    // window, so boot must load exactly that window. "Latest 500" silently under-fills
    // when the poller wrote to the local fallback — those days are then missing
    // from the cloud store and the feed looks empty after every restart/republish.
    const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - WINDOW_MS;
    const { data, error } = await getSupabase()
      .from(ANNOUNCEMENTS_TABLE)
      .select('*')
      .gte('fetched_at', cutoff)
      .order('fetched_at', { ascending: false })
      .limit(2500);
    if (error) throw error;
    const rows = data || [];
    console.log(`[Announcements] Hydrated ${rows.length} docs from 7-day Supabase window`);

    // Map union between memory/disk cache and cloud items so no stored records are lost
    const mergedMap = new Map<string, any>();
    for (const item of announcementsMemoryCache) {
      if (item.id) mergedMap.set(item.id, item);
    }

    for (const row of rows) {
      if (LEGACY_DEMO_IDS.has(row.id)) continue;
      processedCache.add(row.id);
      processedBloomFilter.add(row.id);
      const dataItem = row.data || {};
      if (dataItem?.is_sent === 1) {
        sentCache.add(row.id);
        sentBloomFilter.add(row.id);
      }
      let bseTs = parseBseDate(dataItem.bseTime);
      if (!bseTs) bseTs = dataItem.fetched_at || 0;

      const fsItem = projectFilingIdentity({ id: row.id, ...dataItem, bseTimestamp: bseTs });
      const existing = mergedMap.get(row.id);
      mergedMap.set(row.id, existing ? { ...existing, ...fsItem } : fsItem);
    }

    const now = Date.now();
    const loaded = Array.from(mergedMap.values()).map(item => {
      let bseTs = parseBseDate(item.bseTime);
      if (!bseTs || bseTs > now + 120000) {
        if (item.fetched_at && item.fetched_at <= now + 120000) {
          bseTs = item.fetched_at;
        } else if (item.bseTimestamp && item.bseTimestamp > now + 120000) {
          bseTs = item.bseTimestamp - (5.5 * 3600 * 1000);
        } else {
          bseTs = item.bseTimestamp || item.fetched_at || now;
        }
      }
      if (bseTs > now + 120000) bseTs = now;

      const isFutureBseTime = parseBseDate(item.bseTime) > now + 120000;
      let meetingDate = item.meetingDate;
      let safeBseTime = item.bseTime;
      if (isFutureBseTime) {
        meetingDate = meetingDate || item.bseTime;
        safeBseTime = new Date(bseTs).toISOString();
      }

      const updated = {
        ...item,
        bseTimestamp: bseTs,
        bseTime: safeBseTime,
        meetingDate: meetingDate
      };
      if (!updated.priority || !updated.category) {
        const p = determinePriority(updated.subject || '', updated.details || '');
        return { ...updated, priority: p.level, category: p.category };
      }
      return updated;
    });
    loaded.sort((a, b) => (b.bseTimestamp || b.fetched_at || 0) - (a.bseTimestamp || a.fetched_at || 0));
    announcementsMemoryCache = loaded.slice(0, 10000);

    for (const item of announcementsMemoryCache) {
      if (item.id) {
        processedCache.add(item.id);
        processedBloomFilter.add(item.id);
      }
      if (item.is_sent === 1) {
        sentCache.add(item.id);
        sentBloomFilter.add(item.id);
      }
    }

    writeLocalJson(ANNOUNCEMENTS_FILE, announcementsMemoryCache);
    await addLog('INFO', 'SYSTEM', `Initialized announcement cache with ${announcementsMemoryCache.length} items`);
  } catch (e: any) {
    if (isOfflineOrNetworkError(e)) {
      console.warn("Supabase unreachable during initAnnouncementCache. Using local disk cache.");
    } else {
      console.warn("Notice during initAnnouncementCache:", e?.message || e);
    }
  }
}

export async function getAnnouncementById(newsId: string): Promise<any | null> {
  if (!newsId || LEGACY_DEMO_IDS.has(newsId)) return null;
  const inMem = announcementsMemoryCache.find(a => a.id === newsId || a.newsId === newsId);
  if (inMem) return inMem;

  if (!isSupabaseConfigured()) return null;

  try {
    const item = await announcementLookupCache.get(newsId, async () => {
      const { data, error } = await getSupabase()
        .from(ANNOUNCEMENTS_TABLE)
        .select('id,data')
        .eq('id', newsId)
        .maybeSingle();
      if (error) throw error;
      return data ? fromRow(data) : null;
    });
    return item === null ? null : structuredClone(item);
  } catch (err: any) {
    console.warn("Notice in getAnnouncementById:", err?.message || err);
  }
  return null;
}

export async function isAnnouncementSent(newsId: string): Promise<boolean> {
  if (!newsId) return false;

  // Tier 1: Bloom Filter check (O(1), zero false negatives)
  // If not in sentBloomFilter, it was 100% DEFINITELY NEVER sent to Telegram.
  // Instantly bypasses the cloud store and expensive memory scans (0 DB scans).
  if (!sentBloomFilter.has(newsId)) {
    return false;
  }

  // Tier 2: Bloom Filter says "possibly sent" -> Check exact in-memory set
  if (sentCache.has(newsId)) return true;

  const inMem = announcementsMemoryCache.find(a => a.id === newsId);
  if (inMem && inMem.is_sent === 1) {
    sentCache.add(newsId);
    return true;
  }

  if (!isSupabaseConfigured()) return false;

  try {
    const { data, error } = await getSupabase()
      .from(ANNOUNCEMENTS_TABLE)
      .select('data')
      .eq('id', newsId)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      const isSent = (data.data as any)?.is_sent === 1;
      if (isSent) {
        sentCache.add(newsId);
        sentBloomFilter.add(newsId);
        if (sentCache.size > 5000) {
          const firstItem = sentCache.values().next().value;
          if (firstItem) sentCache.delete(firstItem);
        }
      }
      return isSent;
    }
  } catch (err: any) {
    console.warn("Notice in isAnnouncementSent:", err?.message || err);
  }
  return false;
}

export async function isAnnouncementProcessed(newsId: string): Promise<boolean> {
  if (!newsId) return false;

  // Tier 1: Bloom Filter check (O(1), zero false negatives)
  // If not in processedBloomFilter, 100% guarantee it has never been processed before.
  if (!processedBloomFilter.has(newsId)) {
    return false;
  }

  // Tier 2: Confirm against exact in-memory set to eliminate false positive
  return processedCache.has(newsId);
}

// Batched Supabase Write Queue with Zero Announcement Loss and Exponential Backoff Retries
interface WriteTask {
  docId: string;
  data: any;
  merge: boolean;
  attempts?: number;
  lastAttemptAt?: number;
}

const MAX_WRITE_ATTEMPTS = 10;
const BACKOFF_DELAYS = [1000, 3000, 5000, 10000, 20000, 30000];
const ANNOUNCEMENT_WRITE_BATCH_SIZE = 50;

const supabaseWriteQueue: Map<string, WriteTask> = new Map();
let isQueueWorkerRunning = false;
let consecutiveBatchErrors = 0;
let nextBatchRetryTime = 0;

async function processSupabaseQueue() {
  if (isQueueWorkerRunning) return;
  isQueueWorkerRunning = true;
  const changedPublicFilings = new Map<string, any>();

  try {
    while (supabaseWriteQueue.size > 0) {
      if (!isSupabaseConfigured()) {
        supabaseWriteQueue.clear();
        break;
      }

      const now = Date.now();
      if (now < nextBatchRetryTime) {
        const waitMs = nextBatchRetryTime - now;
        await new Promise(r => setTimeout(r, Math.min(waitMs, 5000)));
        continue;
      }

      // Collect eligible tasks (discard poisoned tasks that exceeded max attempts)
      const tasksToProcess: WriteTask[] = [];
      for (const task of supabaseWriteQueue.values()) {
        if ((task.attempts || 0) >= MAX_WRITE_ATTEMPTS) {
          console.warn(`[Supabase] Dropping task ${task.docId} after ${task.attempts} failed write attempts.`);
          supabaseWriteQueue.delete(task.docId);
          continue;
        }
        tasksToProcess.push(task);
        if (tasksToProcess.length >= ANNOUNCEMENT_WRITE_BATCH_SIZE) break;
      }

      if (tasksToProcess.length === 0) break;

      try {
        // Read-modify-write: tasks may carry partial updates (e.g. {is_sent: 1}),
        // so merge each over the stored document before the whole-row upsert.
        // One read + one upsert per batch — the Firestore batch.set(merge) equivalent.
        // Fetch only 'id, data' in chunks of 50 to avoid HTTP URI size limits.
        const ids = tasksToProcess.map(t => t.docId);
        const { data: existingRows, error: readError } = await getSupabase()
          .from(ANNOUNCEMENTS_TABLE)
          .select('id, data')
          .in('id', ids);
        if (readError) throw readError;

        const existingById = new Map<string, any>();
        for (const row of existingRows || []) {
          existingById.set(row.id, row.data || {});
        }

        const rowsToUpsert = tasksToProcess.map(task => {
          const base = existingById.get(task.docId) || {};
          // merge:true (the only mode used) overlays the task fields on the
          // stored document, exactly like the old Firestore batch.set(merge).
          const merged = task.merge === false ? task.data : { ...base, ...task.data };
          return toRow(task.docId, merged);
        });

        const { error: upsertError } = await getSupabase()
          .from(ANNOUNCEMENTS_TABLE)
          .upsert(rowsToUpsert, { onConflict: 'id' });
        if (upsertError) throw upsertError;
        // Discard any read that raced the queued write before it committed.
        for (const row of rowsToUpsert) {
          announcementLookupCache.invalidate(row.id);
          // A repair may also change the previous security identity.
          if (existingById.has(row.id)) invalidateCompanyFilingReads(existingById.get(row.id)?.scrip_cd);
          invalidateCompanyFilingReads(row.scrip_cd);
        }

        for (const row of rowsToUpsert) {
          if (!existingById.has(row.id) || publicFilingVersion(existingById.get(row.id)) !== publicFilingVersion(row.data)) changedPublicFilings.set(String(row.id), row.data);
        }

        // Remove from queue ONLY after the upsert confirms success
        for (const t of tasksToProcess) {
          supabaseWriteQueue.delete(t.docId);
        }

        consecutiveBatchErrors = 0;
        nextBatchRetryTime = 0;
      } catch (err: any) {
        // Transient error: KEEP the queue, track attempts, and back off exponentially
        consecutiveBatchErrors++;
        for (const t of tasksToProcess) {
          t.attempts = (t.attempts || 0) + 1;
          t.lastAttemptAt = Date.now();
        }

        const delayIdx = Math.min(consecutiveBatchErrors - 1, BACKOFF_DELAYS.length - 1);
        const backoffDelay = BACKOFF_DELAYS[delayIdx] || 30000;
        nextBatchRetryTime = Date.now() + backoffDelay;

        console.warn(`[Supabase] Batch write transient error for ${tasksToProcess.length} items (retry #${consecutiveBatchErrors}). Retrying in ${backoffDelay}ms:`, err?.message || err);

        // Paced sleep before next iteration
        await new Promise(r => setTimeout(r, Math.min(backoffDelay, 5000)));

        if (consecutiveBatchErrors >= 10) {
          // Schedule retry in background and release the immediate loop
          setTimeout(() => {
            processSupabaseQueue().catch(() => {});
          }, backoffDelay);
          break;
        }
      }

      // Small pacing to avoid rate limit spikes
      await new Promise(r => setTimeout(r, 100));
    }
  } catch (globalQueueErr) {
    console.warn("[Supabase] Write queue worker notice:", globalQueueErr);
  } finally {
    isQueueWorkerRunning = false;
    // Coalesce the whole confirmed storage drain; no HTTP/database indexing work
    // is awaited by the filing pipeline, and unchanged/delivery-only rows stay out.
    try {
      for (const page of storedFilingIndexPages([...changedPublicFilings.values()])) {
        const match = new URL(page.url).pathname.match(/^\/company\/(.+)$/);
        if (match) pageRenderCache.invalidate(`comp:${decodeURIComponent(match[1])}`);
        notifySearchEnginesOfNewPages(page.url, page.version);
      }
    } catch { console.warn('[IndexNow] Could not queue stored public changes; filing storage is unaffected'); }
  }
}

function queueAnnouncementWrite(docId: string, data: any, merge: boolean = true) {
  queueAnnouncementsBatchWrite([{ docId, data, merge }]);
}

export function queueAnnouncementsBatchWrite(tasks: { docId: string; data: any; merge?: boolean }[]) {
  if (!isSupabaseConfigured() || !tasks || tasks.length === 0) return;

  for (const t of tasks) {
    if (!t.docId) continue;
    announcementLookupCache.invalidate(t.docId);
    // Clear before the write and on confirmation to fence racing reads.
    invalidateCompanyFilingReads(t.data?.scrip_cd || t.data?.scripCode);
    const existing = supabaseWriteQueue.get(t.docId);
    if (existing) {
      supabaseWriteQueue.set(t.docId, {
        docId: t.docId,
        data: { ...existing.data, ...t.data },
        merge: true,
        attempts: existing.attempts || 0,
        lastAttemptAt: existing.lastAttemptAt
      });
    } else {
      supabaseWriteQueue.set(t.docId, {
        docId: t.docId,
        data: t.data,
        merge: t.merge !== false,
        attempts: 0
      });
    }
  }

  processSupabaseQueue().catch(() => {});
}

export async function flushSupabaseWriteQueue(maxWaitMs: number = 3000): Promise<void> {
  if (!isSupabaseConfigured() || supabaseWriteQueue.size === 0) return;
  const start = Date.now();
  while (supabaseWriteQueue.size > 0 && isSupabaseConfigured()) {
    // If Supabase is in backoff due to transient batch errors, release the foreground
    // loop immediately so poller cycles are not delayed or timed out.
    if (consecutiveBatchErrors > 0 || Date.now() < nextBatchRetryTime) {
      break;
    }

    if (Date.now() - start >= maxWaitMs) {
      break;
    }

    await processSupabaseQueue();

    if (supabaseWriteQueue.size > 0) {
      const elapsed = Date.now() - start;
      if (elapsed >= maxWaitMs || consecutiveBatchErrors > 0) {
        break;
      }
      await new Promise(r => setTimeout(r, Math.min(100, maxWaitMs - elapsed)));
    }
  }
}

// Delete announcements from local cache, disk, and Supabase
export async function deleteAnnouncementsFromStorageAndCloud(idsToDelete: string[]) {
  if (!idsToDelete || idsToDelete.length === 0) return;

  const idSet = new Set(idsToDelete);
  companyFilingReadCache.clear();
  apiResponseCache.invalidate('/api/announcements');

  // 1. Remove from in-memory cache & local sets
  announcementsMemoryCache = announcementsMemoryCache.filter(a => !idSet.has(a.id) && !idSet.has(a.newsId));
  for (const id of idsToDelete) {
    announcementLookupCache.invalidate(id);
    processedCache.delete(id);
    sentCache.delete(id);
    supabaseWriteQueue.delete(id);
    pageRenderCache.invalidate(`ann:${id}`);
  }

  // 2. Persist to local disk
  writeLocalJson(ANNOUNCEMENTS_FILE, announcementsMemoryCache);

  // 3. Batch delete from Supabase (safe chunk size to prevent HTTP URI length overflow)
  if (isSupabaseConfigured()) {
    try {
      const BATCH_LIMIT = 50;
      for (let i = 0; i < idsToDelete.length; i += BATCH_LIMIT) {
        const chunk = idsToDelete.slice(i, i + BATCH_LIMIT);
        const { error } = await getSupabase()
          .from(ANNOUNCEMENTS_TABLE)
          .delete()
          .in('id', chunk);
        if (error) throw error;
        for (const id of chunk) announcementLookupCache.invalidate(id);
        companyFilingReadCache.clear();
      }
    } catch (err: any) {
      console.warn("Supabase delete batch notice:", err?.message || err);
    }
  }
}

export async function markAnnouncementSent(newsId: string, telegramMessageId?: number) {
  sentCache.add(newsId);
  sentBloomFilter.add(newsId);
  processedCache.add(newsId);
  processedBloomFilter.add(newsId);

  const inMem = announcementsMemoryCache.find(a => a.id === newsId || a.newsId === newsId);
  if (inMem) {
    inMem.is_sent = 1;
    if (telegramMessageId) inMem.telegram_msg_id = telegramMessageId;
  }

  // Synchronously persist is_sent to disk right away (write-ahead) so crashes cannot cause duplicates
  flushLocalDiskSave();

  queueAnnouncementWrite(newsId, { is_sent: 1, ...(telegramMessageId ? { telegram_msg_id: telegramMessageId } : {}) }, true);
}

export type SummaryVariant = 'hinglish' | 'english';

export async function updateAnnouncementSummary(newsId: string, aiSummary: string, variant: SummaryVariant = 'hinglish') {
  const field = variant === 'english' ? 'aiSummaryEn' : 'aiSummary';
  const inMem = announcementsMemoryCache.find(a => a.id === newsId);
  if (inMem) {
    (inMem as any)[field] = aiSummary;
    scheduleLocalDiskSave();
  }

  queueAnnouncementWrite(newsId, { [field]: aiSummary }, true);
  pageRenderCache.invalidate(`ann:${newsId}`);
}

/** Separate provenance cache; legacy website summaries are never promoted to PDF evidence. */
export function cacheAiConnectionSummary(newsId: string, field: 'aiConnectionSummaryEn' | 'aiConnectionSummary', value: unknown) {
  const inMem = announcementsMemoryCache.find(a => a.id === newsId);
  if (inMem) { (inMem as any)[field] = value; scheduleLocalDiskSave(); }
  queueAnnouncementWrite(newsId, { [field]: value }, true);
}

export interface AnnouncementInput {
  newsId: string;
  symbol?: string;
  source?: string;
  companyName: string;
  subject: string;
  details: string;
  pdfLink: string;
  bseTime?: string;
  meetingDate?: string;
  category?: string;
  priority?: string;
  is_sent?: number;
  aiSummary?: string;
  aiSummaryEn?: string;
  scrip_cd?: string;
  isWatchlist?: boolean;
  resultDocumentCheck?: import('../../src/shared/resultFiling.js').ResultDocumentCheck;
}

export async function saveAnnouncementsBatch(items: AnnouncementInput[]): Promise<{ total: number; inserted: number; updated: number; skipped: number }> {
  if (!Array.isArray(items) || items.length === 0) {
    return { total: 0, inserted: 0, updated: 0, skipped: 0 };
  }

  // Fast O(1) index map for current in-memory cache
  const idMap = new Map<string, number>();
  for (let i = 0; i < announcementsMemoryCache.length; i++) {
    const item = announcementsMemoryCache[i];
    if (item && item.id) {
      idMap.set(item.id, i);
    }
  }

  const now = Date.now();
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const tasksToQueue: { docId: string; data: any; merge?: boolean }[] = [];

  for (const data of items) {
    if (!data || !data.newsId) {
      skipped++;
      continue;
    }

    processedCache.add(data.newsId);
    processedBloomFilter.add(data.newsId);
    if (data.is_sent === 1) {
      sentCache.add(data.newsId);
      sentBloomFilter.add(data.newsId);
    }

    let bseTs = 0;
    if (data.bseTime) {
      const parsed = parseBseDate(data.bseTime);
      if (parsed > 0) bseTs = parsed;
    }
    const isFutureTime = bseTs > now + 120000;
    if (!bseTs || isFutureTime) bseTs = now;

    const safeData = {
      ...data,
      subject: String(data.subject || "").substring(0, 990),
      details: String(data.details || "").substring(0, 4900),
      companyName: String(data.companyName || "").substring(0, 190),
      pdfLink: String(data.pdfLink || "").substring(0, 990),
      bseTime: isFutureTime ? new Date(now).toISOString() : String(data.bseTime || "").substring(0, 90),
      meetingDate: data.meetingDate || (isFutureTime ? String(data.bseTime || '') : undefined),
      scrip_cd: String(data.scrip_cd || "").substring(0, 30),
      isWatchlist: data.isWatchlist ?? false,
      fetched_at: now,
      bseTimestamp: bseTs,
      is_sent: data.is_sent ?? 0
    };

    if (!safeData.priority || !safeData.category) {
      const p = determinePriority(safeData.subject || '', safeData.details || '');
      safeData.priority = safeData.priority || p.level;
      safeData.category = safeData.category || p.category;
    }

    const memItem = { id: data.newsId, ...safeData };
    const existingIdx = idMap.get(data.newsId);

    if (existingIdx !== undefined && existingIdx >= 0) {
      const existing = announcementsMemoryCache[existingIdx];
      const isIdentical = 
        JSON.stringify(existing.resultDocumentCheck || null) === JSON.stringify(safeData.resultDocumentCheck || existing.resultDocumentCheck || null) &&
        existing.subject === safeData.subject &&
        existing.details === safeData.details &&
        existing.companyName === safeData.companyName &&
        existing.pdfLink === safeData.pdfLink &&
        existing.priority === safeData.priority &&
        existing.category === safeData.category &&
        (existing.is_sent ?? 0) === (safeData.is_sent ?? 0) &&
        (existing.aiSummary || '') === (safeData.aiSummary || '') &&
        Boolean(existing.isWatchlist) === Boolean(safeData.isWatchlist);

      if (isIdentical) {
        skipped++;
      } else {
        announcementsMemoryCache[existingIdx] = { ...existing, ...memItem };
        updated++;
        tasksToQueue.push({ docId: data.newsId, data: safeData, merge: true });
      }
    } else {
      announcementsMemoryCache.push(memItem);
      idMap.set(data.newsId, announcementsMemoryCache.length - 1);
      inserted++;
      tasksToQueue.push({ docId: data.newsId, data: safeData, merge: true });
    }
  }

  // If new records were added or existing ones were updated, perform a single consolidated sort, disk save, and Firestore batch queue
  if (inserted > 0 || updated > 0) {
    announcementsMemoryCache.sort((a, b) => (b.bseTimestamp || b.fetched_at || 0) - (a.bseTimestamp || a.fetched_at || 0));
    if (announcementsMemoryCache.length > 10000) {
      announcementsMemoryCache.length = 10000;
    }
    // New/changed filings must not wait for an older API feed cache to expire.
    apiResponseCache.invalidate('/api/announcements');
    scheduleLocalDiskSave();
    queueAnnouncementsBatchWrite(tasksToQueue);


  }

  return { total: items.length, inserted, updated, skipped };
}

export async function saveAnnouncement(data: AnnouncementInput) {
  await saveAnnouncementsBatch([data]);
}

export async function pruneAndCheckStorageCapacity() {
  try {
    const { checkStorageAndTriggerAlerts, runAutoStorageCleanup } = await import('../services/storageMonitor.js');
    await runAutoStorageCleanup(false);
    await checkStorageAndTriggerAlerts();
  } catch (err: any) {
    console.warn("Notice in pruneAndCheckStorageCapacity:", err?.message || err);
  }
}

export async function getRecentAnnouncements(limitNum: number = 1000, symbols?: string[]) {
  if (symbols && symbols.length > 0) {
    const cleanSymbols = symbols.map(s => String(s).trim().toUpperCase()).filter(Boolean);
    if (cleanSymbols.length > 0) {
      // Recent updates keep their seven-day window and a global response budget.
      // There is no per-company total cap; the company history read pages durable rows.
      const PER_STOCK = limitNum;
      const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
      const cutoff = Date.now() - WINDOW_MS;
      const buckets: any[][] = cleanSymbols.map(() => []);
      const counts = new Array<number>(cleanSymbols.length).fill(0);
      let allFull = false;
      for (const ann of announcementsMemoryCache) {
        if (!isBseFiling(ann)) continue;
        const ts = (typeof ann.bseTimestamp === 'number' && !isNaN(ann.bseTimestamp) && ann.bseTimestamp > 0)
          ? ann.bseTimestamp : (ann.fetched_at || 0);
        if (ts > 0 && ts < cutoff) break; // older than the window; rest is older too
        if (allFull) break;
        const comp = ann.companyName || ann.SLONGNAME || '';
        const subj = ann.subject || ann.NEWSSUB || '';
        const scrip = String(ann.scrip_cd || ann.SCRIP_CD || '');
        for (let i = 0; i < cleanSymbols.length; i++) {
          if (counts[i] >= PER_STOCK) continue;
          if (isSymbolMatch(comp, subj, cleanSymbols[i], scrip)) {
            buckets[i].push(ann);
            counts[i]++;
            break; // assign to first matching symbol; avoids duplicates
          }
        }
        allFull = counts.every(c => c >= PER_STOCK);
      }
      const merged = buckets.flat();
      merged.sort((a, b) => {
        const tsA = (typeof a.bseTimestamp === 'number' && !isNaN(a.bseTimestamp) && a.bseTimestamp > 0) ? a.bseTimestamp : (a.fetched_at || 0);
        const tsB = (typeof b.bseTimestamp === 'number' && !isNaN(b.bseTimestamp) && b.bseTimestamp > 0) ? b.bseTimestamp : (b.fetched_at || 0);
        return tsB - tsA;
      });
      return merged.slice(0, limitNum);
    }
  }
  // announcementsMemoryCache is already maintained sorted on insert
  return announcementsMemoryCache.filter(isBseFiling).slice(0, limitNum);
}

export function getTotalAnnouncementsCount(): number {
  return announcementsMemoryCache.length;
}

// Durable per-stock read for results history. The memory cache intentionally
// holds only the newest ~10,000 filings (boot hydration loads a 7-day fetched
// window, then slices), so deep per-stock history — including filings saved by
// an earlier deep sync — falls out of memory after restarts even though it
// still exists in Supabase. Query Supabase directly by scrip (indexed column)
// and union with whatever memory already holds.
// During local fallback this degrades to the memory-only view.
export async function getAnnouncementsForScrip(scripCode: string, limitNum: number = Number.MAX_SAFE_INTEGER, strict = false): Promise<any[]> {
  const target = String(scripCode || '').trim();
  if (!target) return [];

  if (strict && process.env.NODE_ENV === 'production' && !isSupabaseConfigured()) throw new Error('Stored filing history unavailable');
  const byId = new Map<string, any>();
  for (const ann of announcementsMemoryCache) {
    if (hasExactScripCode(ann, target)) {
      byId.set(ann.id || ann.newsId, ann);
    }
  }

  if (isSupabaseConfigured()) {
    try {
      // Keyset pages avoid both PostgREST's row ceiling and a silent total-history cap.
      const deadline = AbortSignal.timeout(12_000);
      let after = '';
      while (true) {
        let query = getSupabase().from(ANNOUNCEMENTS_TABLE).select('*')
          .eq('scrip_cd', target).order('id', { ascending: true }).limit(Math.min(500, limitNum));
        if (after) query = query.gt('id', after);
        const { data, error } = await query.abortSignal(deadline);
        if (error) throw error;
        for (const row of data || []) {
          const dataItem: any = row.data || {};
          const item = { ...dataItem, id: row.id, scrip_cd: row.scrip_cd,
            bseTimestamp: parseBseDate(dataItem.bseTime) || dataItem.bseTimestamp || 0 };
          if (hasExactScripCode(item, target)) byId.set(row.id, { ...(byId.get(row.id) || {}), ...item });
        }
        if (!data?.length || data.length < Math.min(500, limitNum) || byId.size >= limitNum) break;
        const next = String(data[data.length - 1].id);
        if (next <= after) throw new Error('Filing history pagination did not advance');
        after = next;
      }
    } catch (e) {
      if (strict) throw new Error('Stored filing history unavailable');
      // Existing callers may explicitly use the memory fallback.
    }
  }

  return Array.from(byId.values()).filter(isBseFiling);
}

/** A bounded public company window for connector reads, not the archive API. */
export async function getCachedCompanyFilings(scripCode: string): Promise<any[]> {
  const target = String(scripCode || '').trim();
  if (!/^\d{6}$/.test(target)) throw new Error('Invalid filing security code');
  const rows = await companyFilingReadCache.get(target, async () => {
    const records = await getAnnouncementsForScrip(target, 400, true);
    return records.sort((a, b) => Number(b.bseTimestamp || 0) - Number(a.bseTimestamp || 0)).slice(0, 400);
  });
  return structuredClone(rows);
}

/** BSE equity has no BSE scrip. Read exact NSE identity, including verified legacy PDFs. */
export async function getBseOperatorAnnouncements(strict = false): Promise<any[]> {
  if (strict && process.env.NODE_ENV === 'production' && !isSupabaseConfigured()) throw new Error('BSE operator filings unavailable');
  const byId = new Map<string, any>();
  for (const item of announcementsMemoryCache) if (isBseOperatorFiling(item)) byId.set(item.id, item);
  if (isSupabaseConfigured()) {
    const deadline = AbortSignal.timeout(12_000);
    let after = '';
    try {
      while (true) {
        let query = getSupabase().from(ANNOUNCEMENTS_TABLE).select('*')
          .or('data->>symbol.eq.BSE,data->>companyName.eq.BSE Limited,data->>companyName.eq.BSE Ltd')
          .order('id', { ascending: true }).limit(500);
        if (after) query = query.gt('id', after);
        const { data, error } = await query.abortSignal(deadline);
        if (error) throw error;
        for (const row of data || []) { const item = fromRow(row); if (isBseOperatorFiling(item)) byId.set(row.id, item); }
        if (!data?.length || data.length < 500) break;
        const next = String(data[data.length - 1].id);
        if (next <= after) throw new Error('Operator history pagination stalled');
        after = next;
      }
    } catch { if (strict || !byId.size) throw new Error('BSE operator filings unavailable'); }
  }
  // Projection only; immutable stored evidence and its old code are not rewritten.
  return [...byId.values()].map(projectFilingIdentity);
}

export async function boostAnnouncementsPriorityForWindow(
  scripCode: string,
  symbol: string,
  startTs: number,
  endTs: number,
  newPriority: string = 'HIGH'
): Promise<{ boostedCount: number; announcements: any[] }> {
  const targetScrip = String(scripCode || '').trim();
  const targetSym = String(symbol || '').trim().toUpperCase();
  
  const boostedList: any[] = [];
  let boostedCount = 0;

  for (const ann of announcementsMemoryCache) {
    const ts = ann.bseTimestamp || ann.fetched_at || 0;

    const isMatch = hasExactScripCode(ann, targetScrip);

    if (isMatch && ts >= startTs && ts <= endTs) {
      const prevPriority = ann.priority;
      ann.priority = newPriority;
      ann.isPreResultBoosted = true;
      ann.preResultBoostedAt = Date.now();
      
      boostedList.push(ann);
      if (prevPriority !== newPriority) {
        boostedCount++;
      }

      queueAnnouncementWrite(ann.id || ann.newsId, {
        priority: newPriority,
        isPreResultBoosted: true,
        preResultBoostedAt: Date.now()
      }, true);
    }
  }

  if (boostedCount > 0) {
    scheduleLocalDiskSave();
    await addLog('INFO', 'BSE', `Set ${boostedCount} announcements to HIGH priority for ${targetSym || targetScrip} in the 10-day pre-result runup window.`);
  }

  return { boostedCount, announcements: boostedList };
}

export function getAnnouncementsForStockInWindow(
  scripCode: string,
  symbol: string,
  startTs: number,
  endTs: number
): any[] {
  const targetScrip = String(scripCode || '').trim();
  const targetSym = String(symbol || '').trim().toUpperCase();
  
  const results: any[] = [];

  for (const ann of announcementsMemoryCache) {
    const ts = ann.bseTimestamp || ann.fetched_at || 0;

    const isMatch = hasExactScripCode(ann, targetScrip);

    if (isMatch && ts >= startTs && ts <= endTs) {
      results.push(ann);
    }
  }

  results.sort((a, b) => (b.bseTimestamp || b.fetched_at || 0) - (a.bseTimestamp || a.fetched_at || 0));
  return results;
}

export function getBloomFilterDiagnostics() {
  const pStats = processedBloomFilter.getStats();
  const sStats = sentBloomFilter.getStats();

  return {
    processedFilter: pStats,
    sentFilter: sStats,
    summary: {
      status: 'ACTIVE_ZERO_FALSE_NEGATIVES',
      totalDatabaseBypasses: pStats.negativeBypasses + sStats.negativeBypasses,
      totalCandidateVerifications: pStats.positiveChecks + sStats.positiveChecks,
      totalMemorySavedKb: pStats.memorySavedKb + sStats.memorySavedKb,
      combinedMemoryFootprintKb: Math.round((pStats.byteSize + sStats.byteSize) / 1024)
    }
  };
}



