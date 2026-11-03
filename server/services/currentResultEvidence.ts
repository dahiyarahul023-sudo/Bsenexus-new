import { hasExactScripCode } from '../../src/shared/scripMatching.js';
import { cachedResultDocumentCheck, isAmbiguousBoardOutcome } from '../../src/shared/resultFiling.js';
import { isBseFiling } from '../../src/shared/filingSource.js';
import { parseBseDate } from '../utils/helpers.js';
import { checkResultDocument } from './resultDocumentEvidence.js';
import { queueAnnouncementsBatchWrite, flushSupabaseWriteQueue } from '../database/announcementDao.js';

/** Only the last two days' ambiguous official outcomes need a bounded PDF check.
 * No year-long import, AI call, notification or user-data write belongs here. */
export function createCurrentResultVerifier(deps: {
  verify: typeof checkResultDocument;
  save: (row: any) => Promise<void>;
  now?: () => number;
  timeoutMs?: number;
}) {
  const checked = new Map<string, { at: number; proof: any }>();
  const pending = new Map<string, Promise<any>>();
  const now = deps.now || Date.now;
  const keyOf = (row: any) => `${row.scrip_cd || row.scripCode}:${row.id || row.newsId}:${row.pdfLink}`;
  return async (rows: any[]) => {
    const clock = now();
    const eligible = rows.filter(row => {
      const timestamp = parseBseDate(row.bseTime) || Number(row.bseTimestamp || 0);
      return isBseFiling(row) && hasExactScripCode(row, String(row.scrip_cd || row.scripCode || '')) && /^\d{6}$/.test(String(row.scrip_cd || row.scripCode || '')) &&
        timestamp > 0 && timestamp <= clock && timestamp >= clock - 2 * 86_400_000 &&
        isAmbiguousBoardOutcome(row) && !cachedResultDocumentCheck(row);
    }).sort((a,b) => (parseBseDate(a.bseTime)||a.bseTimestamp) - (parseBseDate(b.bseTime)||b.bseTimestamp));
    const work: Promise<any>[] = [];
    for (const row of eligible) {
      const key = keyOf(row), hit = checked.get(key);
      if (hit && clock - hit.at < (hit.proof ? 5 * 60_000 : 60_000)) continue;
      if (pending.has(key)) { work.push(pending.get(key)!); continue; }
      if (pending.size >= 2 || work.length >= 2) continue;
      const signal = AbortSignal.timeout(deps.timeoutMs ?? 6000);
      let task!: Promise<any>;
      task = (async () => {
        let proof: any = null;
        const item = { ...row, newsId: row.id || row.newsId, scrip_cd: row.scrip_cd || row.scripCode };
        // Keep the capacity reserved until the provider actually settles, even
        // when the response deadline wins against a non-cooperative parser.
        const verification = Promise.resolve().then(() => deps.verify(item, { signal }));
        let onAbort: (() => void) | undefined;
        try {
          proof = await Promise.race([verification, new Promise<never>((_, reject) => {
            onAbort = () => reject(new Error('Result check timed out'));
            signal.addEventListener('abort', onAbort, { once: true });
          })]);
          if (signal.aborted) return;
          if (proof && cachedResultDocumentCheck({ ...item, resultDocumentCheck: proof })) {
            await deps.save({ ...item, resultDocumentCheck: proof });
          } else proof = null;
        } catch { /* Source failure is unverified, never a declaration. Back off. */ }
        finally {
          if (onAbort) signal.removeEventListener('abort', onAbort);
          while (checked.size >= 128) checked.delete(checked.keys().next().value!);
          checked.set(key, { at: now(), proof: signal.aborted ? null : proof });
          void verification.catch(() => {}).finally(() => {
            if (pending.get(key) === task) pending.delete(key);
          });
        }
      })();
      pending.set(key, task); work.push(task);
    }
    await Promise.allSettled(work);
    return rows.map(row => {
      const hit = checked.get(keyOf(row));
      return hit?.proof && cachedResultDocumentCheck({ ...row, resultDocumentCheck: hit.proof })
        ? { ...row, resultDocumentCheck: hit.proof } : row;
    });
  };
}
export const verifyCurrentResultFilings = createCurrentResultVerifier({
  verify: checkResultDocument,
  save: async row => {
    queueAnnouncementsBatchWrite([{ docId: row.newsId, data: { scrip_cd: row.scrip_cd, resultDocumentCheck: row.resultDocumentCheck } }]);
    await flushSupabaseWriteQueue(1500);
  },
});
