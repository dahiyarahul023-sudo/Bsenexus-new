// Sentry error tracking — initialized once at app boot.
//
// DSN resolution order:
//   1. import.meta.env.VITE_SENTRY_DSN (build-time, from AI Studio Secret VITE_SENTRY_DSN)
//   2. GET /api/config/public -> { sentryDsn } (runtime, server reads SENTRY_DSN env)
// If neither is set, Sentry stays disabled and the app works normally.
import type * as SentryTypes from '@sentry/react';
import { redactAiTelemetry } from '../shared/aiTelemetry';
import { APP_VERSION } from '../version';

let initialized = false;
let initPromise: Promise<void> | null = null;
let sdk: Pick<typeof SentryTypes, 'init' | 'setUser' | 'captureException'> | null = null;

// Noise we never want in Sentry (matches the client telemetry filters).
const BENIGN_PATTERNS =
  /ResizeObserver loop|Failed to fetch dynamically imported module|AbortError|NetworkError when attempting to fetch resource|Database is closing|websocket|closed without opened/i;

async function startSentry(dsn: string) {
  if (initialized) return;
  try {
    const { init, setUser, captureException } = await import('./sentrySdk');
    sdk = { init, setUser, captureException };
    sdk.init({
      dsn,
      environment: import.meta.env.MODE === 'production' ? 'production' : 'development',
      release: `bsenexus@${APP_VERSION}`,
      // Free-tier friendly: a small sample of transactions, all errors captured.
      tracesSampleRate: 0.1,
      beforeSend(event) {
        try {
          const msg =
            event.exception?.values?.[0]?.value ||
            (typeof event.message === 'string' ? event.message : '');
          if (msg && BENIGN_PATTERNS.test(msg)) return null;
        } catch {}
        return redactAiTelemetry(event);
      },
      beforeSendTransaction: event => redactAiTelemetry(event),
    });
    initialized = true;
  } catch {
    // Sentry must never break the app.
  }
}

/** Initialize Sentry. Safe to call multiple times; resolves once. */
export function initSentry(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (typeof window === 'undefined') return;
    const buildDsn = (import.meta.env.VITE_SENTRY_DSN as string | undefined)?.trim();
    if (buildDsn) {
      await startSentry(buildDsn);
      return;
    }
    try {
      const res = await fetch('/api/config/public', { credentials: 'same-origin', signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const data = await res.json();
        if (data?.sentryDsn) await startSentry(String(data.sentryDsn).trim());
      }
    } catch {
      // Offline or server unreachable — Sentry stays off, app unaffected.
    }
  })();
  return initPromise;
}

/** Attach the signed-in user to error reports (call after login). */
export function setSentryUser(id: string | null, email?: string | null) {
  try {
    void initSentry().then(() => sdk?.setUser(id ? { id, email: email || undefined } : null));
  } catch {}
}

/** Early render failures wait for configured monitoring without blocking paint. */
export function captureClientException(error: unknown) {
  void initSentry().then(() => { if (initialized) sdk?.captureException(error); });
}
