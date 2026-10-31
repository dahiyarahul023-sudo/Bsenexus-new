import { getSupabase, isSupabaseConfigured } from './supabase.js';
import { runPaymentStore, PaymentStoreUnavailableError } from './paymentStore.js';

export interface FaqQuotaResult { allowed: boolean; used: number; remaining: number; dailyLimit: number; reservationId?: string }
export type FaqQuotaAction = 'status' | 'reserve' | 'refund';
export async function operateFaqQuota(identityHash: string, action: FaqQuotaAction, reservationId?: string): Promise<FaqQuotaResult> {
  if (!isSupabaseConfigured()) throw new PaymentStoreUnavailableError('FAQ quota');
  return runPaymentStore('FAQ quota', Promise.resolve().then(async () => {
    const { data, error } = await getSupabase().rpc('manage_faq_quota', {
      p_identity_hash: identityHash, p_action: action, p_reservation_id: reservationId || null,
    }).abortSignal(AbortSignal.timeout(3500));
    if (error) throw error;
    if (!data || typeof data.allowed !== 'boolean' || !Number.isInteger(data.used) || data.used < 0 || data.used > 4 || data.dailyLimit !== 4 || data.remaining !== 4 - data.used) throw new Error('Invalid FAQ quota response');
    if (action === 'reserve' && data.allowed && data.reservationId !== reservationId) throw new Error('Invalid FAQ reservation');
    return data as FaqQuotaResult;
  }), 4000);
}
