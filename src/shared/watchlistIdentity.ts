import { hasExactScripCode } from './scripMatching';

export interface WatchlistIdentity { symbol: string; scripCode?: string; companyName?: string }
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const companyKey = (value: unknown) => text(value).toUpperCase().replace(/\b(?:LIMITED|LTD)\.?$/g, '').replace(/[^A-Z0-9]/g, '');

export function watchlistIdentity(item: unknown): WatchlistIdentity | null {
  const raw = typeof item === 'string' ? { symbol: item } : item as any;
  const symbol = text(raw?.symbol).toUpperCase();
  if (!symbol) return null;
  const code = text(raw?.scripCode) || (/^\d{6}$/.test(symbol) ? symbol : '');
  return { symbol, scripCode: /^\d{6}$/.test(code) ? code : undefined, companyName: text(raw?.companyName) || undefined };
}

export function activeWatchlistIdentities(lists: any[]): WatchlistIdentity[] {
  const items = lists.filter(list => list?.is_active === 1 || list?.is_active === true)
    .flatMap(list => Array.isArray(list.items) ? list.items : []).map(watchlistIdentity).filter((it): it is WatchlistIdentity => it !== null);
  return [...new Map(items.map(item => [item.scripCode || item.symbol, item])).values()];
}

/** A filing code wins over text. Short tickers must never match inside names. */
export function matchesWatchlistIdentity(filing: any, stock: WatchlistIdentity): boolean {
  const codes = [filing?.scrip_cd, filing?.SCRIP_CD, filing?.scripCode].filter(code => code != null && String(code).trim());
  if (stock.scripCode && codes.length) return hasExactScripCode(filing, stock.scripCode);
  const symbol = text(filing?.symbol || filing?.SYMBOL).toUpperCase();
  if (symbol) return symbol === stock.symbol;
  const name = companyKey(filing?.companyName);
  return Boolean(stock.companyName && name && name === companyKey(stock.companyName));
}
