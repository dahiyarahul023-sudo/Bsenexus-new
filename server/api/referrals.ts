import express from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../security/auth.js';
import { sanitizeUserId } from '../database/watchlistDao.js';
import { getUserProfile } from '../database/usersDao.js';
import {
  getOrCreateUserReferralCode,
  getReferralByCode,
  getReferralStats,
  setCustomReferralCode,
  recordReferralClick,
  getAllReferralsAdmin,
  markReferralPayout,
  sanitizeReferralCode,
  updateReferralPayoutInfo,
  setReferralType,
  getTierInfo,
} from '../database/referralsDao.js';

export const referralsRouter = express.Router();

function getReqUserId(req: express.Request): string {
  const raw =
    (req as any).user?.uid ||
    (req as any).user?.id ||
    (req as any).userId ||
    (req as any).uid ||
    req.headers['x-user-id'] ||
    '';
  return sanitizeUserId(String(raw));
}

// Rate limiting for public referral endpoints to prevent abuse
const referralRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please slow down.' },
});

/**
 * Canonical domain: ALWAYS use https://bsenexus.in for public sharing
 */
const CANONICAL_DOMAIN = 'https://bsenexus.in';

/**
 * GET /api/referrals/my-code — Authenticated user gets their referral link, code,
 * tier milestone details, live stats and audit log of converted accounts.
 */
referralsRouter.get('/my-code', requireAuth, async (req, res) => {
  try {
    const uid = getReqUserId(req);
    const profile = await getUserProfile(uid).catch(() => null);
    const email = (req as any).user?.email || profile?.email || '';
    const displayName = (req as any).user?.displayName || profile?.displayName || '';

    // Ensure user has a clean, customized referral code
    const refRecord = await getOrCreateUserReferralCode(uid, email, displayName);
    const stats = await getReferralStats(uid);

    // Canonical link is always https://bsenexus.in/?ref=CODE
    const referralLink = `${CANONICAL_DOMAIN}/?ref=${encodeURIComponent(refRecord.code)}`;

    const tierInfo = getTierInfo(stats?.totalConversions || 0);

    res.json({
      success: true,
      code: refRecord.code,
      referralLink,
      type: refRecord.type,
      tierInfo,
      commissionPercent: tierInfo.commissionPercent,
      freeProDaysPerReferral: 14,
      totalFreeDaysEarned: (stats?.totalConversions || 0) * 14,
      payoutUpiId: refRecord.payoutUpiId || '',
      payoutBankInfo: refRecord.payoutBankInfo || '',
      stats: {
        totalClicks: stats?.totalClicks || 0,
        totalSignups: stats?.totalSignups || 0,
        totalConversions: stats?.totalConversions || 0,
        totalEarningsRupees: (stats?.totalEarningsPaise || 0) / 100,
        pendingPayoutRupees: (stats?.pendingPayoutPaise || 0) / 100,
        paidPayoutRupees: (stats?.paidPayoutPaise || 0) / 100,
      },
      conversions: stats?.conversions || [],
      benefits: {
        monthlyDiscount: 100, // Flat ₹100 OFF on Monthly (₹199 instead of ₹299)
        weeklyDiscount: 30, // ₹30 OFF on Weekly (₹59 instead of ₹89)
        halfyearlyDiscount: 500, // ₹500 OFF on 6-Month (₹999 instead of ₹1,499)
        yearlyDiscount: 900, // ₹900 OFF on Yearly (₹1,799 instead of ₹2,699)
        freeProReward: '+14 Days Free Pro access for every referred friend who upgrades',
        commissionRate: `Up to 30% tiered cash commission for verified creators`,
      },
    });
  } catch (err: any) {
    console.error('[Referrals] my-code error:', err?.message || err);
    res.status(500).json({ success: false, error: 'Could not fetch referral details' });
  }
});

/**
 * POST /api/referrals/custom-code — User or Creator sets custom vanity code (e.g. "RAHUL", "FINTECH").
 */
referralsRouter.post('/custom-code', requireAuth, async (req, res) => {
  try {
    const uid = getReqUserId(req);
    const rawCode = String(req.body?.code || '').trim();
    if (!rawCode) {
      return res.status(400).json({ success: false, error: 'Please enter a valid code.' });
    }

    const isAdmin = Boolean((req as any).user?.isAdmin || (req as any).user?.isOwner);
    const result = await setCustomReferralCode(uid, rawCode, isAdmin);

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    const referralLink = `${CANONICAL_DOMAIN}/?ref=${encodeURIComponent(result.code!)}`;

    res.json({
      success: true,
      code: result.code,
      referralLink,
      message: 'Referral code updated successfully!',
    });
  } catch (err: any) {
    console.error('[Referrals] custom-code error:', err?.message || err);
    res.status(500).json({ success: false, error: 'Could not update referral code' });
  }
});

/**
 * POST /api/referrals/payout-info — Creator saves UPI / Bank account details for payouts.
 */
referralsRouter.post('/payout-info', requireAuth, async (req, res) => {
  try {
    const uid = getReqUserId(req);
    const upiId = String(req.body?.upiId || '').trim();
    const bankInfo = String(req.body?.bankInfo || '').trim();

    if (!upiId && !bankInfo) {
      return res.status(400).json({ success: false, error: 'Please enter a valid UPI ID or Bank details.' });
    }

    const result = await updateReferralPayoutInfo(uid, upiId, bankInfo);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.json({ success: true, message: 'Payout details saved successfully.' });
  } catch (err: any) {
    console.error('[Referrals] payout-info error:', err?.message || err);
    res.status(500).json({ success: false, error: 'Failed to update payout details' });
  }
});

/**
 * POST /api/referrals/set-tier — Switch or apply between Community Member and Creator Partner tier.
 */
referralsRouter.post('/set-tier', requireAuth, async (req, res) => {
  try {
    const uid = getReqUserId(req);
    const type = req.body?.type === 'creator' ? 'creator' : 'user';

    const result = await setReferralType(uid, type);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.json({ success: true, type: result.type, message: `Switched to ${type === 'creator' ? 'Creator Partner' : 'Community Member'} tier.` });
  } catch (err: any) {
    console.error('[Referrals] set-tier error:', err?.message || err);
    res.status(500).json({ success: false, error: 'Failed to switch referral tier' });
  }
});

/**
 * GET /api/referrals/validate?code=XYZ — Public validation of referral code.
 */
referralsRouter.get('/validate', referralRateLimiter, async (req, res) => {
  try {
    const rawCode = String(req.query.code || '').trim();
    const code = sanitizeReferralCode(rawCode);
    if (!code) {
      return res.json({ success: false, valid: false, error: 'No referral code provided' });
    }

    const rec = await getReferralByCode(code);
    if (!rec || !rec.isActive) {
      return res.json({ success: false, valid: false, error: 'Invalid or inactive referral code' });
    }

    res.json({
      success: true,
      valid: true,
      code: rec.code,
      type: rec.type,
      referrerName: rec.referrerName || 'Nexus Partner',
      discountMessage: 'Flat ₹100 OFF on Monthly (Pay ₹199 instead of ₹299)',
      discounts: {
        pro_weekly: 30,
        pro_monthly: 100, // Flat ₹100 OFF
        pro_halfyearly: 500,
        pro_yearly: 900,
      },
    });
  } catch (err: any) {
    console.error('[Referrals] validate error:', err?.message || err);
    res.status(500).json({ success: false, valid: false, error: 'Failed to validate code' });
  }
});

/**
 * POST /api/referrals/track-visit — Public endpoint called when someone lands with ?ref=CODE.
 */
referralsRouter.post('/track-visit', referralRateLimiter, async (req, res) => {
  try {
    const rawCode = String(req.body?.code || '').trim();
    const code = sanitizeReferralCode(rawCode);
    if (!code) {
      return res.json({ success: false });
    }

    const tracked = await recordReferralClick(code);
    res.json({ success: tracked });
  } catch {
    res.json({ success: false });
  }
});

/**
 * GET /api/referrals/admin/creators — Admin view of all creators and referrers.
 */
referralsRouter.get('/admin/creators', requireAuth, async (req, res) => {
  try {
    const isAdmin = Boolean((req as any).user?.isAdmin || (req as any).user?.isOwner);
    if (!isAdmin) {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const all = await getAllReferralsAdmin();
    res.json({ success: true, referrers: all });
  } catch (err: any) {
    console.error('[Referrals] admin error:', err?.message || err);
    res.status(500).json({ success: false, error: 'Failed to list creators' });
  }
});

/**
 * POST /api/referrals/admin/payout — Admin records payout to a creator.
 */
referralsRouter.post('/admin/payout', requireAuth, async (req, res) => {
  try {
    const isAdmin = Boolean((req as any).user?.isAdmin || (req as any).user?.isOwner);
    if (!isAdmin) {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const { code, amountRupees, txReference } = req.body || {};
    if (!code || !amountRupees || amountRupees <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid payout amount or code' });
    }

    const amountPaise = Math.round(Number(amountRupees) * 100);
    const result = await markReferralPayout(code, amountPaise, txReference || '');

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.json({ success: true, message: `Payout of ₹${amountRupees} recorded for ${code}` });
  } catch (err: any) {
    console.error('[Referrals] payout error:', err?.message || err);
    res.status(500).json({ success: false, error: 'Failed to record payout' });
  }
});

export default referralsRouter;
