import { getSupabase } from './supabase.js';

const PAGE_TIMEOUT_MS = 10_000;
const PAGE_ATTEMPTS = 3;

/**
 * Fetch one page of stored meetings. Every attempt gets its OWN timeout
 * window: previously a single 10s deadline was shared by the whole restore,
 * so one slow page — or a table grown past a few pages — failed the entire
 * recovery and raised the 'Stored calendar history' warning even though the
 * database was healthy. Attempts are read-only and bounded; a page that
 * still fails after every attempt fails the restore loudly, exactly as
 * before, so a real outage keeps surfacing instead of silently truncating.
 */
async function readStoredCalendarPage(after: string): Promise<any[]> {
  for (let attempt = 1; ; attempt++) {
    let query = getSupabase().from('results_calendar').select('id,scrip_code,data')
      .order('id', { ascending: true }).limit(500);
    if (after) query = query.gt('id', after);
    const { data, error } = await query.abortSignal(AbortSignal.timeout(PAGE_TIMEOUT_MS));
    if (!error && Array.isArray(data)) return data;
    if (attempt >= PAGE_ATTEMPTS) throw new Error('Stored calendar history unavailable');
  }
}

/** Restore every stored public meeting; never truncate silently at PostgREST's default row limit. */
export async function readStoredCalendarMeetings(): Promise<any[]> {
  const rows: any[] = [];
  let after = '';
  while (true) {
    const data = await readStoredCalendarPage(after);
    for (const row of data) {
      const item = row.data;
      if (!item || !/^\d{6}$/.test(row.scrip_code) || item.scripCode !== row.scrip_code ||
          typeof row.id !== 'string' || !row.id || typeof item.meetingDate !== 'string' ||
          typeof item.purpose !== 'string' || !Number.isFinite(item.meetingTimestamp) || item.meetingTimestamp <= 0) continue;
      rows.push({ ...item, id: row.id, scripCode: row.scrip_code });
    }
    if (data.length < 500) return rows;
    const next = String(data[data.length - 1].id);
    if (next <= after) throw new Error('Calendar history pagination stalled');
    after = next;
  }
}
