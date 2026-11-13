import { verifyCurrentResultFilings } from './currentResultEvidence.js';
import { getSupabase, isSupabaseConfigured } from '../database/supabase.js';
import { hasExactScripCode, projectFilingIdentity } from '../../src/shared/scripMatching.js';
import { isBseFiling } from '../../src/shared/filingSource.js';
import { isVerifiedResultFiling } from '../../src/shared/resultFiling.js';
const pending = new Map<string, Promise<any[]>>();

const PAGE_TIMEOUT_MS = 12_000;
const PAGE_ATTEMPTS = 3;

/**
 * Fetch one page of stored outcome evidence. Every attempt gets its OWN
 * timeout window: previously a single 12s deadline was shared by every
 * batch and page, so during results season (many scrip codes, several
 * batches) the deadline expired mid-read and the whole evidence read was
 * reported unavailable even though the database was healthy. Attempts are
 * read-only and bounded; a page that still fails after every attempt fails
 * the read loudly, exactly as before.
 */
async function readOutcomePage(batch: string[], since: number, after: string): Promise<any[]> {
  for (let attempt = 1; ; attempt++) {
    let query = getSupabase().from('announcements').select('id,scrip_cd,data')
      .in('scrip_cd', batch).gte('fetched_at', since)
      .or('data->>category.eq.RESULTS,data->>subject.ilike.*result*,data->>subject.ilike.*outcome*')
      .order('id', { ascending: true }).limit(500);
    if (after) query = query.gt('id', after);
    const { data, error } = await query.abortSignal(AbortSignal.timeout(PAGE_TIMEOUT_MS));
    if (!error && Array.isArray(data)) return data;
    if (attempt >= PAGE_ATTEMPTS) throw new Error('Calendar outcome storage unavailable');
  }
}
/** Durable public result evidence, independent of the bounded global news cache. */
export async function readCalendarOutcomes(codes: string[], since: number): Promise<any[]> {
  const exact = [...new Set(codes.map(String).filter(code => /^\d{6}$/.test(code)))].sort();
  if (!exact.length || !Number.isFinite(since) || !isSupabaseConfigured()) return [];
  const key = `${since}:${exact.join(',')}`;
  if (pending.has(key)) return pending.get(key)!;
  const work = (async () => {
    const results: any[] = [];
    for (let offset = 0; offset < exact.length; offset += 60) {
      const batch = exact.slice(offset, offset + 60);
      let after = '', complete = false;
      for (let page = 0; page < 8; page++) {
        const data = await readOutcomePage(batch, since, after);
        for (const row of data) {
          const item = projectFilingIdentity({ ...row.data, id: row.id, scrip_cd: row.scrip_cd });
          if (batch.includes(String(row.scrip_cd)) && hasExactScripCode(item, row.scrip_cd) && isBseFiling(item)) results.push(item);
        }
        if (data.length < 500) { complete = true; break; }
        const next = String(data[data.length - 1].id);
        if (!next || next === after) break;
        after = next;
      }
      if (!complete) throw new Error('Calendar outcome coverage incomplete');
    }
    const verified = await verifyCurrentResultFilings(results);
    return verified.filter(isVerifiedResultFiling);
  })();
  pending.set(key, work);
  try { return await work; } finally { if (pending.get(key) === work) pending.delete(key); }
}
