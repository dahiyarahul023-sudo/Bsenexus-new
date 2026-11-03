import { getSupabase } from './supabase.js';
import { isRadarMateriality,type RadarMateriality } from '../../src/shared/radarMateriality.js';
export async function readRadarCompanyContexts(ids:string[]):Promise<Map<string,RadarMateriality>> {
 if(!ids.length)return new Map();
 const {data,error}=await getSupabase().from('impact_radar_company_context').select('reaction_id,data').in('reaction_id',ids.slice(0,600)).limit(600).abortSignal(AbortSignal.timeout(2000));
 if(error)throw Error('Company-relative context unavailable');
 return new Map((data||[]).filter(r=>isRadarMateriality(r.data)).map(r=>[r.reaction_id,r.data]));
}
export async function saveRadarCompanyContext(id:string,data:RadarMateriality) {
 if(!isRadarMateriality(data))throw Error('Invalid company context');
 const {error}=await getSupabase().rpc('save_radar_company_context',{p_reaction_id:id,p_data:data}).abortSignal(AbortSignal.timeout(2000));
 if(error)throw Error('Company context save unconfirmed');
}
