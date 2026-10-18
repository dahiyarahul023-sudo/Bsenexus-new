/**
 * Browser permission and provider subscription are separate facts.
 * Keep the legacy worker URL; migrate only its scope away from the PWA.
 */
export const ONESIGNAL_APP_ID =
  (import.meta as any).env?.VITE_ONESIGNAL_APP_ID ||
  'f6cc3d33-a1bc-4c2a-992c-f36d0eccff6f';

export const PUSH_WORKER_SCOPE = '/push/onesignal/';

declare global {
  interface Window {
    OneSignalDeferred?: any[];
    OneSignal?: any;
  }
}

export interface PushState {
  permission: NotificationPermission | 'unsupported';
  subscribed: boolean | null;
}

let sdkScheduled = false;
let sdkInstance: any = null;
let initialization: Promise<any | null> | null = null;
const listeners = new Set<(state: PushState) => void>();

export function getPushState(): PushState {
  return {
    permission: typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
    subscribed: sdkInstance
      ? Boolean(sdkInstance.User?.PushSubscription?.optedIn)
      : null,
  };
}

function publishPushState() {
  const state = getPushState();
  for (const listener of listeners) listener(state);
}

export function loadOneSignalSdk(): void {
  if (typeof document === 'undefined' || sdkInstance || document.querySelector('script[data-bse-push-sdk]')) return;
  const script = document.createElement('script');
  script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
  script.async = true;
  script.dataset.bsePushSdk = 'true';
  script.onerror = () => {
    script.remove();
    sdkScheduled = false;
    // Permission remains authoritative even when the optional CDN is blocked.
    publishPushState();
  };
  document.head.appendChild(script);
}

function schedulePushSdk(): void {
  if (sdkScheduled) return;
  sdkScheduled = true;
  if ('requestIdleCallback' in window) window.requestIdleCallback(loadOneSignalSdk, { timeout: 4000 });
  else setTimeout(loadOneSignalSdk, 1500);
}

function ensureOneSignal(): Promise<any | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (initialization) return initialization;
  initialization = new Promise(resolve => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal: any) => {
      try {
        await OneSignal.init({
          appId: ONESIGNAL_APP_ID,
          allowLocalhostAsSecureOrigin: true,
          autoResubscribe: true,
          notifyButton: { enable: false },
          promptOptions: { slidedown: { prompts: [{ type: 'push', autoPrompt: false }] } },
          serviceWorkerParam: { scope: PUSH_WORKER_SCOPE },
          // KEEP this URL for existing subscribers; only the scope changes.
          serviceWorkerPath: 'OneSignalSDKWorker.js',
        });
        sdkInstance = OneSignal;
        OneSignal.Notifications.addEventListener('permissionChange', publishPushState);
        OneSignal.User.PushSubscription.addEventListener('change', publishPushState);
        publishPushState();
        resolve(OneSignal);
      } catch (error) {
        console.warn('[OneSignal] Client init notice:', error);
        resolve(null);
      }
    });
  });
  schedulePushSdk();
  return initialization;
}

export function initOneSignal(): void {
  if (typeof window === 'undefined') return;
  void ensureOneSignal();
  // A failed script download can be retried on the next focus/online event
  // without enqueuing a second SDK initialization.
  schedulePushSdk();
}

/** Subscribers see a late SDK result too; a deadline never means "not allowed". */
export function subscribePushState(listener: (state: PushState) => void): () => void {
  listeners.add(listener);
  listener(getPushState());
  initOneSignal();
  return () => { listeners.delete(listener); };
}

export function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function isStandalonePWA(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window.navigator as any).standalone ||
    window.matchMedia?.('(display-mode: standalone)').matches
  );
}

export interface PushRequestResult {
  granted: boolean;
  reason: 'granted' | 'ios_requires_pwa' | 'blocked_by_shield' | 'denied' | 'unsupported';
  message: string;
}

function permissionResult(permission: NotificationPermission): PushRequestResult {
  publishPushState();
  return permission === 'granted'
    ? { granted: true, reason: 'granted', message: 'Notification permission allowed.' }
    : { granted: false, reason: 'denied', message: 'Notifications are not allowed. You can change this in your browser site settings.' };
}

/** Trigger native permission within the click gesture, never from a delayed timer. */
export async function requestPushPermission(): Promise<PushRequestResult> {
  if (typeof window === 'undefined') {
    return { granted: false, reason: 'unsupported', message: 'Not in a browser.' };
  }
  if (isIOS() && !isStandalonePWA()) {
    return {
      granted: false,
      reason: 'ios_requires_pwa',
      message: 'On iPhone/iPad, add BSE Nexus to your Home Screen first.',
    };
  }

  const ready = ensureOneSignal();
  loadOneSignalSdk();
  try {
    if (typeof Notification === 'undefined') {
      return { granted: false, reason: 'unsupported', message: 'Notifications are not supported on this browser.' };
    }
    const permission = Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();

    if (permission === 'granted') {
      // Native Allow hides the permission banner immediately. OneSignal still
      // registers/reconciles its own subscription when its SDK becomes ready.
      void ready.then(async sdk => {
        if (sdk?.Notifications.isPushSupported()) {
          await sdk.User.PushSubscription.optIn();
          publishPushState();
        }
      }).catch(() => { /* Provider recovery must not undo browser permission. */ });
    }
    return permissionResult(permission);
  } catch {
    return {
      granted: false,
      reason: 'blocked_by_shield',
      message: 'Could not request notifications. Check your browser site settings or retry.',
    };
  }
}

/** Compatibility query: a timeout is unknown, never an unsubscribe decision. */
export async function isPushSubscribed(): Promise<boolean | null> {
  let timer: ReturnType<typeof setTimeout>;
  const sdk = await Promise.race([
    ensureOneSignal(),
    new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 5000); }),
  ]);
  clearTimeout(timer!);
  return sdk ? Boolean(sdk.User?.PushSubscription?.optedIn) : null;
}
