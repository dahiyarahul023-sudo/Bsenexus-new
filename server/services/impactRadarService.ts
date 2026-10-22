import { createHash } from 'node:crypto';
import { radarCaseIdentity, radarSourceIdentity } from './radarCaseIdentity.js';
import { readRadarSourceCheck, saveRadarSourceCheck, radarSourceStatus } from '../database/radarSourceDao.js';
import { PNC_REVIEW } from './radarReviewedEvidence.js';
import { refreshRadarCompanyIdentity, radarCompanyFromFiling } from './radarCompanyIdentity.js';
import { getRecentAnnouncements } from '../database/announcementDao.js';
import { getAllStockEntries, resolveStockDetailsStrict } from '../utils/stockResolver.js';
import { fetchGeneralMarketNews, getNewsSourceState, type StockNewsItem } from './stockNewsService.js';
import { publishRadarRecords, getRadarIntakeRules, type RadarRecord } from '../database/impactRadarDao.js';
import { newsPublicationTime } from '../utils/newsPublicationTime.js';
import { DEFAULT_RADAR_INTAKE_RULES, matchRadarIntakeRule, radarWords, type RadarIntakeRule } from './radarIntakePolicy.js';
import { isRoutineRadarTransaction, radarScopeText, radarSourceSummary } from '../../src/shared/radarScope.js';
import { isNeutralRadarText, isRadarEvent, radarUrl, radarDay, validRadarDate, validRadarTime, type RadarCategory, type RadarEvent, type RadarSource } from '../../src/shared/impactRadar.js';

const digest = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 32);
const text = (s: unknown) => typeof s === 'string' ? s.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim() : '';
const MATERIAL = /\b(?:order|orders|hearing|judgment|judgement|petition|appeal|litigation|tribunal|penalty|demand|restriction|restricted|ban|debarment|stays?|quashes|relief|licen[cs]e|investigat\w*|indictment|insolvency|injunction|blocks?|rejects?|prohibits?|revokes?|market coupling|show.?cause|warning letter|settlement)\b/i;
export function classifyRadarEvent(title: string, rules: readonly RadarIntakeRule[] = DEFAULT_RADAR_INTAKE_RULES): { category: RadarCategory; authority: string } | null {
  if (isRoutineRadarTransaction(title)) return null;
  title = radarScopeText(title);
  const authority = /\bsupreme court\b/i.test(title) ? 'Supreme Court' : /\bDelhi\s+(?:High Court|HC)\b|\bHigh Court\s+of\s+Delhi\b/i.test(title) ? 'Delhi High Court' : /\bhigh court\b/i.test(title) ? 'High Court' :
    /\bNCLAT\b/i.test(title) ? 'NCLAT' : /\bNCLT\b/i.test(title) ? 'NCLT' : /\bAPTEL\b/i.test(title) ? 'APTEL' :
    /\bCERC\b/i.test(title) ? 'CERC' : /\bSEBI\b/i.test(title) ? 'SEBI' : /\bRBI\b/i.test(title) ? 'RBI' :
    /\b(?:USFDA|FDA)\b/i.test(title) ? 'USFDA' : /\b(?:Commissioner of Customs|Customs)\b/i.test(title) ? 'Customs' : /\bGST Department\b/i.test(title) ? 'GST Department' : /\b(?:IRDAI|CCI|NGT|DGGI|SAT|ED|SFIO|DOJ|SEC)\b/.exec(title)?.[0];
  // A generic "SEBI Regulation 30" disclosure alone is not a legal event.
  const rule = matchRadarIntakeRule(title, rules);
  if (!authority || !MATERIAL.test(title)) return rule ? { category: rule.category, authority: authority || rule.label } : null;
  const category: RadarCategory = /\b(?:insolvency|bankruptcy|CIRP|arbitration|arbitral)\b/i.test(title) ? 'deals' :
    /\b(?:market coupling|pricing rules|tariff|regulatory framework)\b/i.test(title) ? 'rules' :
    /\b(?:tax|demand|liability|penalty|compensation|AT.?1)\b/i.test(title) ? 'liability' :
    /\b(?:fraud|investigat\w*|indictment|promoter|bribery)\b/i.test(title) ? 'governance' :
    /\b(?:plant|licen[cs]e|environment|warning letter|inspection)\b/i.test(title) ? 'operations' :
    /\b(?:restriction|restricted|ban|debarment|halt|stop|blocks?|prohibits?)\b/i.test(title) ? 'restriction' : 'legal';
  return { category, authority };
}
function explicitDate(value: string): string | null {
  const numeric = value.match(/^(\d{1,2})[./-](\d{1,2})[./-](20\d{2})/);
  const named = value.match(/^(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})/i);
  const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  const day = numeric?.[1] || named?.[1], month = numeric?.[2] || (named ? String(months.indexOf(named[2].toLowerCase()) + 1) : ''), year = numeric?.[3] || named?.[3];
  const date = `${year}-${month.padStart(2, '0')}-${day?.padStart(2, '0')}`;
  return validRadarDate(date) ? date : null;
}
export function matchRadarCompany(title: string, entries: { symbol: string; name: string; scripCode: string; nameKeywords?: string[] }[]) {
  entries = [...new Map(entries.filter(e => /^\d{6}$/.test(e.scripCode) && /[a-z]/i.test(e.name)).map(e => [e.scripCode, e])).values()];
  const normalized = radarWords(title);
  const named = entries.filter(e => {
    const names = [e.name, ...(e.nameKeywords || [])].map(n => n.replace(/\s+(?:limited|ltd\.?)$/i, '').trim());
    return names.some(name => name.length >= 7 && normalized.includes(radarWords(name)));
  });
  if (named.length > 1) return null;
  const symbols = entries.filter(e => e.symbol.length >= 3 && new RegExp(`(?:^|[^A-Za-z0-9])${e.symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^A-Za-z0-9])`).test(title));
  const matches = [...new Map([...named, ...symbols].map(e => [e.scripCode, e])).values()];
  return matches.length === 1 ? matches[0] : null;
}
/** Conservative discovery only: dates, outcomes and price effects are never inferred. */
export function radarRecordFromSource(input: {
  sourceId: string; title: string; publishedAt: string; source: RadarSource;
  company: { symbol: string; name: string; scripCode: string }; evidence?: string; rules?: readonly RadarIntakeRule[];
}, now = Date.now()): RadarRecord | null {
  const title = text(input.title);
  const classified = classifyRadarEvent(`${title} ${text(input.evidence)}`, input.rules);
  const summary = radarSourceSummary(title, text(input.evidence));
  const ts = Date.parse(input.publishedAt);
  if (!classified || !summary || !isNeutralRadarText(title, 200) || !isNeutralRadarText(summary, 200) || !radarUrl(input.source.url) || !validRadarTime(input.publishedAt) || ts > now || ts < now - 7 * 86_400_000) return null;
  if (!/^\d{6}$/.test(input.company.scripCode)) return null;
  const sourceKey = radarSourceIdentity(input.source);
  const { id } = radarCaseIdentity(input.company.scripCode, classified.authority, title, input.source, input.publishedAt);
  const reported = input.source.kind === 'news' || input.source.kind === 'report';
  const attributed = reported ? `${input.source.name} reported: ${text(input.evidence)} Official confirmation is not recorded in this source.` : text(input.evidence);
  const information = input.evidence && isNeutralRadarText(attributed, 1200) ? attributed : reported
    ? 'A news source has reported this development. Read the original report for details; an official outcome has not been independently confirmed here.'
    : 'The company has published a legal or regulatory disclosure. Read the original filing for the scope and current position.';
  const scheduled = /\b(?:to hear|will hear|scheduled|listed for|hearing on|hearing scheduled)\b/i.test(title);
  const event: RadarEvent = { id, title: summary, companies: [input.company], ...classified, status: scheduled ? 'scheduled' : 'monitoring', scheduledDate: null,
    scheduleConfirmed: false, information, nextTrigger: null, source: input.source,
    publishedAt: new Date(ts).toISOString(), updatedAt: new Date(ts).toISOString() };
  const evidence = `${title} ${text(input.evidence)}`;
  const nextText = evidence.match(/\b(?:hearing\s+(?:scheduled\s+)?(?:on|for)|listed\s+for|next\s+(?:hearing|listing)\s+(?:is\s+)?(?:on|date[:\s]+))\s+(.{8,30})/i)?.[1];
  const nextDate = nextText ? explicitDate(nextText) : null;
  if (nextDate && nextDate >= radarDay(ts) && Date.parse(nextDate) - ts < 730 * 86400000) {
    event.status = 'scheduled'; event.scheduledDate = nextDate; event.scheduleConfirmed = !reported && !/\b(?:tentative|proposed|subject to|expected|could)\b|\bmay\s+(?:be|take|occur|hear|list)\b/i.test(evidence); event.scheduleSource = input.source;
  }
  const happened = evidence.match(/\b(?:court(?:\s+of\s+delhi)?|tribunal|SEBI|RBI|APTEL|CERC|NCLAT|NCLT)\s+(?:order|judgment|judgement)\s+(?:dated|passed\s+on)\s+(.{8,30})/i)?.[1];
  const occurredDate = happened ? explicitDate(happened) : null;
  if (occurredDate && occurredDate <= radarDay(ts) && !reported) { event.occurredDate = occurredDate; event.occurredSource = input.source; }
  if (!isRadarEvent(event)) return null;
  return { event, update: { id: `update_${digest(`${sourceKey}:${event.publishedAt}:${title}${reported && input.evidence ? ':' + information : ''}`)}`, eventId: id, title, information, source: input.source, publishedAt: event.publishedAt }, origin: 'intake' };
}
export function radarRecordFromNews(n: StockNewsItem, entries: { symbol: string; name: string; scripCode: string; nameKeywords?: string[] }[], now = Date.now(), rules: readonly RadarIntakeRule[] = DEFAULT_RADAR_INTAKE_RULES): RadarRecord | null {
  if (n.publicationTimeKnown !== true || n.hasArticleLink !== true) return null;
  const title = text(n.title), entry = matchRadarCompany(title, entries), publishedAt = newsPublicationTime(n.publishedAt);
  return entry && publishedAt ? radarRecordFromSource({ sourceId: `news:${n.id || n.link}`, title, publishedAt, rules, evidence: text(n.snippet) || undefined,
    source: { name: n.source, url: n.link, kind: 'news' }, company: entry }, now) : null;
}
let running: Promise<void> | null = null;
let lastCheckedAt: number | null = null;
let lastAttempt = 0;
let lastError = false;
/** Explicitly reviewed historical evidence; automatic discovery keeps its seven-day bound. */
export function reviewedRadarRecords(now = Date.now()): RadarRecord[] {
  const p = PNC_REVIEW, company = resolveStockDetailsStrict(p.scripCode);
  if (!company || Date.parse(p.filingAt) > now) return [];
  const base = radarRecordFromSource({ sourceId: 'reviewed-pnc-filing', title: p.title, publishedAt: p.filingAt, company,
    source: { name: 'BSE company disclosure', url: p.filingUrl, kind: 'disclosure' }, evidence: p.information }, Date.parse(p.filingAt));
  if (!base) return [];
  base.origin = 'editorial';
  base.event.occurredDate = p.orderDate;
  base.event.occurredSource = { name: 'PNC Infratech · original investor disclosure', url: p.investorUrl, kind: 'company' };
  base.event.supportingSources = [base.event.occurredSource, { name: 'CNBC TV18 syndication · publication timestamp', url: 'https://www.tradingview.com/news/cnbctv:c90dfbcd4094b:0/', kind: 'news' }];
  const records = [base];
  for (const n of p.news) {
    if (Date.parse(n.publishedAt) > now) continue;
    records.push({ origin: 'editorial', event: { ...base.event, updatedAt: n.publishedAt, ...('nextHearing' in n ? { status: 'scheduled', scheduledDate: n.nextHearing, scheduleConfirmed: false, scheduleSource: { name: n.name, url: n.url, kind: 'news' }, nextTrigger: 'A news report lists a hearing on 26 November 2026. Confirmation from the court case record is pending.' } as const : {}) }, update: {
      id: `update_${digest(`${n.url}:${n.publishedAt}:reviewed-v1`)}`, eventId: base.event.id, title: n.title,
      information: n.information, publishedAt: n.publishedAt, source: { name: n.name, url: n.url, kind: 'news' },
    } });
  }
  return records;
}
export function radarIntakeStatus() {
  const news = getNewsSourceState();
  return radarSourceStatus(lastCheckedAt === null ? null : {checkedAt:lastCheckedAt,available:!lastError,newsAvailable:!news.unavailable && !news.stale});
}
/** Process restarts and another hosting instance must not invent a source delay. */
export async function durableRadarIntakeStatus() {
  const local = radarIntakeStatus();
  try {
    const stored = await readRadarSourceCheck();
    return stored && (local.checkedAt === null || stored.checkedAt >= local.checkedAt) ? radarSourceStatus(stored) : local;
  } catch { return {...local,unavailable:local.checkedAt === null || local.unavailable,statusUnavailable:true}; }
}
export async function refreshRadarIntake(): Promise<void> {
  if (running) return running;
  if (Date.now() - lastAttempt < 60_000) return;
  lastAttempt = Date.now();
  running = (async () => {
    try {
      const rules = await getRadarIntakeRules();
      const [filingResult, newsResult] = await Promise.allSettled([getRecentAnnouncements(1500), fetchGeneralMarketNews(false)]);
      const filings = filingResult.status === 'fulfilled' ? filingResult.value : [];
      const unknown = [...new Set(filings.filter(f => classifyRadarEvent(`${text(f.subject || f.NEWSSUB)} ${text(f.details || f.HEADLINE)}`, rules)).map(f => String(f.scrip_cd || f.SCRIP_CD || '')))].filter(code => !resolveStockDetailsStrict(code)).slice(0, 8);
      for (let i = 0; i < unknown.length; i += 4) await Promise.allSettled(unknown.slice(i, i + 4).map(refreshRadarCompanyIdentity));
      const records: RadarRecord[] = reviewedRadarRecords();
      for (const f of filings) {
        const subject = text(f.subject || f.NEWSSUB), evidence = text(f.details || f.HEADLINE);
        const classified = classifyRadarEvent(`${subject} ${evidence}`, rules);
        if (!classified) continue;
        const scrip = String(f.scrip_cd || f.SCRIP_CD || '');
        const entry = radarCompanyFromFiling({ ...f, scrip_cd: scrip, subject });
        const ts = typeof f.bseTimestamp === 'number' ? f.bseTimestamp : NaN;
        const url = radarUrl(f.pdfLink);
        if (!entry || !url || !/(^|\.)(?:bseindia|nseindia)\.com$/i.test(new URL(url).hostname) || !Number.isFinite(ts)) continue;
        const title = classifyRadarEvent(subject, rules) && subject.length <= 200 ? subject : evidence.length <= 200 && classifyRadarEvent(evidence, rules) ? evidence : '';
        if (!title) continue;
        const record = radarRecordFromSource({ sourceId: `filing:${f.id || url}`, title, publishedAt: new Date(ts).toISOString(),
          source: { name: /nseindia/.test(url) ? 'NSE company disclosure' : 'BSE company disclosure', url, kind: 'disclosure' },
          company: { symbol: entry.symbol, name: entry.name, scripCode: entry.scripCode }, evidence: evidence || undefined, rules });
        if (record) records.push(record);
        if (records.length >= 30) break;
      }
      // Reuse the existing service's shared three-minute cache; no second RSS worker.
      const stories = newsResult.status === 'fulfilled' ? newsResult.value : [];
      const entries = getAllStockEntries();
      for (const n of stories) {
        if (records.length >= 60) break;
        const r = radarRecordFromNews(n, entries, Date.now(), rules);
        if (r) records.push(r);
      }
      await publishRadarRecords(records);
      // An optional RSS failure does not mean a successful filing scan failed.
      lastError = filingResult.status === 'rejected' && (newsResult.status === 'rejected' || getNewsSourceState().unavailable);
    } catch { lastError = true; }
    finally {
      lastCheckedAt = Date.now();
      const news = getNewsSourceState();
      try { await saveRadarSourceCheck({checkedAt:lastCheckedAt,available:!lastError,newsAvailable:!news.unavailable && !news.stale}); }
      catch { console.warn('[Radar] Source-check persistence unavailable'); }
      running = null;
    }
  })();
  return running;
}
