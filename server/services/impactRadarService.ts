import { createHash } from 'node:crypto';
import { getRecentAnnouncements } from '../database/announcementDao.js';
import { getAllStockEntries, resolveStockDetailsSync } from '../utils/stockResolver.js';
import { fetchGeneralMarketNews, getNewsSourceState } from './stockNewsService.js';
import { publishRadarRecords, type RadarRecord } from '../database/impactRadarDao.js';
import { isNeutralRadarText, isRadarEvent, radarUrl, type RadarCategory, type RadarEvent, type RadarSource } from '../../src/shared/impactRadar.js';

const digest = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 32);
const text = (s: unknown) => typeof s === 'string' ? s.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim() : '';
function sourceIdentity(source: RadarSource): string {
  const url = new URL(source.url); url.hash = '';
  for (const key of [...url.searchParams.keys()]) if (/^utm_|^fbclid$|^gclid$/i.test(key)) url.searchParams.delete(key);
  return url.href;
}
export function classifyRadarEvent(title: string): { category: RadarCategory; authority: string } | null {
  const authority = /\bsupreme court\b/i.test(title) ? 'Supreme Court' : /\bhigh court\b/i.test(title) ? 'High Court' :
    /\bNCLAT\b/i.test(title) ? 'NCLAT' : /\bNCLT\b/i.test(title) ? 'NCLT' : /\bAPTEL\b/i.test(title) ? 'APTEL' :
    /\bCERC\b/i.test(title) ? 'CERC' : /\bSEBI\b/i.test(title) ? 'SEBI' : /\bRBI\b/i.test(title) ? 'RBI' :
    /\b(?:USFDA|FDA)\b/i.test(title) ? 'USFDA' : /\b(?:IRDAI|CCI|NGT|DGGI|SAT|ED|SFIO|DOJ|SEC)\b/.exec(title)?.[0];
  // A generic "SEBI Regulation 30" disclosure alone is not a legal event.
  if (!authority || !/\b(?:order|hearing|judgment|judgement|petition|appeal|litigation|tribunal|penalty|demand|restriction|restricted|ban|licen[cs]e|investigation|indictment|insolvency|injunction|market coupling|show.?cause|warning letter|settlement)\b/i.test(title)) return null;
  const category: RadarCategory = /\b(?:insolvency|merger|arbitration|deal|acquisition)\b/i.test(title) ? 'deals' :
    /\b(?:market coupling|pricing rules|tariff|regulatory framework)\b/i.test(title) ? 'rules' :
    /\b(?:tax|demand|liability|penalty|compensation|AT.?1)\b/i.test(title) ? 'liability' :
    /\b(?:fraud|investigation|indictment|promoter|bribery)\b/i.test(title) ? 'governance' :
    /\b(?:plant|licen[cs]e|environment|warning letter|inspection)\b/i.test(title) ? 'operations' :
    /\b(?:restriction|restricted|ban|halt|stop)\b/i.test(title) ? 'restriction' : 'legal';
  return { category, authority };
}
/** Conservative discovery only: dates, outcomes and price effects are never inferred. */
export function radarRecordFromSource(input: {
  sourceId: string; title: string; publishedAt: string; source: RadarSource;
  company: { symbol: string; name: string; scripCode: string };
}, now = Date.now()): RadarRecord | null {
  const title = text(input.title);
  const classified = classifyRadarEvent(title);
  const ts = Date.parse(input.publishedAt);
  if (!classified || !isNeutralRadarText(title, 200) || !radarUrl(input.source.url) || !Number.isFinite(ts) || ts > now || ts < now - 7 * 86_400_000) return null;
  if (!/^\d{6}$/.test(input.company.scripCode)) return null;
  // Group only an explicit case reference within the same company and authority.
  // Missing references remain separate source reports rather than guessing a shared case.
  const reference = title.match(/\b(?:case|appeal|petition)\s*(?:no\.?|number|#)\s*([a-z0-9][a-z0-9./-]{1,40}(?:\s+of\s+\d{4})?)/i)?.[1].toUpperCase().replace(/\s+/g, '');
  const unambiguousReference = reference && /(?:^|[/.\-]|OF)20\d{2}(?:$|[/.\-])/.test(reference) &&
    ['Supreme Court', 'SEBI', 'RBI', 'APTEL', 'CERC', 'NCLAT'].includes(classified.authority);
  const sourceKey = sourceIdentity(input.source);
  const id = `radar_${digest(unambiguousReference ? `${input.company.scripCode}:${classified.authority}:${reference}` : `${input.company.scripCode}:${sourceKey}`)}`;
  const information = input.source.kind === 'news'
    ? 'A news source has reported this development. Read the original report for details; an official outcome has not been independently confirmed here.'
    : 'The company has published a legal or regulatory disclosure. Read the original filing for the scope and current position.';
  const scheduled = /\b(?:to hear|will hear|scheduled|listed for|hearing on|hearing scheduled)\b/i.test(title);
  const event: RadarEvent = { id, title, companies: [input.company], ...classified, status: scheduled ? 'scheduled' : 'monitoring', scheduledDate: null,
    scheduleConfirmed: false, information, nextTrigger: null, source: input.source,
    publishedAt: new Date(ts).toISOString(), updatedAt: new Date(ts).toISOString() };
  if (!isRadarEvent(event)) return null;
  return { event, update: { id: `update_${digest(`${sourceKey}:${event.publishedAt}:${title}`)}`, eventId: id, title, information, source: input.source, publishedAt: event.publishedAt }, origin: 'intake' };
}
let running: Promise<void> | null = null;
let lastCheckedAt: number | null = null;
let lastAttempt = 0;
let lastError = false;
export function radarIntakeStatus() { return { checkedAt: lastCheckedAt, unavailable: lastError }; }
export async function refreshRadarIntake(): Promise<void> {
  if (running) return running;
  if (Date.now() - lastAttempt < 60_000) return;
  lastAttempt = Date.now();
  running = (async () => {
    try {
      const filings = await getRecentAnnouncements(1500);
      const records: RadarRecord[] = [];
      for (const f of filings) {
        const title = text(f.subject || f.NEWSSUB);
        if (!classifyRadarEvent(title)) continue;
        const scrip = String(f.scrip_cd || f.SCRIP_CD || '');
        const entry = resolveStockDetailsSync(scrip);
        const ts = typeof f.bseTimestamp === 'number' ? f.bseTimestamp : NaN;
        const url = radarUrl(f.pdfLink);
        if (!entry || !url || !/(^|\.)(?:bseindia|nseindia)\.com$/i.test(new URL(url).hostname) || !Number.isFinite(ts)) continue;
        const record = radarRecordFromSource({ sourceId: `filing:${f.id || url}`, title, publishedAt: new Date(ts).toISOString(),
          source: { name: /nseindia/.test(url) ? 'NSE company disclosure' : 'BSE company disclosure', url, kind: 'disclosure' },
          company: { symbol: entry.symbol, name: entry.name, scripCode: entry.scripCode } });
        if (record) records.push(record);
        if (records.length >= 40) break;
      }
      // Reuse the existing service's shared three-minute cache; no second RSS worker.
      const stories = await fetchGeneralMarketNews(false);
      const entries = getAllStockEntries();
      for (const n of stories) {
        if (records.length >= 60) break;
        if (n.publicationTimeKnown === false || !classifyRadarEvent(text(n.title))) continue;
        const title = text(n.title);
        const entry = entries.find(e => e.name.length >= 7 && title.toLowerCase().includes(e.name.replace(/\s+(?:limited|ltd\.?)$/i, '').toLowerCase())) ||
          entries.find(e => e.symbol.length >= 3 && new RegExp(`(?:^|[^A-Za-z0-9])${e.symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^A-Za-z0-9])`).test(title));
        if (!entry) continue;
        const r = radarRecordFromSource({ sourceId: `news:${n.id || n.link}`, title, publishedAt: n.publishedAt,
          source: { name: n.source, url: n.link, kind: 'news' }, company: { symbol: entry.symbol, name: entry.name, scripCode: entry.scripCode } });
        if (r) records.push(r);
      }
      await publishRadarRecords(records);
      lastCheckedAt = Date.now(); lastError = getNewsSourceState().unavailable;
    } catch { lastError = true; }
    finally { running = null; }
  })();
  return running;
}
