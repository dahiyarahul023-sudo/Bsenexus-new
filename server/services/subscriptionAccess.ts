import { giftsEnabled } from './giftAccessPolicy.js';
import { getUserProfile } from '../database/usersDao.js';
import { getPaymentEntitlement } from '../database/paymentEntitlementsDao.js';
import { getGiftAccess } from '../database/giftAccessDao.js';
import type { UserProfile } from '../../src/types.js';
import type { GiftAccess, SubscriptionAccess } from '../../src/shared/giftAccess.js';
// This is a read projection only. Never pass it to profile persistence or payment grants.
export function projectSubscription(profile: UserProfile, gift: GiftAccess | null, paidExpiresAt = 0, now = Date.now()): UserProfile {
  const base = Math.max(Number(profile.proExpiresAt || 0), paidExpiresAt);
  const giftExpiry = gift && gift.expiresAt > now ? gift.expiresAt : 0;
  const expiresAt = Math.max(base, giftExpiry);
  const paid = Boolean(profile.lastPaymentAt || profile.proPlanId || paidExpiresAt);
  const source: SubscriptionAccess['source'] = profile.tier === 'admin' ? 'admin' : expiresAt <= now ? 'free' : giftExpiry > base ? 'gift' : paid ? 'paid' : 'trial';
  return { ...profile, proExpiresAt: expiresAt, tier: profile.tier === 'admin' ? 'admin' : expiresAt > now ? 'pro' : 'free',
    subscriptionAccess: { source, expiresAt, paidExpiresAt: paidExpiresAt || (paid ? base : 0), gift: giftExpiry ? gift : null } };
}
export async function getAccessProfile(uid: string, options: { durable?: boolean } = {}) {
  if (!giftsEnabled()) return getUserProfile(uid, options);
  const [profile, paid, gift] = await Promise.all([getUserProfile(uid, options), getPaymentEntitlement(uid), getGiftAccess(uid)]);
  return profile ? projectSubscription(profile, gift, Number(paid?.proExpiresAt || 0)) : null;
}
