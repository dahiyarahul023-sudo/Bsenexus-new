import { randomUUID } from 'node:crypto';
import { getSupabase } from './supabase.js';
import { calendarDayStart } from '../../src/shared/calendarTiming.js';

export interface CalendarTelegramClaim { scripCode: string; meetingDay: number; token: string }

/** The unique code/day constraint elects one worker, independent of cache IDs. */
export async function claimCalendarTelegram(scripCode: string, timestamp: number, force = false): Promise<CalendarTelegramClaim | null> {
  if (!/^\d{6}$/.test(scripCode) || !Number.isFinite(new Date(timestamp).getTime()) || timestamp < 86400000) {
    throw new Error('Invalid calendar delivery identity');
  }
  const claim = { scripCode, meetingDay: calendarDayStart(timestamp), token: randomUUID() };
  const { data, error } = await getSupabase().from('calendar_telegram_deliveries')
    .upsert({ scrip_code: claim.scripCode, meeting_day: claim.meetingDay, state: 'reserved', claim_token: claim.token,
      finished_at: null, telegram_message_id: null },
      { onConflict: 'scrip_code,meeting_day', ignoreDuplicates: !force })
    .select('scrip_code').abortSignal(AbortSignal.timeout(4000));
  if (error || !Array.isArray(data)) throw new Error('Calendar delivery ledger unavailable');
  return data.length === 1 ? claim : null;
}

export async function finishCalendarTelegram(claim: CalendarTelegramClaim, result: { success: boolean; messageId?: number }): Promise<void> {
  const { error } = await getSupabase().from('calendar_telegram_deliveries')
    .update({ state: result.success ? 'sent' : 'uncertain', finished_at: new Date().toISOString(),
      telegram_message_id: result.success ? result.messageId ?? null : null })
    .eq('scrip_code', claim.scripCode).eq('meeting_day', claim.meetingDay).eq('claim_token', claim.token)
    .abortSignal(AbortSignal.timeout(4000));
  if (error) throw new Error('Calendar delivery receipt unavailable');
}
