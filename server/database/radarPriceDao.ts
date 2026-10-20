import { getSupabase } from './supabase.js';
import { isRadarSessionMove, type RadarSessionMove } from '../../src/shared/radarMovement.js';
import { validRadarDate } from '../../src/shared/impactRadar.js';
export class RadarPriceStorageError extends Error { constructor() { super('Radar price storage read failed'); } }
/** Store only the selected companies' final daily values and source links, never report/PDF bytes. */
export async function readRadarPriceSessions(symbols: string[], dates: string[]): Promise<RadarSessionMove[]> {
  if (!symbols.length || symbols.length > 6 || !dates.length || dates.length > 24) return [];
  try {
    const { data, error } = await getSupabase().from('impact_price_sessions').select('symbol,session_date,data').in('symbol', symbols).in('session_date', dates).limit(144).abortSignal(AbortSignal.timeout(2000));
    if (error) throw new RadarPriceStorageError();
    return (data || []).filter(r => isRadarSessionMove(r.data) && r.data.symbol === r.symbol && r.data.date === r.session_date).map(r => r.data);
  } catch { throw new RadarPriceStorageError(); }
}
/** Retain the last known company close even when it is older than the event's eight-day window. */
export async function readLatestRadarPriceSessions(symbols: string[], throughDate: string): Promise<RadarSessionMove[]> {
  if(!symbols.length||symbols.length>6||!validRadarDate(throughDate))return [];
  try {
    const groups=await Promise.all([...new Set(symbols)].map(async symbol=>{
      const {data,error}=await getSupabase().from('impact_price_sessions').select('symbol,session_date,data').eq('symbol',symbol).lte('session_date',throughDate).order('session_date',{ascending:false}).limit(1).abortSignal(AbortSignal.timeout(2000));
      if(error)throw new RadarPriceStorageError();
      return (data||[]).filter(r=>isRadarSessionMove(r.data)&&r.symbol===symbol&&r.data.symbol===symbol&&r.data.date===r.session_date&&r.session_date<=throughDate).map(r=>r.data);
    }));
    return groups.flat();
  }catch{throw new RadarPriceStorageError();}
}
export async function saveRadarPriceSessions(sessions: RadarSessionMove[]): Promise<boolean> {
  if (!sessions.length || sessions.length > 30 || !sessions.every(isRadarSessionMove)) return false;
  const rows = sessions.map(data => ({ symbol: data.symbol, session_date: data.date, data }));
  try {
    const { error } = await getSupabase().from('impact_price_sessions').upsert(rows, { onConflict: 'symbol,session_date', ignoreDuplicates: true }).abortSignal(AbortSignal.timeout(2000));
    return !error;
  } catch { return false; }
}
