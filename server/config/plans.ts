/**
 * Plan catalogue — SINGLE SOURCE OF TRUTH for what is CHARGED.
 * amountPaise is in the smallest currency unit. validityDays = Pro duration.
 *
 * The client NEVER sends a price: /api/payments/create-order looks the plan
 * up here. When a valid referral code is provided, referralAmountPaise is charged.
 *
 * The display twin lives in src/config/plans.ts; the pricingSync
 * test fails if the two drift (id, price, days, label, referralPrice must match).
 *
 * This module has ZERO imports so server tests can import it without
 * pulling in auth/env-gated modules.
 */
export const PRO_PLANS = {
  pro_weekly: {
    id: 'pro_weekly',
    label: 'Pro Weekly',
    amountPaise: 8900, // ₹89 standard
    referralAmountPaise: 5900, // ₹59 with referral
    currency: 'INR',
    validityDays: 7,
  },
  pro_monthly: {
    id: 'pro_monthly',
    label: 'Pro Monthly',
    amountPaise: 29900, // ₹299 standard
    referralAmountPaise: 19900, // ₹199 with referral (Flat ₹100 OFF)
    currency: 'INR',
    validityDays: 30,
  },
  pro_halfyearly: {
    id: 'pro_halfyearly',
    label: 'Pro 6-Month',
    amountPaise: 149900, // ₹1,499 standard
    referralAmountPaise: 99900, // ₹999 with referral (₹500 OFF)
    currency: 'INR',
    validityDays: 180,
  },
  pro_yearly: {
    id: 'pro_yearly',
    label: 'Pro Yearly',
    amountPaise: 269900, // ₹2,699 standard
    referralAmountPaise: 179900, // ₹1,799 with referral (₹900 OFF)
    currency: 'INR',
    validityDays: 365,
  },
} as const;

export type PlanId = keyof typeof PRO_PLANS;
