import { createHash, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import type { AnnouncementPollResult } from '../services/monitor.js';

interface Dependencies {
  poll: () => Promise<AnnouncementPollResult>;
  backoffMs: () => number;
  secret?: () => string | undefined;
  now?: () => number;
  log?: (line: string) => void;
  afterPoll?: () => Promise<void>;
}

export function createAnnouncementCronHandler(deps: Dependencies): RequestHandler {
  const now = deps.now || Date.now;
  const log = deps.log || console.log;
  let running = false;
  let nextEligibleAt = 0;
  let requestNumber = 0;
  return async (req, res) => {
    const startedAt = now();
    const cycleNumber = ++requestNumber;
    let mode = 'unauthorized';
    let fetched = 0;
    let added = 0;
    res.setHeader('Cache-Control', 'no-store');
    try {
      // Bearer only: putting secrets in query strings exposes them to access logs.
      const expected = (deps.secret || (() => process.env.CRON_SECRET))();
      const supplied = /^Bearer ([^\s]+)$/i.exec(req.get('Authorization') || '')?.[1];
      if (!expected || !supplied || !timingSafeEqual(
        createHash('sha256').update(expected).digest(), createHash('sha256').update(supplied).digest(),
      )) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }
      if (running) {
        mode = 'busy';
        res.setHeader('Retry-After', '60');
        res.status(409).json({ success: false, mode, fetched: 0, new: 0, durationMs: now() - startedAt });
        return;
      }
      if (startedAt < nextEligibleAt) {
        mode = 'backoff';
        res.json({ success: true, mode, fetched: 0, new: 0, durationMs: now() - startedAt, retryAfterMs: nextEligibleAt - startedAt });
        return;
      }
      running = true;
      try {
        let result: AnnouncementPollResult;
        try { result = await deps.poll(); }
        finally {
          // Keep request-based hosting CPU through maintenance even when announcements throw or are blocked.
          try { await deps.afterPoll?.(); } catch { log('[POLLER] Radar maintenance failed'); }
        }
        fetched = result.fetched;
        added = result.new;
        mode = result.mode;
        // Scheduler supplies cadence. Only source failures/blocking defer calls;
        // healthy off-hours calls also perform a cycle every scheduled minute.
        nextEligibleAt = startedAt + deps.backoffMs();
        const ok = mode === 'success';
        if (!ok) res.setHeader('Retry-After', '60');
        res.status(ok ? 200 : mode === 'busy' ? 409 : 503).json({ success: ok, ...result, durationMs: now() - startedAt });
      } finally {
        running = false;
      }
    } catch {
      mode = 'error';
      // Do not log exception text: upstream messages may contain request secrets.
      log('[POLLER] Poll invocation failed');
      // Anchor recovery to the attempt start so a slow failure cannot skip
      // the next scheduled minute merely because it finished late.
      nextEligibleAt = startedAt + 60_000;
      res.status(503).json({ success: false, mode, fetched, new: added, durationMs: now() - startedAt });
    } finally {
      const timestampIST = new Date(startedAt + 19_800_000).toISOString().replace('Z', '+05:30');
      log(`[POLLER] Cycle ${JSON.stringify({
        event: 'poll-request', timestampIST, cycleNumber, durationMs: now() - startedAt,
        fetched, newFilingsCount: added, skipped: mode === 'busy' || mode === 'backoff',
        error: mode !== 'success' && mode !== 'busy' && mode !== 'backoff', mode,
        ...(mode === 'busy' ? { reason: 'skipped: previous cycle running' } : {}),
      })}`);
    }
  };
}
