import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { getSupabase } from '../database/supabase.js';
import { createClient } from '@supabase/supabase-js';
import { isRadarResearch, publicRadarResearch } from '../../src/shared/radarResearch.js';
import { isRadarEvent, isRadarUpdate, publicRadarEvent, publicRadarUpdate, validRadarTime, type RadarEvent, type RadarUpdate } from '../../src/shared/impactRadar.js';

export const RADAR_ARCHIVE_BUCKET = 'radar-history';
export const archiveHash = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const MAX_FILE = 8_388_608, MAX_PLAIN = 32_000_000;
export interface RadarArchive {
  version: 1; event: RadarEvent; firstPublicAt: string; eventVersion: string;
  updates: RadarUpdate[]; updateDigest: string; research: unknown;
}
export function validateRadarArchive(v: any): v is RadarArchive {
  return v?.version === 1 && isRadarEvent(v.event) && validRadarTime(v.firstPublicAt) && validRadarTime(v.eventVersion) &&
    Date.parse(v.firstPublicAt) <= Date.parse(v.eventVersion) && Date.parse(v.eventVersion)===Date.parse(v.event.updatedAt) && (v.research===null||isRadarResearch(v.research)) && /^[a-f0-9]{32}$/.test(v.updateDigest) &&
    Array.isArray(v.updates) && v.updates.length > 0 && v.updates.length <= 5000 &&
    new Set(v.updates.map((u: any) => u?.id)).size === v.updates.length &&
    v.updates.every((u: any) => isRadarUpdate(u) && u.eventId === v.event.id && Date.parse(u.publishedAt) >= Date.parse(v.firstPublicAt) && Date.parse(u.publishedAt) <= Date.parse(v.eventVersion));
}
export function encodeRadarArchive(value: RadarArchive): Buffer {
  if (!validateRadarArchive(value)) throw new Error('Invalid archive evidence');
  // Snapshot RPC contains public event/update evidence only; no account, follow or OAuth data.
  const safe = {version:1,event:publicRadarEvent(value.event),firstPublicAt:value.firstPublicAt,eventVersion:value.eventVersion,
    updates:value.updates.map(publicRadarUpdate),updateDigest:value.updateDigest,research:isRadarResearch(value.research)?publicRadarResearch(value.research):null};
  const bytes = Buffer.from(JSON.stringify(safe));
  if (bytes.length > MAX_PLAIN) throw new Error('Archive requires partitioning');
  const compressed = gzipSync(bytes);
  if (compressed.length > MAX_FILE) throw new Error('Archive requires partitioning');
  return compressed;
}
export function decodeRadarArchive(bytes: Uint8Array, hash: string, eventId: string): RadarArchive {
  if (bytes.length > MAX_FILE || archiveHash(bytes) !== hash) throw new Error('Archive checksum mismatch');
  const value = JSON.parse(gunzipSync(bytes,{maxOutputLength:MAX_PLAIN}).toString('utf8'));
  if (!validateRadarArchive(value) || value.event.id !== eventId) throw new Error('Archive restore validation failed');
  return value;
}

/** Full private readback, decompression, identity/count validation, not just an upload status. */
export async function readRadarArchive(path: string, hash: string, id: string): Promise<RadarArchive> {
  if (path !== `${id}/${hash}.json.gz`) throw new Error('Invalid archive path');
  const {data,error} = await radarArchiveBucket().download(path,{}, {signal:AbortSignal.timeout(8000)});
  if (error || !data || data.size > MAX_FILE) throw new Error('Archive unavailable');
  return decodeRadarArchive(new Uint8Array(await data.arrayBuffer()),hash,id);
}
/** storage-js upload has no AbortSignal option. Give this storage-only client a bounded fetch,
 * rather than inventing an SDK upload option or changing the shared application client.
 */
export function radarArchiveBucket() {
  return radarArchiveStorage().from(RADAR_ARCHIVE_BUCKET);
}
export function radarArchiveStorage() {
  getSupabase(); // Fail closed using the normal configured server credentials.
  return createClient(process.env.SUPABASE_URL!.trim(),process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),{
    auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.any([AbortSignal.timeout(10000),...(init?.signal?[init.signal]:[])])})},
  }).storage;
}
export async function readArchivedRadarUpdates(id: string): Promise<RadarUpdate[]> {
  const {data,error} = await getSupabase().from('impact_radar_archives').select('sha256,object_path,update_count').eq('event_id',id).not('compacted_at','is',null).limit(2).abortSignal(AbortSignal.timeout(3000));
  if (error || (data?.length || 0) > 1) throw new Error('Archive index unavailable');
  if (!data?.length) return [];
  const a = await readRadarArchive(data[0].object_path,data[0].sha256,id);
  if (a.updates.length !== data[0].update_count) throw new Error('Archive evidence count mismatch');
  return a.updates;
}

export interface ArchiveStorage {
  upload: (path: string, bytes: Buffer) => Promise<void>;
  download: (path: string) => Promise<Uint8Array>;
  backup?: (path: string, bytes: Buffer, hash: string) => Promise<{fileId: string; bytes: Uint8Array}>;
}
/** Pure orchestration is injectable so corruption, partial failures and retry are behavior-tested. */
export async function verifyArchiveCopies(value: RadarArchive, storage: ArchiveStorage) {
  const bytes = encodeRadarArchive(value), sha256 = archiveHash(bytes), path = `${value.event.id}/${sha256}.json.gz`;
  await storage.upload(path,bytes);
  const restored = decodeRadarArchive(await storage.download(path),sha256,value.event.id);
  if (restored.updates.length !== value.updates.length || restored.updateDigest !== value.updateDigest) throw new Error('Archive evidence mismatch');
  let backupFileId: string | null = null;
  if (storage.backup) {
    const backup = await storage.backup(path,bytes,sha256);
    const independent = decodeRadarArchive(backup.bytes,sha256,value.event.id);
    if (!backup.fileId || independent.updates.length !== value.updates.length) throw new Error('Backup restore check failed');
    backupFileId = backup.fileId;
  }
  return {sha256,path,compressedBytes:bytes.length,backupFileId};
}
