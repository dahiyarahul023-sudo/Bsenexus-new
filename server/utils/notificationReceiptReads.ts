/** Keep PostgREST GET filters below gateway URL/header limits. Fail the whole read on any batch failure. */
export async function readNotificationReceiptIds(ids: string[], load: (ids: string[]) => Promise<string[]>): Promise<string[]> {
  const batches: string[][]=[];let batch:string[]=[],size=0;
  for(const id of new Set(ids)) {
    const encoded=encodeURIComponent(JSON.stringify(id)).length+3;
    if(encoded>5500)throw new Error('Notification identifier exceeds read budget');
    if(batch.length && (size+encoded>5500 || batch.length>=80)){batches.push(batch);batch=[];size=0;}
    batch.push(id);size+=encoded;
  }
  if(batch.length)batches.push(batch);
  const result=new Set<string>(),requested=new Set(ids);
  for(let offset=0;offset<batches.length;offset+=2){
    const groups=await Promise.all(batches.slice(offset,offset+2).map(load));
    for(const group of groups)for(const id of group)if(requested.has(id))result.add(id);
  }
  return [...result];
}
