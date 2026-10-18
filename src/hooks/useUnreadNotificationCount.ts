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
  // Mask an old owner's value during render, before effect cleanup can run.
  return { count: owner && snapshot.owner === owner ? snapshot.count : null, refresh };
}
