import { getSupabase } from '../database/supabase.js';
import { randomUUID } from 'node:crypto';
import { backupRadarToDrive, radarDriveConfigured } from './radarDriveBackup.js';
import { RADAR_ARCHIVE_BUCKET, radarArchiveStorage, radarArchiveBucket, validateRadarArchive, verifyArchiveCopies, type ArchiveStorage } from './radarArchive.js';

export async function archiveRadarCase(id:string, compact=false) {
  const db=getSupabase();
  const token=randomUUID(),claim=await db.rpc('claim_radar_archive',{p_event_id:id,p_token:token}).abortSignal(AbortSignal.timeout(3000));
  if(claim.error)throw new Error('Archive lease unavailable');
  if(claim.data!==true)return {state:'busy'};
  try {return await archiveClaimedRadarCase(id,compact);}
  finally{await db.rpc('release_radar_archive',{p_event_id:id,p_token:token}).abortSignal(AbortSignal.timeout(3000)).then(()=>{},()=>{});}
}
async function archiveClaimedRadarCase(id:string,compact:boolean) {
  const db=getSupabase();
  const prior=await db.from('impact_radar_archives').select('sha256').eq('event_id',id).not('compacted_at','is',null).limit(1).abortSignal(AbortSignal.timeout(3000));
  if(prior.error)throw new Error('Archive index unavailable');
  if(prior.data?.length)return {state:'already-compacted',sha256:prior.data[0].sha256};
  const snapshot=await db.rpc('radar_archive_snapshot',{p_event_id:id}).abortSignal(AbortSignal.timeout(6000));
  if(snapshot.error || !validateRadarArchive(snapshot.data))throw new Error('Archive snapshot unavailable');
  const value=snapshot.data;
  const storage:ArchiveStorage={
    upload:async(path,bytes)=>{
      const bucket=await radarArchiveStorage().getBucket(RADAR_ARCHIVE_BUCKET);
      if(bucket.error||bucket.data?.public!==false)throw new Error('Archive bucket must remain private');
      const usage=await db.rpc('radar_storage_usage').abortSignal(AbortSignal.timeout(3000));
      const configured=Number(process.env.RADAR_ARCHIVE_BUDGET_BYTES || 750*1024*1024);
      if(usage.error||!usage.data||usage.data.unknownStorageSizes>0||!Number.isSafeInteger(configured)||configured<=0||Number(usage.data.allStorageBytes)+bytes.length>configured)throw new Error('Archive capacity check failed; original evidence retained');
      const r=await radarArchiveBucket().upload(path,bytes,{contentType:'application/gzip',upsert:false});
      // An idempotent retry verifies the existing object in full below, never overwrites it.
      if(r.error && !['409','Duplicate'].includes(String((r.error as any).statusCode || (r.error as any).error)))throw new Error('Archive upload failed');
    },
    download:async path=>{
      const r=await radarArchiveBucket().download(path,{}, {signal:AbortSignal.timeout(8000)});
      if(r.error || !r.data || r.data.size>8_388_608)throw new Error('Archive readback failed');
      return new Uint8Array(await r.data.arrayBuffer());
    },
    ...(radarDriveConfigured()?{backup:backupRadarToDrive}:{}),
  };
  const verified=await verifyArchiveCopies(value,storage);
  const now=new Date().toISOString();
  const manifest={event_id:id,sha256:verified.sha256,object_path:verified.path,event_version:value.eventVersion,
    update_count:value.updates.length,update_digest:value.updateDigest,compressed_bytes:verified.compressedBytes,
    first_update:[...value.updates].sort((a,b)=>Date.parse(a.publishedAt)-Date.parse(b.publishedAt)||a.id.localeCompare(b.id))[0],primary_verified_at:now,
    ...(verified.backupFileId?{backup_file_id:verified.backupFileId,backup_verified_at:now}:{}),
  };
  const saved=await db.from('impact_radar_archives').upsert(manifest,{onConflict:'event_id,sha256'}).abortSignal(AbortSignal.timeout(3000));
  if(saved.error)throw new Error('Archive verification record failed');
  let removed=0;
  if(compact && verified.backupFileId) {
    const r=await db.rpc('compact_radar_archive',{p_event_id:id,p_sha256:verified.sha256}).abortSignal(AbortSignal.timeout(6000));
    if(r.error)throw new Error('Archive retained; compaction not eligible'); removed=r.data;
  }
  return {state:verified.backupFileId?'two-copies-verified':'primary-verified-backup-pending',sha256:verified.sha256,compressedBytes:verified.compressedBytes,removed};
}

let running:Promise<void>|null=null,nextAttempt=0;
/** At most two old closed cases per day. Active cases of any age stay hot.
 * This maintenance runs after ingestion; it never dispatches filing alerts or expires core records.
 */
export function refreshRadarArchives():Promise<void> {
  if(running)return running;
  if(Date.now()<nextAttempt)return Promise.resolve();
  nextAttempt=Date.now()+24*60*60_000;
  running=(async()=>{
    try {
      const rows=await getSupabase().rpc('radar_archive_candidates').abortSignal(AbortSignal.timeout(4000));
      if(rows.error)throw new Error('Archive candidates unavailable');
      if(!rows.data?.length)return;
      for(const row of rows.data.slice(0,2)) {
        const result=await archiveRadarCase(row.id,true);
        console.info(`[RadarArchive] ${JSON.stringify({eventId:row.id,...result})}`);
      }
    } catch {nextAttempt=Date.now()+60*60_000;console.warn('[RadarArchive] Maintenance unavailable; original evidence retained');}
    finally{running=null;}
  })();return running;
}
