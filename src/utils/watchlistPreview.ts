import { activeWatchlistIdentities, matchesWatchlistIdentity } from '../shared/watchlistIdentity';
import { announcementTs } from './announcementFeed';

/** Home preview: the newest filing per exact watchlist security, before limiting. */
export function latestWatchlistUpdates(filings: any[], lists: any[], limit = 2, now = Date.now()): any[] {
  const stocks = activeWatchlistIdentities(lists);
  const seen = new Set<string>();
  return [...filings].sort((a, b) => announcementTs(b, now) - announcementTs(a, now)).filter(filing => {
    const stock = stocks.find(candidate => matchesWatchlistIdentity(filing, candidate));
    if (!stock) return false;
    const key = stock.scripCode || stock.symbol;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);
}
