/** Dedicated offline OAuth grant only. Never reuse Firebase or ChatGPT connector credentials. */
export function radarDriveConfigured(env = process.env): boolean {
  return ['RADAR_DRIVE_CLIENT_ID','RADAR_DRIVE_CLIENT_SECRET','RADAR_DRIVE_REFRESH_TOKEN','RADAR_DRIVE_FOLDER_ID'].every(k => !!env[k]?.trim());
}
async function json(response: Response) {
  if (!response.ok) throw new Error('Independent backup provider unavailable');
  return response.json();
}
export async function backupRadarToDrive(path: string, bytes: Buffer, hash: string): Promise<{fileId:string;bytes:Uint8Array}> {
  if(bytes.length>5_000_000)throw new Error('Partition backup before multipart upload');
  if (!radarDriveConfigured() || !/^[a-zA-Z0-9_-]{1,150}$/.test(process.env.RADAR_DRIVE_FOLDER_ID!)) throw new Error('Independent backup is not configured');
  const token = await json(await fetch('https://oauth2.googleapis.com/token',{method:'POST',signal:AbortSignal.timeout(6000),
    body:new URLSearchParams({client_id:process.env.RADAR_DRIVE_CLIENT_ID!,client_secret:process.env.RADAR_DRIVE_CLIENT_SECRET!,refresh_token:process.env.RADAR_DRIVE_REFRESH_TOKEN!,grant_type:'refresh_token'})}));
  if (typeof token.access_token !== 'string') throw new Error('Independent backup authentication unavailable');
  const headers = {Authorization:`Bearer ${token.access_token}`};
  const query = new URLSearchParams({q:`'${process.env.RADAR_DRIVE_FOLDER_ID}' in parents and trashed = false and appProperties has { key='radarHash' and value='${hash}' }`,fields:'files(id,size)',pageSize:'2'});
  const found = await json(await fetch(`https://www.googleapis.com/drive/v3/files?${query}`,{headers,signal:AbortSignal.timeout(6000)}));
  if (!Array.isArray(found.files) || found.files.length > 1) throw new Error('Independent backup identity conflict');
  let fileId: string = found.files[0]?.id;
  if (!fileId) {
    const boundary = `radar_${hash}`;
    const metadata = JSON.stringify({name:`radar-${path.replaceAll('/','-')}`,parents:[process.env.RADAR_DRIVE_FOLDER_ID],mimeType:'application/gzip',appProperties:{radarHash:hash}});
    const body = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/gzip\r\n\r\n`),bytes,Buffer.from(`\r\n--${boundary}--`)]);
    const created = await json(await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,size',{method:'POST',headers:{...headers,'Content-Type':`multipart/related; boundary=${boundary}`},body,signal:AbortSignal.timeout(10000)}));
    fileId = created.id;
  }
  if (typeof fileId !== 'string' || !/^[a-zA-Z0-9_-]{1,150}$/.test(fileId)) throw new Error('Invalid backup identity');
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,{headers,signal:AbortSignal.timeout(10000)});
  if (!response.ok || !response.body) throw new Error('Backup readback failed');
  const reader = response.body.getReader(), chunks:Uint8Array[]=[]; let size=0;
  try { for (;;) { const part=await reader.read(); if(part.done)break; size+=part.value.length; if(size>8_388_608)throw new Error('Backup exceeds limit'); chunks.push(part.value); } }
  finally {await reader.cancel().catch(()=>{});}
  return {fileId,bytes:Buffer.concat(chunks)};
}
