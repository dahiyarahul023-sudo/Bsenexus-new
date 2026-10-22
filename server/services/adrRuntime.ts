import { createAdrAlertWorker } from './adrAlerts.js';
import { getAdrSnapshot } from './adrService.js';
import { getAllUserProfiles, getUserProfile } from '../database/usersDao.js';
import { getAllWatchlists } from '../database/watchlistDao.js';
import { addNotificationOnce } from '../database/notificationDao.js';
import { getSettings } from '../database/settingsDao.js';
import { getSupabase, isSupabaseConfigured } from '../database/supabase.js';
import { runPaymentStore, PaymentStoreUnavailableError } from '../database/paymentStore.js';

export const processAdrAlerts = createAdrAlertWorker({
  snapshot: getAdrSnapshot,
  users: getAllUserProfiles,
  enabled: async () => (await getSettings()).isRunning !== false,
  save: addNotificationOnce,
  recipient: async uid => {
    if (isSupabaseConfigured()) {
      const [user, result] = await Promise.all([
        getUserProfile(uid, { durable: true }),
        runPaymentStore('read ADR recipient watchlist', (async () => {
          const { data, error } = await getSupabase().from('user_watchlists').select('lists').eq('uid', uid).maybeSingle();
          if (error) throw error;
          return data;
        })(), 8000),
      ]);
      return { user, lists: Array.isArray(result?.lists) ? result.lists : [] };
    }
    if (process.env.NODE_ENV === 'production') throw new PaymentStoreUnavailableError('read ADR recipient');
    return { user: await getUserProfile(uid), lists: await getAllWatchlists(uid, { noCreate: true }) };
  },
});
