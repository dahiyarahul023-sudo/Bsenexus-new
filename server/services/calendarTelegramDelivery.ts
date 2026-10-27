import { claimCalendarTelegram, finishCalendarTelegram } from '../database/calendarTelegramDao.js';
import { sendToTelegram } from './telegram.js';
import { getSettings } from '../database/settingsDao.js';
import { currentUpcomingMeetings } from './calendarUniverse.js';

interface Meeting {
  id: string; scripCode: string; meetingTimestamp: number; purpose: string;
  daysLeft: number; status?: string; isDeclared?: boolean;
}

/** Reserve durably before HTTP. A timeout is not proof that Telegram rejected it. */
export async function deliverCalendarTelegram<T extends Meeting>(item: T, message: (current: T) => string,
  options: { force?: boolean; allowDeclared?: boolean } = {}): Promise<boolean> {
  const settings = await getSettings();
  if (!(settings.botToken || process.env.TELEGRAM_BOT_TOKEN) || !(settings.chatId || process.env.TELEGRAM_CHAT_ID)) return false;
  if (!currentUpcomingMeetings([item]).length || (!options.allowDeclared && item.isDeclared)) return false;
  const claim = await claimCalendarTelegram(item.scripCode, item.meetingTimestamp, options.force);
  if (!claim) return false;
  // A slow claim could cross midnight. Never render a stale Today message.
  const current = currentUpcomingMeetings([item])[0];
  if (!current) return false;
  const result = await sendToTelegram(message(current)).catch(() => ({ success: false }));
  if (claim) {
    // An unrecorded receipt leaves the reservation intact and suppresses replay.
    await finishCalendarTelegram(claim, result).catch(() => {
      console.warn('[ResultsCalendar] Delivery receipt unavailable; reservation retained');
    });
  }
  return result.success === true;
}
