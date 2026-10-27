import { getSupabase } from './supabase.js';

/** Restore every stored public meeting; never truncate silently at PostgREST's default row limit. */
export async function readStoredCalendarMeetings(): Promise<any[]> {
  const rows: any[] = [];
  const signal = AbortSignal.timeout(10_000);
  let after = '';
  while (true) {
    let query = getSupabase().from('results_calendar').select('id,scrip_code,data')
      .order('id', { ascending: true }).limit(500);
    if (after) query = query.gt('id', after);
    const { data, error } = await query.abortSignal(signal);
    if (error || !Array.isArray(data)) throw new Error('Stored calendar history unavailable');
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
