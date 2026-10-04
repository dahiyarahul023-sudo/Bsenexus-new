import { runPaymentStore, PaymentStoreUnavailableError } from './paymentStore.js';
import { getSupabase, isSupabaseConfigured } from './supabase.js';
import { readLocalJson, writeLocalJson } from './localStore.js';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'RESULT' | 'DIVIDEND' | 'BUYBACK' | 'BONUS_SPLIT' | 'ORDER_WIN' | 'BOARD_MEETING' | 'RULE_MATCH' | 'GENERAL';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  symbol: string;
  scripCode: string;
  newsId?: string;
  pdfLink?: string;
  timestamp: number;
  isRead: boolean;
  userId?: string;
  isWatchlist?: boolean;
  metadata?: Record<string, any>;
}

const NOTIFICATIONS_FILE = 'notifications.json';
// Preserve legitimate inbox records across local development restarts.
let notificationsCache = readLocalJson<AppNotification[]>(NOTIFICATIONS_FILE, []);
const RECEIPTS_FILE = 'notification_receipts.json';
let localReceipts = readLocalJson<Record<string, string[]>>(RECEIPTS_FILE, {});
function needsCloud(): boolean { return isSupabaseConfigured() || process.env.NODE_ENV === 'production'; }
async function cloud<T>(operation: string, run: () => Promise<T>): Promise<T> {
  if (!isSupabaseConfigured()) throw new PaymentStoreUnavailableError(operation);
  return runPaymentStore(operation, Promise.resolve().then(run));
}

let saveDiskTimer: NodeJS.Timeout | null = null;
function scheduleSave() {
  if (saveDiskTimer) return;
  saveDiskTimer = setTimeout(() => {
    saveDiskTimer = null;
    writeLocalJson(NOTIFICATIONS_FILE, notificationsCache);
  }, 1000);
}

const NOTIFICATIONS_TABLE = 'notifications';
const MAX_CACHED = 500;

// --- Row mapping: camelCase app shape <-> snake_case Postgres columns ---
function toRow(n: AppNotification): Record<string, any> {
  return {
    id: n.id,
    user_id: n.userId || 'system',
    title: n.title,
    message: n.message,
    type: n.type,
    priority: n.priority,
    symbol: n.symbol || null,
    scrip_code: n.scripCode || null,
    news_id: n.newsId || null,
    pdf_link: n.pdfLink || null,
    timestamp: n.timestamp,
    is_read: !!n.isRead,
    is_watchlist: !!n.isWatchlist,
    metadata: n.metadata || {},
  };
}

function fromRow(r: any): AppNotification {
  return {
    id: r.id,
    title: r.title || '',
    message: r.message || '',
    type: r.type || 'GENERAL',
    priority: r.priority || 'LOW',
    symbol: r.symbol || '',
    scripCode: r.scrip_code || '',
    newsId: r.news_id || undefined,
    pdfLink: r.pdf_link || undefined,
    timestamp: Number(r.timestamp) || 0,
    isRead: !!r.is_read,
    userId: r.user_id || 'system',
    isWatchlist: !!r.is_watchlist,
    metadata: r.metadata || {},
  };
}

// Cloud writes are awaited; a configured store failure is never reported as success.
// The local JSON file lives on Cloud Run's ephemeral filesystem, so without
// this the inbox goes empty on every restart/republish.

async function persistNotificationToCloud(n: AppNotification): Promise<void> {
  if (!needsCloud()) return;
  await cloud('persist notification', async () => {
    const { error } = await getSupabase().from(NOTIFICATIONS_TABLE).upsert(toRow(n), { onConflict: 'id' });
    if (error) throw error;
  });
}

let notificationsCloudInitDone = false;
/** One-time background restore of notifications from Supabase into the memory cache. */
export async function initNotificationsFromCloud(): Promise<void> {
  if (notificationsCloudInitDone) return;
  if (!isSupabaseConfigured()) return;
  try {
    const { data, error } = await getSupabase()
      .from(NOTIFICATIONS_TABLE)
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(MAX_CACHED);
    if (error) throw error;
    notificationsCloudInitDone = true;
    const seen = new Set(notificationsCache.map(n => n.id));
    let added = 0;
    for (const row of data || []) {
      const notif = fromRow(row);
      if (notif.id && !seen.has(notif.id)) {
        seen.add(notif.id);
        notificationsCache.push(notif);
        added++;
      }
    }
    if (added > 0) {
      notificationsCache.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      if (notificationsCache.length > MAX_CACHED) notificationsCache = notificationsCache.slice(0, MAX_CACHED);
      scheduleSave();
    }
  } catch (err: any) {
    console.warn('[Notifications] cloud restore failed:', err?.message || err);
  }
}

export interface NotificationFilterOptions {
  watchlistOnly?: boolean;
  type?: string;
  unreadOnly?: boolean;
}

async function readInbox(userId: string): Promise<AppNotification[]> {
  let visible: AppNotification[];
  let readIds: Set<string>;
  if (needsCloud()) {
    const snapshot = await cloud('read notification inbox', async () => {
      const {data,error}=await getSupabase().from(NOTIFICATIONS_TABLE).select('*').in('user_id',[userId,'system','all']).order('timestamp',{ascending:false}).limit(MAX_CACHED);
      if(error)throw error;
      if(!data?.length)return {items:[],readIds:[]};
      const receipts=await getSupabase().from('user_notification_receipts').select('notification_id').eq('user_id',userId).in('notification_id',data.map(row=>row.id));
      if(receipts.error)throw receipts.error;
      return { items: (data || []).map(fromRow), readIds: (receipts.data || []).map(r=>r.notification_id) };
    });
    visible = snapshot.items;
    readIds = new Set(snapshot.readIds);
  } else {
    visible = notificationsCache.filter(n=>!n.userId || ['system','all',userId].includes(n.userId));
    readIds = new Set(localReceipts[userId] || []);
  }
  // Legacy shared isRead was global; it must never decide another user's receipt.
  return visible.map(n=>({...n, isRead: readIds.has(n.id) || (n.userId===userId && n.isRead)}));
}

export async function getAllNotifications(userId: string = 'guest', limit = 100, options: NotificationFilterOptions = {}): Promise<AppNotification[]> {
  return filterNotifications(await readInbox(userId),limit,options);
}
export function filterNotifications(items: AppNotification[],limit=100,options: NotificationFilterOptions={}): AppNotification[] {
  let filtered = items;
  if (options.watchlistOnly !== false) filtered = filtered.filter(n=>Boolean(n.isWatchlist));
  if (options.unreadOnly) filtered = filtered.filter(n=>!n.isRead);
  if (options.type==='RESULTS') filtered=filtered.filter(n=>['RESULT','BOARD_MEETING'].includes(n.type));
  else if (options.type==='ACTIONS') filtered=filtered.filter(n=>['DIVIDEND','BUYBACK','BONUS_SPLIT'].includes(n.type));
  else if (options.type==='ORDERS') filtered=filtered.filter(n=>n.type==='ORDER_WIN');
  return filtered.sort((a,b)=>b.timestamp-a.timestamp).slice(0,Math.max(1,Math.min(MAX_CACHED,limit)));
}
export async function getUnreadNotificationCount(userId = 'guest', watchlistOnly = true): Promise<number> {
  return (await getAllNotifications(userId,MAX_CACHED,{watchlistOnly,unreadOnly:true})).length;
}

export async function addNotification(notif: Omit<AppNotification, 'id' | 'timestamp' | 'isRead'> & { id?: string; timestamp?: number; isRead?: boolean }): Promise<AppNotification> {
  const ownerId = notif.userId && typeof notif.userId === 'string' ? notif.userId : 'system';
  const id = notif.id || `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  
  // Avoid exact duplicate for the SAME user within 2 hours
  const existing = notificationsCache.find(n => 
    (n.userId === ownerId) &&
    ((notif.newsId && n.newsId === notif.newsId) ||
    (n.symbol === notif.symbol && n.title === notif.title && Math.abs(n.timestamp - (notif.timestamp || Date.now())) < 7200000))
  );

  if (existing) {
    await persistNotificationToCloud({ ...existing, isWatchlist: Boolean(existing.isWatchlist || notif.isWatchlist) });
    if (notif.isWatchlist && !existing.isWatchlist) {
      existing.isWatchlist = true;
      scheduleSave();
    }
    return existing;
  }

  const newNotif: AppNotification = {
    id,
    timestamp: notif.timestamp || Date.now(),
    isRead: notif.isRead || false,
    ...notif,
    userId: ownerId
  };

  await persistNotificationToCloud(newNotif);
  notificationsCache.unshift(newNotif);
  if (notificationsCache.length > MAX_CACHED) {
    notificationsCache = notificationsCache.slice(0, MAX_CACHED);
  }

  scheduleSave();
  return newNotif;
}

export async function addNotificationsBatch(notifs: (Omit<AppNotification,'id'|'timestamp'|'isRead'> & {id?: string; timestamp?: number; isRead?: boolean})[]): Promise<AppNotification[]> {
  if (!Array.isArray(notifs)) return [];
  const added: AppNotification[]=[];
  for (const notif of notifs) if (notif) added.push(await addNotification(notif));
  return added;
}

export async function markNotificationsReadBatch(ids: string[], userId = 'guest'): Promise<number> {
  if (!Array.isArray(ids) || !ids.length) return 0;
  const requested = new Set(ids.filter(id=>typeof id==='string').slice(0,MAX_CACHED));
  const changed = (await readInbox(userId)).filter(n=>requested.has(n.id) && !n.isRead);
  if (!changed.length) return 0;
  if (needsCloud()) {
    await cloud('mark notification receipts', async () => {
      const {error}=await getSupabase().from('user_notification_receipts').upsert(changed.map(n=>({user_id:userId,notification_id:n.id,read_at:Date.now()})),{onConflict:'user_id,notification_id'});
      if(error)throw error;
    });
  } else {
    localReceipts[userId]=[...new Set([...(localReceipts[userId] || []),...changed.map(n=>n.id)])];
    writeLocalJson(RECEIPTS_FILE,localReceipts);
  }
  return changed.length;
}
export async function markNotificationRead(id: string,userId='guest'): Promise<boolean> {
  const exists=(await readInbox(userId)).some(n=>n.id===id);
  if (!exists) return false;
  await markNotificationsReadBatch([id],userId);
  return true;
}
export async function markAllNotificationsRead(userId='guest'): Promise<void> {
  await markNotificationsReadBatch((await readInbox(userId)).map(n=>n.id),userId);
}

export async function clearAllNotifications(userId: string = 'guest'): Promise<void> {
  if (needsCloud()) {
    await cloud('clear personal notifications', async () => {
      const {error}=await getSupabase().from(NOTIFICATIONS_TABLE).delete().eq('user_id',userId);
      if(error)throw error;
    });
  }
  const prevCount = notificationsCache.length;
  notificationsCache = notificationsCache.filter(n => {
    // Only delete notifications that strictly belong to the calling user
    if (n.userId === userId) {
      return false;
    }
    if (userId === 'guest' && (!n.userId || n.userId === 'guest')) {
      return false;
    }
    // Keep system-wide, broadcast, and other users' notifications
    return true;
  });
  if (notificationsCache.length !== prevCount) {
    scheduleSave();

  }
}
