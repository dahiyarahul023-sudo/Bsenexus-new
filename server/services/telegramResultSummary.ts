import { createHash, randomUUID } from 'node:crypto';
import { telegramResultIdentity, isValidTelegramResultSummary, type ResultFiling } from '../utils/telegramResultPolicy.js';
import { telegramResultStore } from '../database/telegramResultDao.js';

interface Input extends ResultFiling { source: string; chatId: string; lang: 'english' | 'hinglish'; }
interface Dependencies {
  store: typeof telegramResultStore;
  generate: () => Promise<string>;
  send: (text: string) => Promise<{ success: boolean; messageId?: number }>;
  wait?: () => Promise<void>;
}
const generations = new Map<string, Promise<string>>();

/** Durable at-most-once reply: uncertain external acceptance is never replayed. */
export async function deliverTelegramResultSummary(input: Input, deps: Dependencies): Promise<string> {
  const identity = telegramResultIdentity(input);
  if (!identity || !input.source || !input.chatId) return 'ineligible';
  const chatHash = createHash('sha256').update(input.chatId.trim()).digest('hex');
  const deliveryKey = identity + ':delivery:' + chatHash;
  const deliveryToken = randomUUID();
  const delivery = await deps.store.claim(deliveryKey, 'delivery', input.source, deliveryToken);
  if (!delivery.acquired) return 'duplicate';
  const summaryKey = identity + ':summary:v2:' + input.lang;
  const generate = async () => {
    const token = randomUUID();
    const claim = await deps.store.claim(summaryKey, 'summary', input.source, token);
    if (!claim.acquired) {
      let row = claim.row;
      // Another instance may be producing this quarter's one shared summary.
      for (let attempt = 0; row?.status === 'processing' && attempt < 55; attempt++) {
        await (deps.wait || (() => new Promise<void>(resolve => setTimeout(resolve, 2000))))();
        row = (await deps.store.read(summaryKey))!;
      }
      return row?.status === 'ready' && isValidTelegramResultSummary(row.value.text || '') ? row.value.text! : '';
    }
    try {
      const text = await deps.generate();
      if (!isValidTelegramResultSummary(text)) {
        await deps.store.finish(summaryKey, token, 'failed', { reason: 'missing or invalid result evidence' });
        return '';
      }
      const committed = await deps.store.finish(summaryKey, token, 'ready', { text });
      return committed ? text : '';
    } catch {
      await deps.store.finish(summaryKey, token, 'failed', { reason: 'generation unavailable' });
      return '';
    }
  };
  let attemptedSend = false;
  try {
    if (!generations.has(summaryKey)) {
      const task = generate();
      generations.set(summaryKey, task);
      void task.finally(() => { if (generations.get(summaryKey) === task) generations.delete(summaryKey); }).catch(() => {});
    }
    const text = await generations.get(summaryKey)!;
    if (!text) { await deps.store.finish(deliveryKey, deliveryToken, 'failed'); return 'invalid'; }
    attemptedSend = true;
    const result = await deps.send(text);
    await deps.store.finish(deliveryKey, deliveryToken, result.success ? 'sent' : 'uncertain', { messageId: result.messageId });
    return result.success ? 'sent' : 'uncertain';
  } catch (error) {
    // A network timeout may occur after Telegram accepted the reply. Keep the
    // reservation, including if the receipt write fails, rather than double-send.
    await deps.store.finish(deliveryKey, deliveryToken, attemptedSend ? 'uncertain' : 'failed').catch(() => {});
    throw error;
  }
}
