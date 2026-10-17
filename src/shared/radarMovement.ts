import { validRadarDate, validRadarTime } from './impactRadar';
export interface RadarSessionMove {
  date: string; symbol: string; series: string; close: number; previousClose: number;
  changePercent: number; sourceUrl: string;
  high?: number; low?: number;
  exchange?: 'NSE' | 'BSE'; exchangeSymbol?: string; companyName?: string;
}
export interface RadarMovement {
  basis: 'event-date' | 'report-date'; anchorDate: string; afterClose: boolean;
  status: 'available' | 'partial' | 'unavailable' | 'upcoming'; checkedAt: string;
  companies: { symbol: string; name?: string; sessions: RadarSessionMove[] }[];
}
export const radarPriceExchange = (s: RadarSessionMove): 'NSE' | 'BSE' => s.sourceUrl.startsWith('https://www.bseindia.com/') ? 'BSE' : 'NSE';
export function isRadarSessionMove(s: any): s is RadarSessionMove {
  return s && validRadarDate(s.date) && /^[A-Z0-9&._-]{1,30}$/.test(s.symbol) && typeof s.sourceUrl === 'string' && typeof s.series === 'string' && (s.sourceUrl.startsWith('https://www.bseindia.com/') ? /^[A-Z0-9]{0,3}$/.test(s.series) : ['EQ', 'BE', 'BZ', 'SM', 'ST'].includes(s.series)) &&
    Number.isFinite(s.close) && s.close > 0 && Number.isFinite(s.previousClose) && s.previousClose > 0 &&
    Number.isFinite(s.changePercent) && Math.abs(s.changePercent - (s.close / s.previousClose - 1) * 100) < 0.001 &&
    ((s.high == null && s.low == null) || (Number.isFinite(s.high) && Number.isFinite(s.low) && s.low > 0 && s.low <= s.close && s.high >= s.close)) &&
    (s.exchange == null || (['NSE','BSE'].includes(s.exchange) && s.exchange === radarPriceExchange(s))) &&
    (s.exchangeSymbol == null || /^[A-Z0-9&._-]{1,30}$/.test(s.exchangeSymbol)) &&
    (s.companyName == null || (typeof s.companyName === 'string' && s.companyName.length <= 160 && /[a-z]/i.test(s.companyName) && !/[<>]/.test(s.companyName))) &&
    [ `https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_${s.date.replaceAll('-', '')}_F_0000.csv.zip`,
      `https://www.bseindia.com/download/BhavCopy/Equity/BhavCopy_BSE_CM_0_0_0_${s.date.replaceAll('-', '')}_F_0000.csv.zip` ].includes(s.sourceUrl);
}
export function isRadarMovement(v: any): v is RadarMovement {
  return v && ['event-date', 'report-date'].includes(v.basis) && validRadarDate(v.anchorDate) && typeof v.afterClose === 'boolean' &&
    ['available', 'partial', 'unavailable', 'upcoming'].includes(v.status) && validRadarTime(v.checkedAt) &&
    Array.isArray(v.companies) && v.companies.length <= 3 && v.companies.every((c: any) => /^[A-Z0-9&._-]{1,30}$/.test(c.symbol) && (c.name == null || (typeof c.name === 'string' && c.name.length <= 160 && !/[<>]/.test(c.name))) &&
      Array.isArray(c.sessions) && c.sessions.length <= 3 && c.sessions.every((s: any) => isRadarSessionMove(s) && s.symbol === c.symbol));
}
