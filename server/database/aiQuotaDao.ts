import { getSupabase, isSupabaseConfigured } from './supabase.js';
import { PaymentStoreUnavailableError, runPaymentStore } from './paymentStore.js';

export interface DurableQuotaResult { allowed: boolean; used: number; remaining: number; dailyLimit: number; reservationId?: string }
/** No local fallback when cloud storage is configured, or in production. */
export function requiresDurableAiQuota(): boolean {
  return isSupabaseConfigured() || process.env.NODE_ENV === 'production';
}
export async function operateDurableAiQuota(uid: string, action: 'status' | 'reserve' | 'refund' | 'reset', reservationId?: string): Promise<DurableQuotaResult> {
  if (!isSupabaseConfigured()) throw new PaymentStoreUnavailableError('AI quota ' + action);
  const result = await runPaymentStore('AI quota ' + action, Promise.resolve().then(async () => {
    const { data, error } = await getSupabase().rpc('manage_ai_quota', {
      p_uid: uid, p_action: action, p_reservation_id: reservationId || null,
    });
    if (error) throw error;
    if (!data || typeof data.allowed !== 'boolean' || !Number.isInteger(data.used) || data.used < 0 || data.dailyLimit !== 100 || data.remaining !== Math.max(0, 100 - data.used)) {
      throw new Error('Invalid durable AI quota response');
    }
    if (action === 'reserve' && data.allowed && data.reservationId !== reservationId) throw new Error('Invalid quota reservation identity');
    return data as DurableQuotaResult;
  }));
  return result;
}
