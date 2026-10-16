/** Shared facts-only contract. No prediction, sentiment, target or return estimate fields. */
export const RADAR_CATEGORIES = {
  restriction: 'Business restrictions', rules: 'Rules & business model',
  liability: 'Financial liabilities', governance: 'Governance & enforcement',
  deals: 'Deals & insolvency', operations: 'Licences & operations',
  legal: 'Legal & regulatory matters',
} as const;
export type RadarCategory = keyof typeof RADAR_CATEGORIES;
export type RadarStatus = 'scheduled' | 'active' | 'monitoring' | 'closed';
export type RadarFilter = 'all' | 'live' | 'today' | 'tomorrow' | 'week' | 'tracking';
export interface RadarSource { name: string; url: string; kind: 'disclosure' | 'official' | 'news' }
export interface RadarCompany { symbol: string; name: string; scripCode: string }
export interface RadarEvent {
  id: string; title: string; companies: RadarCompany[]; category: RadarCategory;
  authority: string; status: RadarStatus; scheduledDate: string | null;
  scheduleConfirmed: boolean; information: string; nextTrigger: string | null;
  source: RadarSource; publishedAt: string; updatedAt: string;
}
export interface RadarUpdate {
  id: string; eventId: string; title: string; information: string;
  source: RadarSource; publishedAt: string;
}
export const RADAR_NOTICE = 'Event information only. Volatility is possible; direction and extent are unknown.';
export const RADAR_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/;
export const RADAR_STALE_MS = 150_000;
const forecast = /\b(?:bullish|bearish|buy|sell|multibagger|upside|downside|price target|target price|(?:will|may|could|likely to|expected to|set to)\s+(?:rise|fall|rally|crash|surge|plunge|gain|drop)|(?:rise|fall|rally|crash)\s+(?:expected|likely))\b/i;
export function isNeutralRadarText(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max && !forecast.test(value) && !/[<>]/.test(value);
}
export function radarUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
    if (!u.hostname.includes('.') || /^(?:localhost|127\.|10\.|192\.168\.|169\.254\.|\[)/.test(u.hostname)) return null;
    return u.href;
  } catch { return null; }
}
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
export function validRadarDate(value: unknown): value is string {
  return typeof value === 'string' && datePattern.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function radarDay(time: number): string {
  return new Date(time + 330 * 60_000).toISOString().slice(0, 10);
}
function validTime(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value) && Number.isFinite(Date.parse(value));
}
function sourceValid(s: any): s is RadarSource {
  return s && typeof s.name === 'string' && s.name.length > 0 && s.name.length <= 100 && radarUrl(s.url) !== null && ['disclosure', 'official', 'news'].includes(s.kind);
}
export function isRadarEvent(e: any): e is RadarEvent {
  return e && typeof e.id === 'string' && RADAR_ID.test(e.id) && isNeutralRadarText(e.title, 200) &&
    Array.isArray(e.companies) && e.companies.length > 0 && e.companies.length <= 20 &&
    e.companies.every((c: any) => c && typeof c.symbol === 'string' && /^[A-Z0-9&._-]{1,30}$/.test(c.symbol) && typeof c.name === 'string' && c.name.length > 0 && c.name.length <= 160 && /^\d{6}$/.test(c.scripCode)) &&
    Object.hasOwn(RADAR_CATEGORIES, e.category) && isNeutralRadarText(e.authority, 100) &&
    ['scheduled', 'active', 'monitoring', 'closed'].includes(e.status) &&
    (e.scheduledDate === null || validRadarDate(e.scheduledDate)) && typeof e.scheduleConfirmed === 'boolean' &&
    !(e.scheduleConfirmed && !e.scheduledDate) &&
    isNeutralRadarText(e.information, 1200) && (e.nextTrigger === null || isNeutralRadarText(e.nextTrigger, 400)) &&
    sourceValid(e.source) && validTime(e.publishedAt) && validTime(e.updatedAt) &&
    Date.parse(e.updatedAt) >= Date.parse(e.publishedAt);
}
export function isRadarUpdate(u: any): u is RadarUpdate {
  return u && typeof u.id === 'string' && typeof u.eventId === 'string' && RADAR_ID.test(u.id) && RADAR_ID.test(u.eventId) && isNeutralRadarText(u.title, 200) &&
    isNeutralRadarText(u.information, 1200) && sourceValid(u.source) && validTime(u.publishedAt);
}
/** Whitelist the public projection, so an upstream object cannot expose added prediction fields. */
export function publicRadarEvent(e: RadarEvent): RadarEvent {
  return {
    id: e.id, title: e.title, companies: e.companies.map(({ symbol, name, scripCode }) => ({ symbol, name, scripCode })),
    category: e.category, authority: e.authority, status: e.status, scheduledDate: e.scheduledDate,
    scheduleConfirmed: e.scheduleConfirmed, information: e.information, nextTrigger: e.nextTrigger,
    source: { name: e.source.name, url: radarUrl(e.source.url)!, kind: e.source.kind },
    publishedAt: e.publishedAt, updatedAt: e.updatedAt,
  };
}
export function publicRadarUpdate(u: RadarUpdate): RadarUpdate {
  return { id: u.id, eventId: u.eventId, title: u.title, information: u.information,
    source: { name: u.source.name, url: radarUrl(u.source.url)!, kind: u.source.kind }, publishedAt: u.publishedAt };
}
export function isLiveRadarEvent(e: RadarEvent, now: number): boolean {
  return (e.status === 'active' || e.status === 'monitoring') && Date.parse(e.publishedAt) <= now;
}
export function radarStatus(e: RadarEvent, now: number): string {
  if (e.status === 'closed') return 'Closed';
  if (e.status === 'scheduled') {
    if (e.scheduledDate && e.scheduledDate < radarDay(now)) return 'Awaiting update';
    return e.scheduleConfirmed ? 'Scheduled' : 'Date to be confirmed';
  }
  return e.status === 'active' ? 'Ongoing' : 'Following developments';
}
export function matchesRadarFilter(e: RadarEvent, filter: RadarFilter, tracked: Set<string>, now: number): boolean {
  if (filter === 'tracking') return tracked.has(e.id);
  if (filter === 'live') return isLiveRadarEvent(e, now);
  if (filter === 'all') return e.status !== 'closed';
  if (e.status === 'closed' || !e.scheduledDate) return false;
  const today = radarDay(now), tomorrow = radarDay(now + 86_400_000);
  if (filter === 'today') return e.scheduledDate === today;
  if (filter === 'tomorrow') return e.scheduledDate === tomorrow;
  return e.scheduledDate >= today && e.scheduledDate <= radarDay(now + 6 * 86_400_000);
}
