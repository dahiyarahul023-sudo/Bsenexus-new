import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeAppCheck, ReCaptchaEnterpriseProvider, type AppCheck } from 'firebase/app-check';

const configModules = typeof (import.meta as any)?.glob === 'function'
  ? (import.meta as any).glob('../firebase-applet-config.json', { eager: true })
  : {};
const rawConfig: any = Object.values(configModules)[0] ? ((Object.values(configModules)[0] as any).default || Object.values(configModules)[0]) : {};

const defaultFirebaseConfig = {
  apiKey: "AIzaSyCvtuoTPMd_e3UQ-V6CLyReDuiiJS7-1_8",
  authDomain: "bse-nexus.firebaseapp.com",
  projectId: "bse-nexus",
  storageBucket: "bse-nexus.firebasestorage.app",
  messagingSenderId: "1048233708069",
  appId: "1:1048233708069:web:6b3252dec7e05012318dcc"
};

const firebaseConfig = {
  apiKey: (rawConfig?.apiKey && rawConfig.apiKey.trim() !== '') ? rawConfig.apiKey.trim() : defaultFirebaseConfig.apiKey,
  authDomain: (rawConfig?.authDomain && rawConfig.authDomain.trim() !== '') ? rawConfig.authDomain.trim() : defaultFirebaseConfig.authDomain,
  projectId: (rawConfig?.projectId && rawConfig.projectId.trim() !== '') ? rawConfig.projectId.trim() : defaultFirebaseConfig.projectId,
  storageBucket: (rawConfig?.storageBucket && rawConfig.storageBucket.trim() !== '') ? rawConfig.storageBucket.trim() : defaultFirebaseConfig.storageBucket,
  messagingSenderId: (rawConfig?.messagingSenderId && rawConfig.messagingSenderId.trim() !== '') ? rawConfig.messagingSenderId.trim() : defaultFirebaseConfig.messagingSenderId,
  appId: (rawConfig?.appId && rawConfig.appId.trim() !== '') ? rawConfig.appId.trim() : defaultFirebaseConfig.appId
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey.trim() !== '' &&
  !firebaseConfig.apiKey.includes('Placeholder') &&
  !firebaseConfig.apiKey.includes('FakeKey')
);

// Clear stale tokens and caches from previous project on startup
if (typeof window !== 'undefined') {
  try {
    const lastProject = localStorage.getItem('bse_nexus_firebase_project');
    const currentProject = firebaseConfig.projectId || 'bse-nexus';
    if (lastProject && lastProject !== currentProject) {
      console.info(`[Auth] Resetting stale session cache for project: ${currentProject}`);
      localStorage.removeItem('bse_nexus_auth_session');
      localStorage.removeItem('bse_nexus_fb_id_token');
    }
    localStorage.setItem('bse_nexus_firebase_project', currentProject);

    // Sanitize any malformed non-JWT token from localStorage
    const existingFbToken = localStorage.getItem('bse_nexus_fb_id_token');
    if (existingFbToken && existingFbToken.split('.').length !== 3) {
      localStorage.removeItem('bse_nexus_fb_id_token');
    }

    // Suppress known benign internal assertion in @firebase/auth ("Pending promise was never set")
    const isPendingPromiseAssertion = (err: any) => {
      const msg = err?.message || String(err || '');
      return msg.includes('Pending promise was never set');
    };

    window.addEventListener('error', (event) => {
      if (isPendingPromiseAssertion(event.error) || isPendingPromiseAssertion(event.message)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return true;
      }
    }, true);

    window.addEventListener('unhandledrejection', (event) => {
      if (isPendingPromiseAssertion(event.reason)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
  } catch {}
}

// Initialize Firebase App for Auth
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Authentication instance
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

/**
 * Firebase App Check Integration Readiness:
 * Uses Enterprise attestation in production and registered debug tokens in development.
 * NOTE: App Check tokens are automatically attached to outgoing Firestore & Cloud Storage calls.
 * Enforcement MUST be turned on explicitly in the Firebase Console (Firestore -> App Check tab).
 */
export let appCheckInstance: AppCheck | null = null;

export function initAppCheck(): AppCheck | null {
  if (typeof window === 'undefined' || appCheckInstance) {
    return appCheckInstance;
  }

  const isDevelopment = (import.meta as any).env?.DEV === true;
  // A production Enterprise key cannot attest an unregistered development preview.
  // Debug tokens must be registered in Firebase Console; never use them in production.
  const debugToken = isDevelopment ? String((import.meta as any).env?.VITE_APPCHECK_DEBUG_TOKEN || '').trim() : '';
  if (isDevelopment && !debugToken) return null;

  try {
    // An App Check registration may use a different key from login risk assessment.
    const recaptchaSiteKey = (import.meta as any).env?.VITE_APPCHECK_SITE_KEY || (import.meta as any).env?.VITE_RECAPTCHA_SITE_KEY;
    if (debugToken) {
      (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
    } else {
      delete (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN;
    }

    if (recaptchaSiteKey && recaptchaSiteKey.trim() !== '' && !recaptchaSiteKey.includes('placeholder')) {
      appCheckInstance = initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey.trim()),
        isTokenAutoRefreshEnabled: true
      });
      console.info('[Firebase] App Check initialized with reCAPTCHA Enterprise provider readiness.');
    }
  } catch (err: any) {
    console.info('[Firebase] App Check initialization note (Console activation pending):', err?.message || err);
  }

  return appCheckInstance;
}

// Public rendering needs no attestation network work. Auth still loads and
// assesses reCAPTCHA on demand before the server can issue a session.
if (typeof window !== 'undefined' && isFirebaseConfigured) {
  const arm = () => {
    window.removeEventListener('pointerdown', arm);
    window.removeEventListener('keydown', arm);
    initAppCheck();
  };
  window.addEventListener('pointerdown', arm, { once: true, passive: true });
  window.addEventListener('keydown', arm, { once: true });
}
