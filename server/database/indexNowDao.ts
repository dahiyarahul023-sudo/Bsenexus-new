import { getSupabase } from './supabase';
import type { IndexNowStore } from '../services/indexNowQueue';

export const indexNowStore: IndexNowStore = {
  async enqueue(pages) {
    const { error } = await getSupabase().rpc('indexnow_enqueue', { p_pages: pages }).abortSignal(AbortSignal.timeout(5000));
    if (error) throw error;
  },
  async claim() {
    const { data, error } = await getSupabase().rpc('indexnow_claim', { p_limit: 10000 }).abortSignal(AbortSignal.timeout(5000));
    if (error) throw error;
    return data || [];
  },
  async complete(claims, status) {
    const { error } = await getSupabase().rpc('indexnow_complete', { p_claims: claims, p_status: status }).abortSignal(AbortSignal.timeout(5000));
    if (error) throw error;
  },
};
