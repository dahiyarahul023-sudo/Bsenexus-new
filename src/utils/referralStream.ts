/** Decode authenticated SSE, including events split across network chunks. */
export async function consumeReferralEvents(response: Response,onSnapshot:(data:any)=>void,signal:AbortSignal):Promise<void> {
  if(!response.ok||!response.body||!response.headers.get('content-type')?.includes('text/event-stream'))throw new Error('Live referral connection unavailable');
  const reader=response.body.getReader(),decoder=new TextDecoder();
  let buffer='';
  const cancel=()=>void reader.cancel().catch(()=>{});
  signal.addEventListener('abort',cancel,{once:true});
  try{
    while(!signal.aborted){
      const {value,done}=await reader.read();if(done)break;
      buffer+=decoder.decode(value,{stream:true}).replace(/\r\n/g,'\n');
      if(buffer.length>1_000_000)throw new Error('Oversized referral event');
      let end:number;
      while((end=buffer.indexOf('\n\n'))>=0){
        const event=buffer.slice(0,end);buffer=buffer.slice(end+2);
        const lines=event.split('\n'),kind=lines.find(l=>l.startsWith('event:'))?.slice(6).trim();
        if(kind==='unavailable')throw new Error('Referral updates delayed');
        if(kind==='snapshot'&&!signal.aborted){
          const data=JSON.parse(lines.filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n'));
          if(!data?.success||typeof data.code!=='string'||!data.stats)throw new Error('Invalid referral event');
          onSnapshot(data);
        }
      }
    }
  }finally{signal.removeEventListener('abort',cancel);await reader.cancel().catch(()=>{});reader.releaseLock();}
}
