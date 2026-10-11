import * as Sentry from '@sentry/react';

/**
 * BSE Nexus Sentry Error & Performance Monitoring
 * DSN configured from Sentry project: bsenexus
 */
export const DEFAULT_SENTRY_DSN =
  'https://d57d9a4cbdfcec87d7a7d84bae5dc2a3@o4512192922255360.ingest.de.sentry.io/4512192924549200';

export function getClientSentryDsn(): string {
  return (
    (import.meta as any).env?.VITE_SENTRY_DSN ||
    DEFAULT_SENTRY_DSN
  );
}

let isInitialized = false;

export function initSentry(): void {
  if (typeof window === 'undefined' || isInitialized) return;

  const dsn = getClientSentryDsn();
  if (!dsn) return;

  try {
    Sentry.init({
      dsn,
      environment: (import.meta as any).env?.MODE || 'production',
      integrations: [
        Sentry.browserTracingIntegration(),
      ],
      tracesSampleRate: 0.1,
      // Ignore benign noise, cancellation, and expected network warnings
      ignoreErrors: [
        'ResizeObserver loop completed with undelivered notifications',
        'ResizeObserver loop limit exceeded',
        'Failed to fetch dynamically imported module',
        'NetworkError when attempting to fetch resource',
        'AbortError',
        'WebSocket connection closed',
        'Database is closing',
      ],
      beforeSend(event) {
        // Drop noisy browser extensions / ad-blocker injections
        const frames = event.exception?.values?.[0]?.stacktrace?.frames;
        if (frames?.some(f => f.filename?.includes('chrome-extension://') || f.filename?.includes('moz-extension://'))) {
          return null;
        }
        return event;
      },
    });
    isInitialized = true;
    console.log('[Sentry] Client monitoring initialized.');
  } catch (err) {
    console.warn('[Sentry] Client init notice:', err);
  }
}

export { Sentry };
