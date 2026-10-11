/**
 * OneSignal Client-Side Web Push Integration
 * App ID: f6cc3d33-a1bc-4c2a-992c-f36d0eccff6f
 */

export const ONESIGNAL_APP_ID =
  (import.meta as any).env?.VITE_ONESIGNAL_APP_ID ||
  'f6cc3d33-a1bc-4c2a-992c-f36d0eccff6f';

declare global {
  interface Window {
    OneSignalDeferred?: any[];
    OneSignal?: any;
  }
}

let isInitialized = false;

export function initOneSignal(): void {
  if (typeof window === 'undefined' || isInitialized) return;

  // Initialize deferred queue
  window.OneSignalDeferred = window.OneSignalDeferred || [];

  window.OneSignalDeferred.push(async (OneSignal: any) => {
    try {
      await OneSignal.init({
        appId: ONESIGNAL_APP_ID,
        allowLocalhostAsSecureOrigin: true,
        notifyButton: {
          enable: false, // We use custom native bell UI
        },
        serviceWorkerParam: {
          scope: '/',
        },
        serviceWorkerPath: 'OneSignalSDKWorker.js',
      });
      isInitialized = true;
      console.log('[OneSignal] Client push SDK initialized.');
    } catch (err) {
      console.warn('[OneSignal] Client init notice:', err);
    }
  });
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

/**
 * Prompt user for Push Notification Permission.
 * Includes timeout and platform-aware checks so it never hangs.
 */
export async function requestPushPermission(): Promise<PushRequestResult> {
  if (typeof window === 'undefined') {
    return { granted: false, reason: 'unsupported', message: 'Not in a browser.' };
  }

  // Apple iOS restriction: Web Push ONLY works when added to Home Screen (iOS 16.4+)
  if (isIOS() && !isStandalonePWA()) {
    return {
      granted: false,
      reason: 'ios_requires_pwa',
      message: 'On iPhone/iPad, Apple requires saving to Home Screen first. Tap Share (📤) ➔ "Add to Home Screen".'
    };
  }

  return new Promise((resolve) => {
    let resolved = false;
    const finish = (result: PushRequestResult) => {
      if (!resolved) {
        resolved = true;
        resolve(result);
      }
    };

    // 5-second timeout guard against aggressive adblockers/Brave shields blocking OneSignal CDN
    const timer = setTimeout(() => {
      // Fall back to native browser Notification API if available
      if (typeof Notification !== 'undefined') {
        try {
          Notification.requestPermission().then((perm) => {
            if (perm === 'granted') {
              finish({ granted: true, reason: 'granted', message: 'Notifications enabled!' });
            } else {
              finish({ granted: false, reason: 'denied', message: 'Notification permission denied.' });
            }
          }).catch(() => {
            finish({
              granted: false,
              reason: 'blocked_by_shield',
              message: 'Blocked by browser shield or adblocker. Please allow notifications in site settings.'
            });
          });
          return;
        } catch {}
      }
      finish({
        granted: false,
        reason: 'blocked_by_shield',
        message: 'Push service timed out or was blocked by Brave Shields / adblocker.'
      });
    }, 4500);

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal: any) => {
      clearTimeout(timer);
      try {
        if (!OneSignal?.Notifications) {
          finish({ granted: false, reason: 'unsupported', message: 'Notifications not available on this browser.' });
          return;
        }

        const isPushSupported = OneSignal.Notifications.isPushSupported();
        if (!isPushSupported) {
          finish({
            granted: false,
            reason: isIOS() ? 'ios_requires_pwa' : 'unsupported',
            message: isIOS()
              ? 'On iPhone/iPad, tap Share (📤) ➔ "Add to Home Screen" to enable push notifications.'
              : 'Push notifications are not supported on this browser.'
          });
          return;
        }

        await OneSignal.Notifications.requestPermission();
        const permission = OneSignal.Notifications.permission;
        if (permission === true) {
          finish({ granted: true, reason: 'granted', message: 'Notifications successfully enabled!' });
        } else {
          finish({ granted: false, reason: 'denied', message: 'Notification permission was denied.' });
        }
      } catch (err: any) {
        finish({ granted: false, reason: 'unsupported', message: err?.message || 'Could not enable notifications.' });
      }
    });
  });
}

/**
 * Check if the user is currently subscribed to Push Notifications.
 */
export async function isPushSubscribed(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), 2000);

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal: any) => {
      clearTimeout(timer);
      try {
        if (!OneSignal?.User?.pushSubscription) {
          resolve(false);
          return;
        }
        const optedIn = OneSignal.User.pushSubscription.optedIn;
        resolve(Boolean(optedIn));
      } catch {
        resolve(false);
      }
    });
  });
}
