const DAY = 86_400_000;
/** Remaining access, including prepaid extensions. Never changes entitlement. */
export function subscriptionProgress(expiry: number, validityDays: number, paidAt: number | null, now = Date.now()) {
  const remaining = Number.isFinite(expiry) ? Math.max(0, expiry - now) : 0;
  const duration = Math.max(1, Number.isFinite(validityDays) ? validityDays : 1) * DAY;
  const total = paidAt && Number.isFinite(paidAt) && paidAt < expiry ? Math.max(duration, expiry - paidAt) : duration;
  return { daysLeft: Math.ceil(remaining / DAY), percent: Math.min(100, Math.max(0, remaining / total * 100)) };
}
