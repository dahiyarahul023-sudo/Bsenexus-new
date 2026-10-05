import { randomUUID } from 'node:crypto';
import { operateDurableAiQuota, requiresDurableAiQuota } from '../database/aiQuotaDao.js';
import { readLocalJson, writeLocalJson } from '../database/localStore.js';
import { getUserProfile } from '../database/usersDao.js';
import { createKeyedSerial } from '../utils/keyedSerial.js';

const serializeQuota = createKeyedSerial();
const localReservations = new Map<string, { uid: string; usageKey: string }>();

const AI_USAGE_FILE = 'ai_usage.json';

function getTodayKeyIST(): string {
  const istDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const yyyy = istDate.getFullYear();
  const mm = String(istDate.getMonth() + 1).padStart(2, '0');
  const dd = String(istDate.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export async function checkServerAiQuota(
  uid: string,
  isAdminUser: boolean
): Promise<{ allowed: boolean; remaining: number; dailyLimit: number; error?: string; isPro?: boolean; reservationId?: string }> {
  // 1. Admin/Owner always has full unlimited AI generation
  if (isAdminUser) {
    return { allowed: true, remaining: Infinity, dailyLimit: Infinity, isPro: true };
  }

  // 2. Guest users (unauthenticated / anonymous): STRICTLY 0 QUOTA.
  // This prevents bots, web crawlers, or random visitors from draining the Gemini API limits.
  if (!uid || uid === 'guest' || uid.startsWith('guest_') || uid.startsWith('trader_')) {
    return {
      allowed: false,
      remaining: 0,
      dailyLimit: 0,
      error: "Google Sign-In Required: Sign in with Google to activate your 1-Week Free Pro trial with AI summaries.",
      isPro: false
    };
  }

  // 3. Authenticated User: Verify active 1-Week Pro Trial
  const profile = await getUserProfile(uid, { durable: requiresDurableAiQuota() });
  const now = Date.now();
  const proExpiresAt = profile?.proExpiresAt;
  const isProActive = Boolean(proExpiresAt && proExpiresAt > now);

  // If user's 1-week Pro trial has expired
  if (!isProActive && profile?.tier !== 'admin') {
    return {
      allowed: false,
      remaining: 0,
      dailyLimit: 0,
      error: "Your 1-Week Free Pro trial has ended. Upgrade to Pro (one-time plans from ₹59) to continue generating AI summaries.",
      isPro: false
    };
  }

  // 4. User has active 1-Week Pro Trial: Provide generous 100 summaries/day fair-use rate limit
  const todayKey = getTodayKeyIST();
  const usageKey = `${uid}_${todayKey}`;
  const usageMap = readLocalJson<Record<string, number>>(AI_USAGE_FILE, {});
  const used = requiresDurableAiQuota()
    ? (await operateDurableAiQuota(uid, 'status')).used
    : usageMap[usageKey] || 0;

  const dailyLimit = 100; // Fair-use daily limit for 1-week Pro trial
  const remaining = Math.max(0, dailyLimit - used);

  if (used >= dailyLimit) {
    return {
      allowed: false,
      remaining: 0,
      dailyLimit,
      error: `Daily Pro quota reached (${dailyLimit} AI summaries/day). Resets at 00:00 IST.`,
      isPro: true
    };
  }

  return {
    allowed: true,
    remaining,
    dailyLimit,
    isPro: true
  };
}

export async function resetServerAiQuota(uid: string): Promise<boolean> {
  if (requiresDurableAiQuota()) { await operateDurableAiQuota(uid, 'reset'); return true; }
  const todayKey = getTodayKeyIST();
  const usageKey = `${uid}_${todayKey}`;
  const usageMap = readLocalJson<Record<string, number>>(AI_USAGE_FILE, {});
  for (const [id, reservation] of localReservations) {
    if (reservation.uid === uid && reservation.usageKey === usageKey) localReservations.delete(id);
  }
  delete usageMap[usageKey];
  writeLocalJson(AI_USAGE_FILE, usageMap);
  return true;
}

export async function consumeServerAiQuota(
  uid: string,
  isAdminUser: boolean
): Promise<{ remaining: number; dailyLimit: number; isPro: boolean }> {
  const result = await checkAndConsumeServerAiQuota(uid, isAdminUser);
  return { remaining: result.remaining, dailyLimit: result.dailyLimit, isPro: result.isPro === true };
}

export async function checkAndConsumeServerAiQuota(
  uid: string,
  isAdminUser: boolean
): Promise<{ allowed: boolean; remaining: number; dailyLimit: number; error?: string; isPro?: boolean; reservationId?: string }> {
  // No request in this process can pass the same user's check before this
  // reservation commits. Cloud Run instances still need a durable SQL quota.
  return serializeQuota(uid, async () => {
    const check = await checkServerAiQuota(uid, isAdminUser);
    if (!check.allowed || !Number.isFinite(check.dailyLimit)) return check;
    const reservationId = randomUUID();
    if (requiresDurableAiQuota()) {
      const result = await operateDurableAiQuota(uid, 'reserve', reservationId);
      return { ...check, allowed: result.allowed, remaining: result.remaining, reservationId,
        ...(result.allowed ? {} : { error: 'Daily Pro quota reached (100 AI summaries/day). Resets at 00:00 IST.' }) };
    }
    // Development-only local reservation; cloud/production never falls back here.
    const usageKey = `${uid}_${getTodayKeyIST()}`;
    const usageMap = readLocalJson<Record<string, number>>(AI_USAGE_FILE, {});
    const used = usageMap[usageKey] || 0;
    usageMap[usageKey] = used + 1;
    writeLocalJson(AI_USAGE_FILE, usageMap);
    localReservations.set(reservationId, { uid, usageKey });
    return { ...check, remaining: Math.max(0, check.dailyLimit - used - 1), reservationId };
  });
}

/**
 * Refund one AI quota unit for a user. Called when AI generation fails AFTER
 * the quota was atomically consumed (e.g. Gemini timeout, model error).
 * Without this, a failed generation would still count against the daily limit,
 * effectively giving the user fewer than 100 actual summaries per day.
 *
 * LOGIC-002 (1 Oct 2026 audit): Routes now use checkAndConsumeServerAiQuota
 * atomically BEFORE generation, then call refundServerAiQuota if generation
 * throws. This closes the race where N concurrent requests all pass the check
 * (used<100) and all consume, bypassing the limit.
 *
 * For admin/guest/free users this is a no-op (admin=unlimited, guest=0, free
 * uses the separate freeSummaryUsed flag with its own release path).
 */
export async function refundServerAiQuota(
  uid: string,
  isAdminUser: boolean,
  reservationId?: string
): Promise<void> {
  // Admin/owner: unlimited, no refund needed
  if (isAdminUser) return;
  // Guest: no quota to refund
  if (!uid || uid === 'guest' || uid.startsWith('guest_') || uid.startsWith('trader_')) return;

  if (!reservationId) return; // Never refund an unrelated or already-refunded request.
  if (requiresDurableAiQuota()) {
    await operateDurableAiQuota(uid, 'refund', reservationId);
    return;
  }
  await serializeQuota(uid, async () => {
    const reservation = localReservations.get(reservationId);
    if (!reservation || reservation.uid !== uid) return;
    const usageMap = readLocalJson<Record<string, number>>(AI_USAGE_FILE, {});
    usageMap[reservation.usageKey] = Math.max(0, (usageMap[reservation.usageKey] || 0) - 1);
    writeLocalJson(AI_USAGE_FILE, usageMap);
    localReservations.delete(reservationId);
  });
}

export async function getServerAiQuotaStatus(
  uid: string,
  isAdminUser: boolean
): Promise<{ tier: 'guest' | 'free' | 'pro' | 'admin'; dailyLimit: number; usedToday: number; remaining: number; canGenerate: boolean; proDaysLeft?: number }> {
  if (isAdminUser) {
    return {
      tier: 'admin',
      dailyLimit: Infinity,
      usedToday: 0,
      remaining: Infinity,
      canGenerate: true
    };
  }

  // Guest users have 0 quota
  if (!uid || uid === 'guest' || uid.startsWith('guest_') || uid.startsWith('trader_')) {
    return {
      tier: 'guest',
      dailyLimit: 0,
      usedToday: 0,
      remaining: 0,
      canGenerate: false,
      proDaysLeft: 0
    };
  }

  // Authenticated user: Check 1-week (7-day) Pro trial
  const profile = await getUserProfile(uid, { durable: requiresDurableAiQuota() });
  const now = Date.now();
  const proExpiresAt = profile?.proExpiresAt;
  const isProActive = Boolean(proExpiresAt && proExpiresAt > now);
  const proDaysLeft = proExpiresAt ? Math.max(0, Math.ceil((proExpiresAt - now) / (24 * 60 * 60 * 1000))) : 0;

  if (!isProActive && profile?.tier !== 'admin') {
    // FREE PLAN: exactly ONE AI summary demo (one disclosure, one time ever)
    const demoUsed = (profile as any)?.freeSummaryUsed === true;
    return {
      tier: 'free',
      dailyLimit: 1,
      usedToday: demoUsed ? 1 : 0,
      remaining: demoUsed ? 0 : 1,
      canGenerate: !demoUsed,
      proDaysLeft: 0
    };
  }

  const todayKey = getTodayKeyIST();
  const usageKey = `${uid}_${todayKey}`;
  const usageMap = readLocalJson<Record<string, number>>(AI_USAGE_FILE, {});
  const used = requiresDurableAiQuota()
    ? (await operateDurableAiQuota(uid, 'status')).used
    : usageMap[usageKey] || 0;

  const dailyLimit = 100;
  const remaining = Math.max(0, dailyLimit - used);

  return {
    tier: 'pro',
    dailyLimit,
    usedToday: used,
    remaining,
    canGenerate: remaining > 0,
    proDaysLeft
  };
}

// The cloud reservation is the charge/refund receipt, not an active lock. A
// successful request keeps refunded=false and its day's used count. Do not
// "complete" it by refunding. Durable completion metadata/retention is pending.
export function completeServerAiQuotaReservation(reservationId?: string): void {
  if (reservationId) localReservations.delete(reservationId);
}
