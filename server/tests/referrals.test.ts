import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  sanitizeReferralCode,
  generateCleanUserReferralCode,
  getTierCommissionPercent,
  getTierInfo,
} from '../database/referralsDao.js';
import { PRO_PLANS } from '../config/plans.js';
import { PRO_PLAN_LIST, getEffectivePlanPrice } from '../../src/config/plans.js';

describe('Referral System & Pricing Integration', () => {
  test('code sanitization removes special chars, whitespace and forces uppercase', () => {
    assert.strictEqual(sanitizeReferralCode('  akshat100  '), 'AKSHAT100');
    assert.strictEqual(sanitizeReferralCode('nexus@#$123'), 'NEXUS123');
    assert.strictEqual(sanitizeReferralCode('PARTNER-2026'), 'PARTNER-2026');
  });

  test('generates clean, readable referral codes from user names and emails', () => {
    assert.strictEqual(generateCleanUserReferralCode('Rahul Dahiya', 'dahiyarahul023@gmail.com'), 'RAHULDAH');
    assert.strictEqual(generateCleanUserReferralCode('Akshat', 'akshat@gmail.com'), 'AKSHAT');
    assert.strictEqual(generateCleanUserReferralCode('', 'john.doe@fintech.in'), 'JOHNDOE');
  });

  test('tiered volume-based commission scales with referral performance', () => {
    // 1-4 referrals: Bronze Starter 15%
    assert.strictEqual(getTierCommissionPercent(1), 15);
    assert.strictEqual(getTierCommissionPercent(4), 15);

    // 5-19 referrals: Silver Creator 20%
    assert.strictEqual(getTierCommissionPercent(5), 20);
    assert.strictEqual(getTierCommissionPercent(19), 20);

    // 20-49 referrals: Gold Partner 25%
    assert.strictEqual(getTierCommissionPercent(20), 25);
    assert.strictEqual(getTierCommissionPercent(49), 25);

    // 50+ referrals: Platinum Elite 30%
    assert.strictEqual(getTierCommissionPercent(50), 30);
    assert.strictEqual(getTierCommissionPercent(100), 30);

    const info = getTierInfo(8);
    assert.strictEqual(info.commissionPercent, 20);
    assert.strictEqual(info.nextTierName, 'Gold Partner (25%)');
    assert.strictEqual(info.conversionsToNext, 12);
  });

  test('monthly plan offers flat ₹100 discount (₹299 -> ₹199)', () => {
    const monthlyServer = PRO_PLANS['pro_monthly'];
    assert.strictEqual(monthlyServer.amountPaise, 29900);
    assert.strictEqual(monthlyServer.referralAmountPaise, 19900);

    const monthlyDisplay = PRO_PLAN_LIST.find((p) => p.id === 'pro_monthly');
    assert.ok(monthlyDisplay);
    assert.strictEqual(monthlyDisplay.price, 299);
    assert.strictEqual(monthlyDisplay.referralPrice, 199);
    assert.strictEqual(monthlyDisplay.referralDiscount, 100);

    // Helper functions return exact amounts
    assert.strictEqual(getEffectivePlanPrice('pro_monthly', false), 299);
    assert.strictEqual(getEffectivePlanPrice('pro_monthly', true), 199);
  });

  test('weekly and long-term plans provide referral pricing', () => {
    const weekly = PRO_PLAN_LIST.find((p) => p.id === 'pro_weekly');
    assert.ok(weekly);
    assert.strictEqual(weekly.price, 89);
    assert.strictEqual(weekly.referralPrice, 59);

    const halfyearly = PRO_PLAN_LIST.find((p) => p.id === 'pro_halfyearly');
    assert.ok(halfyearly);
    assert.strictEqual(halfyearly.price, 1499);
    assert.strictEqual(halfyearly.referralPrice, 999);

    const yearly = PRO_PLAN_LIST.find((p) => p.id === 'pro_yearly');
    assert.ok(yearly);
    assert.strictEqual(yearly.price, 2699);
    assert.strictEqual(yearly.referralPrice, 1799);
  });
});
