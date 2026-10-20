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

  function setOwner(next: string | null) {
    sequence++;
    pending?.abort();
    pending = null;
    owner = next;
    publish({ owner, count: null });
  }

  async function refresh() {
    if (!owner) return;
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
      publish({ owner, count });
    } catch {
      // Initial failure stays unknown. Background failure preserves this owner's confirmed count.
    } finally {
      if (pending === controller) pending = null;
    }
  }

  return { setOwner, refresh };
}
