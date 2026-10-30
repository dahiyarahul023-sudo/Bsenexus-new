import express from 'express';
import rateLimit from 'express-rate-limit';

export function cspReportRouter(log: (event: { directive: string; blockedOrigin: string }) => void = event => console.info('[CSP report]', event)) {
  const router = express.Router();
  router.post('/api/security/csp-report', rateLimit({
    windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false,
    validate: { xForwardedForHeader: false, forwardedHeader: false, default: true },
  }), express.json({ type: ['application/csp-report', 'application/reports+json', 'application/json'], limit: '2kb', inflate: false }), (req, res) => {
    const body = Array.isArray(req.body) ? req.body.slice(0, 4) : [req.body];
    for (const item of body) {
      const report = item?.['csp-report'] || item?.body;
      const directive = report?.['effective-directive'] || report?.effectiveDirective;
      const blocked = report?.['blocked-uri'] || report?.blockedURL;
      if (typeof directive !== 'string' || !/^[a-z-]{1,64}$/.test(directive)) continue;
      let blockedOrigin = 'other';
      if (['inline', 'eval', 'self'].includes(blocked)) blockedOrigin = blocked;
      else if (typeof blocked === 'string') {
        try { const u = new URL(blocked); if (['https:', 'http:'].includes(u.protocol)) blockedOrigin = u.origin.slice(0, 200); } catch { /* omit malformed values */ }
      }
      log({ directive, blockedOrigin });
    }
    res.sendStatus(204);
  });
  router.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status([400, 413, 415].includes(error?.status) ? error.status : 400).json({ success: false, error: 'Invalid CSP report' });
  });
  return router;
}
