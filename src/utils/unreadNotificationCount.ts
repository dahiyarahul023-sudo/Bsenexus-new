export interface UnreadCountSnapshot {
  owner: string | null;
  count: number | null;
}

export function notificationCountOwner(
  user: { uid?: string; isAnonymous?: boolean; getIdToken?: unknown } | null,
  sessionPending: boolean,
): string | null {
  return !sessionPending && user?.uid && !user.isAnonymous && typeof user.getIdToken === 'function'
    ? user.uid : null;
}

/** A private count is usable only for its current owner and latest request. */
export function createUnreadNotificationCounter(
  load: (signal: AbortSignal) => Promise<unknown>,
  publish: (snapshot: UnreadCountSnapshot) => void,
) {
  let owner: string | null = null;
  let sequence = 0;
  let pending: AbortController | null = null;
  let count: number | null = null;
  let mutation: symbol | null = null;

  function publishCount(next: number | null) {
    count = next;
    publish({ owner, count });
  }

  function setOwner(next: string | null) {
    sequence++;
    pending?.abort();
    pending = null;
    owner = next;
    mutation = null;
    publishCount(null);
  }

  async function refresh() {
    if (!owner || mutation) return;
    const requestOwner = owner;
    const requestSequence = ++sequence;
    pending?.abort();
    const controller = new AbortController();
    pending = controller;
    try {
      const data = await load(controller.signal) as { unreadCount?: unknown } | null;
      if (controller.signal.aborted || requestSequence !== sequence || requestOwner !== owner) return;
      const count = data?.unreadCount;
      if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) return;
      publishCount(count);
    } catch {
      // Initial failure stays unknown. Background failure preserves this owner's confirmed count.
    } finally {
      if (pending === controller) pending = null;
    }
  }

  // Invalidate pre-click reads before publishing the same optimistic change as
  // the inbox. Polling cannot resurrect a badge while its write is pending.
  function beginRead(account: string, amount: number | 'all') {
    if (account !== owner || mutation) return () => {};
    const before = count;
    const token = Symbol();
    mutation = token;
    sequence++;
    pending?.abort();
    pending = null;
    publishCount(amount === 'all' ? 0 : count === null ? null : Math.max(0, count - amount));
    return (success: boolean) => {
      if (owner !== account || mutation !== token) return;
      mutation = null;
      if (!success) publishCount(before);
      void refresh();
    };
  }

  return { setOwner, refresh, beginRead };
}
