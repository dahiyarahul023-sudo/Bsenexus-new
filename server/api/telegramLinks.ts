import express from 'express';
import crypto from 'node:crypto';
import { requireAuth, requireAdmin, requireProOrAdmin, apiRateLimiter } from '../security/auth.js';
import { telegramLinkCommand } from '../database/telegramLinksDao.js';
import { getSettings } from '../database/settingsDao.js';
import { isPaymentStoreUnavailable } from '../database/paymentStore.js';

export const telegramLinksRouter = express.Router();
export function validTelegramWebhookSecret(received: unknown, expected: string | undefined): boolean {
  if (typeof received !== 'string' || !expected || expected.length < 32) return false;
  const a = Buffer.from(received), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
export function telegramStartProof(update: any): { nonce: string; chatId: string } | null {
  const m = update?.message;
  const match = typeof m?.text === 'string' ? m.text.match(/^\/start(?:@[A-Za-z0-9_]+)? ([A-Za-z0-9_-]{43})$/) : null;
  // A forwarded /start or a group member must not bind a third-party destination.
  if (!match || m.chat?.type !== 'private' || !Number.isSafeInteger(m.chat.id) || m.chat.id <= 0 || m.from?.id !== m.chat.id || m.from?.is_bot || m.forward_origin || m.forward_from) return null;
  return { nonce: match[1], chatId: String(m.chat.id) };
}
const handle = (fn: (req: express.Request, res: express.Response) => Promise<any>) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
  fn(req, res).catch(e => {
    if (isPaymentStoreUnavailable(e)) return res.status(503).json({ success: false, error: 'Telegram verification is temporarily unavailable. Retry shortly.' });
    next(e);
  });
};
telegramLinksRouter.post('/telegram/webhook', handle(async (req, res) => {
  if (!validTelegramWebhookSecret(req.headers['x-telegram-bot-api-secret-token'], process.env.TELEGRAM_WEBHOOK_SECRET)) return res.sendStatus(401);
  const proof = telegramStartProof(req.body);
  if (proof) {
    const settings = await getSettings();
    if (proof.chatId !== String(settings.chatId || process.env.TELEGRAM_CHAT_ID || '').trim()) {
      await telegramLinkCommand('consume', '', proof.nonce, proof.chatId);
    }
  }
  return res.json({ ok: true });
}));
telegramLinksRouter.post('/telegram/webhook/setup', requireAdmin, handle(async (_req, res) => {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const url = process.env.TELEGRAM_WEBHOOK_URL;
  if (!secret || !/^[A-Za-z0-9_-]{32,256}$/.test(secret) || !url || !/^https:\/\/[^/?#]+\/api\/telegram\/webhook$/.test(url)) return res.status(503).json({ success: false, error: 'Configure TELEGRAM_WEBHOOK_SECRET and the canonical TELEGRAM_WEBHOOK_URL first.' });
  const settings = await getSettings();
  const token = settings.botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return res.status(503).json({ success: false, error: 'Telegram bot is not configured.' });
  const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url, secret_token: secret, allowed_updates: ['message'], drop_pending_updates: false }), signal: AbortSignal.timeout(8000) });
  const data = await response.json();
  return res.status(data.ok ? 200 : 502).json({ success: data.ok === true });
}));
telegramLinksRouter.post('/users/telegram/link', requireProOrAdmin, apiRateLimiter, handle(async (req, res) => {
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(process.env.TELEGRAM_WEBHOOK_SECRET || '') || !process.env.TELEGRAM_WEBHOOK_URL) return res.status(503).json({ success: false, error: 'Verified Telegram linking is awaiting administrator setup.' });
  const settings = await getSettings();
  const token = settings.botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return res.status(503).json({ success: false, error: 'Telegram bot is not configured.' });
  const [bot, webhook] = await Promise.all(['getMe', 'getWebhookInfo'].map(async method => {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, { signal: AbortSignal.timeout(8000) });
    return response.json();
  }));
  if (!bot.ok || !/^[A-Za-z0-9_]+$/.test(bot.result?.username || '') || !webhook.ok || webhook.result?.url !== process.env.TELEGRAM_WEBHOOK_URL) {
    return res.status(503).json({ success: false, error: 'Verified Telegram linking is awaiting administrator webhook setup.' });
  }
  const nonce = crypto.randomBytes(32).toString('base64url');
  await telegramLinkCommand('start', (req as any).user.uid, nonce);
  res.setHeader('Cache-Control', 'private, no-store');
  return res.json({ success: true, url: `https://t.me/${bot.result.username}?start=${nonce}`, expiresIn: 600 });
}));
telegramLinksRouter.get('/users/telegram/link', requireAuth, handle(async (req, res) => {
  const link = await telegramLinkCommand('status', (req as any).user.uid);
  res.setHeader('Cache-Control', 'private, no-store');
  return res.json({ success: true, verified: Boolean(link?.chatId), chatId: link?.chatId || null });
}));
