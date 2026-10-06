/**
 * Plan catalogue — SINGLE SOURCE OF TRUTH for plan DISPLAY data.
 *
 * Rule: no component may hardcode a plan price, duration, label, tag or
 * savings line. Read everything from PRO_PLAN_LIST / getPlanDisplay().
 * When a price changes, edit ONLY this list (and the server charge truth in
 * server/config/plans.ts); every surface updates automatically.
 * The pricingSync test fails the build if display and charge data drift.
 *
 * This module has ZERO imports so it stays safe to import anywhere,
 * including in node-based server tests.
 */
export interface ProPlanDisplay {
  id: string;
  label: string;
  price: number; // ₹ (standard display price — server decides the charged amount)
  referralPrice: number; // ₹ (price when referral code/link is active)
  referralDiscount: number; // ₹ (flat or derived savings)
  days: number;
  tag?: string; // small highlight under the price, e.g. "Most Popular"
  sub: string; // honest sub-line
  wasPrice?: number; // honest struck-through anchor, e.g. monthly's ₹499 launch anchor
}

export const PRO_PLAN_LIST: ProPlanDisplay[] = [
  {
    id: 'pro_weekly',
    label: 'Pro Weekly',
    price: 89,
    referralPrice: 59,
    referralDiscount: 30,
    days: 7,
    sub: '7 days · ₹59 with referral',
  },
  {
    id: 'pro_monthly',
    label: 'Pro Monthly',
    price: 299,
    referralPrice: 199,
    referralDiscount: 100, // Flat ₹100 OFF
    days: 30,
    tag: 'Most Popular',
    wasPrice: 499,
    sub: 'Flat ₹100 OFF with referral (Pay ₹199)',
  },
  {
    id: 'pro_halfyearly',
    label: 'Pro 6-Month',
    price: 1499,
    referralPrice: 999,
    referralDiscount: 500,
    days: 180,
    sub: 'Save ₹295 vs monthly · ₹999 with referral',
  },
  {
    id: 'pro_yearly',
    label: 'Pro Yearly',
    price: 2699,
    referralPrice: 1799,
    referralDiscount: 900,
    days: 365,
    sub: 'Save ₹889 vs monthly · ₹1,799 with referral',
  },
];

export function getPlanDisplay(planId?: string | null): ProPlanDisplay {
  return PRO_PLAN_LIST.find((p) => p.id === planId) || PRO_PLAN_LIST[1];
}

/** Get the effective price considering referral status */
export function getEffectivePlanPrice(planId?: string | null, hasReferral: boolean = false): number {
  const plan = getPlanDisplay(planId);
  return hasReferral ? plan.referralPrice : plan.price;
}

/** Cheapest plan price — the single source for "from ₹X" marketing lines. */
export function getLowestPlanPrice(hasReferral: boolean = false): number {
  return Math.min(...PRO_PLAN_LIST.map((p) => (hasReferral ? p.referralPrice : p.price)));
}

export function isValidPlanId(planId?: string | null): boolean {
  return Boolean(planId && PRO_PLAN_LIST.some((p) => p.id === planId));
}

/** Derive the plan display from a server-generated order id (BN_<code>_...). */
const ORDER_CODE_TO_PLAN: Record<string, string> = {
  W: 'pro_weekly',
  M: 'pro_monthly',
  H: 'pro_halfyearly',
  Y: 'pro_yearly',
};

export function getPlanDisplayFromOrderId(orderId?: string | null): ProPlanDisplay {
  const m = /^BN_([WMHY])_/.exec(orderId || '');
  const pid = m ? ORDER_CODE_TO_PLAN[m[1]] : 'pro_monthly';
  return getPlanDisplay(pid);
}
