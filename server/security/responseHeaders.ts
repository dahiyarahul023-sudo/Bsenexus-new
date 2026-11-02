import helmet from 'helmet';
import type { RequestHandler } from 'express';
import { randomBytes } from 'node:crypto';
import { renderNonceHtml, isCspReportOnlyEnabled } from './cspNonce.js';

export const SCRIPT_HOSTS = [
  'https://apis.google.com', 'https://www.google.com', 'https://www.gstatic.com',
  'https://cdn.onesignal.com', 'https://sdk.cashfree.com',
  'https://www.clarity.ms', 'https://scripts.clarity.ms',
];

/** Preview iframes and the public embed widget are explicit exceptions. */
export function responseHeaders(production = process.env.NODE_ENV === 'production', reportOnly = isCspReportOnlyEnabled()): RequestHandler {
  const baseline = helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    frameguard: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });
  // Preserve existing enforcing framing/base/object protection. Script policy
  // is deliberately report-only until canonical user journeys are observed.
  const documentPolicy = helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: { defaultSrc: helmet.contentSecurityPolicy.dangerouslyDisableDefaultSrc, baseUri: ["'self'"], objectSrc: ["'none'"], frameAncestors: ["'self'"], upgradeInsecureRequests: [] },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginResourcePolicy: false,
    frameguard: { action: 'sameorigin' },
  });
  return (req, res, next) => baseline(req, res, () => {
    // Use deployment mode and the real requested hostname. Do not trust a
    // client-supplied query flag to disable the canonical site's policy.
    const hostname = (req.get('host') ?? '').split(':')[0].toLowerCase();
    const canonical = ['bsenexus.in', 'www.bsenexus.in'].includes(hostname);
    const protectedDocument = production && canonical && !req.path.startsWith('/embed/');
    const trialDocument = protectedDocument && reportOnly;
    const nonce = randomBytes(24).toString('base64');
    // Resolve private placeholders on every host so a preview Host request can
    // never reveal the process template marker used in canonical responses.
    const send = res.send.bind(res);
    res.send = ((body: unknown) => {
      if (typeof body === 'string' && (String(res.getHeader('Content-Type') || '').includes('text/html') || /^\s*<!doctype html|^\s*<html/i.test(body))) {
        if (trialDocument) { res.setHeader('Cache-Control', 'private, no-store'); res.removeHeader('ETag'); }
        return send(renderNonceHtml(body, trialDocument ? nonce : null));
      }
      return send(body);
    }) as typeof res.send;
    if (trialDocument) {
      res.setHeader('Content-Security-Policy-Report-Only', [
        `script-src 'self' 'nonce-${nonce}' ${SCRIPT_HOSTS.join(' ')}`,
        "object-src 'none'", "base-uri 'self'", 'report-uri /api/security/csp-report',
      ].join('; '));
      // A 304 with a new header nonce would reuse an old browser body.
      delete req.headers['if-none-match'];
      delete req.headers['if-modified-since'];
    }
    if (protectedDocument) return documentPolicy(req, res, next);
    next();
  });
}
