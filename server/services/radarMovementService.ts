import { inflateRawSync } from 'node:zlib';
import { radarDay, validRadarDate, type RadarEvent } from '../../src/shared/impactRadar.js';
import type { RadarMovement, RadarSessionMove } from '../../src/shared/radarMovement.js';
import { resolveRadarCompany, radarCompanyKey } from './radarCompanyIdentity.js';
import { readRadarPriceSessions, saveRadarPriceSessions } from '../database/radarPriceDao.js';
import { EnvHttpProxyAgent, type Dispatcher } from 'undici';

const MAX_ZIP = 6_000_000, MAX_CSV = 25_000_000;
export function nseBhavcopyUrl(day: string): string {
  if (!validRadarDate(day)) throw new Error('Invalid report date');
  return `https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_${day.replaceAll('-', '')}_F_0000.csv.zip`;
}
export function bseBhavcopyUrl(day: string): string {
  if (!validRadarDate(day)) throw new Error('Invalid report date');
  return `https://www.bseindia.com/download/BhavCopy/Equity/BhavCopy_BSE_CM_0_0_0_${day.replaceAll('-', '')}_F_0000.csv.zip`;
}
/** Read only the expected single report; never extract paths or trust archive sizes. */
export function readBhavcopyZip(zip: Buffer, day: string, exchange: 'NSE' | 'BSE' = 'NSE'): string {
  if (zip.length > MAX_ZIP || zip.length < 22) throw new Error('Invalid report archive');
  let end = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65557); i--) if (zip.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  if (end < 0 || zip.readUInt16LE(end + 10) !== 1) throw new Error('Unexpected archive entries');
  const at = zip.readUInt32LE(end + 16);
  if (at + 46 > end || zip.readUInt32LE(at) !== 0x02014b50) throw new Error('Invalid archive directory');
  const size = zip.readUInt32LE(at + 20), plain = zip.readUInt32LE(at + 24), nameLen = zip.readUInt16LE(at + 28);
  const local = zip.readUInt32LE(at + 42), method = zip.readUInt16LE(at + 10), flags = zip.readUInt16LE(at + 8);
  const name = zip.subarray(at + 46, at + 46 + nameLen).toString();
  if (name !== new URL(exchange === 'NSE' ? nseBhavcopyUrl(day) : bseBhavcopyUrl(day)).pathname.split('/').pop()!.replace(/\.zip$/, '') || plain > MAX_CSV || size > MAX_ZIP || flags & 1 || ![0, 8].includes(method)) throw new Error('Unexpected report');
  if (local + 30 > at || zip.readUInt32LE(local) !== 0x04034b50) throw new Error('Invalid report entry');
  const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
  if (start + size > at) throw new Error('Truncated report');
  const result = method === 8 ? inflateRawSync(zip.subarray(start, start + size), { maxOutputLength: MAX_CSV }) : zip.subarray(start, start + size);
  if (result.length !== plain) throw new Error('Invalid report size');
  return result.toString('utf8').replace(/^\uFEFF/, '');
}
function csvRow(line: string): string[] {
  const out: string[] = []; let value = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (quoted && line[i + 1] === '"') { value += '"'; i++; } else quoted = !quoted; }
    else if (c === ',' && !quoted) { out.push(value.trim()); value = ''; } else value += c;
  }
  if (quoted) throw new Error('Invalid CSV'); out.push(value.trim()); return out;
}
export function parseBhavcopy(csv: string, day: string, exchange: 'NSE' | 'BSE' = 'NSE'): Map<string, RadarSessionMove> {
  if (Buffer.byteLength(csv) > MAX_CSV) throw new Error('Report too large');
  const lines = csv.trim().split(/\r?\n/), header = csvRow(lines.shift() || '');
  for (const key of ['TradDt', 'Sgmt', 'Src', 'FinInstrmTp', 'TckrSymb', 'SctySrs', 'ClsPric', 'PrvsClsgPric', 'TtlTradgVol']) if (!header.includes(key)) throw new Error('Unknown report format');
  if (exchange === 'BSE' && !header.includes('FinInstrmId')) throw new Error('Unknown report format');
  const rows = new Map<string, RadarSessionMove>();
  for (const line of lines) {
    if (!line.trim()) continue;
    const cells = csvRow(line), get = (key: string) => cells[header.indexOf(key)];
    if (get('TradDt') !== day) throw new Error('Report date mismatch');
    const series = get('SctySrs') || '', symbol = exchange === 'BSE' ? get('FinInstrmId') : get('TckrSymb');
    if (get('Sgmt') !== 'CM' || get('Src') !== exchange || get('FinInstrmTp') !== 'STK' || (exchange === 'NSE' ? !['EQ', 'BE','BZ','SM','ST'].includes(series) : !/^\d{6}$/.test(symbol) || !/^[A-Z0-9]{0,3}$/.test(series)) || !/^[A-Z0-9&._-]{1,30}$/.test(symbol)) continue;
    const close = Number(get('ClsPric')), previousClose = Number(get('PrvsClsgPric')), volume = Number(get('TtlTradgVol'));
    if (!(close > 0 && previousClose > 0 && volume >= 0) || !get('TtlTradgVol') || ![close, previousClose, volume].every(Number.isFinite)) continue;
    if (rows.has(symbol) && series !== 'EQ') continue;
    const high = Number(get('HghPric')), low = Number(get('LwPric'));
    const companyName = get('FinInstrmNm');
    rows.set(symbol, { date: day, symbol, series, close, previousClose, changePercent: (close / previousClose - 1) * 100, sourceUrl: exchange === 'NSE' ? nseBhavcopyUrl(day) : bseBhavcopyUrl(day),
      ...(exchange === 'BSE' ? {exchange} : {}),
      ...(typeof companyName === 'string' && /[a-z]/i.test(companyName) && companyName.length <= 160 && !/[<>]/.test(companyName) ? {companyName} : {}),
      ...(Number.isFinite(high) && Number.isFinite(low) && high >= close && low > 0 && low <= close ? { high, low } : {}) });
  }
  return rows;
}
const cache = new Map<string, { until: number; rows: Map<string, RadarSessionMove> | null }>();
const pending = new Map<string, Promise<Map<string, RadarSessionMove> | null>>();
let active = 0;
const waiting: (() => void)[] = [];
async function acquireReportSlot(): Promise<boolean> {
  if (active < 4) { active++; return true; }
  if (waiting.length >= 16) return false;
  await new Promise<void>(resolve => waiting.push(resolve)); return true;
}
let proxyAgent: Dispatcher | undefined;
/** Honor a configured egress proxy for exchange requests only; never change global networking. */
function reportDispatcher(): Dispatcher | undefined {
  if (!(process.env.https_proxy || process.env.HTTPS_PROXY || process.env.http_proxy || process.env.HTTP_PROXY)) return undefined;
  return proxyAgent ||= new EnvHttpProxyAgent();
}
async function report(day: string, exchange: 'NSE' | 'BSE' = 'NSE'): Promise<Map<string, RadarSessionMove> | null> {
  const key = `${exchange}:${day}`;
  const cached = cache.get(key); if (cached && cached.until > Date.now()) return cached.rows;
  const existing = pending.get(key); if (existing) return existing;
  const work = (async () => {
    if (!await acquireReportSlot()) { pending.delete(key); return null; }
    let rows: Map<string, RadarSessionMove> | null = null;
    try {
      const options: RequestInit & { dispatcher?: Dispatcher } = { signal: AbortSignal.timeout(10_000), redirect: 'error', dispatcher: reportDispatcher(), headers: { Accept: 'application/zip', 'User-Agent': 'Mozilla/5.0', Referer: exchange === 'NSE' ? 'https://www.nseindia.com/' : 'https://www.bseindia.com/' } };
      const response = await fetch(exchange === 'NSE' ? nseBhavcopyUrl(day) : bseBhavcopyUrl(day), options);
      if (!response.ok || !response.body) throw new Error('Report unavailable');
      const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
      try { for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > MAX_ZIP) throw new Error('Report too large'); chunks.push(part.value); } }
      finally { await reader.cancel().catch(() => {}); }
      rows = parseBhavcopy(readBhavcopyZip(Buffer.concat(chunks), day, exchange), day, exchange);
    } catch { /* A blocked, missing or invalid exchange report is not a zero return. */ }
    finally { const next = waiting.shift(); if (next) next(); else active--; pending.delete(key); }
    if (cache.size >= 32) cache.delete(cache.keys().next().value!);
    cache.set(key, { until: Date.now() + (rows ? 30 * 60_000 : 60_000), rows });
    return rows;
  })();
  pending.set(key, work); return work;
}
type ReportLoader = (day: string) => Promise<Map<string, RadarSessionMove> | null>;
export async function getRadarMovement(event: RadarEvent, now = Date.now(), loadReport: ReportLoader = report, store = { read: readRadarPriceSessions, save: saveRadarPriceSessions }, loadBse: ReportLoader | null = loadReport === report ? day => report(day, 'BSE') : null): Promise<RadarMovement> {
  const deadline = Date.now() + 24_000;
  const bounded = async (task: () => ReturnType<ReportLoader>) => {
    const left = deadline - Date.now(); if (left <= 0) return null;
    let timer: ReturnType<typeof setTimeout>;
    try { return await Promise.race([task().catch(() => null), new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), left); })]); }
    finally { clearTimeout(timer!); }
  };
  event = { ...event, companies: event.companies.map(c => resolveRadarCompany(c, event.title, event.source)) };
  const anchorDate = event.occurredDate || radarDay(Date.parse(event.publishedAt));
  const local = new Date(Date.parse(event.publishedAt) + 330 * 60_000);
  const afterClose = local.getUTCHours() * 60 + local.getUTCMinutes() >= 15 * 60 + 30;
  const result: RadarMovement = { basis: event.occurredDate ? 'event-date' : 'report-date', anchorDate, afterClose, checkedAt: new Date(now).toISOString(), status: 'unavailable', companies: event.companies.slice(0, 3).map(c => ({ symbol: c.symbol, name: c.name, sessions: [] })) };
  if (anchorDate > radarDay(now)) return { ...result, status: 'upcoming' };
  const dates: string[] = [];
  for (let i = 0; i < 8; i++) {
    const day = new Date(Date.parse(anchorDate) + i * 86400000).toISOString().slice(0, 10);
    // The final daily report may not yet exist; never present intraday quotes as a close.
    if (Date.parse(`${day}T10:30:00Z`) > now) break;
    dates.push(day);
  }
  const saved = loadReport === report ? await store.read(result.companies.map(c => c.symbol), dates) : [];
  const savedForDay = (day: string) => new Map(saved.filter(s => s.date === day).map(s => [s.symbol, s]));
  const load = async (day: string) => {
    const recorded = savedForDay(day);
    if (result.companies.every(c => recorded.has(c.symbol))) return recorded;
    const fresh = await bounded(() => loadReport(day));
    for (const company of event.companies.slice(0,3)) {
      if (recorded.has(company.symbol)) continue;
      let row = fresh?.get(company.symbol);
      // An exact unique complete company-name match may resolve a missing exchange symbol.
      // Partial/fuzzy names and ambiguous report rows never establish an identity.
      if (!row && /[a-z]/i.test(company.name) && radarCompanyKey(company.name).length >= 8) {
        const matches = [...(fresh?.values() || [])].filter(r => r.companyName && radarCompanyKey(r.companyName) === radarCompanyKey(company.name));
        if (matches.length === 1) row = matches[0];
      }
      if (row) recorded.set(company.symbol, {...row,symbol:company.symbol,...(row.symbol !== company.symbol ? {exchangeSymbol:row.symbol}: {})});
    }
    if (loadBse && !result.companies.every(c => recorded.has(c.symbol))) {
      const bse = await bounded(() => loadBse(day));
      for (const company of event.companies.slice(0,3)) {
        const row = bse?.get(company.scripCode);
        if (!recorded.has(company.symbol) && row) recorded.set(company.symbol,{...row,symbol:company.symbol,exchangeSymbol:company.scripCode});
      }
    }
    return recorded;
  };
  // Stop after three available records; do not wait on a fourth (often unpublished) report.
  for (let i = 0; i < dates.length; i += 3) {
    const reports = await Promise.all(dates.slice(i, i + 3).map(load));
    for (const rows of reports) for (const company of result.companies) {
      const row = rows?.get(company.symbol); if (row && company.sessions.length < 3) company.sessions.push(row);
    }
    if (result.companies.every(c => c.sessions.length === 3)) break;
  }
  const count = result.companies.reduce((n, c) => n + c.sessions.length, 0);
  if (loadReport === report && count) await store.save(result.companies.flatMap(c => c.sessions));
  result.status = count ? result.companies.every(c => c.sessions.length === 3) ? 'available' : 'partial' : 'unavailable';
  return result;
}
