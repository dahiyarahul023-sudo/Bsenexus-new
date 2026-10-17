import { validRadarDate, radarUrl } from './impactRadar';
export interface RadarSessionMove {
  date: string; symbol: string; series: string; close: number; previousClose: number;
  changePercent: number; sourceUrl: string;
}
export interface RadarMovement {
  basis: 'event-date' | 'report-date'; anchorDate: string; afterClose: boolean;
  status: 'available' | 'partial' | 'unavailable' | 'upcoming'; checkedAt: string;
  companies: { symbol: string; sessions: RadarSessionMove[] }[];
}
export function isRadarMovement(v: any): v is RadarMovement {
  return v && ['event-date', 'report-date'].includes(v.basis) && validRadarDate(v.anchorDate) && typeof v.afterClose === 'boolean' &&
    ['available', 'partial', 'unavailable', 'upcoming'].includes(v.status) && Number.isFinite(Date.parse(v.checkedAt)) &&
    Array.isArray(v.companies) && v.companies.length <= 3 && v.companies.every((c: any) => /^[A-Z0-9&._-]{1,30}$/.test(c.symbol) &&
      Array.isArray(c.sessions) && c.sessions.length <= 3 && c.sessions.every((s: any) => validRadarDate(s.date) && s.symbol === c.symbol &&
        ['EQ', 'BE'].includes(s.series) && Number.isFinite(s.close) && s.close > 0 && Number.isFinite(s.previousClose) && s.previousClose > 0 &&
        Number.isFinite(s.changePercent) && Math.abs(s.changePercent - (s.close / s.previousClose - 1) * 100) < 0.001 &&
        radarUrl(s.sourceUrl) && new URL(s.sourceUrl).hostname === 'nsearchives.nseindia.com'));
}
