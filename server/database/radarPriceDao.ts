import { getSupabase } from './supabase.js';
import { isRadarSessionMove, type RadarSessionMove } from '../../src/shared/radarMovement.js';
/** Store only the selected companies' final daily values and source links, never report/PDF bytes. */
export async function readRadarPriceSessions(symbols: string[], dates: string[]): Promise<RadarSessionMove[]> {
  if (!symbols.length || symbols.length > 3 || !dates.length || dates.length > 8) return [];
  try {
    const { data, error } = await getSupabase().from('impact_price_sessions').select('symbol,session_date,data').in('symbol', symbols).in('session_date', dates).limit(24).abortSignal(AbortSignal.timeout(2000));
    if (error) return [];
    return (data || []).filter(r => isRadarSessionMove(r.data) && r.data.symbol === r.symbol && r.data.date === r.session_date).map(r => r.data);
  } catch { return []; }
}
export async function saveRadarPriceSessions(sessions: RadarSessionMove[]): Promise<boolean> {
  if (!sessions.length || sessions.length > 9 || !sessions.every(isRadarSessionMove)) return false;
  const rows = sessions.map(data => ({ symbol: data.symbol, session_date: data.date, data }));
  try {
    const { error } = await getSupabase().from('impact_price_sessions').upsert(rows, { onConflict: 'symbol,session_date', ignoreDuplicates: true }).abortSignal(AbortSignal.timeout(2000));
    return !error;
  } catch { return false; }
}
