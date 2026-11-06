import express from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { getSettings, saveAdminPinHash } from '../database/settingsDao.js';
import { verifyAndMigrateAdminPin } from './adminPin.js';
import { addLog } from '../database/logDao.js';
import { getFirebaseAuth, getFirebaseAppCheck } from './firebaseAdmin.js';
import { getUserProfile, claimTrialAtomically, isAdminEmail, ADMIN_EMAILS } from '../database/usersDao.js';
import { getAccessProfile } from '../services/subscriptionAccess.js';
import { reconcilePaymentEntitlement } from '../database/paymentEntitlementsDao.js';
import { isPaymentStoreUnavailable } from '../database/paymentStore.js';
import { verifyRecaptchaToken } from './recaptchaService.js';
import { getFirebaseIdentity, hasTrustedSessionRoles } from './firebaseIdentity.js';
import { createVerifiedTokenCache, resolveVerifyCacheMs } from './verifiedTokenCache.js';
import { 
  getAccountKey, 
  checkAccountProtection, 
  recordFailedAttempt, 
  resetAccountProtection, 
  simulateCredentialVerificationDelay, 
  getSanitizedClientIp,
  getAccountProtectionConfig,
  isAccountProtectionUnavailable
} from './accountRateLimiter.js';

import crypto from 'node:crypto';

// Cryptographically secure JWT Secret (fallback to generated ephemeral secret in dev/test if not in env)
const devFallbackSecret = typeof crypto.randomBytes === 'function'
  ? crypto.randomBytes(32).toString('hex')
  : 'bsenexus_default_ephemeral_dev_jwt_secret_token_12345';

const JWT_SECRET = (process.env.JWT_SECRET && process.env.JWT_SECRET.trim())
  ? process.env.JWT_SECRET.trim()
  : (() => {
      if (process.env.NODE_ENV === 'production') {
        throw new Error("FATAL CONFIG ERROR: JWT_SECRET environment variable is not defined. Server cannot operate securely in production.");
      }
      console.warn('[Auth] JWT_SECRET not set in environment — using ephemeral development secret.');
      return devFallbackSecret;
    })();
const ADMIN_EMAIL = 'dahiyarahul023@gmail.com';
function getCookieElevation(req: express.Request, uid: string): number {
  try {
    const claims: any = jwt.verify(req.cookies?.authToken || '', JWT_SECRET);
    return hasTrustedSessionRoles(claims, ADMIN_EMAIL) && claims.uid === uid && claims.emailVerified === true
      ? Number(claims.adminElevatedUntil || 0) : 0;
  } catch { return 0; }
}


// Rate limiter for authentication attempts
export const authRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30, // max 30 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    forwardedHeader: false,
    default: true,
  },
  message: { error: "Too many authentication requests from this IP. Please try again in 5 minutes." }
});

// Rate limiter for general API routes
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300, // max 300 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    forwardedHeader: false,
    default: true,
  },
  message: { success: false, error: "Too many requests to the API. Please slow down and try again shortly." }
});

// Dedicated rate limiter for AI generation endpoints (prevents spam and Gemini quota depletion)
export const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // max 20 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    forwardedHeader: false,
    default: true,
  },
  message: { success: false, error: "AI summary rate limit exceeded. Please wait a moment before generating another summary." }
});

// Dedicated rate limiter for Telegram broadcast endpoints (prevents Telegram API 429 throttling)
export const telegramRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // max 20 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    forwardedHeader: false,
    default: true,
  },
  message: { success: false, error: "Telegram broadcast rate limit reached. Please wait a moment before broadcasting again." }
});

// PERF-1: revocation-checked Firebase verification is a network call to Google.
// Reuse one successful verification for a short window (default 60 s, never past
// the token's own expiry) and let parallel requests share it. Disabled in tests
// and with FIREBASE_VERIFY_CACHE_MS=0. /auth/session still verifies fresh.
const firebaseTokenCache = createVerifiedTokenCache<any>({ ttlMs: resolveVerifyCacheMs() });

export const authMiddleware = async (req: express.Request, _res: express.Response, next: express.NextFunction) => {
  const cookie = req.cookies?.authToken;
  const bearer = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7).trim() : '';
  let tokenExpired = false;
  const localSession = (token: string) => {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    if (!decoded.uid || !hasTrustedSessionRoles(decoded, ADMIN_EMAIL)) throw new Error('Untrusted session');
    return { ...decoded, isAdmin: decoded.emailVerified === true && isAdminEmail(decoded.email) && Number(decoded.adminElevatedUntil || 0) > Date.now() };
  };
  if (bearer) {
    try {
      (req as any).user = localSession(bearer);
      return next();
    } catch (error: any) { tokenExpired = error?.name === 'TokenExpiredError'; }
    try {
      const adminAuth = getFirebaseAuth();
      if (adminAuth && bearer.split('.').length === 3) {
        const decoded = await firebaseTokenCache.verify(bearer, t => adminAuth.verifyIdToken(t, true));
        const identity = getFirebaseIdentity(decoded, ADMIN_EMAIL);
        const elevation = identity?.isOwner ? getCookieElevation(req, decoded.uid) : 0;
        (req as any).user = {
          uid: decoded.uid, rawUid: decoded.uid, email: identity?.email,
          emailVerified: identity?.emailVerified === true,
          name: decoded.name || decoded.displayName || (identity ? 'User' : 'Guest Trader'),
          isOwner: identity?.isOwner === true,
          isAdmin: identity?.isOwner === true && elevation > Date.now(),
          adminElevatedUntil: elevation, isAnonymous: !identity
        };
        return next();
      }
    } catch (error: any) { tokenExpired ||= error?.code === 'auth/id-token-expired'; }
  }
  // A rejected/expired Bearer must not mask the independent signed cookie.
  // Never decode unverified claims, and never borrow another UID's elevation
  // when a Bearer identity has verified successfully above.
  if (typeof cookie === 'string' && cookie.trim()) {
    try {
      (req as any).user = localSession(cookie.trim());
      return next();
    } catch (error: any) { tokenExpired ||= error?.name === 'TokenExpiredError'; }
  }
  (req as any).authFailure = { tokenExpired };
  (req as any).user = { uid: 'guest', isOwner: false, isAdmin: false, isAnonymous: true };
  return next();
};

// Firebase App Check Verification Helper & Middleware Readiness
export async function verifyAppCheckHeader(req: express.Request): Promise<{ valid: boolean; token?: any; error?: string }> {
  const appCheckToken = req.headers['x-firebase-appcheck'] as string;
  if (!appCheckToken || typeof appCheckToken !== 'string') {
    return { valid: false, error: 'Missing X-Firebase-AppCheck header' };
  }

  try {
    const adminAppCheck = getFirebaseAppCheck();
    if (!adminAppCheck) {
      return { valid: false, error: 'Firebase Admin App Check not available' };
    }
    const decoded = await adminAppCheck.verifyToken(appCheckToken.trim());
    return { valid: true, token: decoded };
  } catch (err: any) {
    return { valid: false, error: err?.message || 'App Check token invalid' };
  }
}

export const requireAppCheck = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Configurable readiness: Enforces App Check if FIREBASE_APPCHECK_ENFORCE is set to 'true'.
  // Defaults to non-blocking so previews and local development are not blocked before Console activation.
  if (process.env.FIREBASE_APPCHECK_ENFORCE !== 'true') {
    return next();
  }

  const result = await verifyAppCheckHeader(req);
  if (!result.valid) {
    return res.status(401).json({
      success: false,
      appCheckError: true,
      error: 'App Check verification failed. Request unverified by Google.'
    });
  }

  (req as any).appCheck = result.token;
  return next();
};

// Strict Authentication Guard (Requires logged-in user with Google or verified session)
export const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const user = (req as any).user;
  if (!user || !user.uid || user.uid === 'guest' || user.isAnonymous) {
    return res.status(401).json({ 
      success: false, 
      authRequired: true,
      tokenExpired: (req as any).authFailure?.tokenExpired === true,
      error: "Google Sign-In Required: Guest access is strictly view-only. Please sign in with Google to get 1 week (7 days) of Free Pro access." 
    });
  }
  next();
};

// Resilient Admin Authorization Guard (Checks verified JWT or verified Owner session)
export const requireAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const user = (req as any).user;
  if (!user?.uid || user.uid === 'guest' || user.isAnonymous) {
    return res.status(403).json({ success: false, code: 'ADMIN_AUTH_REQUIRED', authRequired: true,
      tokenExpired: (req as any).authFailure?.tokenExpired === true,
      error: 'Sign in with an authorized Administrator Google account before verifying the Master PIN.' });
  }
  if (user.emailVerified !== true || !isAdminEmail(user.email)) {
    return res.status(403).json({ success: false, code: 'ADMIN_FORBIDDEN', error: 'A verified Administrator account is required.' });
  }
  if (Number(user.adminElevatedUntil || 0) > Date.now()) return next();
  return res.status(403).json({ success: false, adminElevationRequired: true,
    error: 'Forbidden: Verify Master PIN in Settings → Administration → Admin Master Key (or Gift Pro Access → Verify admin PIN). Elevation lasts 15 minutes.' });
};

// Pro or Admin Authorization Guard (Allows verified Pro trial subscribers or Admin/Owner)
export const requireProOrAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const user = (req as any).user;
  if (!user || !user.uid || user.uid === 'guest' || user.isAnonymous) {
    return res.status(401).json({ 
      success: false, 
      authRequired: true,
      tokenExpired: (req as any).authFailure?.tokenExpired === true,
      error: "Google Sign-In Required: Sign in with Google to activate your 1-Week Free Pro trial." 
    });
  }

  if (user.isAdmin || (user.isOwner && !user.isAnonymous && isAdminEmail(user.email))) {
    return next();
  }

  // The JWT `isPro` claim is minted at login and goes stale the moment a user's
  // Pro/trial expires, so it is NEVER trusted here. The dedicated payment
  // entitlement is checked before the mutable profile mirror.
  let profileReadFailed = false;
  let wasPaidUser = false;
  try {
    const reconciled = await reconcilePaymentEntitlement(user.uid);
    const entitlement = reconciled.entitlement;
    if (entitlement && entitlement.proExpiresAt > Date.now()) {
      return next();
    }
    wasPaidUser = Boolean(entitlement?.lastPaymentAt || entitlement?.lastOrderId);

    const profile = await getAccessProfile(user.uid, { durable: true });
    const now = Date.now();
    // HARD RULE: a user with a successful payment on record is NEVER told
    // about a "trial" — even after their Pro expires.
    wasPaidUser = wasPaidUser || Boolean((profile as any)?.lastPaymentAt || (profile as any)?.proPlanId);
    if (profile && (profile.tier === 'admin' || (profile.proExpiresAt && profile.proExpiresAt > now))) {
      return next();
    }
  } catch {
    profileReadFailed = true;
  }

  if (profileReadFailed) {
    // Fail closed: live Pro status could not be verified — never fall back to
    // the stale JWT claim. The user retries once storage recovers.
    return res.status(503).json({
      success: false,
      error: "Couldn't verify your Pro status right now. Please retry in a moment."
    });
  }

  return res.status(403).json({ 
    success: false, 
    proRequired: true, 
    error: wasPaidUser
      ? "Your Pro subscription has expired. Renew Pro — one-time plans from ₹59 (Weekly), ₹199 (Monthly), ₹999 (6-Month), ₹1,799 (Yearly) — to continue using this feature."
      : "Your Pro access has ended. Please upgrade to Pro — one-time plans from ₹59 (Weekly), ₹199 (Monthly), ₹999 (6-Month), ₹1,799 (Yearly) — to continue using this feature."
  });
};

export const authRouter = express.Router();

// Session login for Firebase-authenticated users: Verifies Firebase ID Token
authRouter.post('/session', authRateLimiter, requireAppCheck, async (req, res) => {
  try {
    // Before token verification, only the sanitized IP is a trustworthy risk key.
    // Unverified body emails must never lock or reset another user's account.
    const accountKey = getAccountKey(`session-ip:${getSanitizedClientIp(req)}`);

    // Enforce per-account protection against distributed credential stuffing / token brute-force
    const acctProtection = await checkAccountProtection(accountKey);
    if (!acctProtection.allowed) {
      if (acctProtection.delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, acctProtection.delayMs));
      }
      return res.status(429).json({
        success: false,
        error: `Too many failed attempts for this account. Locked for ${acctProtection.remainingLockoutSec}s.`,
        code: "ACCOUNT_LOCKED",
        remainingSec: acctProtection.remainingLockoutSec
      });
    }

    if (acctProtection.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, acctProtection.delayMs));
    }

    const { recaptchaToken, recaptchaAction } = req.body || {};
    if (recaptchaToken || process.env.NODE_ENV === 'production' || process.env.RECAPTCHA_ENFORCE === 'true') {
      const context = {
        ip: getSanitizedClientIp(req),
        userAgent: req.headers['user-agent'] as string,
        host: req.headers.host as string
      };
      const assessment = await verifyRecaptchaToken(
        recaptchaToken,
        'SESSION',
        context
      );
      if (!assessment.valid) {
        return res.status(400).json({
          success: false,
          error: assessment.userMessage || 'Security verification failed. Please try again.',
          code: assessment.errorCode
        });
      }
    }

    const authHeader = req.headers.authorization;
    let idToken = req.body?.idToken;
    if (!idToken && authHeader && authHeader.startsWith('Bearer ')) {
      idToken = authHeader.substring(7);
    }

    if (!idToken || typeof idToken !== 'string' || !idToken.trim()) {
      await recordFailedAttempt(accountKey);
      await simulateCredentialVerificationDelay();
      return res.status(401).json({ success: false, error: "Valid Firebase ID token required" });
    }

    idToken = idToken.trim();
    const tokenParts = idToken.split('.');
    if (tokenParts.length !== 3) {
      await recordFailedAttempt(accountKey);
      await simulateCredentialVerificationDelay();
      return res.status(401).json({ success: false, error: "Invalid Firebase ID token format. A 3-segment JWT is required." });
    }

    const auth = getFirebaseAuth();
    let decodedToken: any = null;

    if (auth) {
      try {
        decodedToken = await auth.verifyIdToken(idToken, true);
      } catch {
        // Fallback gracefully without noisy console warning
      }
    }

    // SECURITY (1 Oct 2026 audit SEC-002): The previous unverified jwt.decode()
    // fallback allowed attackers to forge Firebase-looking JWTs and obtain a
    // server-signed admin JWT (7-day validity) with isOwner:true. Removed
    // entirely — if adminAuth.verifyIdToken() fails or is unavailable, the
    // session request MUST fail with 401. Never mint a JWT_SECRET-signed token
    // from unverified claims.

    if (!decodedToken || !decodedToken.uid) {
      const failResult = await recordFailedAttempt(accountKey);
      await simulateCredentialVerificationDelay();
      if (failResult.locked) {
        return res.status(429).json({
          success: false,
          error: `Too many failed attempts for this account. Locked for ${failResult.remainingLockoutSec}s.`,
          code: "ACCOUNT_LOCKED",
          remainingSec: failResult.remainingLockoutSec
        });
      }
      return res.status(401).json({ success: false, error: "Invalid or expired Firebase ID token." });
    }

    const identity = getFirebaseIdentity(decodedToken, ADMIN_EMAIL);
    if (!identity) {
      await recordFailedAttempt(accountKey);
      return res.status(401).json({ success: false, error: 'A non-anonymous Firebase account with an email is required.' });
    }
    const verifiedAccountKey = getAccountKey(`session-uid:${identity.uid}`);
    const verifiedProtection = await checkAccountProtection(verifiedAccountKey);
    if (!verifiedProtection.allowed) {
      return res.status(429).json({ success: false, code: 'ACCOUNT_LOCKED', error: 'Verified account is temporarily locked.', remainingSec: verifiedProtection.remainingLockoutSec });
    }
    await resetAccountProtection(verifiedAccountKey);

    const { uid, email, displayName, emailVerified, isOwner } = identity;

    const cleanUid = uid.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    const existingIsAdmin = false;

    // Restore any durable paid entitlement before trial/profile logic runs.
    // If the payment store cannot be read, do not mint a session that could
    // label a paid user as Free.
    try {
      await reconcilePaymentEntitlement(cleanUid);
    } catch (entitlementErr: any) {
      if (isPaymentStoreUnavailable(entitlementErr)) {
        return res.status(503).json({
          success: false,
          error: "Couldn't verify your subscription right now. Please retry in a moment.",
        });
      }
      throw entitlementErr;
    }

    // Check / initialize 1-Week (7-Day) Pro Trial for authenticated users.
    // Durable read: never mint a trial profile from a stale/missing local
    // copy — a paid user must not get a replacement trial profile.
    let profile: Awaited<ReturnType<typeof getUserProfile>> | null;
    try {
      profile = await getUserProfile(cleanUid, { durable: true });
    } catch (profileErr: any) {
      if (isPaymentStoreUnavailable(profileErr)) {
        return res.status(503).json({
          success: false,
          error: "Couldn't verify your subscription right now. Please retry in a moment.",
        });
      }
      throw profileErr;
    }
    const now = Date.now();
    // Server-only RPC atomically records first use; expiry loss is not eligibility.
    await claimTrialAtomically(cleanUid, email, displayName || email.split('@')[0]);
    profile = await getAccessProfile(cleanUid, { durable: true });

    const isPro = Boolean(isOwner || profile?.tier === 'admin' || (profile?.proExpiresAt && profile.proExpiresAt > now));
    const proDaysLeft = profile?.proExpiresAt ? Math.max(0, Math.ceil((profile.proExpiresAt - now) / (24 * 60 * 60 * 1000))) : 0;

    // Sign token with real clean UID, preserving admin/owner and pro privileges in claims
    const token = jwt.sign(
      { uid: cleanUid, rawUid: cleanUid, email, displayName, emailVerified, isOwner, isAdmin: existingIsAdmin, isPro, auth: true },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/'
    });

    await addLog('INFO', 'AUTH', `User session verified & started: ${email || cleanUid} (${isOwner ? 'OWNER' : isPro ? `PRO_ACCESS_${proDaysLeft}D` : 'FREE_USER'})`);
    res.json({ 
      success: true, 
      token, 
      isAdmin: existingIsAdmin, 
      isOwner, 
      isPro,
      proDaysLeft,
      user: { uid: cleanUid, email, displayName },
      profile 
    });
  } catch (error: any) {
    if (isAccountProtectionUnavailable(error)) return res.status(503).json({ success: false, error: 'Sign-in protection is temporarily unavailable. Please retry.' });
    if (isPaymentStoreUnavailable(error)) {
      return res.status(503).json({
        success: false,
        error: "Couldn't verify your subscription right now. Please retry in a moment.",
      });
    }
    console.error("Firebase ID Token verification failed in /auth/session:", error?.message || error);
    return res.status(401).json({ success: false, error: "Invalid or expired Firebase ID token." });
  }
});

const authAttempt = (handler: (req: express.Request, res: express.Response) => Promise<any>) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
  handler(req, res).catch(error => {
    if (isAccountProtectionUnavailable(error)) return res.status(503).json({ success: false, error: 'Sign-in protection is temporarily unavailable. Please retry.' });
    if (isPaymentStoreUnavailable(error)) return res.status(503).json({ success: false, error: 'PIN verification is temporarily unavailable. Please retry.' });
    next(error);
  });
};

// Master PIN Login / 2FA Elevation (Fail-Closed: Standalone PIN login without Admin identity is strictly forbidden)
authRouter.post('/login', authRateLimiter, requireAppCheck, authAttempt(async (req, res) => {
  const { pin, recaptchaToken, recaptchaAction, email, identifier, username } = req.body || {};
  const settings = await getSettings();

  // Strict Security Rule: Standalone PIN login without prior Administrator authentication is blocked.
  // Attackers cannot guess or brute-force PINs without authenticating with the Admin Google/Email account first.
  const currentUser = (req as any).user;
  const isAuthorizedAdmin = currentUser && !currentUser.isAnonymous && currentUser.emailVerified === true && isAdminEmail(currentUser.email);

  if (!isAuthorizedAdmin) {
    await simulateCredentialVerificationDelay();
    return res.status(403).json({
      success: false,
      error: "Access Denied: Standalone PIN login is disabled. You must first sign in with an authorized Administrator account.",
      code: "ADMIN_AUTH_REQUIRED"
    });
  }

  // Resolve normalized account key via one-way keyed HMAC hash (never store or leak raw emails)
  const rawIdentifier = currentUser.email || email || identifier || username || 'admin_master_account';
  const accountKey = getAccountKey(rawIdentifier);

  // 1. Check per-account protection status (lockout and progressive delay)
  const acctProtection = await checkAccountProtection(accountKey);
  if (!acctProtection.allowed) {
    if (acctProtection.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, acctProtection.delayMs));
    }
    return res.status(429).json({
      success: false,
      error: `Too many failed login attempts for this account. Locked for ${acctProtection.remainingLockoutSec}s.`,
      code: "ACCOUNT_LOCKED",
      remainingSec: acctProtection.remainingLockoutSec
    });
  }

  // Apply progressive delay if account has prior failed attempts within active window
  if (acctProtection.delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, acctProtection.delayMs));
  }

  // 2. Validate reCAPTCHA with safe client IP (honoring trust proxy without trusting client-supplied headers blindly)
  if (recaptchaToken || process.env.NODE_ENV === 'production' || process.env.RECAPTCHA_ENFORCE === 'true') {
    const context = {
      ip: getSanitizedClientIp(req),
      userAgent: req.headers['user-agent'] as string,
      host: req.headers.host as string
    };
    const assessment = await verifyRecaptchaToken(
      recaptchaToken,
      'ADMIN_PIN',
      context
    );
    if (!assessment.valid) {
      return res.status(400).json({
        success: false,
        error: assessment.userMessage || 'Security verification failed. Please try again.',
        code: assessment.errorCode
      });
    }
  }

  if (!pin) {
    await simulateCredentialVerificationDelay();
    return res.status(400).json({ success: false, error: "Master PIN is required" });
  }

  const strPin = String(pin).trim();
  if (!settings.appPinHash && !process.env.APP_PIN) {
    await simulateCredentialVerificationDelay();
    return res.status(400).json({ success: false, error: "Master PIN is not configured yet. Please configure APP_PIN in environment or initialize in settings." });
  }
  const isValid = await verifyAndMigrateAdminPin(strPin, settings.appPinHash, process.env.APP_PIN, hash => saveAdminPinHash(hash, strPin));

  if (isValid) {
    // Authentication succeeded: safely reset account protection counter
    await resetAccountProtection(accountKey);

    // SECURITY (1 Oct 2026 audit SEC-009): Removed hardcoded owner UID fallback.
    // PIN entry requires a prior verified Firebase Auth session. If the caller is
    // a guest (no verified uid), reject instead of minting a token for a hardcoded
    // owner UID. The isAuthorizedAdmin check above already gates this path, but
    // defense-in-depth says never trust a hardcoded identity.
    const elevatedUid = (req as any).user?.uid;
    if (!elevatedUid || elevatedUid === 'guest') {
      return res.status(401).json({ success: false, error: "PIN entry requires prior Firebase authentication." });
    }
    const token = jwt.sign(
      { auth: true, isAdmin: true, uid: elevatedUid, rawUid: elevatedUid, email: currentUser.email || ADMIN_EMAIL, emailVerified: true, isOwner: true, adminElevatedUntil: Date.now() + 15 * 60 * 1000 },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.cookie('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/'
    });
    await addLog('INFO', 'AUTH', 'Admin 2FA Master PIN verified successfully');
    return res.json({ success: true, verified: true, isAdmin: true, token });
  } else {
    // Record failed attempt against account key and simulate constant-time work
    const failResult = await recordFailedAttempt(accountKey);
    await simulateCredentialVerificationDelay();

    if (failResult.locked) {
      return res.status(429).json({
        success: false,
        error: `Too many failed login attempts for this account. Locked for ${failResult.remainingLockoutSec}s.`,
        code: "ACCOUNT_LOCKED",
        remainingSec: failResult.remainingLockoutSec
      });
    }

    // Generic error response that does not disclose account existence or internal state
    return res.status(401).json({ success: false, error: "Invalid credentials. Please verify your details and try again." });
  }
}));

// Verify Master PIN (for elevating authenticated admin sessions)
authRouter.post('/verify-pin', authRateLimiter, requireAppCheck, authAttempt(async (req, res) => {
  const { pin, recaptchaToken, recaptchaAction, email, identifier } = req.body || {};

  // Strict Security Rule: User must be signed in with the authorized Administrator account
  const currentUser = (req as any).user;
  const isAuthorizedAdmin = currentUser && !currentUser.isAnonymous && currentUser.emailVerified === true && isAdminEmail(currentUser.email);

  if (!isAuthorizedAdmin) {
    await simulateCredentialVerificationDelay();
    return res.status(403).json({
      success: false,
      error: "Access Denied: You must first sign in with an authorized Administrator account before verifying the Master PIN.",
      authRequired: true,
      tokenExpired: (req as any).authFailure?.tokenExpired === true,
      code: "ADMIN_AUTH_REQUIRED"
    });
  }

  const settings = await getSettings();
  const rawIdentifier = currentUser.email || email || identifier || 'admin_master_account';
  const accountKey = getAccountKey(rawIdentifier);

  const acctProtection = await checkAccountProtection(accountKey);
  if (!acctProtection.allowed) {
    if (acctProtection.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, acctProtection.delayMs));
    }
    return res.status(429).json({
      success: false,
      error: `Too many failed attempts for this account. Locked for ${acctProtection.remainingLockoutSec}s.`,
      code: "ACCOUNT_LOCKED",
      remainingSec: acctProtection.remainingLockoutSec
    });
  }

  if (acctProtection.delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, acctProtection.delayMs));
  }

  if (recaptchaToken || process.env.NODE_ENV === 'production' || process.env.RECAPTCHA_ENFORCE === 'true') {
    const context = {
      ip: getSanitizedClientIp(req),
      userAgent: req.headers['user-agent'] as string,
      host: req.headers.host as string
    };
    const assessment = await verifyRecaptchaToken(
      recaptchaToken,
      'ADMIN_PIN',
      context
    );
    if (!assessment.valid) {
      return res.status(400).json({
        success: false,
        error: assessment.userMessage || 'Security verification failed. Please try again.',
        code: assessment.errorCode
      });
    }
  }

  if (!pin) {
    await simulateCredentialVerificationDelay();
    return res.status(400).json({ success: false, error: "Master PIN is required" });
  }

  const strPin = String(pin).trim();
  if (!settings.appPinHash && !process.env.APP_PIN) {
    await simulateCredentialVerificationDelay();
    return res.status(400).json({ success: false, error: "Master PIN is not configured yet. Please configure APP_PIN in environment or initialize in settings." });
  }
  const isValid = await verifyAndMigrateAdminPin(strPin, settings.appPinHash, process.env.APP_PIN, hash => saveAdminPinHash(hash, strPin));

  if (isValid) {
    await resetAccountProtection(accountKey);

    // SECURITY (1 Oct 2026 audit SEC-009): Removed hardcoded owner UID fallback.
    // PIN entry requires a prior verified Firebase Auth session. If the caller is
    // a guest (no verified uid), reject instead of minting a token for a hardcoded
    // owner UID. The isAuthorizedAdmin check above already gates this path, but
    // defense-in-depth says never trust a hardcoded identity.
    const elevatedUid = (req as any).user?.uid;
    if (!elevatedUid || elevatedUid === 'guest') {
      return res.status(401).json({ success: false, error: "PIN entry requires prior Firebase authentication." });
    }
    const token = jwt.sign(
      { auth: true, isAdmin: true, uid: elevatedUid, rawUid: elevatedUid, email: currentUser.email || ADMIN_EMAIL, emailVerified: true, isOwner: true, adminElevatedUntil: Date.now() + 15 * 60 * 1000 },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.cookie('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/'
    });
    await addLog('INFO', 'AUTH', 'Admin Master PIN 2FA Elevation Successful');
    return res.json({ success: true, verified: true, isAdmin: true, token });
  } else {
    const failResult = await recordFailedAttempt(accountKey);
    await simulateCredentialVerificationDelay();

    if (failResult.locked) {
      return res.status(429).json({
        success: false,
        error: `Too many failed attempts for this account. Locked for ${failResult.remainingLockoutSec}s.`,
        code: "ACCOUNT_LOCKED",
        remainingSec: failResult.remainingLockoutSec
      });
    }
    return res.status(401).json({ success: false, error: "Invalid credentials. Please verify your details and try again." });
  }
}));

authRouter.post('/logout', (_req, res) => {
  res.clearCookie('authToken', { path: '/' });
  res.json({ success: true, isAuthenticated: false, isAdmin: false });
});

authRouter.get('/status', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const settings = await getSettings();
  const user = (req as any).user;
  const isAuthenticated = Boolean(user?.uid && user.uid !== 'guest' && !user.isAnonymous);
  const isAdmin = isAuthenticated && user.emailVerified === true && isAdminEmail(user.email);
  const adminElevatedUntil = isAdmin ? Number(user.adminElevatedUntil || 0) : 0;
  res.json({ isAuthenticated, hasPin: !!settings.appPinHash, user: isAuthenticated ? user : null,
    isAdmin, isOwner: isAdmin, adminElevatedUntil,
    isElevated: isAdmin && adminElevatedUntil > Date.now(),
    authRequired: !isAuthenticated, tokenExpired: (req as any).authFailure?.tokenExpired === true });
});
