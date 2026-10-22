import { createHash } from 'node:crypto';
import { adrIsRecent, adrPercent, adrSeverity, adrSessionLabel, rankAdrs, type AdrSnapshot } from '../../src/shared/adr.js';
import { activeWatchlistIdentities, matchesWatchlistIdentity } from '../../src/shared/watchlistIdentity.js';
import type { AppNotification } from '../database/notificationDao.js';

export function isAdrMorning(now: number) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(now));
  const value = (type: string) => parts.find(part => part.type === type)?.value || '';
  const minute = Number(value('hour')) * 60 + Number(value('minute'));
  return !['Sat', 'Sun'].includes(value('weekday')) && minute >= 8 * 60 && minute < 9 * 60 + 15;
}
/** The first weekday morning after the US close; holidays never relabel an old close as new. */
export function adrMorningDate(closeAt: number): string {
  const date = new Date(closeAt + 19800000);
  if (date.getUTCHours() * 60 + date.getUTCMinutes() >= 8 * 60) date.setUTCDate(date.getUTCDate() + 1);
  while ([0, 6].includes(date.getUTCDay())) date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
export function buildAdrDigest(snapshot: AdrSnapshot, user: any, lists: any[], now: number): AppNotification | null {
  const prefs = user?.notificationPreferences;
  if (!isAdrMorning(now) || !user?.uid || ['guest', 'system', 'all', 'admin'].includes(user.uid)
    || prefs?.adrAlertsEnabled !== true || user.muteInAppNotifications || prefs.muteInAppNotifications
    || snapshot.refreshFailed || snapshot.status !== 'ready' || !Number.isFinite(snapshot.checkedAt) || snapshot.checkedAt > now || now - snapshot.checkedAt > 10 * 60000) return null;
  const identities = activeWatchlistIdentities(lists);
  const latest = snapshot.items.reduce((day, item) => item.sessionDate > day ? item.sessionDate : day, '');
  const priorities = new Map<string, number>();
  for (const list of lists.filter(list => list?.is_active === 1 || list?.is_active === true)) {
    for (const item of Array.isArray(list.items) ? list.items : []) {
      const identity = activeWatchlistIdentities([{ is_active: 1, items: [item] }])[0];
      if (!identity) continue;
      const priority = typeof item === 'object' ? item.priority : 'HIGH';
      const weight = priority === 'LOW' ? 1 : priority === 'MEDIUM' ? 2 : 3;
      const key = identity.scripCode || identity.symbol;
      priorities.set(key, Math.max(priorities.get(key) || 0, weight));
    }
  }
  const items = rankAdrs(snapshot.items).filter(item => {
    if (item.sessionDate !== latest || adrMorningDate(item.sessionCloseAt) !== new Date(now + 19800000).toISOString().slice(0, 10) || !adrIsRecent(item, now) || item.corporateAction || item.volume < 10000 || adrSeverity(item.changePercent) === 'normal') return false;
    const match = identities.find(stock => matchesWatchlistIdentity(item, stock));
    if (!match) return false;
    const weight = priorities.get(match.scripCode || match.symbol) || 3;
    return weight === 1 ? prefs.stocksLowPriority === true : weight === 2 ? prefs.stocksMediumPriority !== false : prefs.stocksHighPriority !== false;
  });
  if (!items.length) return null;
  const lead = items[0];
  const ownerKey = createHash('sha256').update(user.uid).digest('hex').slice(0, 32);
  return { id: `adr_${latest}_${ownerKey}`, userId: user.uid, title: `${lead.name} ADR: ${adrPercent(lead.changePercent)}`,
    message: `${items.map(item => `${item.name} ${adrPercent(item.changePercent)}`).join('; ')}. ${adrSessionLabel(latest)} US regular session. Indian opening can differ.`,
    type: 'GENERAL', priority: 'HIGH', symbol: lead.symbol, scripCode: lead.scripCode,
    // Inbox arrival and US publication are distinct; duplicate insertion never rewrites either.
    timestamp: now, isRead: false, isWatchlist: true,
    metadata: { sourceType: 'ADR', source: 'Yahoo Finance', sourceUrl: lead.sourceUrl, sessionDate: latest, sessionCloseAt: Math.max(...items.map(item => item.sessionCloseAt)), items: items.map(item => ({ symbol: item.symbol, adrSymbol: item.adrSymbol, changePercent: item.changePercent })) } };
}
interface Dependencies {
  snapshot: () => Promise<AdrSnapshot>;
  users: () => Promise<any[]>;
  recipient: (uid: string) => Promise<{ user: any; lists: any[] }>;
  save: (notification: AppNotification) => Promise<boolean>;
  enabled: () => Promise<boolean>;
  now?: () => number;
  warn?: (message: string) => void;
}
/** Uses the existing scheduler request lifetime; no user or quote work outside the morning. */
export function createAdrAlertWorker(deps: Dependencies) {
  let pending: Promise<void> | null = null;
  let nextAttempt = 0;
  let cursor = 0;
  return () => {
    const now = (deps.now || Date.now)();
    if (!isAdrMorning(now) || now < nextAttempt) return Promise.resolve();
    if (pending) return pending;
    nextAttempt = now + 60000;
    pending = (async () => {
      if (!await deps.enabled()) return;
      const snapshot = await deps.snapshot();
      if (snapshot.refreshFailed || snapshot.status !== 'ready' || !snapshot.items.some(item => adrIsRecent(item, now) && !item.corporateAction && item.volume >= 10000 && adrSeverity(item.changePercent) !== 'normal')) return;
      const users = (await deps.users()).filter(user => user?.uid && user.uid !== 'guest' && user.notificationPreferences?.adrAlertsEnabled === true);
      if (!users.length) return;
      const batch = Array.from({ length: Math.min(8, users.length) }, (_, i) => users[(cursor + i) % users.length]);
      cursor = (cursor + batch.length) % users.length;
      // Four concurrent owners at most; failures never authorize stale/local membership.
      for (let i = 0; i < batch.length; i += 4) {
        const results = await Promise.allSettled(batch.slice(i, i + 4).map(async candidate => {
        const recipient = await deps.recipient(candidate.uid);
        if (recipient.user?.uid !== candidate.uid) return;
        const digest = buildAdrDigest(snapshot, recipient.user, recipient.lists, (deps.now || Date.now)());
        if (digest) await deps.save(digest);
        }));
        const failures = results.filter(result => result.status === 'rejected').length;
        if (failures) (deps.warn || console.warn)(`[ADR] ${failures} recipient checks or saves unavailable`);
      }
    })().finally(() => { pending = null; });
    return pending;
  };
}
