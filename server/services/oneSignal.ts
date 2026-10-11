/**
 * OneSignal Server-Side Push Notification Service
 * Sends real-time browser push notifications to all subscribed users for:
 * 1. High-Priority BSE Corporate Announcements (Results, Dividends, Bonus, Mergers)
 * 2. Admin Broadcasts
 */

export const ONESIGNAL_APP_ID =
  process.env.ONESIGNAL_APP_ID || 'f6cc3d33-a1bc-4c2a-992c-f36d0eccff6f';

// Dynamic API key override (from admin config or runtime)
let dynamicApiKey: string | null = null;
let unauthorizedApiKey: string | null = null;
let lastAuthNoticeTimestamp = 0;

/**
 * Validates that an API key is not an empty/placeholder/malformed string.
 * Real OneSignal REST API keys are either 48 chars (legacy hex/base64),
 * UUID (~36 chars), or start with 'os_v2_app_' (~75 chars).
 */
export function isValidOneSignalKeyFormat(key: string): boolean {
  if (!key) return false;
  const trimmed = key.trim();
  if (trimmed.length < 32) return false;
  if (/^(placeholder|dummy|your_key|none|test|fvhgfdnzmenaer23gtpbwcyuy)/i.test(trimmed)) {
    return false;
  }
  return true;
}

export function setOneSignalApiKey(key: string | null): void {
  dynamicApiKey = key ? key.trim() : null;
  // If user sets a new key, clear unauthorized state to allow retry
  if (dynamicApiKey && dynamicApiKey !== unauthorizedApiKey) {
    unauthorizedApiKey = null;
  }
}

export function getOneSignalApiKey(): string {
  if (dynamicApiKey) return dynamicApiKey;
  // SEC-105 fix (Oct 2026 audit): Removed VITE_ONESIGNAL_REST_API_KEY fallback.
  return String(
    process.env.ONESIGNAL_REST_API_KEY ||
    process.env.ONESIGNAL_API_KEY ||
    ''
  ).trim();
}

export function isOneSignalConfigured(): boolean {
  if (!ONESIGNAL_APP_ID) return false;
  const apiKey = getOneSignalApiKey();
  if (!apiKey || !isValidOneSignalKeyFormat(apiKey)) return false;
  if (unauthorizedApiKey && apiKey === unauthorizedApiKey) return false;
  return true;
}

export interface PushNotificationPayload {
  title: string;
  message: string;
  url?: string;
  newsId?: string;
  scripCode?: string;
  category?: string;
  data?: Record<string, any>;
  segments?: string[];
}

export interface PushSendResult {
  ok: boolean;
  id?: string;
  recipients?: number;
  error?: string;
}

/**
 * Send a web push notification via OneSignal REST API.
 * Never throws — catches errors and returns structured result.
 */
export async function sendOneSignalPush(payload: PushNotificationPayload): Promise<PushSendResult> {
  const apiKey = getOneSignalApiKey();
  if (!apiKey || !isValidOneSignalKeyFormat(apiKey)) {
    return { ok: false, error: 'OneSignal REST API key is not configured or is a placeholder.' };
  }

  if (unauthorizedApiKey && apiKey === unauthorizedApiKey) {
    return { ok: false, error: 'OneSignal REST API key was rejected (Access denied). Update key to resume.' };
  }

  const appId = ONESIGNAL_APP_ID;
  if (!appId) {
    return { ok: false, error: 'OneSignal App ID is missing.' };
  }

  const targetUrl = payload.url || (payload.newsId ? `https://bsenexus.in/?id=${payload.newsId}` : 'https://bsenexus.in');

  const bodyData: Record<string, any> = {
    app_id: appId,
    included_segments: payload.segments && payload.segments.length > 0 ? payload.segments : ['Subscribed Users'],
    headings: { en: payload.title },
    contents: { en: payload.message },
    web_url: targetUrl,
    url: targetUrl,
    chrome_web_icon: 'https://bsenexus.in/icon-192.png',
    firefox_icon: 'https://bsenexus.in/icon-192.png',
    data: {
      newsId: payload.newsId || '',
      scripCode: payload.scripCode || '',
      category: payload.category || '',
      ...(payload.data || {})
    }
  };

  // Auth header format: OneSignal accepts "Key <key>" or "Basic <key>" or "Bearer <key>"
  const authHeader = apiKey.startsWith('Key ') || apiKey.startsWith('Basic ') || apiKey.startsWith('Bearer ')
    ? apiKey
    : `Key ${apiKey}`;

  try {
    const res = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyData),
      signal: AbortSignal.timeout(8000),
    });

    const data: any = await res.json().catch(() => null);

    if (res.ok && data?.id) {
      console.log(`[OneSignal] Push sent successfully! ID: ${data.id}, Recipients: ${data.recipients || 0}`);
      return {
        ok: true,
        id: String(data.id),
        recipients: Number(data.recipients || 0)
      };
    }

    const errMsg = (data && (data.errors ? (Array.isArray(data.errors) ? data.errors.join(', ') : JSON.stringify(data.errors)) : data.message)) || `HTTP ${res.status}`;

    // Handle authentication / access denied gracefully without spamming alerts
    if (res.status === 401 || res.status === 403 || String(errMsg).includes('Access denied') || String(errMsg).includes('valid API key')) {
      unauthorizedApiKey = apiKey;
      const now = Date.now();
      if (now - lastAuthNoticeTimestamp > 300000) {
        lastAuthNoticeTimestamp = now;
        console.info('[OneSignal] Push dispatch paused: REST API key is unauthorized or invalid (Access denied). Configure ONESIGNAL_REST_API_KEY with a valid key.');
      }
      return { ok: false, error: 'Access denied: OneSignal REST API key is unauthorized.' };
    }

    console.info(`[OneSignal] Push dispatch notice: ${errMsg}`);
    return { ok: false, error: String(errMsg).slice(0, 200) };
  } catch (err: any) {
    console.info('[OneSignal] Push dispatch notice:', err?.message || err);
    return { ok: false, error: err?.message || 'Network error' };
  }
}
