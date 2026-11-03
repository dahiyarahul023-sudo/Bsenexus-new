import { useEffect, useRef, useState } from 'react';
import { customFetch } from '../api';
import { createUnreadNotificationCounter, type UnreadCountSnapshot } from '../utils/unreadNotificationCount';
import { useVisibilityInterval } from './useVisibilityInterval';

export function useUnreadNotificationCount(owner: string | null) {
  const [snapshot, setSnapshot] = useState<UnreadCountSnapshot>({ owner: null, count: null });
  const counter = useRef<ReturnType<typeof createUnreadNotificationCounter> | null>(null);
  if (!counter.current) {
    counter.current = createUnreadNotificationCounter(async signal => {
      const response = await customFetch('/api/notifications/unread-count', { signal, cache: 'no-store' });
      if (!response.ok) throw new Error('Unread count unavailable');
      return response.json();
    }, setSnapshot);
  }
  const refresh = counter.current.refresh;

  useEffect(() => {
    counter.current!.setOwner(owner);
    void refresh();
    return () => counter.current!.setOwner(null);
  }, [owner, refresh]);

  useVisibilityInterval(refresh, 15000, Boolean(owner));
  const count = owner && snapshot.owner === owner ? snapshot.count : null;
  useEffect(() => {
    // Installed iPhone apps and supporting desktop browsers use the same
    // confirmed unread count as the header. Unsupported browsers simply skip.
    const badge = navigator as Navigator & {setAppBadge?: (count: number) => Promise<void>; clearAppBadge?: () => Promise<void>};
    if (count !== null && count > 0) void badge.setAppBadge?.(count)?.catch(() => {});
    else void badge.clearAppBadge?.()?.catch(() => {});
  }, [count]);
  // Mask an old owner's value during render, before effect cleanup can run.
  return { count, refresh, beginRead: (amount: number | 'all') => owner ? counter.current!.beginRead(owner, amount) : () => {} };
}
