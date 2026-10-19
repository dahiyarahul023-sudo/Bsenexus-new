import { getSupabase } from './supabase.js';

export interface ResultState {
  status: string;
  claim_token: string;
  value: { text?: string; messageId?: number; reason?: string };
}
export interface ResultClaim { acquired: boolean; row: ResultState; }
export async function recordFilingDeliveryTiming(row: {
  news_id: string; telegram_message_id: number; source: string;
  exchange_at: number | null; observed_at: number | null; processed_at: number; accepted_at: number;
}) {
  const { error } = await getSupabase().from('filing_delivery_timings').insert(row).abortSignal(AbortSignal.timeout(3000));
  if (error && error.code !== '23505') throw new Error('Delivery timing store unavailable');
}
export const telegramResultStore = {
  async claim(key: string, kind: 'summary' | 'delivery', source: string, token: string): Promise<ResultClaim> {
    const { data, error } = await getSupabase().rpc('claim_telegram_result', {
      p_key: key, p_kind: kind, p_source: source, p_token: token,
    }).abortSignal(AbortSignal.timeout(5000));
    if (error || !data) throw new Error('Result claim store unavailable');
    return data as ResultClaim;
  },
  async read(key: string): Promise<ResultState | null> {
    const { data, error } = await getSupabase().from('telegram_result_state').select('status,claim_token,value')
      .eq('state_key', key).abortSignal(AbortSignal.timeout(5000)).maybeSingle();
    if (error) throw new Error('Result state store unavailable');
    return data;
  },
  async finish(key: string, token: string, status: string, value: ResultState['value'] = {}): Promise<boolean> {
    const { data, error } = await getSupabase().rpc('finish_telegram_result', {
      p_key: key, p_token: token, p_status: status, p_value: value,
    }).abortSignal(AbortSignal.timeout(5000));
    if (error) throw new Error('Result completion store unavailable');
    return data === true;
  },
};
