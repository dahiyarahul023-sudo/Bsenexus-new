import { getSupabase } from './supabase.js';

export interface RadarSourceCheck { checkedAt: number; available: boolean; newsAvailable: boolean }
export function radarSourceStatus(check: RadarSourceCheck | null, now = Date.now()) {
  return { checkedAt: check?.checkedAt ?? null, unavailable: check?.available === false,
    stale: Boolean(check && now - check.checkedAt > 5 * 60_000), pending: check === null,
    newsUnavailable: Boolean(check && !check.newsAvailable) };
}
export async function saveRadarSourceCheck(check: RadarSourceCheck): Promise<void> {
  const {error} = await getSupabase().from('impact_radar_source_checks').upsert({checked_at:new Date(check.checkedAt).toISOString(),available:check.available,news_available:check.newsAvailable},{onConflict:'checked_at'}).abortSignal(AbortSignal.timeout(4000));
  if (error) throw new Error('Radar check persistence unavailable');
  // A tiny operational ledger, bounded to seven days; never an event/evidence deletion.
  const cleanup = await getSupabase().from('impact_radar_source_checks').delete().lt('checked_at',new Date(check.checkedAt - 7 * 86_400_000).toISOString()).abortSignal(AbortSignal.timeout(2000));
  if (cleanup.error) console.warn('[Radar] Check-history cleanup unavailable');
}
export async function readRadarSourceCheck(): Promise<RadarSourceCheck | null> {
  const {data,error} = await getSupabase().from('impact_radar_source_checks').select('checked_at,available,news_available').order('checked_at',{ascending:false}).limit(1).abortSignal(AbortSignal.timeout(4000)).maybeSingle();
  if (error) throw new Error('Radar source status unavailable');
  if (!data) return null;
  const checkedAt = Date.parse(data.checked_at);
  if (!Number.isFinite(checkedAt) || checkedAt > Date.now() + 60_000 || typeof data.available !== 'boolean' || typeof data.news_available !== 'boolean') throw new Error('Invalid Radar source status');
  return {checkedAt,available:data.available,newsAvailable:data.news_available};
}
