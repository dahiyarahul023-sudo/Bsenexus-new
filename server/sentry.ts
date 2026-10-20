import * as Sentry from '@sentry/node';

/**
 * BSE Nexus Server-Side Sentry Monitoring
 * DSN configured from Sentry project: bsenexus
 */
export const DEFAULT_SENTRY_DSN =
  'https://d57d9a4cbdfcec87d7a7d84bae5dc2a3@o4512192922255360.ingest.de.sentry.io/4512192924549200';

export function getServerSentryDsn(): string {
  return (
    process.env.SENTRY_DSN ||
    process.env.VITE_SENTRY_DSN ||
    DEFAULT_SENTRY_DSN
  );
}

let isServerInitialized = false;

export function initServerSentry(): void {
  if (isServerInitialized) return;

  const dsn = getServerSentryDsn();
  if (!dsn) return;

  try {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'production',
      tracesSampleRate: 0.1,
    });
    isServerInitialized = true;
    console.log('[Sentry] Server monitoring initialized.');
  } catch (err) {
    console.warn('[Sentry] Server init notice:', err);
  }
}

export { Sentry };
