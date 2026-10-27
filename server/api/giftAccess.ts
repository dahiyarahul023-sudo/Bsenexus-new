import express from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAdmin, requireAuth } from '../security/auth.js';
import { getFirebaseAuth } from '../security/firebaseAdmin.js';
import { getFirebaseIdentity } from '../security/firebaseIdentity.js';
import { giftCommand } from '../database/giftAccessDao.js';
import { getAccessProfile } from '../services/subscriptionAccess.js';
import { giftActionInput, giftCreateInput, giftRedeemInput, giftsEnabled, hashGiftToken, newGiftToken } from '../services/giftAccessPolicy.js';
import { isResendConfigured, sendReceiptEmail, escHtml } from '../services/resendMailer.js';

export function buildGiftEmail(invite: { validityDays: number; claimUntil: number }, token: string) {
  const link = 'https://bsenexus.in/activate-gift#token=' + token;
  const deadline = new Date(invite.claimUntil).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';
  return {
    subject: `Your gift: ${invite.validityDays} days of BSE Nexus Pro`,
    text: `You've received ${invite.validityDays} days of BSE Nexus Pro. Activate using the same verified email this invitation was sent to. Your access starts when you confirm activation. Claim before ${deadline}.\n\n${link}\n\nNo payment required. No auto-charge. Existing paid access is preserved; gift days run alongside it.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:28px;color:#171717"><h2>BSE Nexus</h2><h1>Your Pro access is ready</h1><p>You've received <strong>${invite.validityDays} days of Pro</strong>.</p><p>Sign in with the same verified email and confirm activation to start your access.</p><p style="margin:28px 0"><a href="${escHtml(link)}" style="background:#171717;color:white;padding:14px 22px;border-radius:10px;text-decoration:none">Activate Pro</a></p><p>Claim before ${escHtml(deadline)}.</p><p>No payment required. No auto-charge. Gift days run alongside any existing paid access.</p></div>`,
  };
}
const freshIdentity = async (token: string) => {
  const claims = await getFirebaseAuth().verifyIdToken(token, true);
  return getFirebaseIdentity(claims, 'dahiyarahul023@gmail.com');
};
export function createGiftAccessRouter(overrides: Partial<{
  command: typeof giftCommand; verify: typeof freshIdentity; send: typeof sendReceiptEmail;
  configured: typeof isResendConfigured; enabled: typeof giftsEnabled; profile: typeof getAccessProfile;
}> = {}) {
  const dep = { command: giftCommand, verify: freshIdentity, send: sendReceiptEmail, configured: isResendConfigured, enabled: giftsEnabled, profile: getAccessProfile, ...overrides };
  const router = express.Router();
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'private, no-store'); res.set('Referrer-Policy', 'no-referrer');
    // A deliberately disabled feature is a configuration conflict, not a
    // transient server outage. Keep this gate before identity/storage/mail.
    if (!dep.enabled()) return res.status(409).json({ success: false, code: 'GIFT_ACCESS_DISABLED', error: 'Gift access is not enabled yet.' });
    next();
  });
  router.use(requireAuth, rateLimit({ windowMs: 60000, limit: 30, standardHeaders: true, legacyHeaders: false }));
  router.use((req, res, next) => {
    if (req.method === 'GET') return next();
    const origin = req.get('Origin') || '';
    const allowed = origin === 'https://bsenexus.in' || (process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
    if (!allowed || req.get('X-Gift-Action') !== '1') return res.status(403).json({ success: false, error: 'Open this action on BSE Nexus.' });
    next();
  });
  const failure = (res: express.Response, err: unknown) => res.status(err instanceof z.ZodError ? 400 : 503).json({ success: false, error: err instanceof z.ZodError ? 'Check the email, duration and request details.' : 'Gift access could not be confirmed. Refresh the list before retrying a change.' });
  async function send(actor: string, result: any, token: string, key: string) {
    if (!result.shouldSend) return result;
    let delivery = 'unknown';
    try {
      const email = buildGiftEmail(result.invite, token);
      const sent = await dep.send({ to: result.invite.email, ...email, idempotencyKey: 'gift-' + key, signal: AbortSignal.timeout(15000), verifiedSenderOnly: true });
      delivery = sent.ok ? 'accepted' : sent.error === 'network-error' ? 'unknown' : 'failed';
    } catch { /* Unknown outcome; no automatic rotation/resend. */ }
    await dep.command('delivery', actor, { id: result.invite.id, hash: hashGiftToken(token), delivery });
    return { ...result, invite: { ...result.invite, delivery } };
  }
  router.get('/admin', requireAdmin, async (req, res) => {
    try {
      const offset = z.coerce.number().int().min(0).max(10000).parse(req.query.offset || 0);
      const result = await dep.command('list', (req as any).user.uid, { offset });
      res.json({ success: true, items: result.items.slice(0, 20), hasMore: result.items.length > 20, mailConfigured: dep.configured() });
    } catch (err) { failure(res, err); }
  });
  router.post('/admin', requireAdmin, async (req, res) => {
    try {
      if (!dep.configured()) return res.status(503).json({ success: false, error: 'Configure the verified BSE Nexus email sender first.' });
      const input = giftCreateInput.parse(req.body), token = newGiftToken(), actor = (req as any).user.uid;
      const result = await dep.command('create', actor, { ...input, id: input.requestId, hash: hashGiftToken(token) });
      if (result.error) return res.status(429).json({ success: false, error: 'Invitation limit reached: up to 50 new invitations per 24 hours.' });
      res.json({ success: true, ...(await send(actor, result, token, input.requestId)) });
    } catch (err) { failure(res, err); }
  });
  for (const action of ['resend', 'revoke'] as const) router.post('/admin/:id/' + action, requireAdmin, async (req, res) => {
    try {
      const id = z.string().uuid().parse(req.params.id), input = giftActionInput.parse(req.body);
      if (action === 'resend' && !dep.configured()) return res.status(503).json({ success: false, error: 'Email sender is unavailable.' });
      const token = newGiftToken(), actor = (req as any).user.uid;
      const result = await dep.command(action, actor, { id, requestId: input.requestId, hash: hashGiftToken(token) });
      if (result.error) return res.status(result.error === 'wait' ? 429 : 409).json({ success: false, error: result.error === 'wait' ? 'Wait one minute before resending.' : 'This invitation is unavailable for that action. Refresh the list.' });
      res.json({ success: true, ...(action === 'resend' ? await send(actor, result, token, input.requestId) : result) });
    } catch (err) { failure(res, err); }
  });
  for (const action of ['preview', 'claim'] as const) router.post('/' + action, async (req, res) => {
    try {
      const input = giftRedeemInput.parse(req.body);
      let identity;
      try { identity = await dep.verify(input.firebaseIdToken); } catch { return res.status(401).json({ success: false, error: 'Sign in again to confirm your identity.' }); }
      if (!identity || identity.uid !== (req as any).user.uid || !identity.emailVerified) return res.status(403).json({ success: false, error: 'Use the invited account and verify its email before activating.' });
      const result = await dep.command(action, identity.uid, { hash: hashGiftToken(input.token), email: identity.email });
      if (result.error) return res.status(409).json({ success: false, error: 'This invitation is unavailable for this account. Use the email it was sent to, or ask for a new invitation.' });
      const profile = await dep.profile(identity.uid, { durable: true });
      res.json({ success: true, ...result, paidExpiresAt: profile?.subscriptionAccess?.paidExpiresAt || 0 });
    } catch (err) { failure(res, err); }
  });
  return router;
}
export const giftAccessRouter = createGiftAccessRouter();
