/** Shared facts-only contract. No prediction, sentiment, target or return estimate fields. */
export const RADAR_CATEGORIES = {
  restriction: 'Business restrictions', rules: 'Rules & business model',
  liability: 'Financial liabilities', governance: 'Governance & enforcement',
  deals: 'Deals & insolvency', operations: 'Licences & operations',
  legal: 'Legal & regulatory matters',
} as const;
export type RadarCategory = string;
export interface RadarCategoryOption { id: string; label: string; sort_order: number; active: boolean }
export function isRadarCategoryOption(c: any): c is RadarCategoryOption {
  return c && typeof c.id === 'string' && /^[a-z][a-z0-9_-]{0,63}$/.test(c.id) && isNeutralRadarText(c.label, 100) && Number.isInteger(c.sort_order) && typeof c.active === 'boolean';
}
export type RadarStatus = 'scheduled' | 'active' | 'monitoring' | 'closed';
export type RadarFilter = 'all' | 'live' | 'today' | 'tomorrow' | 'week' | 'past' | 'tracking';
export interface RadarSource { name: string; url: string; kind: 'disclosure' | 'official' | 'news' | 'company' }
export interface RadarCompany { symbol: string; name: string; scripCode: string }
export interface RadarEvent {
  id: string; title: string; companies: RadarCompany[]; category: RadarCategory;
  authority: string; status: RadarStatus; scheduledDate: string | null;
  scheduleConfirmed: boolean; information: string; nextTrigger: string | null;
  source: RadarSource; publishedAt: string; updatedAt: string;
  occurredDate?: string | null; occurredSource?: RadarSource | null; scheduleSource?: RadarSource | null;
  supportingSources?: RadarSource[];
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
    if (/(^|\.)(?:google\.[a-z.]+|bing\.com|yahoo\.com|duckduckgo\.com|search\.brave\.com)$/i.test(u.hostname)) return null;
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
export function validRadarTime(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const m = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-](\d{2}):(\d{2}))$/);
  return Boolean(m && validRadarDate(m[1]) && +m[2] < 24 && +m[3] < 60 && +m[4] < 60 && (!m[6] || (+m[6] <= 23 && +m[7] < 60)) && Number.isFinite(Date.parse(value)));
}
export function sourceValid(s: any): s is RadarSource {
  if (!s || typeof s.name !== 'string' || !s.name.trim() || s.name.length > 100 || !radarUrl(s.url)) return false;
  const host = new URL(s.url).hostname.toLowerCase();
  if (s.kind === 'disclosure') return /(^|\.)(?:bseindia|nseindia)\.com$/.test(host);
  // Courts and Indian government agencies, RBI, plus the named overseas regulators in intake.
  if (s.kind === 'official') return /(^|\.)(?:gov\.in|nic\.in|rbi\.org\.in|cercind\.gov\.in|fda\.gov|sec\.gov|justice\.gov)$/.test(host);
  // Reviewed investor originals; extend only with verified company/domain evidence.
  if (s.kind === 'company') return /(^|\.)pncinfratech\.com$/.test(host);
  return s.kind === 'news';
}
export function isRadarEvent(e: any, categories?: ReadonlySet<string>): e is RadarEvent {
  return e && typeof e.id === 'string' && RADAR_ID.test(e.id) && isNeutralRadarText(e.title, 200) &&
    Array.isArray(e.companies) && e.companies.length > 0 && e.companies.length <= 20 &&
    e.companies.every((c: any) => c && typeof c.symbol === 'string' && /^[A-Z0-9&._-]{1,30}$/.test(c.symbol) && typeof c.name === 'string' && c.name.length > 0 && c.name.length <= 160 && /^\d{6}$/.test(c.scripCode)) &&
    typeof e.category === 'string' && /^[a-z][a-z0-9_-]{0,63}$/.test(e.category) && (!categories || categories.has(e.category)) && isNeutralRadarText(e.authority, 100) &&
    ['scheduled', 'active', 'monitoring', 'closed'].includes(e.status) &&
    (e.scheduledDate === null || validRadarDate(e.scheduledDate)) && typeof e.scheduleConfirmed === 'boolean' &&
    !(e.scheduleConfirmed && !e.scheduledDate) &&
    isNeutralRadarText(e.information, 1200) && (e.nextTrigger === null || isNeutralRadarText(e.nextTrigger, 400)) &&
    sourceValid(e.source) && validRadarTime(e.publishedAt) && validRadarTime(e.updatedAt) &&
    (e.occurredDate == null || (validRadarDate(e.occurredDate) && e.occurredDate <= radarDay(Date.parse(e.publishedAt)) && sourceValid(e.occurredSource))) &&
    (e.scheduleSource == null || sourceValid(e.scheduleSource)) &&
    (e.supportingSources == null || (Array.isArray(e.supportingSources) && e.supportingSources.length <= 10 && e.supportingSources.every(sourceValid))) &&
    Date.parse(e.updatedAt) >= Date.parse(e.publishedAt);
}
export function isRadarUpdate(u: any): u is RadarUpdate {
  return u && typeof u.id === 'string' && typeof u.eventId === 'string' && RADAR_ID.test(u.id) && RADAR_ID.test(u.eventId) && isNeutralRadarText(u.title, 200) &&
    isNeutralRadarText(u.information, 1200) && sourceValid(u.source) && validRadarTime(u.publishedAt);
}
/** Whitelist the public projection, so an upstream object cannot expose added prediction fields. */
export function publicRadarEvent(e: RadarEvent): RadarEvent {
  return {
    id: e.id, title: e.title, companies: e.companies.map(({ symbol, name, scripCode }) => ({ symbol, name, scripCode })),
    category: e.category, authority: e.authority, status: e.status, scheduledDate: e.scheduledDate,
    scheduleConfirmed: e.scheduleConfirmed, information: e.information, nextTrigger: e.nextTrigger,
    source: { name: e.source.name, url: radarUrl(e.source.url)!, kind: e.source.kind },
    publishedAt: e.publishedAt, updatedAt: e.updatedAt,
    ...(e.occurredDate && e.occurredSource ? { occurredDate: e.occurredDate, occurredSource: { name: e.occurredSource.name, url: radarUrl(e.occurredSource.url)!, kind: e.occurredSource.kind } } : {}),
    ...(e.scheduleSource ? { scheduleSource: { name: e.scheduleSource.name, url: radarUrl(e.scheduleSource.url)!, kind: e.scheduleSource.kind } } : {}),
    ...(e.supportingSources ? { supportingSources: e.supportingSources.map(s => ({ name: s.name, url: radarUrl(s.url)!, kind: s.kind })) } : {}),
  };
}
export function publicRadarUpdate(u: RadarUpdate): RadarUpdate {
  return { id: u.id, eventId: u.eventId, title: u.title, information: u.information,
    source: { name: u.source.name, url: radarUrl(u.source.url)!, kind: u.source.kind }, publishedAt: u.publishedAt };
}
export function isLiveRadarEvent(e: RadarEvent, now: number): boolean {
  return (e.status === 'active' || e.status === 'monitoring') && radarTiming(e, now) === 'live';
}
export function radarTiming(e: RadarEvent, now: number): 'live' | 'upcoming' | 'past' | 'undated' {
  if (e.status === 'closed') return 'past';
  if (e.scheduledDate && e.scheduledDate > radarDay(now)) return 'upcoming';
  if (e.status === 'active') return 'live';
  if (e.status === 'scheduled') return e.scheduledDate ? e.scheduledDate === radarDay(now) ? 'live' : 'past' : 'undated';
  return radarDay(Date.parse(e.updatedAt)) === radarDay(now) ? 'live' : 'past';
}
export const RADAR_TIMING_LABELS = { live: 'Live / today', upcoming: 'Upcoming', past: 'Past development', undated: 'Date pending' };
export function radarCompanyName(c: RadarCompany): string {
  return /[a-z]/i.test(c.name) ? c.name : `BSE ${c.scripCode} · company name pending`;
}
/** A readable company-first label. Original publisher headings remain in the source timeline. */
export function radarHeadline(e: RadarEvent): string {
  const company = radarCompanyName(e.companies[0]);
  if (/intimation under|this is in continuation|regulation 30|disclosure requirements/i.test(e.title)) {
    const topic = /\border\b/i.test(e.title) ? 'order' : /\bhearing\b/i.test(e.title) ? 'hearing' : 'legal matter';
    return `${company}: ${e.authority} ${topic} update`;
  }
  const name = company.replace(/\s+(?:limited|ltd\.?)$/i, '');
  return e.title.toLowerCase().startsWith(name.toLowerCase()) ? e.title : `${company}: ${e.title}`;
}
export function radarCaseLookup(e: RadarEvent): { reference: string | null; party: string; instructions: string } {
  const match = `${e.title} ${e.information}`.match(/\b(?:case|appeal|petition)\s+(?:number\b|no\.?(?=\s|\d)|#)\s*([a-z0-9][a-z0-9./-]{1,40}(?:\s+of\s+20\d{2})?)/i);
  const reference = match && /\d/.test(match[1]) && /20\d{2}/.test(match[1]) ? match[0] : null;
  return { reference, party: e.companies[0].name.replace(/\s+ltd\.?$/i, ' Limited'), instructions: reference
    ? 'Choose the case type, number and year shown above in the official case-status form. Verify the parties against the original source.'
    : 'Case number is not recorded in the available evidence. Open party-name search, enter the company name above, then verify the parties, order date and case type. A matching name alone does not confirm the same proceeding.' };
}
export function radarVerificationSources(e: RadarEvent): RadarSource[] {
  const name = `${e.authority} ${e.title}`;
  if (/Delhi.*(?:High Court|HC)|(?:High Court|HC).*Delhi/i.test(name)) return [
    { name: 'Delhi High Court · party-name search', url: 'https://delhihighcourt.nic.in/app/party-name-wise-status', kind: 'official' },
    { name: 'Delhi High Court · case status', url: 'https://delhihighcourt.nic.in/app/get-case-type-status', kind: 'official' },
  ];
  const authorities: [RegExp, string, string][] = [
    [/Supreme Court/i, 'Supreme Court', 'https://www.sci.gov.in/'], [/SEBI/i, 'SEBI orders and updates', 'https://www.sebi.gov.in/'],
    [/RBI/i, 'RBI notifications', 'https://www.rbi.org.in/'], [/CERC/i, 'CERC orders', 'https://cercind.gov.in/'],
    [/APTEL/i, 'APTEL case information', 'https://aptel.gov.in/'], [/NCLAT/i, 'NCLAT case information', 'https://nclat.nic.in/'],
    [/NCLT/i, 'NCLT case information', 'https://nclt.gov.in/'],
  ];
  const a = authorities.find(([pattern]) => pattern.test(e.authority));
  return a ? [{ name: a[1], url: a[2], kind: 'official' }] : [];
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
  if (filter === 'all') return true;
  if (filter === 'past') return radarTiming(e, now) === 'past';
  if (filter === 'today') return (e.scheduledDate || e.occurredDate || radarDay(Date.parse(e.publishedAt))) === radarDay(now);
  if (e.status === 'closed' || !e.scheduledDate) return false;
  const today = radarDay(now), tomorrow = radarDay(now + 86_400_000);
  if (filter === 'tomorrow') return e.scheduledDate === tomorrow;
  return e.scheduledDate >= today && e.scheduledDate <= radarDay(now + 6 * 86_400_000);
}
