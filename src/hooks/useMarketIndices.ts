import { useState, useEffect, useCallback, useRef } from 'react';
import { customFetch } from '../api';
import { useVisibilityInterval } from './useVisibilityInterval';

export interface MarketIndexItem {
  id: string;
  symbol: string;
  name: string;
  category?: 'EQUITY_INDEX' | 'VOLATILITY' | 'CURRENCY';
  price: number;
  change: number;
  changePercent: number;
  dayHigh?: number;
  dayLow?: number;
  previousClose?: number;
  currency: string;
  lastUpdated: string;
  description?: string;
  tick?: 'UP' | 'DOWN' | null;
  source?: string;
  stale?: boolean;
}

export interface MarketOverviewState {
  indices: MarketIndexItem[];
  isMarketOpen: boolean;
  marketSession: 'REGULAR' | 'CLOSED' | 'PRE_MARKET' | 'CLOSING_WINDOW_10MIN' | 'POST_MARKET';
  marketStatusText: string;
  sessionBadge?: string;
  lastRefreshed: number;
  loading: boolean;
  stale?: boolean;
}

export function useMarketIndices() {
  const [data, setData] = useState<MarketOverviewState>({
    indices: [],
    isMarketOpen: false,
    marketSession: 'CLOSED',
    marketStatusText: 'Market data unavailable',
    sessionBadge: 'UNAVAILABLE',
    lastRefreshed: 0,
    loading: true
  });

  const prevPricesRef = useRef<Record<string, number>>({});

  const fetchIndices = useCallback(async (isSilent = false) => {
    if (!isSilent) {
      setData(prev => ({ ...prev, loading: true }));
    }
    try {
      const res = await customFetch('/api/market/indices');
      if (res.ok) {
        const json = await res.json();
        if (json.indices && Array.isArray(json.indices)) {
          // Compare with previous price to detect ticks
          const updatedIndices = json.indices.map((item: MarketIndexItem) => {
            const oldPrice = prevPricesRef.current[item.id];
            let tick: 'UP' | 'DOWN' | null = null;
            if (oldPrice !== undefined && oldPrice !== item.price) {
              tick = item.price > oldPrice ? 'UP' : 'DOWN';
            }
            prevPricesRef.current[item.id] = item.price;
            return {
              ...item,
              tick
            };
          });

          setData({
            indices: updatedIndices,
            isMarketOpen: Boolean(json.isMarketOpen),
            marketSession: json.marketSession || 'CLOSED',
            marketStatusText: updatedIndices.length ? (json.marketStatusText || (json.isMarketOpen ? 'Market Open' : 'Market Closed')) : 'Market data unavailable',
            sessionBadge: updatedIndices.length ? (json.stale ? 'STALE' : (json.sessionBadge || (json.isMarketOpen ? 'MARKET LIVE' : 'CLOSED'))) : 'UNAVAILABLE',
            lastRefreshed: updatedIndices.length ? (Number(json.lastRefreshed) || 0) : 0,
            loading: false,
            stale: Boolean(json.stale) || updatedIndices.some((item: MarketIndexItem) => item.stale === true)
          });

          // Reset tick flash after 2 seconds
          setTimeout(() => {
            setData(prev => ({
              ...prev,
              indices: prev.indices.map(i => ({ ...i, tick: null }))
            }));
          }, 2000);

          return;
        }
      }
    } catch {
      // Keep only previously received quotes, and visibly mark them stale.
    }
    setData(prev => ({ ...prev, loading: false, stale: prev.indices.length > 0,
      sessionBadge: prev.indices.length ? 'STALE' : 'UNAVAILABLE',
      marketStatusText: prev.indices.length ? 'Cached quotes; refresh failed' : 'Market data unavailable'
    }));
  }, []);

  useEffect(() => {
    fetchIndices();
  }, [fetchIndices]);

  // Reduced from 15s to 60s smooth live polling with visibility gating
  useVisibilityInterval(() => {
    fetchIndices(true);
  }, 60000);

  return {
    ...data,
    refresh: () => fetchIndices(false)
  };
}
