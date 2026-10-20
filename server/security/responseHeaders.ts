import helmet from 'helmet';
import type { RequestHandler } from 'express';

/** Preview iframes and the public embed widget are explicit exceptions. */
export function responseHeaders(production = process.env.NODE_ENV === 'production'): RequestHandler {
  const baseline = helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    frameguard: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });
  // This rollout protects framing and markup context without pretending the
  // existing inline SSR/bootstrap scripts support a nonce-based strict CSP.
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
    if (production && canonical && !req.path.startsWith('/embed/')) return documentPolicy(req, res, next);
    next();
  });
}
