import type { SubscriptionAccess } from '../shared/giftAccess';

export interface SubscriptionStatus {
  isPro: boolean;
  proExpiresAt: number;
  plan: { label: string; amountPaise: number; validityDays: number };
  lastPaymentAt: number | null;
  subscriptionAccess?: SubscriptionAccess | null;
}

/** Display only: never grants access or converts an old payment into current access. */
export function subscriptionPresentation(status: SubscriptionStatus, admin = false, now = Date.now()) {
  const access = status.subscriptionAccess;
  const source = status.isPro && (access?.source === 'admin' || admin) ? 'admin' : access?.source;
  const expiry = access?.expiresAt ?? status.proExpiresAt;
  const active = status.isPro && source !== 'free' && (source === 'admin' || expiry > now);
  const gift = source === 'gift' ? access?.gift : null;
  const paid = source === 'paid' || (!source && Boolean(status.lastPaymentAt));
  const planLabel = !active ? 'Free plan' : source === 'admin' ? 'Administrator access'
    : gift ? `Gift Pro — ${gift.validityDays} days · Complimentary`
    : paid ? `${status.plan.label} — ₹${(status.plan.amountPaise / 100).toLocaleString('en-IN')} · ${status.plan.validityDays} days (one-time)`
    : source === 'gift' ? 'Gift Pro · Complimentary' : 'Pro Trial — 7-day free trial';
  return {
    active, source, expiry, planLabel,
    showProgress: active && source !== 'admin' && (source !== 'gift' || Boolean(gift)),
    days: gift?.validityDays ?? (paid ? status.plan.validityDays : 7),
    startedAt: gift?.activatedAt ?? status.lastPaymentAt,
    action: source === 'admin' ? 'View Pro plans' : active ? 'Extend Pro' : null,
  };
}
