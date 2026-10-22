import { useEffect, useState } from 'react';
import { customFetch } from '../api';
export function useCompanyFilingCounts(keys: string[], owner: string) {
  const key = [...new Set(keys.filter(k => /^\d{6}$/.test(k) || k === 'BSE'))].sort().join(',');
  const [counts, setCounts] = useState<Record<string, { last30Days?: number; available: boolean }>>({});
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    let activeRequest: AbortController | undefined;
    let refreshing = false;
    const refresh = async () => {
      if (refreshing) return;
      refreshing = true;
      const stocks = key ? key.split(',') : [];
      for (let i = 0; i < stocks.length && alive; i += 20) {
        const chunk = stocks.slice(i, i + 20);
        const controller = new AbortController(); activeRequest = controller;
        const timeout = setTimeout(() => controller.abort(), 20_000);
        try {
          const response = await customFetch(`/api/company-filing-counts?stocks=${encodeURIComponent(chunk.join(','))}`, { signal: controller.signal });
          const data = await response.json();
          if (controller.signal.aborted || !response.ok || data.success !== true || !data.items) throw new Error('Counts unavailable');
          if (alive) setCounts(previous => ({ ...previous, ...Object.fromEntries(chunk.map(code => {
            const item = data.items[code];
            return [code, item?.available === true && Number.isInteger(item.last30Days) && item.last30Days >= 0 ? item : { available: false }];
          })) }));
        } catch {
          if (alive) setCounts(previous => ({ ...previous, ...Object.fromEntries(chunk.map(code => [code, { available: false }])) }));
        } finally { clearTimeout(timeout); }
      }
      refreshing = false;
    };
    setCounts({});
    void refresh();
    const changed = () => { void refresh(); };
    const visible = () => { if (!document.hidden) void refresh(); };
    const timer = setInterval(visible, 90_000);
    window.addEventListener('company-filings-changed', changed);
    window.addEventListener('online', visible);
    return () => { alive = false; activeRequest?.abort(); clearInterval(timer); window.removeEventListener('company-filings-changed', changed); window.removeEventListener('online', visible); };
  }, [key, owner, retry]);
  return { counts, retry: () => setRetry(value => value + 1) };
}
