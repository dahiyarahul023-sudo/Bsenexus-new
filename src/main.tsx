import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {Sentry, initSentry} from './lib/sentry.ts';
import App from './App.tsx';
import './index.css';
import './styles/rich-ui.css';
import './styles/avatars.css';
import { initClientTelemetry } from './utils/telemetry.ts';
import { initOneSignal } from './utils/oneSignal.ts';

initSentry();
initClientTelemetry();
// PERF-005 fix: OneSignal init deferred — SDK now loads via idle callback in index.html.
// initOneSignal() will self-detect when the SDK is ready (it polls for window.OneSignal).
initOneSignal();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary
      fallback={
        <div style={{padding: 32, fontFamily: 'system-ui, sans-serif', textAlign: 'center'}}>
          <h2>Something went wrong</h2>
          <p>Please refresh the page. The error has been reported.</p>
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
    </Sentry.ErrorBoundary>
  </StrictMode>,
);
