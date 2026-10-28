import {Component, StrictMode, type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import {captureClientException, initSentry} from './lib/sentry.ts';
import App from './App.tsx';
import { LazyMotion, domAnimation } from 'framer-motion';
import './index.css';
import './styles/rich-ui.css';
import './styles/avatars.css';
// Payment-return recovery is eager even when checkout/receipt chunks are closed.
import './styles/payment.css';
import { initClientTelemetry } from './utils/telemetry.ts';
import { initOneSignal } from './utils/oneSignal.ts';

if (window.location.pathname.replace(/\/+$/, '').toLowerCase() !== '/activate-gift') {
  initSentry();
  initClientTelemetry();
  initOneSignal();
}

class ClientErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) {
    captureClientException(error);
    const msg = String(error?.message || '');
    if (
      /Invalid hook call|Cannot read properties of null \(reading 'use/i.test(msg) ||
      /Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module/i.test(msg)
    ) {
      try {
        const flag = 'bse_vite_hash_mismatch';
        const last = sessionStorage.getItem(flag);
        const now = Date.now();
        if (!last || now - Number(last) > 10000) {
          sessionStorage.setItem(flag, String(now));
          window.location.reload();
        }
      } catch {}
    }
  }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LazyMotion features={domAnimation}>
    <ClientErrorBoundary
      fallback={
        <div style={{padding: 32, fontFamily: 'system-ui, sans-serif', textAlign: 'center'}}>
          <h2>Something went wrong</h2>
          <p>Please refresh the page to try again.</p>
          <button
            onClick={() => window.location.reload()}
            style={{padding: '10px 20px', marginTop: 12, cursor: 'pointer'}}
          >
            Refresh
          </button>
        </div>
      }
    >
      <App />
    </ClientErrorBoundary>
    </LazyMotion>
  </StrictMode>,
);
