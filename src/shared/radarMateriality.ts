import { validRadarTime } from './impactRadar';
export const SIZE_BANDS=['under-5000cr','5000-20000cr','over-20000cr','unknown'] as const;
export const EXPOSURE_BANDS=['under-0.1pct','0.1-1pct','over-1pct','unknown'] as const;
export type SizeBand=typeof SIZE_BANDS[number];
export type ExposureBand=typeof EXPOSURE_BANDS[number];
export const SIZE_LABELS:Record<SizeBand,string>={'under-5000cr':'Below ₹5,000 crore','5000-20000cr':'₹5,000–20,000 crore','over-20000cr':'₹20,000 crore and above',unknown:'Size unavailable'};
export const EXPOSURE_LABELS:Record<ExposureBand,string>={'under-0.1pct':'Below 0.1% of market cap','0.1-1pct':'0.1–1% of market cap','over-1pct':'1% of market cap and above',unknown:'Amount comparison unavailable'};
export interface RadarSizeSnapshot {scripCode:string;marketCapInr:number;currency:'INR';quotedAt:string;capturedAt:string;sourceUrl:string}
export interface RadarMateriality {snapshot:RadarSizeSnapshot;amountInr:number|null;amountToCapPercent:number|null;sizeBand:SizeBand;exposureBand:ExposureBand}
export function isRadarSizeSnapshot(s:any):s is RadarSizeSnapshot {
 return s&&/^\d{6}$/.test(s.scripCode)&&s.currency==='INR'&&Number.isFinite(s.marketCapInr)&&s.marketCapInr>0&&validRadarTime(s.quotedAt)&&validRadarTime(s.capturedAt)&&Date.parse(s.quotedAt)<=Date.parse(s.capturedAt)&&Date.parse(s.capturedAt)-Date.parse(s.quotedAt)<=7*86400000&&s.sourceUrl===`https://finance.yahoo.com/quote/${s.scripCode}.BO/`;
}
export function materialityCutoff(sessionDate:string|null):number {return sessionDate?Date.parse(`${sessionDate}T03:45:00Z`):NaN;}
export function usableSizeSnapshot(s:RadarSizeSnapshot,publishedAt:string,sessionDate:string|null):boolean {
 return isRadarSizeSnapshot(s)&&Date.parse(s.capturedAt)<=materialityCutoff(sessionDate)&&Date.parse(s.capturedAt)>=Date.parse(publishedAt)-7*86400000;
}
export function statedAmountInr(amounts:string[],excerpt=''):number|null {
 // A single distinct INR figure only. No currency conversion, range midpoint or summing separate liabilities.
 if(amounts.length>=4)return null;
 if(/(?:₹|\bRs\.?|\bINR)\s*[\d,.]+\s*(?:-|–|to)\s*[\d,.]+/i.test(excerpt))return null;
 const numbers=amounts.map(s=>{
  const m=s.trim().match(/^(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d+)?)\s*(crores?|cr\.?|lakhs?|lacs?|million|billion)?$/i);if(!m)return NaN;
  if(m[1].includes(',')&&!/^(?:\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})*,\d{3})(?:\.\d+)?$/.test(m[1]))return NaN;
  const unit=(m[2]||'').toLowerCase(),factor=/^(crore|cr)/.test(unit)?1e7:/^(lakh|lac)/.test(unit)?1e5:unit==='million'?1e6:unit==='billion'?1e9:1;
  return Number(m[1].replaceAll(',',''))*factor;
 });
 if(numbers.some(n=>!Number.isFinite(n)||n<=0))return null;
 const unique=[...new Set(numbers)];return unique.length===1?unique[0]:null;
}
export function sizeBand(cap:number):SizeBand {return cap<5000e7?'under-5000cr':cap<20000e7?'5000-20000cr':'over-20000cr';}
export function exposureBand(p:number|null):ExposureBand {return p===null?'unknown':p<0.1?'under-0.1pct':p<1?'0.1-1pct':'over-1pct';}
export function radarMateriality(snapshot:RadarSizeSnapshot,amounts:string[],excerpt=''):RadarMateriality {
 const amountInr=statedAmountInr(amounts,excerpt),amountToCapPercent=amountInr===null?null:amountInr/snapshot.marketCapInr*100;
 return {snapshot,amountInr,amountToCapPercent,sizeBand:sizeBand(snapshot.marketCapInr),exposureBand:exposureBand(amountToCapPercent)};
}
export function isRadarMateriality(v:any):v is RadarMateriality {
 if(!v||!isRadarSizeSnapshot(v.snapshot))return false;
 const expected=v.amountInr===null?null:v.amountInr/v.snapshot.marketCapInr*100;
 return (v.amountInr===null||(Number.isFinite(v.amountInr)&&v.amountInr>0))&&v.amountToCapPercent===expected&&v.sizeBand===sizeBand(v.snapshot.marketCapInr)&&v.exposureBand===exposureBand(expected);
}
