import { createAvatarSaveController } from '../utils/avatarSave';
import type { AvatarId } from '../config/avatars';
import { useExpiryClock } from '../hooks/useExpiryClock';
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { usePaymentDialog } from '../hooks/usePaymentDialog';
import { 
  signInWithPopup,
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  updateProfile,
  signOut, 
  onAuthStateChanged,
  sendEmailVerification,
  signInAnonymously
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { UserProfile, UserNotificationPreferences } from '../types';
import { customFetch } from '../api';
import { runWithAdminElevation } from '../utils/adminElevation';
import { reportSyncStatus, withRetry } from '../utils/retry';
import { createPreferenceSaveQueue } from '../utils/preferenceSaveQueue';
import { executeRecaptcha } from '../utils/recaptcha';
import type { PaymentReceipt } from '../utils/cashfree';
import { recoverPendingPayments } from '../utils/cashfree';

// Login-time payment recovery runs at most once per uid per page load:
// the server re-checks unresolved orders with Cashfree and grants Pro for
// the ones that are PAID (safety net for a missed webhook / return-verify).
const paymentRecoverAttempted = new Set<string>();

export const ADMIN_EMAIL = 'dahiyarahul023@gmail.com';
export const ADMIN_EMAILS = new Set(['dahiyarahul023@gmail.com', 'rahrohdah@gmail.com']);

export function isAdminEmail(email?: string | null): boolean {
  if (!email || typeof email !== 'string') return false;
  return ADMIN_EMAILS.has(email.trim().toLowerCase());
}
const STORAGE_SESSION_KEY = 'bse_nexus_auth_session';

const defaultNotificationPreferences: UserNotificationPreferences = {
  resultsAndEarnings: true,
  orderWinsAndExpansion: true,
  dividendsAndBonus: true,
  acquisitionsAndMergers: true,
  creditRatings: true,
  muteRoutineFilings: true,
  stocksHighPriority: true,
  stocksMediumPriority: true,
  stocksLowPriority: false,
  concallsAndInvestorMeets: true,
  boardMeetingsAndOutcomes: true,
  insiderTradingAndSAST: false,
  creditRatingChanges: true,
  annualReportsAndAudits: false,
  telegramAlertsEnabled: true,
  telegramAiSummaryEnabled: true,
  telegramAlertScope: 'WATCHLIST_ONLY',
  alertPriority: 'HIGH_ONLY',
  alertScope: 'WATCHLIST_ONLY',
  alertCategory: 'RESULTS_ONLY',
};

export interface UpdateTelegramOptions {
  chatId?: string | null;
  username?: string | null;
  alertsEnabled?: boolean;
  aiSummaryEnabled?: boolean;
  alertScope?: 'WATCHLIST_ONLY' | 'ALL_MARKET';
  summaryLang?: 'hinglish' | 'english';
  unlink?: boolean;
}

export interface UpdateProfileParams {
  displayName?: string;
  username?: string;
  telegramUsername?: string;
}

export interface ProfileUpdateResult {
  success: boolean;
  error?: string;
  suggestion?: string;
  profile?: UserProfile;
}

interface AuthContextType {
  user: any | null;
  profile: UserProfile | null;
  loading: boolean;
  authLoading: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  isPro: boolean;
  /** HARD RULE: user has a successful payment on record (server-set at grant time).
   *  A paid user is NEVER labelled "Trial" anywhere. */
  isPaidPro: boolean;
  /** PRO badge / active-subscription signal: paid subscription CURRENTLY active
   *  (server-driven proExpiresAt in the future), or admin/owner. Trial-only
   *  users are EXCLUDED by design (they see "Pro Trial" wording instead).
   *  Appears automatically on payment grant; disappears automatically at expiry —
   *  no manual toggling anywhere. */
  isPaidProActive: boolean;
  proDaysLeft: number;
  /** True when the server profile/subscription state could not be read
   *  (network failure or 503 storage outage). The UI must show an explicit
   *  "unavailable — retrying" state and must NEVER render this as Free. The
   *  last-known cached profile (if any) is kept visible, marked pending
   *  verification. */
  profileUnavailable: boolean;
  adminUnlocked: boolean;
  isElevated: boolean;
  elevationExpiresAt: number;
  runElevatedAdminAction: (action: () => Promise<Response>) => Promise<Response | null>;
  loginWithGoogle: (forceRedirect?: boolean) => Promise<{ 
    success: boolean; 
    error?: string; 
    code?: string; 
    domain?: string; 
    isIframeBlocked?: boolean 
  }>;
  loginWithEmail: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  signupWithEmail: (email: string, pass: string, name: string, username?: string) => Promise<{ success: boolean; error?: string; needsEmailVerification?: boolean }>;
  quickDemoLogin: (customName?: string) => Promise<{ success: boolean; error?: string }>;
  loginWithAdminPin: (pin: string) => Promise<{ success: boolean; error?: string }>;
  verifyAdminPin: (pin: string) => Promise<{ success: boolean; error?: string }>;
  lockAdminSession: () => Promise<void>;
  logout: () => Promise<void>;
  accountPhotoURL: string | null;
  updateAvatar: (id: AvatarId | null) => Promise<ProfileUpdateResult>;
  updateProfileInfo: (displayNameOrObj: string | UpdateProfileParams, usernameOrTg?: string, telegramUsername?: string) => Promise<ProfileUpdateResult>;
  checkUsernameAvailability: (username: string) => Promise<{ available: boolean; cleanUsername: string; reason?: string; suggestion?: string }>;
  updateNotificationPreferences: (prefs: Partial<UserNotificationPreferences>) => Promise<boolean>;
  updateTelegramChatId: (chatId: string, username?: string) => Promise<boolean>;
  updateTelegramPreferences: (options: UpdateTelegramOptions) => Promise<boolean>;
  upgradeToPro: (plan?: string) => Promise<boolean>;
  refreshProfile: () => Promise<void>;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  isProModalOpen: boolean;
  setIsProModalOpen: (open: boolean) => void;
  isCheckoutOpen: boolean;
  setIsCheckoutOpen: (open: boolean) => void;
  checkoutPlanId: string;
  setCheckoutPlanId: (planId: string) => void;
  /** Open the checkout with a preselected plan (defaults to Pro Monthly). */
  openCheckout: (planId?: string) => void;
  receipt: PaymentReceipt | null;
  setReceipt: (r: PaymentReceipt | null) => void;
  isAdminPinModalOpen: boolean;
  setIsAdminPinModalOpen: (open: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// In-flight concurrency lock for anonymous guest sessions to prevent duplicate calls
let inFlightGuestLoginPromise: Promise<{ success: boolean; error?: string }> | null = null;

// Debounce for 'auth-state-changed': a single login fires syncUserProfile 2-3x
// (onAuthStateChanged + each login method), which used to refetch watchlists /
// announcements repeatedly. Collapses bursts for the same uid into one event.
let lastAuthEventAt = 0;
let lastAuthEventUid = '';
function dispatchAuthChanged(uid: string, user: any, profile: any) {
  const now = Date.now();
  if (uid === lastAuthEventUid && now - lastAuthEventAt < 1500) return;
  lastAuthEventUid = uid;
  lastAuthEventAt = now;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: { uid, user, profile } }));
  }
}
function resetAuthEventDebounce() {
  lastAuthEventUid = '';
  lastAuthEventAt = 0;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // A saved UI snapshot is never an authenticated identity or a role grant.
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const avatarStateRef = React.useRef({ user, profile });
  avatarStateRef.current = { user, profile };
  const avatarSaveRef = React.useRef<ReturnType<typeof createAvatarSaveController> | null>(null);
  if (!avatarSaveRef.current) avatarSaveRef.current = createAvatarSaveController();
  const [profileUnavailable, setProfileUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const logoutPending = useRef<Promise<void> | null>(null);
  type AdminSession = { uid: string; isAdmin: boolean; isOwner: boolean; elevationExpiresAt: number };
  const [adminSession, setAdminSession] = useState<AdminSession | null>(null);
  const adminSessionRef = useRef<AdminSession | null>(null);
  const sessionEpoch = useRef(0);
  const statusRead = useRef(0);
  const pinVerification = useRef(0);
  const adminActionPending = useRef(false);
  const pendingElevation = useRef<{ uid: string; promise: Promise<boolean>; resolve: (ok: boolean) => void } | null>(null);
  const clearAdminStatus = () => {
    statusRead.current++;
    adminSessionRef.current = null;
    setAdminSession(null);
  };
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isProModalOpen, setIsProModalOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutPlanId, setCheckoutPlanId] = useState<string>('pro_monthly');
  const openCheckout = (planId: string = 'pro_monthly') => {
    setCheckoutPlanId(planId);
    setIsCheckoutOpen(true);
  };
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
  const [isAdminPinModalOpen, setPinModalOpen] = useState(false);
  const finishElevation = (ok: boolean) => {
    if (!ok) pinVerification.current++;
    pendingElevation.current?.resolve(ok);
    pendingElevation.current = null;
    setPinModalOpen(false);
  };
  const setIsAdminPinModalOpen = (open: boolean) => {
    if (!open) finishElevation(false);
    else setPinModalOpen(true);
  };
  const clearUnverifiedSession = (prompt = false) => {
    sessionEpoch.current++;
    clearAdminStatus();
    finishElevation(false);
    try {
      localStorage.removeItem(STORAGE_SESSION_KEY);
      localStorage.removeItem('bse_nexus_fb_id_token');
    } catch {}
    setUser(null);
    setProfile(null);
    if (prompt) setIsAuthModalOpen(true);
  };
  const refreshAdminStatus = async (uid = auth.currentUser?.uid) => {
    const revision = ++statusRead.current;
    try {
      const response = await customFetch('/auth/status', { cache: 'no-store' });
      const data = await response.json();
      if (revision !== statusRead.current || !uid || auth.currentUser?.uid !== uid) return null;
      if (!response.ok || !data.isAuthenticated || data.user?.uid !== uid) {
        clearAdminStatus();
        finishElevation(false);
        if (response.ok && (!data.isAuthenticated || data.user?.uid !== uid)) clearUnverifiedSession(true);
        return null;
      }
      const session = { uid, isAdmin: data.isAdmin === true, isOwner: data.isOwner === true,
        elevationExpiresAt: data.isElevated ? Number(data.adminElevatedUntil || 0) : 0 };
      adminSessionRef.current = session;
      setAdminSession(session);
      return session;
    } catch {
      if (revision === statusRead.current) { clearAdminStatus(); finishElevation(false); }
      return null;
    }
  };
  const requestAdminElevation = () => {
    const uid = auth.currentUser?.uid;
    if (!uid || adminSessionRef.current?.uid !== uid || !adminSessionRef.current.isAdmin) {
      setIsAuthModalOpen(true);
      return Promise.resolve(false);
    }
    if (pendingElevation.current?.uid === uid) return pendingElevation.current.promise;
    finishElevation(false);
    let resolve!: (ok: boolean) => void;
    const promise = new Promise<boolean>(r => { resolve = r; });
    pendingElevation.current = { uid, promise, resolve };
    setPinModalOpen(true);
    return promise;
  };
  const runElevatedAdminAction = async (action: () => Promise<Response>) => {
    if (adminActionPending.current) return null;
    adminActionPending.current = true;
    const trigger = document.activeElement as HTMLElement | null;
    const uid = auth.currentUser?.uid;
    const epoch = sessionEpoch.current;
    try {
      return await runWithAdminElevation(action,
        () => adminSessionRef.current?.uid === uid && Number(adminSessionRef.current?.elevationExpiresAt || 0) > Date.now(),
        requestAdminElevation,
        () => Boolean(uid && auth.currentUser?.uid === uid && avatarStateRef.current.user?.uid === uid && sessionEpoch.current === epoch));
    } finally {
      adminActionPending.current = false;
      // The caller re-enables its trigger after this promise settles.
      requestAnimationFrame(() => {
        if (auth.currentUser?.uid === uid && adminSessionRef.current?.isAdmin && !pendingElevation.current && trigger?.isConnected) trigger.focus({ preventScroll: true });
      });
    }
  };

  // Helper to persist sanitized session locally for UI convenience (never stores credentials/tokens)
  // STRICT: Guest/anonymous sessions are NEVER saved in localStorage
  const saveLocalSession = (u: any, p: UserProfile) => {
    try {
      if (!u) {
        localStorage.removeItem(STORAGE_SESSION_KEY);
        return;
      }
      const isGuest = Boolean(
        u.isAnonymous ||
        !u.email ||
        u.email.endsWith('@bse-trader.local') ||
        u.uid?.startsWith('guest_') ||
        u.uid?.startsWith('trader_')
      );
      if (isGuest) {
        localStorage.removeItem(STORAGE_SESSION_KEY);
        return;
      }
      const sanitizedUser = {
        uid: u.uid,
        email: u.email || null,
        displayName: u.displayName || null,
        photoURL: u.photoURL || null,
        isAnonymous: false
      };
      localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify({ user: sanitizedUser, profile: p }));
    } catch (e) {
      console.warn('Could not save auth session locally', e);
    }
  };

  // Sync profile through backend APIs; the server uses Supabase for profiles.
  const syncUserProfile = async (firebaseUser: any) => {
    if (!firebaseUser || !firebaseUser.uid) {
      return null;
    }

    try {
      const uid = firebaseUser.uid;
      const savedLocalUsername = typeof window !== 'undefined' ? localStorage.getItem(`bse_user_handle_${uid}`) : null;
      const savedLocalTgChatId = typeof window !== 'undefined' ? localStorage.getItem(`bse_user_tg_chat_id_${uid}`) : null;
      const savedLocalTgUsername = typeof window !== 'undefined' ? localStorage.getItem(`bse_user_tg_username_${uid}`) : null;
      const emailPrefix = firebaseUser.email ? firebaseUser.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase() : 'trader';
      
      const isGuestUser = Boolean(
        firebaseUser.isAnonymous ||
        !firebaseUser.email ||
        firebaseUser.email.endsWith('@bse-trader.local') ||
        uid.startsWith('guest_') ||
        uid.startsWith('trader_')
      );

      const syncEpoch = sessionEpoch.current;
      const current = () => auth.currentUser?.uid === uid && sessionEpoch.current === syncEpoch;

      // Extract fresh Firebase ID token (no force) and sync session with backend for authenticated users
      let idToken = '';
      if (!isGuestUser && typeof firebaseUser.getIdToken === 'function') {
        try {
          const rawToken = await firebaseUser.getIdToken(false);
          if (rawToken && rawToken.split('.').length === 3) {
            idToken = rawToken;
            localStorage.setItem('bse_nexus_fb_id_token', idToken);
          } else {
            localStorage.removeItem('bse_nexus_fb_id_token');
          }
        } catch (tokErr) {
          console.warn('Could not get idToken from Firebase User:', tokErr);
        }
      }

      if (idToken && idToken.split('.').length === 3) {
        try {
          const sessionSecurity = await executeRecaptcha('SESSION');
          const sessionRes = await customFetch('/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              idToken: idToken,
              recaptchaToken: sessionSecurity.bypassed ? undefined : sessionSecurity.token,
              uid: uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName || 'Trader'
            })
          });
          if (sessionRes && sessionRes.status === 503) {
            // Payment/profile store unavailable on the server: the profile
            // fetch below also reads durably, so it will fail closed too.
            setProfileUnavailable(true);
          }
        } catch (sessionErr) {
          console.warn('Backend session exchange error:', sessionErr);
        }
      }

      if (!current()) return null;
      const verifiedSession = await refreshAdminStatus(uid);
      const isOwnerAccount = verifiedSession?.isAdmin === true;
      if (!current()) return null;
      const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
      const now = Date.now();

      let userProfile: UserProfile | null = null;
      try {
        const res = await customFetch('/api/users/profile');
        if (res.ok) {
          const data = await res.json();
          if (data && data.profile) {
            const rawFirestoreUsername = typeof data.profile.username === 'string' ? data.profile.username.trim().replace(/^@/, '') : '';
            const resolvedUsername = rawFirestoreUsername || savedLocalUsername || data.profile.telegramUsername?.replace(/^@/, '') || emailPrefix;
            
            if (typeof window !== 'undefined' && resolvedUsername) {
              localStorage.setItem(`bse_user_handle_${uid}`, resolvedUsername);
            }

            // Determine Pro status and 1-week (7-day) trial expiry
            let proExpiresAt = 0;
            let resolvedTier: 'free' | 'pro' | 'admin' = 'free';

            if (isOwnerAccount) {
              resolvedTier = 'admin';
              proExpiresAt = Number(data.profile.proExpiresAt || 0);
            } else if (!isGuestUser) {
              // Real authenticated user (Google / Email): the SERVER owns
              // trial state (it mints the 7-day trial durably at session
              // creation). Never invent an expiry client-side — a stale
              // local value must not resurrect a trial or mask paid state.
              proExpiresAt = Number(data.profile.proExpiresAt || 0);
              resolvedTier = proExpiresAt > now ? 'pro' : 'free';
            } else {
              // Guest user: strictly free, 0 trial
              resolvedTier = 'free';
              proExpiresAt = 0;
            }

            userProfile = {
              uid: uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName || data.profile.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'Trader'),
              username: resolvedUsername,
              photoURL: firebaseUser.photoURL ?? null,
              tier: resolvedTier,
              proExpiresAt: proExpiresAt,
              subscriptionAccess: data.profile.subscriptionAccess,
              // HARD RULE: payment markers must survive into the client profile —
              // a paid user is NEVER labelled "Trial". (Server is source of truth.)
              lastPaymentAt: (data.profile as any)?.lastPaymentAt || null,
              proPlanId: (data.profile as any)?.proPlanId || null,
              telegramChatId: data.profile.telegramChatId || savedLocalTgChatId || null,
              telegramUsername: data.profile.telegramUsername || savedLocalTgUsername || null,
              notificationPreferences: {
                ...defaultNotificationPreferences,
                ...(data.profile.notificationPreferences || {})
              },
              createdAt: data.profile.createdAt || now,
              lastLoginAt: now,
              maxWatchlistStocks: resolvedTier === 'pro' || resolvedTier === 'admin' ? 9999 : 5
            };
          }
        }
      } catch (profileErr) {
        console.warn('Backend profile fetch notice:', profileErr);
      }

      if (!current()) return null;
      if (!userProfile) {
        // FAIL-CLOSED (30 Sep 2026): the server profile could not be read
        // (network failure, 503 storage outage, or empty response). NEVER
        // fabricate a replacement Free/trial profile here and NEVER POST one
        // over the real profile — a paid user must not be relabelled, and
        // unknown subscription state must read as "unavailable / retrying",
        // never "Free".
        let lastKnown: UserProfile | null = null;
        try {
          const cachedProfile = JSON.parse(localStorage.getItem(STORAGE_SESSION_KEY) || 'null')?.profile;
          if (cachedProfile?.uid === uid && cachedProfile.tier !== 'admin') lastKnown = cachedProfile;
        } catch {}
        if (isOwnerAccount) {
          // Server-confirmed admin identity survives a profile-store outage.
          const resolvedUsername = savedLocalUsername || emailPrefix;
          userProfile = {
            uid: uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'Trader'),
            username: resolvedUsername,
            photoURL: firebaseUser.photoURL || null,
            tier: 'admin',
            proExpiresAt: 0,
            telegramChatId: savedLocalTgChatId || null,
            telegramUsername: savedLocalTgUsername || null,
            notificationPreferences: defaultNotificationPreferences,
            createdAt: now,
            lastLoginAt: now,
            maxWatchlistStocks: 9999
          };
        } else if (isGuestUser) {
          // Guest sessions are local-only by design — no server profile exists.
          const resolvedUsername = savedLocalUsername || emailPrefix;
          userProfile = {
            uid: uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || 'Trader',
            username: resolvedUsername,
            photoURL: firebaseUser.photoURL || null,
            tier: 'free',
            proExpiresAt: 0,
            telegramChatId: null,
            telegramUsername: null,
            notificationPreferences: defaultNotificationPreferences,
            createdAt: now,
            lastLoginAt: now,
            maxWatchlistStocks: 5
          };
        } else {
          // Real user, profile unreadable: keep the last-known cached profile
          // visible (pending verification) ONLY if it belongs to this exact
          // account — the cache is single-slot, so a different account's
          // profile must never stand in for this user.
          const ownLastKnown = lastKnown && lastKnown.uid === uid ? lastKnown : null;
          setProfileUnavailable(true);
          setUser(firebaseUser);
          setProfile(ownLastKnown);
          dispatchAuthChanged(uid, firebaseUser, ownLastKnown);
          return ownLastKnown;
        }
      } else {
        setProfileUnavailable(false);
      }

      setUser(firebaseUser);
      setProfile(userProfile);
      saveLocalSession(firebaseUser, userProfile);

      dispatchAuthChanged(uid, firebaseUser, userProfile);

      // Login-time payment recovery (27 Sep 2026): if a past payment's grant
      // was missed (webhook never fired / return-verify never ran), the
      // server repairs it now from the durable order ledger. Once per uid per
      // page load. A 503 surfaces as unavailable (never silent); a repaired
      // grant re-syncs the profile so the badge updates by itself.
      if (!isGuestUser && !paymentRecoverAttempted.has(uid)) {
        paymentRecoverAttempted.add(uid);
        recoverPendingPayments()
          .then((r) => {
            if (r.unavailable) {
              setProfileUnavailable(true);
            } else if (r.recoveredCount > 0) {
              syncUserProfile(firebaseUser).catch(() => {});
            }
          })
          .catch(() => {});
      }

      return userProfile;
    } catch (e: any) {
      console.warn("User profile sync error:", e.message);
      // Fail closed for real users: never leave a paid account reading as
      // Free after an unexpected sync error. (Guests are local-only anyway.)
      const syncFailedGuest = Boolean(
        firebaseUser?.isAnonymous ||
        !firebaseUser?.email ||
        firebaseUser?.email?.endsWith('@bse-trader.local') ||
        firebaseUser?.uid?.startsWith('guest_') ||
        firebaseUser?.uid?.startsWith('trader_')
      );
      if (!syncFailedGuest) setProfileUnavailable(true);
      return null;
    }
  };

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    try {
      unsubscribe = onAuthStateChanged(auth, async currentUser => {
        if (!active) return;
        sessionEpoch.current++;
        clearAdminStatus();
        finishElevation(false);
        if (currentUser) {
          const hasActiveGuestSession = sessionStorage.getItem('bse_guest_active_session') === 'true';
          if (currentUser.isAnonymous && !hasActiveGuestSession) {
            clearUnverifiedSession();
            await signOut(auth).catch(() => {});
          } else {
            // Clear previous account display before any asynchronous reads.
            setUser(null); setProfile(null);
            await syncUserProfile(currentUser);
          }
        } else {
          const hadCachedIdentity = Boolean(localStorage.getItem(STORAGE_SESSION_KEY) || localStorage.getItem('bse_nexus_fb_id_token'));
          clearUnverifiedSession(hadCachedIdentity);
        }
        if (active) { setLoading(false); setAuthLoading(false); }
      });
    } catch {
      clearUnverifiedSession();
      setLoading(false); setAuthLoading(false);
    }
    const expired = () => { clearUnverifiedSession(true); };
    const refresh = () => {
      if (document.visibilityState === 'visible' && auth.currentUser && !auth.currentUser.isAnonymous) void refreshAdminStatus();
    };
    window.addEventListener('auth-expired', expired);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      active = false; statusRead.current++; sessionEpoch.current++;
      unsubscribe(); finishElevation(false);
      window.removeEventListener('auth-expired', expired);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  // Google Sign-In with standard rock-solid popup authentication across Desktop & Mobile
  const loginWithGoogle = async () => {
    const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
    const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'current domain';

    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result && result.user) {
        await syncUserProfile(result.user);
        setIsAuthModalOpen(false);
        return { success: true };
      }
      return { success: false, error: 'Google sign-in was cancelled.' };
    } catch (error: any) {
      console.warn('Google Sign In Error:', error?.code || error?.message, error);

      if (error?.code === 'auth/unauthorized-domain') {
        return { 
          success: false, 
          code: 'auth/unauthorized-domain',
          domain: currentHost,
          error: `Domain "${currentHost}" is not added to Firebase Authorized Domains. In Firebase Console > Authentication > Settings > Authorized Domains, please add "${currentHost}".` 
        };
      }
      if (
        error?.code === 'auth/popup-closed-by-user' || 
        error?.code === 'auth/cancelled-popup-request' ||
        error?.message?.includes('Pending promise was never set')
      ) {
        return { 
          success: false, 
          code: error?.code || 'auth/popup-closed-by-user',
          error: 'Google sign-in window was closed. Please click "Sign in with Google" to try again.' 
        };
      }
      if (error?.code === 'auth/popup-blocked') {
        return { 
          success: false, 
          code: 'auth/popup-blocked',
          isIframeBlocked: isInIframe,
          error: isInIframe 
            ? 'Popup was blocked by your browser or the preview frame. Please open the app in a new tab to complete Google sign-in.'
            : 'Popup was blocked by your browser. Please allow popups for this site (click the popup icon in your browser address bar) and try again.' 
        };
      }
      if (isInIframe && (error?.code === 'auth/internal-error' || error?.code === 'auth/network-request-failed')) {
        return {
          success: false,
          code: error?.code,
          isIframeBlocked: true,
          error: 'Browser security prevented sign-in inside the preview frame. Please open the app in a new tab to complete Google sign-in.'
        };
      }
      return { 
        success: false, 
        code: error?.code,
        error: error?.message || 'Google sign-in encountered an error. Please try again.' 
      };
    }
  };

  // Instant Trader Access: Real persistent Firebase anonymous auth with session reuse, in-flight lock, and idempotency
  const quickDemoLogin = async (customName?: string): Promise<{ success: boolean; error?: string }> => {
    // 1. In-flight concurrency lock: return existing pending promise if user clicks multiple times
    if (inFlightGuestLoginPromise) {
      return inFlightGuestLoginPromise;
    }

    const runGuestLogin = async (): Promise<{ success: boolean; error?: string }> => {
      try {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('bse_guest_active_session', 'true');
        }
        const traderName = (typeof customName === 'string' && customName.trim()) ? customName.trim() : 'Pro Trader';

        // 2. Idempotent check: If already authenticated as an anonymous guest in current state, reuse session
        if (user && user.isAnonymous) {
          setIsAuthModalOpen(false);
          return { success: true };
        }

        let firebaseUser: any = null;

        // 3. Existing anonymous user reuse: Re-use auth.currentUser if already an anonymous session
        if (auth?.currentUser && auth.currentUser.isAnonymous) {
          firebaseUser = auth.currentUser;
          if (!firebaseUser.displayName && traderName) {
            await updateProfile(firebaseUser, { displayName: traderName }).catch(() => {});
          }
        } else {
          try {
            const result = await signInAnonymously(auth);
            if (result && result.user) {
              firebaseUser = result.user;
              if (!firebaseUser.displayName && traderName) {
                await updateProfile(firebaseUser, { displayName: traderName }).catch(() => {});
              }
            }
          } catch (fbErr: any) {
            console.info('[Auth] Anonymous firebase auth note:', fbErr?.code || fbErr?.message);
            // Fallback local trader session if offline or blocked
            firebaseUser = {
              uid: 'trader_' + Math.random().toString(36).substring(2, 10),
              displayName: traderName,
              email: `${traderName.toLowerCase().replace(/\s+/g, '_')}@bse-trader.local`,
              isAnonymous: true,
              photoURL: null,
              getIdToken: async () => ''
            };
          }
        }

        if (firebaseUser) {
          await syncUserProfile(firebaseUser);
          setIsAuthModalOpen(false);
          return { success: true };
        }
        return { success: false, error: 'Could not initialize trader session.' };
      } catch (e: any) {
        console.warn('Trader access error:', e?.message || e);
        return { success: false, error: e?.message || 'Login failed' };
      } finally {
        inFlightGuestLoginPromise = null;
      }
    };

    inFlightGuestLoginPromise = runGuestLogin();
    return inFlightGuestLoginPromise;
  };

  const loginWithEmail = async (email: string, pass: string) => {
    let trimmedEmail = email.trim().toLowerCase();
    
    if (!trimmedEmail || !pass) {
      return { success: false, error: 'Please provide both email and password.' };
    }

    // Auto-resolve handle/username if user typed username without domain
    if (!trimmedEmail.includes('@')) {
      if (trimmedEmail === 'admin' || trimmedEmail === 'dahiyarahul023' || trimmedEmail === 'rahul') {
        trimmedEmail = ADMIN_EMAIL.toLowerCase();
      } else {
        trimmedEmail = `${trimmedEmail.replace(/^@/, '')}@gmail.com`;
      }
    }

    try {
      const res = await signInWithEmailAndPassword(auth, trimmedEmail, pass);
      if (res.user) {
        await syncUserProfile(res.user);
        setIsAuthModalOpen(false);
        if (isAdminEmail(trimmedEmail)) {
          setIsAdminPinModalOpen(true);
        }
        return { success: true };
      }
      return { success: false, error: 'Invalid credentials. Please check your email and password.' };
    } catch (fbErr: any) {
      console.warn('Firebase email auth notice:', fbErr?.code || fbErr?.message);
      let errorMsg = 'Invalid email or password.';
      const code = fbErr?.code || '';
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        // If this email is actually linked with Google sign-in (no password provider),
        // point the user to the right door instead of a dead-end password error.
        // This also prevents confusion from duplicate same-email accounts.
        try {
          const methods = await fetchSignInMethodsForEmail(auth, trimmedEmail);
          if (methods.includes('google.com') && !methods.includes('password')) {
            errorMsg = 'This email uses Google sign-in. Please use "Continue with Google" instead of a password.';
          } else if (code === 'auth/user-not-found') {
            errorMsg = 'No account found with this email. Please Sign Up first.';
          } else {
            errorMsg = 'Incorrect password. Please try again.';
          }
        } catch {
          if (code === 'auth/user-not-found') errorMsg = 'No account found with this email. Please Sign Up first.';
          else errorMsg = 'Incorrect password. Please try again.';
        }
      }
      else if (code === 'auth/invalid-email') errorMsg = 'Please enter a valid email address (e.g. name@domain.com).';
      else if (code === 'auth/too-many-requests') errorMsg = 'Too many failed attempts. Please try again in a few minutes.';
      else if (fbErr?.message) errorMsg = fbErr.message;
      return { success: false, error: errorMsg };
    }
  };

  const signupWithEmail = async (email: string, pass: string, name: string, chosenUsername?: string) => {
    const trimmedEmail = email.trim().toLowerCase();
    const cleanUsername = (chosenUsername || trimmedEmail.split('@')[0])
      .toLowerCase()
      .replace(/^@/, '')
      .replace(/[^a-z0-9_]/g, '_');

    if (pass.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters.' };
    }

    try {
      // Prevent duplicate same-email accounts: if this email is already linked
      // with Google sign-in, block password-based signup and point to Google.
      // (Firebase project allows multiple accounts per email, so without this
      // check the same email gets two different UIDs = two "different accounts".)
      try {
        const existingMethods = await fetchSignInMethodsForEmail(auth, trimmedEmail);
        if (existingMethods.includes('google.com')) {
          return { success: false, error: 'This email already uses Google sign-in. Please use "Continue with Google" instead of creating a password account.' };
        }
      } catch (methodErr) {
        console.warn('Could not check existing sign-in methods:', (methodErr as any)?.code || methodErr);
        // Fall through and let Firebase return its own error if any.
      }
      const res = await createUserWithEmailAndPassword(auth, trimmedEmail, pass);
      if (res.user) {
        if (name) {
          await updateProfile(res.user, { displayName: name });
        }
        try {
          await sendEmailVerification(res.user);
        } catch (evErr) {
          console.warn('Could not send verification email:', evErr);
        }
        const p = await syncUserProfile(res.user);
        if (p && cleanUsername) {
          await updateProfileInfo({ displayName: name || p.displayName || '', username: cleanUsername });
        }
        setIsAuthModalOpen(false);
        return { success: true, needsEmailVerification: true };
      }
      return { success: false, error: 'Could not create account.' };
    } catch (fbErr: any) {
      console.warn('Firebase signup notice:', fbErr?.code || fbErr?.message);
      let errorMsg = 'Registration failed. Please try again.';
      if (fbErr?.code === 'auth/email-already-in-use') errorMsg = 'This email is already registered. Please Sign In instead.';
      else if (fbErr?.code === 'auth/weak-password') errorMsg = 'Password should be at least 6 characters.';
      else if (fbErr?.code === 'auth/invalid-email') errorMsg = 'Please enter a valid email address.';
      else if (fbErr?.message) errorMsg = fbErr.message;
      return { success: false, error: errorMsg };
    }
  };

  const loginWithAdminPin = (pin: string) => verifyAdminPin(pin);

  const verifyAdminPin = async (pin: string) => {
    const firebaseUser = auth.currentUser;
    const attempt = ++pinVerification.current;
    const epoch = sessionEpoch.current;
    const current = () => firebaseUser && auth.currentUser?.uid === firebaseUser.uid && sessionEpoch.current === epoch && pinVerification.current === attempt;
    if (!firebaseUser || firebaseUser.isAnonymous) {
      clearUnverifiedSession(true);
      return { success: false, error: 'Please sign in with your Administrator Google account.' };
    }
    try {
      // Force refresh before the PIN gate; an old stored Bearer is never used.
      let token: string;
      try { token = await firebaseUser.getIdToken(true); }
      catch {
        if (current()) clearUnverifiedSession(true);
        return { success: false, error: 'Your Google session expired. Please sign in again.' };
      }
      if (!current()) return { success: false, error: 'Account changed. Please retry.' };
      const rc = await executeRecaptcha('ADMIN_PIN');
      if (!current()) return { success: false, error: 'Account changed. Please retry.' };
      const res = await customFetch('/auth/verify-pin', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pin, recaptchaToken: rc.token, recaptchaAction: 'ADMIN_PIN' })
      });
      const data = await res.json();
      if (!current()) return { success: false, error: 'Session changed. Please sign in again.' };
      if (res.ok && (data.success || data.verified)) {
        const session = await refreshAdminStatus(firebaseUser.uid);
        if (!current() || !session?.isAdmin || session.elevationExpiresAt <= Date.now()) {
          return { success: false, error: 'Could not confirm admin elevation. Please retry.' };
        }
        finishElevation(true);
        setIsAuthModalOpen(false);
        return { success: true };
      }
      if (res.status === 403 && data.code === 'ADMIN_AUTH_REQUIRED') clearUnverifiedSession(true);
      return { success: false, error: data.error || 'Invalid Admin PIN' };
    } catch (e: any) {
      return { success: false, error: e.message || 'PIN verification failed' };
    }
  };

  const lockAdminSession = async () => {
    sessionEpoch.current++;
    statusRead.current++;
    const session = adminSessionRef.current;
    if (session) {
      const locked = { ...session, elevationExpiresAt: 0 };
      adminSessionRef.current = locked;
      setAdminSession(locked);
    }
    finishElevation(false);
    try {
      if (user && !user.isAnonymous) {
        let idToken = '';
        if (typeof (user as any).getIdToken === 'function') {
          idToken = await (user as any).getIdToken(false).catch(() => '');
        }
        if (!idToken) {
          idToken = localStorage.getItem('bse_nexus_fb_id_token') || '';
        }
        if (idToken && idToken.split('.').length === 3) {
          const sessionSecurity = await executeRecaptcha('SESSION');
          const response = await customFetch('/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              idToken,
              recaptchaToken: sessionSecurity.bypassed ? undefined : sessionSecurity.token,
              uid: user.uid,
              email: user.email,
              displayName: profile?.displayName
            })
          });
          if (response.ok) await refreshAdminStatus(user.uid);
          else clearAdminStatus();
        }
      }
    } catch (e) {}
  };

  const performLogout = async () => {
    clearUnverifiedSession();
    try {
      await signOut(auth);
    } catch (e) {}

    try {
      await customFetch('/auth/logout', { method: 'POST' });
    } catch (e) {}
    
    try {
      localStorage.removeItem(STORAGE_SESSION_KEY);
      localStorage.removeItem('bse_nexus_auth_token');
      localStorage.removeItem('bse_nexus_fb_id_token');
      localStorage.removeItem('bse_user_tg_chat_id_global');
      localStorage.removeItem('bse_user_tg_username_global');
      localStorage.removeItem('bse_telegram_chat_id');
      localStorage.removeItem('bse_chat_id');
      
      // Clean all user-specific storage keys
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('bse_user_tg_') || k.startsWith('bse_user_handle_') || k.startsWith('bse_ai_usage_')) {
          localStorage.removeItem(k);
        }
      });
      
      sessionStorage.clear();
      resetAuthEventDebounce();
      dispatchAuthChanged('guest', null, null);
    } catch (e) {}
    
    setUser(null);
    setProfile(null);
    clearAdminStatus();
    setIsAuthModalOpen(false);
    setIsAdminPinModalOpen(false);
    setIsProModalOpen(false);

    // Centralized post-logout navigation: every sign-out entry point
    // (header, settings tab, profile modal, account deletion) lands back on
    // the public landing page instead of stranding the user in guest mode on
    // the previous screen. replace() also keeps the back button from
    // returning to authenticated views.
    if (typeof window !== 'undefined') {
      window.location.replace('/');
    }
  };

  const logout = () => {
    if (logoutPending.current) return logoutPending.current;
    setSigningOut(true);
    logoutPending.current = performLogout().finally(() => {
      logoutPending.current = null;
      setSigningOut(false);
    });
    return logoutPending.current;
  };

  const checkUsernameAvailability = async (
    rawUsername: string
  ): Promise<{ available: boolean; cleanUsername: string; reason?: string; suggestion?: string }> => {
    try {
      const clean = rawUsername.trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '_').slice(0, 25);
      if (!clean || clean.length < 3) {
        return { available: false, cleanUsername: clean, reason: 'Username must be at least 3 characters long.' };
      }
      
      const res = await withRetry(async () => {
        return await customFetch(`/api/users/check-username?username=${encodeURIComponent(clean)}`);
      }, {
        maxRetries: 3,
        delays: [500, 1200, 2500]
      });

      if (res.ok) {
        const data = await res.json();
        return {
          available: Boolean(data.available),
          cleanUsername: data.cleanUsername || clean,
          reason: data.reason,
          suggestion: data.suggestion
        };
      }
      return { available: false, cleanUsername: clean, reason: 'Server check failed. Retrying...' };
    } catch (e: any) {
      console.warn('Check username notice:', e);
      return { available: false, cleanUsername: rawUsername, reason: 'Network slow/offline. Checking again...' };
    }
  };

  // Firebase Auth already owns the account photo. The server profile whitelist stays unchanged.
  const updateAvatar = async (id: AvatarId | null): Promise<ProfileUpdateResult> => {
    const account = auth?.currentUser || null;
    if (!account || avatarStateRef.current.user?.uid !== account.uid || avatarStateRef.current.profile?.uid !== account.uid) {
      return { success: false, error: 'Wait for your account to finish loading, then try again.' };
    }
    return avatarSaveRef.current!.save(id, {
      account,
      currentAccount: () => {
        const current = auth?.currentUser;
        return current && avatarStateRef.current.user?.uid === current.uid && avatarStateRef.current.profile?.uid === current.uid ? current : null;
      },
      persist: (actor, photoURL) => updateProfile(actor, { photoURL }),
      apply: (uid, photoURL) => {
        const current = avatarStateRef.current;
        if (current.user?.uid !== uid || current.profile?.uid !== uid) return;
        const next = { ...current.profile, photoURL };
        avatarStateRef.current = { ...current, profile: next };
        setProfile(next);
        saveLocalSession(account, next);
      },
    });
  };

  const updateProfileInfo = async (
    displayNameOrObj: string | UpdateProfileParams, 
    usernameOrTg?: string, 
    telegramUsername?: string
  ): Promise<ProfileUpdateResult> => {
    if (!profile) return { success: false, error: 'User is not logged in.' };
    reportSyncStatus('syncing');
    
    let newDisplayName = profile.displayName || '';
    let newUsername = profile.username || '';
    let newTgUsername = profile.telegramUsername || null;

    if (typeof displayNameOrObj === 'object' && displayNameOrObj !== null) {
      if (displayNameOrObj.displayName !== undefined) newDisplayName = displayNameOrObj.displayName.trim();
      if (displayNameOrObj.username !== undefined) {
        newUsername = displayNameOrObj.username.trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '_').slice(0, 25);
      }
      if (displayNameOrObj.telegramUsername !== undefined) {
        newTgUsername = displayNameOrObj.telegramUsername.trim() || null;
      }
    } else if (typeof displayNameOrObj === 'string') {
      newDisplayName = displayNameOrObj.trim();
      if (usernameOrTg !== undefined) {
        if (telegramUsername !== undefined) {
          newUsername = usernameOrTg.trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '_').slice(0, 25);
          newTgUsername = telegramUsername.trim() || null;
        } else {
          newTgUsername = usernameOrTg.trim() || null;
        }
      }
    }

    const updatedProfile: UserProfile = {
      ...profile,
      displayName: newDisplayName,
      username: newUsername || profile.username,
      telegramUsername: newTgUsername
    };

    // Optimistic local state update
    setProfile(updatedProfile);
    saveLocalSession(user, updatedProfile);

    if (user && user.uid && newUsername) {
      try {
        localStorage.setItem(`bse_user_handle_${user.uid}`, newUsername);
      } catch {}
    }

    // Direct Cloud sync with resilience against slow networks
    try {
      const res = await withRetry(async () => {
        return await customFetch('/api/users/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedProfile)
        });
      }, {
        maxRetries: 3,
        delays: [700, 1500, 3000],
        onRetry: (err, attempt) => {
          reportSyncStatus('syncing', `Network slow. Retrying profile cloud sync (attempt ${attempt})...`);
        }
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 409 || data.code === 'USERNAME_UNAVAILABLE') {
        reportSyncStatus('failed', data.error || 'Username is already taken');
        return {
          success: false,
          error: data.error || 'This username is already taken by another trader.',
          suggestion: data.suggestion
        };
      }

      if (res.ok && data.success) {
        const confirmed = data.profile || updatedProfile;
        // A name/handle save must not overwrite the separately confirmed Firebase avatar.
        const photoURL = auth?.currentUser?.uid === user.uid ? auth.currentUser.photoURL : updatedProfile.photoURL;
        const finalProfile = { ...confirmed, photoURL: photoURL ?? null };
        setProfile(finalProfile);
        saveLocalSession(user, finalProfile);
        reportSyncStatus('synced');
        return { success: true, profile: finalProfile };
      }

      reportSyncStatus('synced'); // Local fallback preserved
      return { success: true, profile: updatedProfile };
    } catch (e: any) {
      console.warn('Profile update notice (saved locally):', e);
      reportSyncStatus('syncing', `Saved locally. Will sync to cloud once connection strengthens.`);
      return { success: true, profile: updatedProfile };
    }
  };

  // Use a fresh profile between renders and serialize debounced writes. An
  // aborted HTTP request may still finish on the server, so do not race writes.
  const preferenceStateRef = React.useRef({ user, profile, saveLocalSession });
  preferenceStateRef.current = { user, profile, saveLocalSession };
  const preferenceQueueRef = React.useRef<ReturnType<typeof createPreferenceSaveQueue<UserNotificationPreferences>> | null>(null);
  useEffect(() => {
    const uid = user?.uid;
    const queue = createPreferenceSaveQueue<UserNotificationPreferences>({
      read: () => {
        const current = preferenceStateRef.current;
        return current.profile && current.user?.uid === uid
          ? current.profile.notificationPreferences || defaultNotificationPreferences
          : null;
      },
      apply: prefs => {
        const current = preferenceStateRef.current;
        if (!current.profile || current.user?.uid !== uid) return;
        const next = { ...current.profile, notificationPreferences: prefs };
        preferenceStateRef.current = { ...current, profile: next };
        setProfile(next);
        current.saveLocalSession(current.user, next);
      },
      save: async prefs => {
        if (preferenceStateRef.current.user?.uid !== uid) throw new Error('Account changed before preferences were saved.');
        const res = await customFetch('/api/users/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notificationPreferences: prefs }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || `Server responded with status ${res.status}`);
        }
      },
      status: (state, error) => {
        if (preferenceStateRef.current.user?.uid === uid) {
          reportSyncStatus(state, error ? `Notification prefs update failed: ${(error as any)?.message || error}` : undefined);
        }
      },
    });
    preferenceQueueRef.current = queue;
    return () => {
      queue.dispose();
      if (preferenceQueueRef.current === queue) preferenceQueueRef.current = null;
    };
  }, [user?.uid]);

  const updateNotificationPreferences = async (newPrefs: Partial<UserNotificationPreferences>): Promise<boolean> => {
    if (!preferenceStateRef.current.profile) return false;
    return preferenceQueueRef.current?.update(newPrefs) ?? false;
  };

  const updateTelegramPreferences = async (options: UpdateTelegramOptions): Promise<boolean> => {
    if (!profile) return false;
    reportSyncStatus('syncing');

    const unlink = options.unlink === true;
    const cleanChatId = unlink ? null : (options.chatId !== undefined ? (options.chatId ? options.chatId.trim() : null) : profile.telegramChatId);
    const cleanUsername = unlink ? null : (options.username !== undefined ? (options.username ? options.username.trim().replace(/^@/, '') : null) : profile.telegramUsername);

    const currentPrefs = profile.notificationPreferences || defaultNotificationPreferences;
    const updatedPrefs: UserNotificationPreferences = {
      ...currentPrefs,
      ...(options.alertsEnabled !== undefined ? { telegramAlertsEnabled: options.alertsEnabled } : {}),
      ...(options.aiSummaryEnabled !== undefined ? { telegramAiSummaryEnabled: options.aiSummaryEnabled } : {}),
      ...(options.alertScope !== undefined ? { telegramAlertScope: options.alertScope } : {}),
      ...(options.summaryLang !== undefined ? { aiSummaryLang: options.summaryLang } : {}),
    };

    if (unlink) {
      updatedPrefs.telegramAlertsEnabled = false;
    }

    const updatedProfile: UserProfile = {
      ...profile,
      telegramChatId: cleanChatId,
      telegramUsername: cleanUsername,
      notificationPreferences: updatedPrefs
    };

    const previousProfile = profile;
    setProfile(updatedProfile);
    saveLocalSession(user, updatedProfile);

    try {
      if (profile.uid) {
        if (cleanChatId) {
          localStorage.setItem(`bse_user_tg_chat_id_${profile.uid}`, cleanChatId);
        } else {
          localStorage.removeItem(`bse_user_tg_chat_id_${profile.uid}`);
        }
        if (cleanUsername) {
          localStorage.setItem(`bse_user_tg_username_${profile.uid}`, cleanUsername);
        } else {
          localStorage.removeItem(`bse_user_tg_username_${profile.uid}`);
        }
      }
    } catch {}

    try {
      const res = await customFetch('/api/users/telegram/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramChatId: cleanChatId,
          telegramUsername: cleanUsername,
          telegramAlertsEnabled: updatedPrefs.telegramAlertsEnabled,
          telegramAiSummaryEnabled: updatedPrefs.telegramAiSummaryEnabled,
          telegramAlertScope: updatedPrefs.telegramAlertScope,
          aiSummaryLang: updatedPrefs.aiSummaryLang,
          unlink
        })
      });

      if (!res.ok) {
        if (res.status === 403 || res.status === 401) {
          // Pro-gated or auth failure: never bypass via the general profile
          // endpoint — surface the real error instead.
          const errBody = await res.json().catch(() => ({} as any));
          throw new Error(errBody?.error || `Telegram settings update failed (${res.status})`);
        }
        // Transparent fallback to general profile endpoint
        const fallbackRes = await customFetch('/api/users/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telegramChatId: cleanChatId,
            telegramUsername: cleanUsername,
            notificationPreferences: updatedPrefs
          })
        });
        if (!fallbackRes.ok) {
          throw new Error(`Profile sync returned status ${fallbackRes.status}`);
        }
      }

      reportSyncStatus('synced');
      return true;
    } catch (e: any) {
      console.warn('Telegram preferences update notice:', e);
      reportSyncStatus('failed', `Telegram settings update failed: ${e?.message || e}`);
      // Roll back the optimistic update so the UI never shows a state the server rejected
      setProfile(previousProfile);
      saveLocalSession(user, previousProfile);
      return false;
    }
  };

  const updateTelegramChatId = async (chatId: string, username?: string): Promise<boolean> => {
    return updateTelegramPreferences({
      chatId,
      username,
      alertsEnabled: Boolean(chatId && chatId.trim())
    });
  };

  const upgradeToPro = async (plan: string = '1-Week Free Pro Trial') => {
    if (!profile) {
      setIsAuthModalOpen(true);
      return false;
    }

    const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000; // 1-Week (7 days) free trial
    const updatedProfile: UserProfile = {
      ...profile,
      tier: 'pro',
      proExpiresAt: expiry,
      maxWatchlistStocks: 9999,
      trialUsed: true
    };
    setProfile(updatedProfile);
    saveLocalSession(user, updatedProfile);
    // Remember trial consumption locally so the paywall can offer "Buy Pro" instead of a second trial
    try {
      const trialUid = (user as any)?.uid || profile.uid;
      if (trialUid) localStorage.setItem(`bse_trial_used_${trialUid}`, '1');
    } catch { /* non-fatal */ }

    try {
      await customFetch('/api/users/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan
        })
      });
    } catch (e) {
      console.warn('Could not update pro tier in backend:', e);
    }
    setIsProModalOpen(false);
    return true;
  };

  /** Re-sync the profile from the server (e.g. after a Cashfree payment grant). */
  const refreshProfile = async () => {
    if (user) {
      await syncUserProfile(user);
    }
  };

  useEffect(() => {
    if (!user || user.isAnonymous) return;
    const uid=user.uid;let last=0;let pending:AbortController|null=null;
    const refresh = () => {
      if (document.visibilityState !== 'visible' || Date.now()-last<2000) return;
      last=Date.now();pending?.abort();pending=new AbortController();const signal=pending.signal;
      const expectedProfile=preferenceStateRef.current.profile;
      void customFetch('/api/users/profile',{signal,cache:'no-store'}).then(async res=>{
        if(!res.ok)return;const data=await res.json();
        if(signal.aborted||data.profile?.uid!==uid||auth.currentUser?.uid!==uid)return;
        setProfile(old=>old?.uid===uid&&old===expectedProfile?{...data.profile,photoURL:old.photoURL}:old);
        setProfileUnavailable(false);
        window.dispatchEvent(new Event('notes-changed'));
      }).catch(()=>{});
    };
    window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
    return()=>{pending?.abort();window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
  },[user?.uid,user?.isAnonymous]);

  const isOwner = Boolean(user && !user.isAnonymous && auth.currentUser?.uid === user.uid && adminSession?.uid === user.uid && adminSession.isOwner);
  const isAdmin = Boolean(user && !user.isAnonymous && auth.currentUser?.uid === user.uid && adminSession?.uid === user.uid && adminSession.isAdmin);
  const elevationExpiresAt = isAdmin ? adminSession?.elevationExpiresAt || 0 : 0;
  const elevationClock = useExpiryClock(elevationExpiresAt, user?.uid);
  const isElevated = isAdmin && elevationExpiresAt > elevationClock;
  const adminUnlocked = isElevated;

  const now = useExpiryClock(profile?.proExpiresAt, user?.uid);
  const proDaysLeft = !isOwner && !isAdmin && profile?.proExpiresAt
    ? Math.max(0, Math.ceil((profile.proExpiresAt - now) / (24 * 60 * 60 * 1000)))
    : 0;

  // Strict Pro gating:
  // - Guest/Anonymous users: strictly view-only, NEVER Pro
  // - Admin/Owner: Always Pro
  // - Google/Authenticated users: Pro ONLY while 1-week (7-day) trial is active (profile.proExpiresAt > now)
  const isPro = Boolean(
    user &&
    !user.isAnonymous &&
    (
      isOwner ||
      isAdmin ||
      (profile?.tier === 'pro' && profile?.proExpiresAt && profile.proExpiresAt > now)
    )
  );

  // HARD RULE: payment succeeded => "Pro", never "Trial".
  // lastPaymentAt / proPlanId are set ONLY by the server payment grant
  // (server/api/payments.ts doGrantProForOrder) and can never come from a trial.
  const isPaidPro = Boolean(profile?.lastPaymentAt || (profile as any)?.proPlanId);

  // PRO badge signal: paid subscription currently active (server-driven
  // proExpiresAt from the payment grant), or admin/owner. Trial-only users
  // excluded by design. Auto on at grant, auto off at expiry.
  const isPaidProActive = Boolean(
    isAdmin ||
    (isPro && isPaidPro && (profile?.subscriptionAccess ? profile.subscriptionAccess.paidExpiresAt > now : profile?.proExpiresAt && profile.proExpiresAt > now))
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        authLoading,
        isOwner,
        isAdmin,
        isPro,
        isPaidPro,
        isPaidProActive,
        proDaysLeft,
        profileUnavailable,
        adminUnlocked,
        isElevated,
        elevationExpiresAt,
        runElevatedAdminAction,
        loginWithGoogle,
        loginWithEmail,
        signupWithEmail,
        quickDemoLogin,
        loginWithAdminPin,
        verifyAdminPin,
        lockAdminSession,
        logout,
        accountPhotoURL: user?.providerData?.find((p: any) => p.photoURL)?.photoURL || null,
        updateAvatar,
        updateProfileInfo,
        checkUsernameAvailability,
        updateNotificationPreferences,
        updateTelegramChatId,
        updateTelegramPreferences,
        upgradeToPro,
        refreshProfile,
        isAuthModalOpen,
        setIsAuthModalOpen,
        isProModalOpen,
        setIsProModalOpen,
        isCheckoutOpen,
        setIsCheckoutOpen,
        checkoutPlanId,
        setCheckoutPlanId,
        openCheckout,
        receipt,
        setReceipt,
        isAdminPinModalOpen,
        setIsAdminPinModalOpen
      }}
    >
      {children}
      {signingOut && <SignOutProgress />}
    </AuthContext.Provider>
  );
}

function SignOutProgress() {
  const dialog = usePaymentDialog(true, () => {});
  return <div ref={dialog} role="dialog" aria-modal="true" aria-label="Signing out" className="fixed inset-0 z-[300] grid place-items-center bg-slate-950/60 backdrop-blur-sm">
    <div role="status" tabIndex={0} className="flex items-center gap-3 rounded-2xl bg-white dark:bg-slate-900 px-6 py-5 text-sm font-semibold text-slate-800 dark:text-slate-100 shadow-xl">
      <span aria-hidden="true" className="h-5 w-5 rounded-full border-2 border-current border-t-transparent animate-spin motion-reduce:animate-none" />
      Signing out…
    </div>
  </div>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
