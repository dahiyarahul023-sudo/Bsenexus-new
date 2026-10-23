import YahooFinance from 'yahoo-finance2';
import { adrSnapshotStore } from '../database/adrSnapshotDao.js';
import { ADR_COMPANIES, readAdrSnapshot, type AdrCompany, type AdrQuote, type AdrSnapshot } from '../../src/shared/adr.js';

const nyDay = (time: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(time));
const stamp = (value: unknown) => value instanceof Date ? value.getTime() : typeof value === 'number' ? value : typeof value === 'string' ? Date.parse(value) : NaN;
/** 16:00 New York, converted with the date's real DST offset. */
export function regularCloseAt(day: string): number {
  const utc = Date.parse(`${day}T20:00:00Z`);
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/New_York', hour: '2-digit', hourCycle: 'h23' }).format(new Date(utc)));
  return utc + (16 - hour) * 3600000;
}
export function adrFromChart(company: AdrCompany, result: any, now: number): AdrQuote | null {
  const meta = result?.meta;
  if (meta?.symbol !== company.adrSymbol || meta.currency !== 'USD' || meta.exchangeTimezoneName !== 'America/New_York' || !['NYQ', 'NYSE'].includes(meta.exchangeName)) return null;
  if (!Array.isArray(result.quotes)) return null;
  const suppliedEnd = stamp(meta.currentTradingPeriod?.regular?.end);
  const suppliedDay = Number.isFinite(suppliedEnd) ? nyDay(suppliedEnd) : '';
  const rows = result.quotes.flatMap((row: any) => {
    const time = stamp(row.date);
    if (!Number.isFinite(time) || !Number.isFinite(row.close) || row.close <= 0 || !Number.isFinite(row.volume) || row.volume <= 0) return [];
    const day = nyDay(time);
    const closeAt = day === suppliedDay ? suppliedEnd : regularCloseAt(day);
    // Current-session intraday bars and future/invalid end times are never daily closes.
    if (closeAt + 15 * 60000 > now || closeAt < time || closeAt - time > 9 * 3600000) return [];
    return [{ day, closeAt, close: row.close as number, volume: row.volume as number }];
  }).sort((a: any, b: any) => a.day.localeCompare(b.day));
  const distinct = [...new Map<string, any>(rows.map((row: any) => [row.day, row])).values()];
  if (distinct.length < 2) return null;
  const [previous, last] = distinct.slice(-2);
  if (now - last.closeAt > 7 * 86400000) return null;
  const corporateAction = (result.events?.splits || []).some((event: any) => {
    const time = stamp(event.date);
    return Number.isFinite(time) && nyDay(time) > previous.day && nyDay(time) <= last.day;
  });
  return { ...company, close: last.close, previousClose: previous.close, changePercent: (last.close / previous.close - 1) * 100,
    volume: last.volume, sessionDate: last.day, previousSessionDate: previous.day, sessionCloseAt: last.closeAt,
    currency: 'USD', source: 'Yahoo Finance', sourceUrl: `https://finance.yahoo.com/quote/${company.adrSymbol}/`, corporateAction };
}

export function createAdrService(fetchChart: (symbol: string, now: number) => Promise<unknown>, clock = Date.now,
  store?: { read: () => Promise<unknown>; save: (snapshot: AdrSnapshot) => Promise<void> }) {
  let cached: AdrSnapshot | null = null;
  let lastAttempt = 0;
  let pending: Promise<AdrSnapshot> | null = null;
  let hydrated = false;
  let failedBatches = 0;
  return { async load(): Promise<AdrSnapshot> {
    const now = clock();
    if (pending) return pending;
    // First failure retries after one minute; repeated failures back off to 15 minutes.
    const ttl = cached?.status === 'ready' && !cached.refreshFailed ? 5 * 60000 : Math.min(15 * 60000, 60000 * 2 ** Math.max(0, failedBatches - 1));
    if (cached && now - lastAttempt < ttl) return readAdrSnapshot(cached, now)!;
    lastAttempt = now;
    pending = (async () => {
      if (!hydrated) {
        hydrated = true;
        try { const saved = readAdrSnapshot(await store?.read(), now); if (saved?.items.length) cached = { ...saved, refreshFailed: true }; }
        catch { console.warn('[ADR] Saved snapshot read unavailable'); }
      }
      const results = await Promise.allSettled(ADR_COMPANIES.map(async company => adrFromChart(company, await fetchChart(company.adrSymbol, now), now)));
      const items = results.flatMap(result => result.status === 'fulfilled' && result.value ? [result.value] : []);
      const failures = results.flatMap((result, index) => result.status === 'fulfilled' && result.value ? [] : [{
        symbol: ADR_COMPANIES[index].adrSymbol,
        reason: result.status === 'rejected' && result.reason instanceof Error ? result.reason.name : 'InvalidChart',
      }]);
      if (failures.length) console.warn('[ADR] Incomplete source batch', { failures });
      // Retain missing symbols on partial success, never downgrade a newer session.
      const merged = new Map((cached?.items || []).map(item => [item.adrSymbol, item]));
      let olderSource = false;
      for (const item of items) {
        if (!merged.has(item.adrSymbol) || merged.get(item.adrSymbol)!.sessionDate <= item.sessionDate) merged.set(item.adrSymbol, item);
        else olderSource = true;
      }
      const unconfirmed = failures.length > 0 || olderSource;
      failedBatches = unconfirmed ? failedBatches + 1 : 0;
      const checkedAt = unconfirmed && cached?.items.length ? cached.checkedAt : now;
      cached = readAdrSnapshot({ checkedAt, items: [...merged.values()], refreshFailed: unconfirmed }, now)!;
      if (items.length && store) {
        try { await store.save(cached); }
        catch { console.warn('[ADR] Saved snapshot write unavailable'); }
      }
      return cached;
    })().finally(() => { pending = null; });
    return pending;
  } };
}
let client: InstanceType<typeof YahooFinance> | undefined;
const service = createAdrService(async (symbol, now) => {
  client ||= new YahooFinance({ YF_QUERY_HOST: 'query1.finance.yahoo.com', queue: { concurrency: 5 },
    suppressNotices: ['yahooSurvey'], versionCheck: false,
    fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.any([AbortSignal.timeout(8000), ...(init?.signal ? [init.signal] : [])]) }) });
  // Five fixed ADRs fit one bounded batch. The source budget leaves room for the 15s website request.
  return client.chart(symbol, { period1: new Date(now - 16 * 86400000), interval: '1d', includePrePost: false, events: 'splits' }, { fetchOptions: { signal: AbortSignal.timeout(10000) } });
}, Date.now, adrSnapshotStore);
export const getAdrSnapshot = () => service.load();
