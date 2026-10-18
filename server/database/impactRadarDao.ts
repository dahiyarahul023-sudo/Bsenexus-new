import { getSupabase } from './supabase.js';
import { isRadarEvent, isRadarEventInScope, isRadarUpdate, isRadarCategoryOption, publicRadarEvent, publicRadarUpdate, type RadarCategoryOption, type RadarEvent, type RadarUpdate } from '../../src/shared/impactRadar.js';
import { isRadarIntakeRule, type RadarIntakeRule } from '../services/radarIntakePolicy.js';
import { resolveRadarCompany, radarCompanyFromFiling } from '../services/radarCompanyIdentity.js';

export class RadarStorageError extends Error { constructor() { super('Impact Radar storage is unavailable. Please retry.'); } }
const checked = <T>(result: { data: T; error: unknown }): T => { if (result.error) throw new RadarStorageError(); return result.data; };
export interface RadarRecord { event: RadarEvent; update: RadarUpdate; origin?: 'intake' | 'editorial' }
let categoryCache: { until: number; rows: RadarCategoryOption[] } | null = null;
let categoryRead: Promise<RadarCategoryOption[]> | null = null;
let rulesCache: { until: number; rows: RadarIntakeRule[] } | null = null;
let rulesRead: Promise<RadarIntakeRule[]> | null = null;
export async function getRadarIntakeRules(): Promise<RadarIntakeRule[]> {
  if (rulesCache && rulesCache.until > Date.now()) return rulesCache.rows;
  if (rulesRead) return rulesRead;
  rulesRead = (async () => {
    try {
      const rows = checked(await getSupabase().from('impact_intake_rules').select('id,category,label,terms,exclude_terms,priority,active').order('priority').limit(200).abortSignal(AbortSignal.timeout(6000)));
      const categories = new Set((await getRadarCategories()).filter(c => c.active).map(c => c.id));
      if (!Array.isArray(rows) || rows.some(r => !isRadarIntakeRule(r))) throw new RadarStorageError();
      const active = rows.filter(r => r.active && categories.has(r.category));
      rulesCache = { until: Date.now() + 60_000, rows: active }; return active;
    } catch { throw new RadarStorageError(); }
    finally { rulesRead = null; }
  })();
  return rulesRead;
}
export async function getRadarCategories(): Promise<RadarCategoryOption[]> {
  if (categoryCache && categoryCache.until > Date.now()) return categoryCache.rows;
  if (categoryRead) return categoryRead;
  categoryRead = (async () => {
    try {
      const rows = checked(await getSupabase().from('impact_categories').select('id,label,sort_order,active').order('sort_order').limit(200).abortSignal(AbortSignal.timeout(6000)));
      if (!Array.isArray(rows) || rows.some(c => !isRadarCategoryOption(c))) throw new RadarStorageError();
      categoryCache = { until: Date.now() + 60_000, rows }; return rows;
    } catch { throw new RadarStorageError(); }
    finally { categoryRead = null; }
  })();
  return categoryRead;
}
/** Correct legacy numeric identities in the read projection without rewriting immutable evidence. */
export function resolvedRadarEvent(e: RadarEvent): RadarEvent {
  return publicRadarEvent({ ...e, companies: e.companies.map(c => resolveRadarCompany(c, e.title, e.source)) });
}
/** One bounded durable lookup repairs legacy headings that omitted the filing's company name. */
async function repairRadarIdentities(events: RadarEvent[]): Promise<RadarEvent[]> {
  const projected = events.map(resolvedRadarEvent);
  const codes = [...new Set(projected.flatMap(e => e.companies.filter(c => !/[a-z]/i.test(c.name)).map(c => c.scripCode)))];
  if (!codes.length) return projected;
  try {
    const { data, error } = await getSupabase().from('announcements').select('scrip_cd,data').in('scrip_cd', codes).order('fetched_at', {ascending:false}).limit(500).abortSignal(AbortSignal.timeout(2000));
    if (!error) {
      const seen = new Set<string>();
      for (const row of data || []) {
        const code = String(row.scrip_cd || '');
        if (seen.has(code) || !codes.includes(code)) continue;
        if (radarCompanyFromFiling({...row.data,scrip_cd:code})) seen.add(code);
      }
    }
  } catch { /* Keep sourced events readable during an identity-store outage. */ }
  return projected.map(resolvedRadarEvent);
}
export async function listRadarEvents(): Promise<RadarEvent[]> {
  try {
    const rows = checked(await getSupabase().from('impact_radar_events').select('data').order('updated_at', { ascending: false }).limit(200).abortSignal(AbortSignal.timeout(6000)));
    return repairRadarIdentities((rows || []).map(r => r.data).filter(e => isRadarEvent(e) && isRadarEventInScope(e)));
  } catch { throw new RadarStorageError(); }
}
export async function getRadarEvent(id: string): Promise<RadarEvent | null> {
  try {
    const row = checked(await getSupabase().from('impact_radar_events').select('data').eq('id', id).abortSignal(AbortSignal.timeout(6000)).maybeSingle());
    return isRadarEvent(row?.data) && isRadarEventInScope(row.data) ? (await repairRadarIdentities([row.data]))[0] : null;
  } catch { throw new RadarStorageError(); }
}
/** Target the company itself, independent of the global feed cap or the selected report's age. */
export async function listRadarCompanyReports(event: RadarEvent): Promise<RadarEvent[]> {
  try {
    const groups=await Promise.all([...new Set(event.companies.slice(0,3).map(c=>c.scripCode))].map(async scripCode=>{
      const rows=checked(await getSupabase().from('impact_radar_events').select('data').contains('data',{companies:[{scripCode}]}).neq('id',event.id).order('updated_at',{ascending:false}).limit(24).abortSignal(AbortSignal.timeout(6000)));
      return (rows||[]).map(r=>r.data).filter(e=>isRadarEvent(e)&&isRadarEventInScope(e)&&e.id!==event.id&&e.companies.some(c=>c.scripCode===scripCode));
    }));
    return repairRadarIdentities([...new Map(groups.flat().map(e=>[e.id,e])).values()].sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).slice(0,8));
  }catch{throw new RadarStorageError();}
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
  const categories = new Set((await getRadarCategories()).map(c => c.id));
  if (records.length > 60 || records.some(r => !isRadarEvent(r.event, categories) || !isRadarEventInScope(r.event) || !isRadarUpdate(r.update) || r.update.eventId !== r.event.id)) throw new Error('Invalid radar records');
  const safeRecords = records.map(r => ({ event: publicRadarEvent(r.event), update: publicRadarUpdate(r.update), origin: r.origin === 'intake' ? 'intake' : 'editorial' }));
  try { checked(await getSupabase().rpc('publish_impact_radar_records', { p_records: safeRecords }).abortSignal(AbortSignal.timeout(6000))); }
  catch { throw new RadarStorageError(); }
}
export async function getRadarFollowing(uid: string): Promise<{ ids: string[]; events: RadarEvent[] }> {
  try {
    const rows = checked(await getSupabase().from('impact_radar_follows').select('event_id, impact_radar_events(data)').eq('user_id', uid).order('created_at', { ascending: false }).limit(500).abortSignal(AbortSignal.timeout(6000)));
    const events = (rows || []).flatMap((r: any) => {
      const e = r.impact_radar_events?.data;
      return isRadarEvent(e) && isRadarEventInScope(e) ? [resolvedRadarEvent(e)] : [];
    });
    return { ids: events.map(e => e.id), events: await repairRadarIdentities(events) };
  } catch { throw new RadarStorageError(); }
}
export async function setRadarFollowing(uid: string, id: string, followed: boolean): Promise<void> {
  try {
    const q = getSupabase().from('impact_radar_follows');
    checked(await (followed ? q.upsert({ user_id: uid, event_id: id }, { onConflict: 'user_id,event_id', ignoreDuplicates: true }) : q.delete().eq('user_id', uid).eq('event_id', id)).abortSignal(AbortSignal.timeout(6000)));
  } catch { throw new RadarStorageError(); }
}
