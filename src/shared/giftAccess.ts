export interface GiftAccess {
  id: string;
  validityDays: number;
  activatedAt: number;
  expiresAt: number;
}
export interface SubscriptionAccess {
  source: 'paid' | 'gift' | 'trial' | 'free' | 'admin';
  expiresAt: number;
  paidExpiresAt: number;
  gift: GiftAccess | null;
}
export interface GiftInvite {
  id: string; email: string; validityDays: number; claimUntil: number;
  createdAt: number; activatedAt: number | null; expiresAt: number | null;
  status: 'pending' | 'activated' | 'expired' | 'revoked';
  delivery: 'pending' | 'accepted' | 'failed' | 'unknown'; note: string;
}
