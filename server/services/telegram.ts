import { getSettings } from '../database/settingsDao.js';
import { addLog } from '../database/logDao.js';
import { telegramCircuitBreaker } from '../utils/circuitBreaker.js';

let telegramHealth: { status: 'connected' | 'stable' | 'unconfigured' | 'degraded' | 'down'; latency: number } = { status: 'unconfigured', latency: 0 };
let cachedBotUsername: string = 'Dahiyastockbot';
const HEALTH_TTL_MS = 120_000;
let lastHealthUpdate: number | null = null;
let healthRevision = 0;
let healthInFlight: Promise<typeof telegramHealth> | null = null;

function recordHealth(value: typeof telegramHealth) {
  telegramHealth = value;
  lastHealthUpdate = Date.now();
  healthRevision++;
}

export function getBotUsername(): string {
  return cachedBotUsername;
}

export function updateTelegramHealth(): Promise<typeof telegramHealth> {
  if (healthInFlight) return healthInFlight;
  if (lastHealthUpdate !== null && Date.now() - lastHealthUpdate < HEALTH_TTL_MS) return Promise.resolve(telegramHealth);
  const revision = healthRevision;
  healthInFlight = probeTelegramHealth().then(value => {
    // A send completing after this probe started is stronger, newer evidence.
    if (revision === healthRevision) recordHealth(value);
    return telegramHealth;
  }).finally(() => { healthInFlight = null; });
  return healthInFlight;
}

async function probeTelegramHealth(): Promise<typeof telegramHealth> {
  try {
    const settings = await getSettings();
    if (!settings.botToken || !settings.chatId) {
      return { status: 'unconfigured', latency: 0 };
    }
    const start = Date.now();
    const url = `https://api.telegram.org/bot${settings.botToken}/getMe`;
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (response.ok) {
      const data = await response.json();
      if (data?.ok && data?.result?.username) {
        cachedBotUsername = data.result.username;
      }
      const latency = Date.now() - start;
      return { status: latency > 1500 ? 'degraded' : 'connected', latency };
    } else {
      return { status: 'down', latency: -1 };
    }
  } catch (error) {
    return { status: 'down', latency: -1 };
  }
}

// Immediately trigger background check to cache bot username on load
updateTelegramHealth().catch(() => {});

export function getTelegramHealth() {
  // Coalesced background probe, at most once per two minutes per instance.
  pingTelegram().catch(() => {});
  return telegramHealth;
}

export interface TelegramSendResult {
  success: boolean;
  messageId?: number;
  error?: string;
  acceptedAtMs?: number;
}

export async function pingTelegram() {
  await updateTelegramHealth();
}

export async function sendToTelegram(text: string, customChatId?: string | null): Promise<TelegramSendResult> {
  const settings = await getSettings();
  const botToken = settings.botToken || process.env.TELEGRAM_BOT_TOKEN;
  const targetChatId = customChatId || settings.chatId || process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !targetChatId) {
     return { success: false, error: 'Telegram not configured' };
  }

  // Fast-fail if circuit breaker is OPEN
  if (telegramCircuitBreaker.getState() === 'OPEN') {
    return { success: false, error: 'Telegram API circuit breaker is OPEN (failing fast to protect delivery queue)' };
  }
  
  const start = Date.now();
  return await telegramCircuitBreaker.execute<TelegramSendResult>(
    async (signal) => {
      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: signal || AbortSignal.timeout(8000),
        body: JSON.stringify({ 
          chat_id: targetChatId, 
          text, 
          parse_mode: "HTML",
          disable_web_page_preview: true
        })
      });
      
      const responseData = await response.json();
      
      if (!response.ok) {
        const errorMsg = responseData.description || "Unknown Telegram API error";
        // User-specific validation/permissions issues (chat not found, bot blocked) must not trip the global circuit breaker or mark Telegram health down
        if (response.status === 400 || response.status === 403) {
          return { success: false, error: errorMsg };
        }
        await addLog('ERROR', 'TELEGRAM', `API Error: ${errorMsg}`);
        recordHealth({ status: 'down', latency: -1 });
        throw new Error(errorMsg);
      }
      
      const latency = Date.now() - start;
      recordHealth({ status: latency > 1500 ? 'degraded' : 'stable', latency });
      return { success: true, messageId: responseData.result.message_id, acceptedAtMs: Number(responseData.result.date) * 1000 || Date.now() };
    },
    async (err) => {
      await addLog('ERROR', 'TELEGRAM', `Send failure: ${err.message}`);
      recordHealth({ status: 'down', latency: -1 });
      return { success: false, error: err.message || "Network error" };
    },
    8000
  );
}

export async function sendReplyToTelegram(text: string, replyToMessageId: number, customChatId?: string | null): Promise<TelegramSendResult> {
  const settings = await getSettings();
  const botToken = settings.botToken || process.env.TELEGRAM_BOT_TOKEN;
  const targetChatId = customChatId || settings.chatId || process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !targetChatId) return { success: false };

  if (telegramCircuitBreaker.getState() === 'OPEN') {
    return { success: false, error: 'Telegram circuit is OPEN' };
  }

  const start = Date.now();
  return await telegramCircuitBreaker.execute<TelegramSendResult>(
    async (signal) => {
      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: signal || AbortSignal.timeout(8000),
        body: JSON.stringify({
          chat_id: targetChatId,
          reply_to_message_id: replyToMessageId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true
        })
      });
      const responseData = await response.json();
      if (!response.ok) {
        const errorMsg = responseData?.description || `HTTP ${response.status}`;
        // LOGIC-012 fix (1 Oct 2026 audit): Mirror sendToTelegram pattern —
        // user-specific 400/403 errors (e.g. "message to reply not found",
        // "chat not found", "bot blocked") must NOT trip the global circuit
        // breaker. Previously any 400/403 threw, which after 3 occurrences
        // opened the breaker for 20s and blocked ALL Telegram sends.
        if (response.status === 400 || response.status === 403) {
          return { success: false, error: errorMsg };
        }
        recordHealth({ status: 'down', latency: -1 });
        throw new Error(errorMsg);
      }
      const latency = Date.now() - start;
      recordHealth({ status: latency > 1500 ? 'degraded' : 'stable', latency });
      return { success: true, messageId: responseData?.result?.message_id };
    },
    async (err) => {
      await addLog('ERROR', 'TELEGRAM', `Reply send failure: ${err.message}`);
      recordHealth({ status: 'down', latency: -1 });
      return { success: false, error: err.message || "Network error" };
    },
    8000
  );
}
