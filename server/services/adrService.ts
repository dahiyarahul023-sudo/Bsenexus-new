import YahooFinance from 'yahoo-finance2';
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

export function createAdrService(fetchChart: (symbol: string, now: number) => Promise<unknown>, clock = Date.now) {
  let cached: AdrSnapshot | null = null;
  let lastAttempt = 0;
  let pending: Promise<AdrSnapshot> | null = null;
  return { async load(): Promise<AdrSnapshot> {
    const now = clock();
    if (cached && now - lastAttempt < 5 * 60000) return readAdrSnapshot(cached, now)!;
    if (pending) return pending;
    lastAttempt = now;
    pending = (async () => {
      const results = await Promise.allSettled(ADR_COMPANIES.map(async company => adrFromChart(company, await fetchChart(company.adrSymbol, now), now)));
      const items = results.flatMap(result => result.status === 'fulfilled' && result.value ? [result.value] : []);
      // Do not renew an old snapshot's check time after an upstream outage.
      if (!items.length && cached?.items.length) {
        cached = readAdrSnapshot({ ...cached, refreshFailed: true }, now);
        if (cached) return cached;
      }
      cached = readAdrSnapshot({ checkedAt: now, items }, now)!;
      return cached;
    })().finally(() => { pending = null; });
    return pending;
  } };
}
let client: InstanceType<typeof YahooFinance> | undefined;
const service = createAdrService(async (symbol, now) => {
  client ||= new YahooFinance({ suppressNotices: ['yahooSurvey'], versionCheck: false,
    fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.any([AbortSignal.timeout(8000), ...(init?.signal ? [init.signal] : [])]) }) });
  return client.chart(symbol, { period1: new Date(now - 16 * 86400000), interval: '1d', includePrePost: false, events: 'splits' }, { fetchOptions: { signal: AbortSignal.timeout(14000) } });
});
export const getAdrSnapshot = () => service.load();
