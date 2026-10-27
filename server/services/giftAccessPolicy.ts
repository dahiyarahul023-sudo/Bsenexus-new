import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
export const giftsEnabled = () => process.env.GIFT_ACCESS_ENABLED === 'true';
export const giftTokenPattern = /^bnx_gift_[A-Za-z0-9_-]{43}$/;
export const newGiftToken = () => 'bnx_gift_' + randomBytes(32).toString('base64url');
export const hashGiftToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const giftCreateInput = z.object({
  requestId: z.string().uuid(),
  email: z.string().trim().email().max(254).transform(s => s.toLowerCase()),
  validityDays: z.number().int().min(1).max(3650),
  claimDays: z.number().int().min(1).max(30).default(7),
  note: z.string().trim().max(500).default(''),
}).strict();
export const giftActionInput = z.object({ requestId: z.string().uuid() }).strict();
export const giftRedeemInput = z.object({ token: z.string().regex(giftTokenPattern), firebaseIdToken: z.string().min(20).max(8192) }).strict();
