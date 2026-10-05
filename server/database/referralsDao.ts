import { readLocalJson, writeLocalJson } from './localStore.js';
import { getSupabase, isSupabaseConfigured } from './supabase.js';
import { getUserProfile, saveUserProfile } from './usersDao.js';

export interface ReferralCodeRecord {
  code: string; // Uppercase, alphanumeric, e.g. "RAHUL", "AKSHAT", "NEXUS100"
  referrerUid: string;
  referrerEmail: string;
  referrerName: string;
  type: 'creator' | 'user';
  commissionPercent: number; // Tier-based: 15%, 20%, 25%, 30%
  totalClicks: number;
  totalSignups: number;
  totalConversions: number;
  totalEarningsPaise: number;
  pendingPayoutPaise: number;
  paidPayoutPaise: number;
  payoutUpiId?: string;
  payoutBankInfo?: string;
  createdAt: number;
  updatedAt: number;
  isActive: boolean;
}

export interface ReferralConversionRecord {
  id: string; // e.g. "ref_conv_BN_M_..."
  referralCode: string;
  referrerUid: string;
  referrerEmail: string;
  referredUid: string;
  referredEmail: string;
  referredName: string;
  orderId: string;
  planId: string;
  planLabel: string;
  baseAmountPaise: number;
  discountAmountPaise: number;
  finalAmountPaidPaise: number;
  commissionEarnedPaise: number;
  rewardType: 'free_pro_days' | 'cash_commission';
  freeProDaysGranted?: number;
  status: 'confirmed' | 'paid_out' | 'refunded';
  convertedAt: number;
}

const REFERRALS_FILE = 'referrals.json';
const CONVERSIONS_FILE = 'referral_conversions.json';

// In-memory cache for speed
let referralsCache: Map<string, ReferralCodeRecord> | null = null;
let userToCodeCache: Map<string, string> | null = null;
let conversionsCache: ReferralConversionRecord[] | null = null;

function initReferralsCache(): void {
  if (referralsCache !== null && conversionsCache !== null) return;
  const list = readLocalJson<ReferralCodeRecord[]>(REFERRALS_FILE, []);
  referralsCache = new Map();
  userToCodeCache = new Map();
  for (const item of list) {
    if (item && item.code) {
      const normCode = item.code.toUpperCase().trim();
      referralsCache.set(normCode, item);
      if (item.referrerUid) {
        userToCodeCache.set(item.referrerUid, normCode);
      }
    }
  }

  conversionsCache = readLocalJson<ReferralConversionRecord[]>(CONVERSIONS_FILE, []);
}

function flushReferrals(): void {
  if (!referralsCache) return;
  const list = Array.from(referralsCache.values());
  writeLocalJson(REFERRALS_FILE, list);
}

function flushConversions(): void {
  if (!conversionsCache) return;
  writeLocalJson(CONVERSIONS_FILE, conversionsCache);
}

/** Sanitize a referral code to uppercase alphanumeric and hyphen/underscore only. */
export function sanitizeReferralCode(code: string): string {
  return String(code || '')
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .trim()
    .slice(0, 20);
}

/**
 * Clean, memorable referral code generation.
 * Uses the user's name/handle or clean readable prefix.
 */
export function generateCleanUserReferralCode(displayName: string = '', email: string = ''): string {
  let base = (displayName || email.split('@')[0] || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim();

  // If base is too short or generic, fallback to BSE / NEXUS
  if (base.length < 3 || /^(USER|MEMBER|GUEST|ADMIN|TEST)/i.test(base)) {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let suffix = '';
    for (let i = 0; i < 4; i++) {
      suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `NEXUS${suffix}`;
  }

  return base.slice(0, 8);
}

/**
 * Volume-based tiered commission structure:
 * The more verified conversions a creator brings, the higher their commission!
 */
export function getTierCommissionPercent(conversionsCount: number, customPercent?: number): number {
  if (customPercent && customPercent > 0) return customPercent;
  if (conversionsCount >= 50) return 30; // Platinum: 30%
  if (conversionsCount >= 20) return 25; // Gold: 25%
  if (conversionsCount >= 5) return 20;  // Silver: 20%
  return 15;                             // Bronze / Starter: 15%
}

export function getTierInfo(conversionsCount: number): {
  tierName: string;
  commissionPercent: number;
  nextTierName?: string;
  conversionsToNext?: number;
} {
  if (conversionsCount >= 50) {
    return {
      tierName: 'Platinum Elite (30%)',
      commissionPercent: 30,
    };
  }
  if (conversionsCount >= 20) {
    return {
      tierName: 'Gold Partner (25%)',
      commissionPercent: 25,
      nextTierName: 'Platinum Elite (30%)',
      conversionsToNext: 50 - conversionsCount,
    };
  }
  if (conversionsCount >= 5) {
    return {
      tierName: 'Silver Creator (20%)',
      commissionPercent: 20,
      nextTierName: 'Gold Partner (25%)',
      conversionsToNext: 20 - conversionsCount,
    };
  }
  return {
    tierName: 'Bronze Starter (15%)',
    commissionPercent: 15,
    nextTierName: 'Silver Creator (20%)',
    conversionsToNext: 5 - conversionsCount,
  };
}

/** Get referral record by code. */
export async function getReferralByCode(rawCode: string): Promise<ReferralCodeRecord | null> {
  initReferralsCache();
  const code = sanitizeReferralCode(rawCode);
  if (!code) return null;
  const rec = referralsCache!.get(code);
  if (rec && rec.isActive) return rec;

  // Check Supabase if configured
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabase();
      const { data } = await supabase
        .from('referral_codes')
        .select('*')
        .eq('code', code)
        .eq('is_active', true)
        .maybeSingle();

      if (data) {
        const item: ReferralCodeRecord = {
          code: data.code,
          referrerUid: data.referrer_uid,
          referrerEmail: data.referrer_email || '',
          referrerName: data.referrer_name || '',
          type: data.type || 'user',
          commissionPercent: Number(data.commission_percent || 25),
          totalClicks: Number(data.total_clicks || 0),
          totalSignups: Number(data.total_signups || 0),
          totalConversions: Number(data.total_conversions || 0),
          totalEarningsPaise: Number(data.total_earnings_paise || 0),
          pendingPayoutPaise: Number(data.pending_payout_paise || 0),
          paidPayoutPaise: Number(data.paid_payout_paise || 0),
          payoutUpiId: data.payout_upi_id || '',
          payoutBankInfo: data.payout_bank_info || '',
          createdAt: Number(data.created_at || Date.now()),
          updatedAt: Number(data.updated_at || Date.now()),
          isActive: Boolean(data.is_active),
        };
        referralsCache!.set(code, item);
        userToCodeCache!.set(item.referrerUid, code);
        flushReferrals();
        return item;
      }
    } catch (e: any) {
      console.warn('[Referrals] Supabase lookup error:', e?.message || e);
    }
  }

  return null;
}

/** Get or create a referral code for a registered user. */
export async function getOrCreateUserReferralCode(
  uid: string,
  email: string = '',
  displayName: string = ''
): Promise<ReferralCodeRecord> {
  initReferralsCache();
  if (!uid) throw new Error('Missing uid');

  // Check if user already has a code
  const existingCode = userToCodeCache!.get(uid);
  if (existingCode && referralsCache!.has(existingCode)) {
    const existing = referralsCache!.get(existingCode)!;
    // Update name/email if missing
    if (!existing.referrerEmail && email) {
      existing.referrerEmail = email;
      existing.updatedAt = Date.now();
      flushReferrals();
    }
    return existing;
  }

  // Generate clean, readable code based on user's name
  let candidate = generateCleanUserReferralCode(displayName, email);
  if (referralsCache!.has(candidate)) {
    candidate = `${candidate}100`;
    if (referralsCache!.has(candidate)) {
      candidate = `${candidate.slice(0, 6)}${Math.floor(10 + Math.random() * 89)}`;
    }
  }

  const now = Date.now();
  const newRecord: ReferralCodeRecord = {
    code: candidate,
    referrerUid: uid,
    referrerEmail: email,
    referrerName: displayName || email.split('@')[0] || 'Member',
    type: 'user', // Default is regular user ('user') which earns Free Pro Days
    commissionPercent: 15,
    totalClicks: 0,
    totalSignups: 0,
    totalConversions: 0,
    totalEarningsPaise: 0,
    pendingPayoutPaise: 0,
    paidPayoutPaise: 0,
    createdAt: now,
    updatedAt: now,
    isActive: true,
  };

  referralsCache!.set(candidate, newRecord);
  userToCodeCache!.set(uid, candidate);
  flushReferrals();

  // Async sync to Supabase
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabase();
      await supabase.from('referral_codes').upsert({
        code: candidate,
        referrer_uid: uid,
        referrer_email: email,
        referrer_name: newRecord.referrerName,
        type: newRecord.type,
        commission_percent: newRecord.commissionPercent,
        total_clicks: 0,
        total_signups: 0,
        total_conversions: 0,
        total_earnings_paise: 0,
        pending_payout_paise: 0,
        paid_payout_paise: 0,
        created_at: now,
        updated_at: now,
        is_active: true,
      });
    } catch (err: any) {
      console.warn('[Referrals] Supabase referral code create error:', err?.message || err);
    }
  }

  return newRecord;
}

/** User can customize their referral code (e.g. "RAHUL", "FINTECH-PRO"). */
export async function setCustomReferralCode(
  uid: string,
  rawRequestedCode: string,
  isCreator: boolean = false
): Promise<{ success: boolean; code?: string; error?: string }> {
  initReferralsCache();
  const newCode = sanitizeReferralCode(rawRequestedCode);
  if (!newCode || newCode.length < 3) {
    return { success: false, error: 'Referral code must be at least 3 alphanumeric characters' };
  }

  const existingWithCode = referralsCache!.get(newCode);
  if (existingWithCode && existingWithCode.referrerUid !== uid) {
    return { success: false, error: `Code "${newCode}" is already taken. Try another name.` };
  }

  const currentCode = userToCodeCache!.get(uid);
  let record: ReferralCodeRecord;

  if (currentCode && referralsCache!.has(currentCode)) {
    record = referralsCache!.get(currentCode)!;
    if (currentCode !== newCode) {
      referralsCache!.delete(currentCode);
    }
  } else {
    const now = Date.now();
    record = {
      code: newCode,
      referrerUid: uid,
      referrerEmail: '',
      referrerName: '',
      type: isCreator ? 'creator' : 'user',
      commissionPercent: isCreator ? 20 : 15,
      totalClicks: 0,
      totalSignups: 0,
      totalConversions: 0,
      totalEarningsPaise: 0,
      pendingPayoutPaise: 0,
      paidPayoutPaise: 0,
      createdAt: now,
      updatedAt: now,
      isActive: true,
    };
  }

  record.code = newCode;
  if (isCreator) record.type = 'creator';
  record.updatedAt = Date.now();

  referralsCache!.set(newCode, record);
  userToCodeCache!.set(uid, newCode);
  flushReferrals();

  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabase();
      await supabase.from('referral_codes').upsert({
        code: newCode,
        referrer_uid: uid,
        referrer_email: record.referrerEmail,
        referrer_name: record.referrerName,
        type: record.type,
        commission_percent: record.commissionPercent,
        total_clicks: record.totalClicks,
        total_signups: record.totalSignups,
        total_conversions: record.totalConversions,
        total_earnings_paise: record.totalEarningsPaise,
        pending_payout_paise: record.pendingPayoutPaise,
        paid_payout_paise: record.paidPayoutPaise,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
        is_active: record.isActive,
      });
    } catch (err: any) {
      console.warn('[Referrals] Supabase custom code error:', err?.message || err);
    }
  }

  return { success: true, code: newCode };
}

/** Update payout details for creator */
export async function updateReferralPayoutInfo(
  uid: string,
  payoutUpiId: string,
  payoutBankInfo: string = ''
): Promise<{ success: boolean; error?: string }> {
  initReferralsCache();
  const currentCode = userToCodeCache!.get(uid);
  if (!currentCode || !referralsCache!.has(currentCode)) {
    return { success: false, error: 'Referral account not found' };
  }

  const record = referralsCache!.get(currentCode)!;
  record.payoutUpiId = payoutUpiId.trim();
  record.payoutBankInfo = payoutBankInfo.trim();
  record.updatedAt = Date.now();
  flushReferrals();

  return { success: true };
}

/** Toggle or switch between Community User and Creator Partner tier */
export async function setReferralType(
  uid: string,
  type: 'creator' | 'user'
): Promise<{ success: boolean; type: string; error?: string }> {
  initReferralsCache();
  const currentCode = userToCodeCache!.get(uid);
  if (!currentCode || !referralsCache!.has(currentCode)) {
    return { success: false, type, error: 'Referral account not found' };
  }

  const record = referralsCache!.get(currentCode)!;
  record.type = type;
  record.updatedAt = Date.now();
  flushReferrals();

  return { success: true, type: record.type };
}

/** Track a click or page visit using this referral code. */
export async function recordReferralClick(rawCode: string): Promise<boolean> {
  initReferralsCache();
  const code = sanitizeReferralCode(rawCode);
  if (!code) return false;
  const record = referralsCache!.get(code);
  if (!record || !record.isActive) return false;

  record.totalClicks = (record.totalClicks || 0) + 1;
  record.updatedAt = Date.now();
  flushReferrals();
  return true;
}

/** Track a new user account registration using this referral code. */
export async function recordReferralSignup(rawCode: string): Promise<boolean> {
  initReferralsCache();
  const code = sanitizeReferralCode(rawCode);
  if (!code) return false;
  const record = referralsCache!.get(code);
  if (!record || !record.isActive) return false;

  record.totalSignups = (record.totalSignups || 0) + 1;
  record.updatedAt = Date.now();
  flushReferrals();
  return true;
}

/**
 * Record a verified Pro purchase conversion.
 *
 * Provides a durable audit trail for creators and community members:
 * - Regular Users: Earn +14 Days of Free Pro access automatically credited.
 * - Creators: Earn tiered cash commission (15% to 30%) with verified ledger tracking.
 */
export async function recordReferralConversion(params: {
  referralCode: string;
  orderId: string;
  referredUid: string;
  referredEmail: string;
  referredName?: string;
  planId: string;
  planLabel: string;
  baseAmountPaise: number;
  discountAmountPaise: number;
  finalAmountPaidPaise: number;
}): Promise<{
  success: boolean;
  commissionEarnedPaise: number;
  freeProDaysGranted?: number;
  error?: string;
}> {
  initReferralsCache();
  const code = sanitizeReferralCode(params.referralCode);
  if (!code) {
    return { success: false, commissionEarnedPaise: 0, error: 'Invalid referral code' };
  }

  const record = referralsCache!.get(code);
  if (!record) {
    return { success: false, commissionEarnedPaise: 0, error: 'Referral code not found' };
  }

  // Prevent self-referral
  if (record.referrerUid === params.referredUid) {
    console.warn(`[Referrals] Blocked self-referral: uid=${params.referredUid} code=${code}`);
    return { success: false, commissionEarnedPaise: 0, error: 'Self-referral is not permitted' };
  }

  // Idempotency check: orderId must not be counted twice
  const existingConv = conversionsCache!.find((c) => c.orderId === params.orderId);
  if (existingConv) {
    console.log(`[Referrals] Conversion already logged for orderId=${params.orderId}`);
    return {
      success: true,
      commissionEarnedPaise: existingConv.commissionEarnedPaise,
      freeProDaysGranted: existingConv.freeProDaysGranted,
    };
  }

  const isCreator = record.type === 'creator';
  const nextConversionCount = (record.totalConversions || 0) + 1;

  // Calculate tiered commission rate based on volume
  const commissionPercent = getTierCommissionPercent(nextConversionCount, isCreator ? undefined : 0);
  const commissionEarnedPaise = isCreator
    ? Math.round((params.finalAmountPaidPaise * commissionPercent) / 100)
    : 0;

  const freeProDays = isCreator ? 0 : 14; // Regular users get 14 free Pro days
  const conversionId = `ref_conv_${params.orderId}`;
  const now = Date.now();

  const convRecord: ReferralConversionRecord = {
    id: conversionId,
    referralCode: code,
    referrerUid: record.referrerUid,
    referrerEmail: record.referrerEmail,
    referredUid: params.referredUid,
    referredEmail: params.referredEmail || 'Customer',
    referredName: params.referredName || params.referredEmail?.split('@')[0] || 'Pro Subscriber',
    orderId: params.orderId,
    planId: params.planId,
    planLabel: params.planLabel,
    baseAmountPaise: params.baseAmountPaise,
    discountAmountPaise: params.discountAmountPaise,
    finalAmountPaidPaise: params.finalAmountPaidPaise,
    commissionEarnedPaise,
    rewardType: isCreator ? 'cash_commission' : 'free_pro_days',
    freeProDaysGranted: freeProDays,
    status: 'confirmed',
    convertedAt: now,
  };

  conversionsCache!.unshift(convRecord);
  flushConversions();

  // Atomically update referrer's balances & conversion counts
  record.totalConversions = nextConversionCount;
  if (isCreator) {
    record.totalEarningsPaise = (record.totalEarningsPaise || 0) + commissionEarnedPaise;
    record.pendingPayoutPaise = (record.pendingPayoutPaise || 0) + commissionEarnedPaise;
    record.commissionPercent = commissionPercent;
  }
  record.updatedAt = now;
  flushReferrals();

  // Automatically credit Free Pro days to the standard referrer's profile
  if (!isCreator && freeProDays > 0) {
    try {
      const referrerProf = await getUserProfile(record.referrerUid);
      if (referrerProf) {
        const currentExpiry =
          referrerProf.proExpiresAt && referrerProf.proExpiresAt > Date.now()
            ? referrerProf.proExpiresAt
            : Date.now();
        const newExpiry = currentExpiry + freeProDays * 24 * 60 * 60 * 1000;
        referrerProf.proExpiresAt = newExpiry;
        referrerProf.tier = 'pro';
        await saveUserProfile(record.referrerUid, { proExpiresAt: newExpiry, tier: 'pro' }, true);
        console.log(
          `[Referrals] Credited +${freeProDays} free Pro days to referrer ${record.referrerUid}`
        );
      }
    } catch (err: any) {
      console.warn('[Referrals] Notice crediting Pro days to referrer:', err?.message || err);
    }
  }

  // Async sync to Supabase
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabase();
      await supabase.from('referral_conversions').insert({
        id: conversionId,
        referral_code: code,
        referrer_uid: record.referrerUid,
        referrer_email: record.referrerEmail,
        referred_uid: params.referredUid,
        referred_email: params.referredEmail,
        order_id: params.orderId,
        plan_id: params.planId,
        plan_label: params.planLabel,
        base_amount_paise: params.baseAmountPaise,
        discount_amount_paise: params.discountAmountPaise,
        final_amount_paid_paise: params.finalAmountPaidPaise,
        commission_earned_paise: commissionEarnedPaise,
        status: 'confirmed',
        converted_at: now,
      });

      await supabase
        .from('referral_codes')
        .update({
          total_conversions: record.totalConversions,
          total_earnings_paise: record.totalEarningsPaise,
          pending_payout_paise: record.pendingPayoutPaise,
          updated_at: now,
        })
        .eq('code', code);
    } catch (err: any) {
      console.warn('[Referrals] Supabase conversion write error:', err?.message || err);
    }
  }

  return { success: true, commissionEarnedPaise, freeProDaysGranted: freeProDays };
}

/** Get full referral statistics and audit trail for a creator / user. */
export async function getReferralStats(uid: string): Promise<{
  code: string;
  type: 'creator' | 'user';
  commissionPercent: number;
  tierInfo: {
    tierName: string;
    commissionPercent: number;
    nextTierName?: string;
    conversionsToNext?: number;
  };
  totalClicks: number;
  totalSignups: number;
  totalConversions: number;
  totalEarningsPaise: number;
  pendingPayoutPaise: number;
  paidPayoutPaise: number;
  payoutUpiId?: string;
  payoutBankInfo?: string;
  conversions: Array<{
    id: string;
    orderId: string;
    planLabel: string;
    convertedAt: number;
    referredEmailMasked: string;
    finalAmount: number;
    discountAmount: number;
    commission: number;
    rewardType: 'free_pro_days' | 'cash_commission';
    freeProDaysGranted?: number;
    status: string;
  }>;
} | null> {
  initReferralsCache();
  const code = userToCodeCache!.get(uid);
  if (!code) return null;
  const record = referralsCache!.get(code);
  if (!record) return null;

  const tierInfo = getTierInfo(record.totalConversions || 0);

  // Filter conversions for this referrer
  const userConversions = conversionsCache!
    .filter((c) => c.referrerUid === uid || c.referralCode === code)
    .map((c) => {
      const email = c.referredEmail || '';
      const parts = email.split('@');
      let maskedEmail = email;
      if (parts.length === 2 && parts[0].length > 2) {
        maskedEmail = `${parts[0].slice(0, 1)}***${parts[0].slice(-1)}@${parts[1]}`;
      }
      return {
        id: c.id,
        orderId: c.orderId,
        planLabel: c.planLabel,
        convertedAt: c.convertedAt,
        referredEmailMasked: maskedEmail,
        finalAmount: c.finalAmountPaidPaise / 100,
        discountAmount: c.discountAmountPaise / 100,
        commission: c.commissionEarnedPaise / 100,
        rewardType: c.rewardType || (record.type === 'creator' ? 'cash_commission' : 'free_pro_days'),
        freeProDaysGranted: c.freeProDaysGranted || 14,
        status: c.status,
      };
    });

  return {
    code: record.code,
    type: record.type,
    commissionPercent: tierInfo.commissionPercent,
    tierInfo,
    totalClicks: record.totalClicks,
    totalSignups: record.totalSignups,
    totalConversions: record.totalConversions,
    totalEarningsPaise: record.totalEarningsPaise,
    pendingPayoutPaise: record.pendingPayoutPaise,
    paidPayoutPaise: record.paidPayoutPaise,
    payoutUpiId: record.payoutUpiId,
    payoutBankInfo: record.payoutBankInfo,
    conversions: userConversions,
  };
}

/** Admin: get all creator & referral partnerships. */
export async function getAllReferralsAdmin(): Promise<ReferralCodeRecord[]> {
  initReferralsCache();
  return Array.from(referralsCache!.values()).sort(
    (a, b) => (b.totalConversions || 0) - (a.totalConversions || 0)
  );
}

/** Admin: mark payout to a creator. */
export async function markReferralPayout(
  code: string,
  amountPaise: number,
  txReference: string
): Promise<{ success: boolean; error?: string }> {
  initReferralsCache();
  const normCode = sanitizeReferralCode(code);
  const record = referralsCache!.get(normCode);
  if (!record) return { success: false, error: 'Referral code not found' };

  if (amountPaise > record.pendingPayoutPaise) {
    return { success: false, error: 'Payout amount exceeds pending balance' };
  }

  record.pendingPayoutPaise = Math.max(0, record.pendingPayoutPaise - amountPaise);
  record.paidPayoutPaise = (record.paidPayoutPaise || 0) + amountPaise;
  record.updatedAt = Date.now();
  flushReferrals();

  return { success: true };
}
