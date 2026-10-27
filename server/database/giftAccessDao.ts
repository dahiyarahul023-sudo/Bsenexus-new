import { getSupabase } from './supabase.js';
import { runPaymentStore } from './paymentStore.js';
import { giftsEnabled } from '../services/giftAccessPolicy.js';
import type { GiftAccess } from '../../src/shared/giftAccess.js';
export async function giftCommand(action: string, actor: string, data: Record<string, unknown>) {
  return runPaymentStore('gift access ' + action, (async () => {
    const { data: result, error } = await getSupabase().rpc('gift_access_command', { p_action: action, p_actor: actor, p_data: data });
    if (error) throw error;
    if (!result || typeof result !== 'object') throw new Error('Invalid gift response');
    return result;
  })(), 10000);
}
export async function getGiftAccess(uid: string): Promise<GiftAccess | null> {
  if (!giftsEnabled()) return null;
  return runPaymentStore('read gift access', (async () => {
    const { data, error } = await getSupabase().from('gift_access_invites')
      .select('id,validity_days,activated_at,expires_at').eq('bound_uid', uid)
      .is('revoked_at', null).gt('expires_at', Date.now()).order('expires_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return data ? { id: data.id, validityDays: data.validity_days, activatedAt: Number(data.activated_at), expiresAt: Number(data.expires_at) } : null;
  })());
}
