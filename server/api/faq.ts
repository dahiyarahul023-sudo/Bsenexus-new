import crypto from 'node:crypto';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { findBankAnswer, faqBankSize } from '../services/faqBank.js';
import { askPublicFaq } from '../services/gemini.js';
import { getSanitizedClientIp } from '../security/accountRateLimiter.js';
import { operateFaqQuota } from '../database/faqQuotaDao.js';
import { faqQuestionLog } from '../services/faqQuestionLog.js';

const FAQ_AI_DAILY_LIMIT = 4;
const MAX_QUESTION_LEN = 200;
const BUSY = 'The AI is busy right now. Please try again in a few moments.';

export function faqIdentity(req: express.Request) {
  const user = (req as any).user;
  const signedIn = user && typeof user.uid === 'string' && user.uid && user.uid !== 'guest' && user.isAnonymous !== true;
  const kind = signedIn ? 'uid' : 'ip';
  return {
    key: crypto.createHash('sha256').update(`${kind}:${signedIn ? user.uid : getSanitizedClientIp(req) || 'unknown'}`).digest('hex'),
    kind, isAdmin: !!user && (user.uid === 'admin' || user.isAdmin === true),
  };
}

/** Dependencies are server-owned; no request may supply storage or a provider. */
export function createFaqRouter(deps = { quota: operateFaqQuota, ask: askPublicFaq, log: faqQuestionLog.log }) {
  const router = express.Router();
  const floodLimiter = rateLimit({
    windowMs: 60_000, max: 20, standardHeaders: true, legacyHeaders: false,
    validate: { xForwardedForHeader: false, forwardedHeader: false, default: true },
    message: { success: false, error: 'Too many questions. Please wait a minute and try again.' },
  });
  const busy = (res: express.Response) => res.status(503).json({ success: false, error: BUSY, remaining: 0, dailyLimit: FAQ_AI_DAILY_LIMIT });
  router.post('/ask', floodLimiter, async (req, res) => {
    const raw = req.body?.question;
    if (typeof raw !== 'string' || !raw.trim()) return res.status(400).json({ success: false, error: 'Question cannot be empty.' });
    const question = raw.trim().slice(0, MAX_QUESTION_LEN);
    if (question.length < 3) return res.status(400).json({ success: false, error: 'Please ask a slightly longer question.' });
    const ident = faqIdentity(req);
    // No store read at all: bank answers must remain available during outage.
    const bankHit = findBankAnswer(question);
    if (bankHit) {
      deps.log(question, 'bank');
      return res.json({ success: true, answer: bankHit.answer, source: 'bank', dailyLimit: FAQ_AI_DAILY_LIMIT });
    }
    const reservationId = crypto.randomUUID();
    let remaining = FAQ_AI_DAILY_LIMIT;
    if (!ident.isAdmin) {
      try {
        const receipt = await deps.quota(ident.key, 'reserve', reservationId);
        if (!receipt.allowed) return res.status(429).json({
          success: false, error: ident.kind === 'ip' ? 'You have used today’s free questions. Log in to ask more.' : 'You have used today’s free questions. Please come back tomorrow.',
          loginRequired: ident.kind === 'ip', remaining: 0, dailyLimit: FAQ_AI_DAILY_LIMIT,
        });
        remaining = receipt.remaining;
      } catch { return busy(res); }
    }
    try {
      const answer = await deps.ask(question);
      deps.log(question, 'ai');
      return res.json({ success: true, answer, source: 'ai', remaining, dailyLimit: FAQ_AI_DAILY_LIMIT });
    } catch {
      if (!ident.isAdmin) {
        // Only this reservation can be refunded, once, including midnight races.
        // If refund/response is uncertain retain the charge; never grant extra.
        try { remaining = (await deps.quota(ident.key, 'refund', reservationId)).remaining; } catch { remaining = 0; }
      }
      return res.status(503).json({ success: false, error: BUSY, remaining, dailyLimit: FAQ_AI_DAILY_LIMIT });
    }
  });
  router.get('/status', floodLimiter, async (req, res) => {
    const ident = faqIdentity(req);
    try {
      const remaining = ident.isAdmin ? FAQ_AI_DAILY_LIMIT : (await deps.quota(ident.key, 'status')).remaining;
      return res.json({ success: true, remaining, dailyLimit: FAQ_AI_DAILY_LIMIT, bankSize: faqBankSize() });
    } catch { return busy(res); }
  });
  return router;
}
export const faqRouter = createFaqRouter();
