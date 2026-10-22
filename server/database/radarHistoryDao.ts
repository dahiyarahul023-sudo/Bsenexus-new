import { getSupabase } from './supabase.js';
import { isRadarEvent, isRadarEventInScope, RADAR_ID, validRadarDate, validRadarTime, type RadarEvent } from '../../src/shared/impactRadar.js';
import { resolvedRadarEvent, RadarStorageError } from './impactRadarDao.js';

export interface RadarHistoryQuery { query: string; from: string | null; to: string | null; before: {time:string;id:string} | null }
export function parseRadarHistoryQuery(input: Record<string,unknown>): RadarHistoryQuery | null {
  const query = input.q == null ? '' : input.q;
  if (typeof query !== 'string' || query.length > 120 || /[<>\x00-\x1f]/.test(query)) return null;
  const from = input.from || null, to = input.to || null;
  if ((from !== null && !validRadarDate(from)) || (to !== null && !validRadarDate(to)) || (from && to && from > to)) return null;
  let before: RadarHistoryQuery['before'] = null;
  if (input.cursor != null) {
    if (typeof input.cursor !== 'string' || input.cursor.length > 400 || !/^[A-Za-z0-9_-]+$/.test(input.cursor)) return null;
    try { const c=JSON.parse(Buffer.from(input.cursor,'base64url').toString());
      if (!Array.isArray(c) || c.length !== 2 || !validRadarTime(c[0]) || typeof c[1]!=='string' || !RADAR_ID.test(c[1])) return null;
      before={time:c[0],id:c[1]};
    } catch {return null;}
  }
  return {query:query.trim(),from:from as string|null,to:to as string|null,before};
}
export async function searchRadarHistory(query: RadarHistoryQuery) {
  const {data,error}=await getSupabase().rpc('search_radar_history',{
    p_query:query.query,p_from:query.from,p_to:query.to,p_before_time:query.before?.time || null,p_before_id:query.before?.id || null,p_limit:26,
  }).abortSignal(AbortSignal.timeout(6000));
  if (error || !Array.isArray(data)) throw new RadarStorageError();
  const rows=data.slice(0,25), last=rows.at(-1);
  return {items:rows.filter(r=>isRadarEvent(r.data)&&isRadarEventInScope(r.data)).map(r=>({event:resolvedRadarEvent(r.data as RadarEvent),firstPublicAt:r.first_public_at})),
    nextCursor:data.length>25 && last ? Buffer.from(JSON.stringify([last.first_public_at,last.id])).toString('base64url') : null,limit:25};
}
