/** Reviewed US ADR identities. This list does not expand BSE intake or watchlists. */
export const ADR_COMPANIES = [
  { symbol: 'INFY', scripCode: '500209', name: 'Infosys', adrSymbol: 'INFY', listingSource: 'https://www.infosys.com/investors/shareholder-services/faqs.html' },
  { symbol: 'HDFCBANK', scripCode: '500180', name: 'HDFC Bank', adrSymbol: 'HDB', listingSource: 'https://www.hdfc.bank.in/about-us/investor-relations/adr' },
  { symbol: 'ICICIBANK', scripCode: '532174', name: 'ICICI Bank', adrSymbol: 'IBN', listingSource: 'https://www.sec.gov/Archives/edgar/data/1103838/000095010326010820/dp249803_ex0208.htm' },
  { symbol: 'WIPRO', scripCode: '507685', name: 'Wipro', adrSymbol: 'WIT', listingSource: 'https://www.wipro.com/investors/' },
  { symbol: 'DRREDDY', scripCode: '500124', name: "Dr. Reddy's", adrSymbol: 'RDY', listingSource: 'https://www.sec.gov/Archives/edgar/data/1135951/000157587226000381/rdy0899_20f.htm' },
] as const;
export type AdrCompany = typeof ADR_COMPANIES[number];
export interface AdrQuote {
  symbol: string; scripCode: string; name: string; adrSymbol: string;
  close: number; previousClose: number; changePercent: number; volume: number;
  sessionDate: string; sessionCloseAt: number; previousSessionDate: string;
  source: 'Yahoo Finance'; sourceUrl: string; currency: 'USD';
  corporateAction: boolean;
}
export interface AdrSnapshot {
  checkedAt: number; status: 'ready' | 'partial' | 'unavailable'; refreshFailed?: boolean;
  items: AdrQuote[]; unavailableSymbols: string[];
}
export function adrSeverity(percent: number) {
  const displayedMove = Math.round(Math.abs(percent) * 100) / 100;
  return displayedMove >= 5 ? 'sharp' : displayedMove >= 4 ? 'large' : 'normal';
}
export const adrPercent = (percent: number) => `${percent > 0 ? '+' : percent < 0 ? '−' : ''}${Math.abs(percent).toFixed(2)}%`;
export const adrSessionLabel = (day: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));
export const adrIsRecent = (quote: AdrQuote, now = Date.now()) => quote.sessionCloseAt <= now && now - quote.sessionCloseAt <= 96 * 3600000;
export function adrCompanyFor(symbol?: string, scripCode?: string) {
  // An explicit code must agree, even when a plausible symbol was supplied.
  return ADR_COMPANIES.find(company => scripCode ? company.scripCode === String(scripCode) : company.symbol === symbol?.toUpperCase());
}
export function rankAdrs(items: AdrQuote[], watched: readonly string[] = []) {
  const set = new Set(watched.map(value => value.toUpperCase()));
  return [...items].sort((a, b) => {
    const majorA = adrSeverity(a.changePercent) !== 'normal' && !a.corporateAction;
    const majorB = adrSeverity(b.changePercent) !== 'normal' && !b.corporateAction;
    return Number(majorB) - Number(majorA)
      || Number(set.has(b.symbol) || set.has(b.scripCode)) - Number(set.has(a.symbol) || set.has(a.scripCode))
      || Math.abs(b.changePercent) - Math.abs(a.changePercent);
  });
}
/** Validate the public response again at each presentation boundary. */
export function readAdrSnapshot(value: unknown, now = Date.now()): AdrSnapshot | null {
  const raw = value as Partial<AdrSnapshot> | null;
  if (!raw || !Number.isFinite(raw.checkedAt) || raw.checkedAt! > now + 60000 || !Array.isArray(raw.items)) return null;
  const seen = new Set<string>();
  const items = raw.items.flatMap(item => {
    const company = adrCompanyFor(item?.symbol, item?.scripCode);
    if (!company || company.adrSymbol !== item.adrSymbol || seen.has(company.adrSymbol)
      || item.currency !== 'USD' || item.source !== 'Yahoo Finance'
      || ![item.close, item.previousClose, item.changePercent, item.sessionCloseAt, item.volume].every(Number.isFinite)
      || item.close <= 0 || item.previousClose <= 0 || item.volume <= 0 || item.sessionCloseAt > now
      || now - item.sessionCloseAt > 7 * 86400000 || item.sessionCloseAt <= 0
      || !/^\d{4}-\d{2}-\d{2}$/.test(item.sessionDate) || !/^\d{4}-\d{2}-\d{2}$/.test(item.previousSessionDate)
      || item.previousSessionDate >= item.sessionDate
      || Math.abs((item.close / item.previousClose - 1) * 100 - item.changePercent) > 0.0001) return [];
    const sessionDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(item.sessionCloseAt));
    if (sessionDate !== item.sessionDate) return [];
    seen.add(company.adrSymbol);
    return [{ ...item, ...company, corporateAction: item.corporateAction === true, sourceUrl: `https://finance.yahoo.com/quote/${company.adrSymbol}/` } as AdrQuote];
  });
  const unavailableSymbols = ADR_COMPANIES.filter(company => !seen.has(company.adrSymbol)).map(company => company.adrSymbol);
  return { checkedAt: raw.checkedAt!, refreshFailed: raw.refreshFailed === true, status: !items.length ? 'unavailable' : unavailableSymbols.length ? 'partial' : 'ready', items, unavailableSymbols };
}
