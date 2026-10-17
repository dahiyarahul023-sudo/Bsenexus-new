import { inflateRawSync } from 'node:zlib';
import { radarDay, validRadarDate, type RadarEvent } from '../../src/shared/impactRadar.js';
import type { RadarMovement, RadarSessionMove } from '../../src/shared/radarMovement.js';

const MAX_ZIP = 6_000_000, MAX_CSV = 25_000_000;
export function nseBhavcopyUrl(day: string): string {
  if (!validRadarDate(day)) throw new Error('Invalid report date');
  return `https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_${day.replaceAll('-', '')}_F_0000.csv.zip`;
}
/** Read only the expected single report; never extract paths or trust archive sizes. */
export function readBhavcopyZip(zip: Buffer, day: string): string {
  if (zip.length > MAX_ZIP || zip.length < 22) throw new Error('Invalid report archive');
  let end = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65557); i--) if (zip.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  if (end < 0 || zip.readUInt16LE(end + 10) !== 1) throw new Error('Unexpected archive entries');
  const at = zip.readUInt32LE(end + 16);
  if (at + 46 > end || zip.readUInt32LE(at) !== 0x02014b50) throw new Error('Invalid archive directory');
  const size = zip.readUInt32LE(at + 20), plain = zip.readUInt32LE(at + 24), nameLen = zip.readUInt16LE(at + 28);
  const local = zip.readUInt32LE(at + 42), method = zip.readUInt16LE(at + 10), flags = zip.readUInt16LE(at + 8);
  const name = zip.subarray(at + 46, at + 46 + nameLen).toString();
  if (name !== new URL(nseBhavcopyUrl(day)).pathname.split('/').pop()!.replace(/\.zip$/, '') || plain > MAX_CSV || size > MAX_ZIP || flags & 1 || ![0, 8].includes(method)) throw new Error('Unexpected report');
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
export function parseBhavcopy(csv: string, day: string): Map<string, RadarSessionMove> {
  if (Buffer.byteLength(csv) > MAX_CSV) throw new Error('Report too large');
  const lines = csv.trim().split(/\r?\n/), header = csvRow(lines.shift() || '');
  for (const key of ['TradDt', 'Sgmt', 'Src', 'FinInstrmTp', 'TckrSymb', 'SctySrs', 'ClsPric', 'PrvsClsgPric', 'TtlTradgVol']) if (!header.includes(key)) throw new Error('Unknown report format');
  const rows = new Map<string, RadarSessionMove>();
  for (const line of lines) {
    if (!line.trim()) continue;
    const cells = csvRow(line), get = (key: string) => cells[header.indexOf(key)];
    if (get('TradDt') !== day) throw new Error('Report date mismatch');
    const series = get('SctySrs'), symbol = get('TckrSymb');
    if (get('Sgmt') !== 'CM' || get('Src') !== 'NSE' || get('FinInstrmTp') !== 'STK' || !['EQ', 'BE'].includes(series) || !/^[A-Z0-9&._-]{1,30}$/.test(symbol)) continue;
    const close = Number(get('ClsPric')), previousClose = Number(get('PrvsClsgPric')), volume = Number(get('TtlTradgVol'));
    if (!(close > 0 && previousClose > 0 && volume > 0) || ![close, previousClose, volume].every(Number.isFinite)) continue;
    if (rows.has(symbol) && series !== 'EQ') continue;
    rows.set(symbol, { date: day, symbol, series, close, previousClose, changePercent: (close / previousClose - 1) * 100, sourceUrl: nseBhavcopyUrl(day) });
  }
  return rows;
}
const cache = new Map<string, { until: number; rows: Map<string, RadarSessionMove> | null }>();
const pending = new Map<string, Promise<Map<string, RadarSessionMove> | null>>();
let active = 0;
async function report(day: string): Promise<Map<string, RadarSessionMove> | null> {
  const cached = cache.get(day); if (cached && cached.until > Date.now()) return cached.rows;
  const existing = pending.get(day); if (existing) return existing;
  // Reject excess work rather than building an unbounded upstream queue.
  if (active >= 4) return null;
  const work = (async () => {
    active++;
    let rows: Map<string, RadarSessionMove> | null = null;
    try {
      const response = await fetch(nseBhavcopyUrl(day), { signal: AbortSignal.timeout(5000), redirect: 'error', headers: { Accept: 'application/zip' } });
      if (!response.ok || !response.body) throw new Error('Report unavailable');
      const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
      try { for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > MAX_ZIP) throw new Error('Report too large'); chunks.push(part.value); } }
      finally { await reader.cancel().catch(() => {}); }
      rows = parseBhavcopy(readBhavcopyZip(Buffer.concat(chunks), day), day);
    } catch { /* A blocked, missing or invalid exchange report is not a zero return. */ }
    finally { active--; pending.delete(day); }
    if (cache.size >= 32) cache.delete(cache.keys().next().value!);
    cache.set(day, { until: Date.now() + (rows ? 30 * 60_000 : 60_000), rows });
    return rows;
  })();
  pending.set(day, work); return work;
}
export async function getRadarMovement(event: RadarEvent, now = Date.now(), loadReport = report): Promise<RadarMovement> {
  const anchorDate = event.occurredDate || radarDay(Date.parse(event.publishedAt));
  const local = new Date(Date.parse(event.publishedAt) + 330 * 60_000);
  const afterClose = !event.occurredDate && local.getUTCHours() * 60 + local.getUTCMinutes() >= 15 * 60 + 30;
  const result: RadarMovement = { basis: event.occurredDate ? 'event-date' : 'report-date', anchorDate, afterClose, checkedAt: new Date(now).toISOString(), status: 'unavailable', companies: event.companies.slice(0, 3).map(c => ({ symbol: c.symbol, sessions: [] })) };
  if (anchorDate > radarDay(now) || event.status === 'scheduled') return { ...result, status: 'upcoming' };
  const dates: string[] = [];
  for (let i = 0; i < 8; i++) {
    const day = new Date(Date.parse(anchorDate) + i * 86400000).toISOString().slice(0, 10);
    // The final daily report may not yet exist; never present intraday quotes as a close.
    if (Date.parse(`${day}T10:30:00Z`) > now) break;
    dates.push(day);
  }
  // Two bounded batches, shared per-date cache across every company and case.
  for (let i = 0; i < dates.length; i += 4) {
    const reports = await Promise.all(dates.slice(i, i + 4).map(day => loadReport(day).catch(() => null)));
    for (const rows of reports) for (const company of result.companies) {
      const row = rows?.get(company.symbol); if (row && company.sessions.length < 3) company.sessions.push(row);
    }
    if (result.companies.every(c => c.sessions.length === 3)) break;
  }
  const count = result.companies.reduce((n, c) => n + c.sessions.length, 0);
  result.status = count ? result.companies.every(c => c.sessions.length === 3) ? 'available' : 'partial' : 'unavailable';
  return result;
}
