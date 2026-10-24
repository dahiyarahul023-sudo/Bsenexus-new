import {Component, StrictMode, type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import {captureClientException, initSentry} from './lib/sentry.ts';
import App from './App.tsx';
import './index.css';
import './styles/rich-ui.css';
import './styles/avatars.css';
// Payment-return recovery is eager even when checkout/receipt chunks are closed.
import './styles/payment.css';
import { initClientTelemetry } from './utils/telemetry.ts';
import { initOneSignal } from './utils/oneSignal.ts';

initSentry();
initClientTelemetry();
initOneSignal();

class ClientErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { captureClientException(error); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
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
  </StrictMode>,
);
