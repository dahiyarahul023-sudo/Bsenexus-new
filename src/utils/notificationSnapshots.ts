// Ephemeral, owner-scoped snapshots. Closing the inbox never clears confirmed data.
export type NotificationFilter = 'ALL' | 'WATCHLIST' | 'RESULTS';
export interface NotificationSnapshots<T> { owner: string; views: Partial<Record<NotificationFilter, T[]>> }
export const emptyNotificationSnapshots = <T>(owner: string): NotificationSnapshots<T> => ({ owner, views: {} });
export function notificationSnapshot<T>(state: NotificationSnapshots<T>, owner: string, filter: NotificationFilter): T[] | undefined {
  return state.owner === owner ? state.views[filter] : undefined;
}
export function storeNotificationSnapshot<T>(state: NotificationSnapshots<T>, owner: string, filter: NotificationFilter, items: T[]): NotificationSnapshots<T> {
  return { owner, views: { ...(state.owner === owner ? state.views : {}), [filter]: items } };
}
export function updateNotificationSnapshots<T>(state: NotificationSnapshots<T>, owner: string, update: (items: T[]) => T[]): NotificationSnapshots<T> {
  if (state.owner !== owner) return state;
  return { owner, views: Object.fromEntries(Object.entries(state.views).map(([key, items]) => [key, update(items!)])) };
}
