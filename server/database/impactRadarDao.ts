import { getSupabase } from './supabase.js';
import { isRadarEvent, isRadarUpdate, publicRadarEvent, publicRadarUpdate, type RadarEvent, type RadarUpdate } from '../../src/shared/impactRadar.js';

export class RadarStorageError extends Error { constructor() { super('Impact Radar storage is unavailable. Please retry.'); } }
const checked = <T>(result: { data: T; error: unknown }): T => { if (result.error) throw new RadarStorageError(); return result.data; };
export interface RadarRecord { event: RadarEvent; update: RadarUpdate; origin?: 'intake' | 'editorial' }
export async function listRadarEvents(): Promise<RadarEvent[]> {
  try {
    const rows = checked(await getSupabase().from('impact_radar_events').select('data').order('updated_at', { ascending: false }).limit(200).abortSignal(AbortSignal.timeout(6000)));
    return (rows || []).map(r => r.data).filter(isRadarEvent).map(publicRadarEvent);
  } catch { throw new RadarStorageError(); }
}
export async function getRadarEvent(id: string): Promise<RadarEvent | null> {
  try {
    const row = checked(await getSupabase().from('impact_radar_events').select('data').eq('id', id).abortSignal(AbortSignal.timeout(6000)).maybeSingle());
    return isRadarEvent(row?.data) ? publicRadarEvent(row.data) : null;
  } catch { throw new RadarStorageError(); }
}
export async function listRadarUpdates(id: string): Promise<RadarUpdate[]> {
  try {
    const rows = checked(await getSupabase().from('impact_radar_updates').select('data').eq('event_id', id).order('published_at', { ascending: false }).limit(50).abortSignal(AbortSignal.timeout(6000)));
    return (rows || []).map(r => r.data).filter(isRadarUpdate).map(publicRadarUpdate);
  } catch { throw new RadarStorageError(); }
}
export async function firstRadarUpdate(id: string): Promise<RadarUpdate | null> {
  try {
    const rows = checked(await getSupabase().from('impact_radar_updates').select('data').eq('event_id', id).order('published_at', { ascending: true }).limit(1).abortSignal(AbortSignal.timeout(6000)));
    return isRadarUpdate(rows?.[0]?.data) ? publicRadarUpdate(rows[0].data) : null;
  } catch { throw new RadarStorageError(); }
}
export async function publishRadarRecords(records: RadarRecord[]): Promise<void> {
  if (!records.length) return;
  if (records.length > 60 || records.some(r => !isRadarEvent(r.event) || !isRadarUpdate(r.update) || r.update.eventId !== r.event.id)) throw new Error('Invalid radar records');
  const safeRecords = records.map(r => ({ event: publicRadarEvent(r.event), update: publicRadarUpdate(r.update), origin: r.origin === 'intake' ? 'intake' : 'editorial' }));
  try { checked(await getSupabase().rpc('publish_impact_radar_records', { p_records: safeRecords }).abortSignal(AbortSignal.timeout(6000))); }
  catch { throw new RadarStorageError(); }
}
export async function getRadarFollowing(uid: string): Promise<{ ids: string[]; events: RadarEvent[] }> {
  try {
    const rows = checked(await getSupabase().from('impact_radar_follows').select('event_id, impact_radar_events(data)').eq('user_id', uid).order('created_at', { ascending: false }).limit(500).abortSignal(AbortSignal.timeout(6000)));
    const events = (rows || []).flatMap((r: any) => {
      const e = r.impact_radar_events?.data;
      return isRadarEvent(e) ? [publicRadarEvent(e)] : [];
    });
    return { ids: (rows || []).map(r => r.event_id), events };
  } catch { throw new RadarStorageError(); }
}
export async function setRadarFollowing(uid: string, id: string, followed: boolean): Promise<void> {
  try {
    const q = getSupabase().from('impact_radar_follows');
    checked(await (followed ? q.upsert({ user_id: uid, event_id: id }, { onConflict: 'user_id,event_id', ignoreDuplicates: true }) : q.delete().eq('user_id', uid).eq('event_id', id)).abortSignal(AbortSignal.timeout(6000)));
  } catch { throw new RadarStorageError(); }
}
