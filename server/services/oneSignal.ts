/**
 * OneSignal Server-Side Push Notification Service
 * Sends real-time browser push notifications to all subscribed users for:
 * 1. High-Priority BSE Corporate Announcements (Results, Dividends, Bonus, Mergers)
 * 2. Admin Broadcasts
 */

export const ONESIGNAL_APP_ID =
  process.env.ONESIGNAL_APP_ID || 'f6cc3d33-a1bc-4c2a-992c-f36d0eccff6f';

export function getOneSignalApiKey(): string {
  return String(
    process.env.ONESIGNAL_REST_API_KEY ||
    process.env.ONESIGNAL_API_KEY ||
    process.env.VITE_ONESIGNAL_REST_API_KEY ||
    ''
  ).trim();
}

export function isOneSignalConfigured(): boolean {
  return Boolean(ONESIGNAL_APP_ID && getOneSignalApiKey());
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
  if (!apiKey) {
    return { ok: false, error: 'OneSignal REST API key is not configured in server environment.' };
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
    console.warn(`[OneSignal] Push send failed: ${errMsg}`);
    return { ok: false, error: String(errMsg).slice(0, 200) };
  } catch (err: any) {
    console.error('[OneSignal] Network error during push send:', err?.message || err);
    return { ok: false, error: err?.message || 'Network error' };
  }
}
