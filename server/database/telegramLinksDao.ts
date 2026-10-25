import crypto from 'node:crypto';
import { getSupabase } from './supabase.js';
import { runPaymentStore } from './paymentStore.js';
import { invalidateUserProfileCache } from './usersDao.js';

export const hashTelegramNonce = (nonce: string) => crypto.createHash('sha256').update(nonce).digest('hex');
export async function telegramLinkCommand(action: 'start' | 'consume' | 'status' | 'unlink', uid: string, nonce = '', chatId = ''): Promise<{ chatId: string | null; verifiedAt: number | null } | null> {
  const result = await runPaymentStore('verify Telegram destination', (async () => {
    const { data, error } = await getSupabase().rpc('telegram_link_command', {
      p_action: action, p_uid: uid, p_hash: nonce ? hashTelegramNonce(nonce) : '', p_chat_id: chatId,
    });
    if (error) throw error;
    return data;
  })());
  if (uid) invalidateUserProfileCache(uid);
  return result;
}
export async function requireVerifiedTelegramTarget(uid: string, requested: unknown, shared?: unknown): Promise<string> {
  const link = await telegramLinkCommand('status', uid);
  const target = link?.chatId || '';
  if (!target || target === String(shared || '').trim() || (requested && String(requested).trim() !== target)) {
    throw Object.assign(new Error('Verify your personal Telegram connection in Settings first.'), { status: 403 });
  }
  return target;
}
