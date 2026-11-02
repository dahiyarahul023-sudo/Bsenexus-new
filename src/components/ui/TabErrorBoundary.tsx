import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { sendTelemetryEvent, getBreadcrumbs } from '../../utils/telemetry';
import { usePaymentDialog } from '../../hooks/usePaymentDialog';

interface TabErrorBoundaryProps {
  /** Short label for telemetry (e.g. "settings", "watchlists"). */
  label: string;
  /** Optional "back to safety" action (e.g. switch to the Filings tab). */
  onBack?: () => void;
  backLabel?: string;
  children: React.ReactNode;
  /** Dialog-chunk errors must stay in the viewport, above the underlying page. */
  overlay?: boolean;
}

function ErrorSurface({ overlay, onClose, children }: { overlay?: boolean; onClose: () => void; children: React.ReactNode }) {
  const dialog = usePaymentDialog(Boolean(overlay), onClose);
  return <div
    ref={dialog}
    className={`flex flex-col items-center justify-center px-6 py-16 text-center ${overlay ? 'fixed inset-0 z-[160] bg-white/95 dark:bg-slate-950/95' : ''}`}
    role={overlay ? 'alertdialog' : 'alert'}
    aria-modal={overlay || undefined}
    aria-label={overlay ? 'Section could not load' : undefined}
  >{children}</div>;
}

interface TabErrorBoundaryState {
  hasError: boolean;
  reloading: boolean;
  moduleLoadFailure: boolean;
}

const RELOAD_FLAG = 'bse_eb_reloaded';
const IS_DEV_PREVIEW = (import.meta as any).env?.DEV === true;

/**
 * Safety net for lazily-loaded sections.
 *
 * Keep a section's loading/rendering failure inside that section and offer
 * recovery. A failed import can follow a deployment, network failure or preview
 * restart; it does not identify a React hook-order or duplicate-runtime cause.
 *
 * Production retains its one-reload recovery. A development server may still
 * be stopped after an import fails, so the preview keeps its document and
 * offers explicit recovery instead of navigating to an unavailable server.
 */
export class TabErrorBoundary extends React.Component<TabErrorBoundaryProps, TabErrorBoundaryState> {
  state: TabErrorBoundaryState = { hasError: false, reloading: false, moduleLoadFailure: false };

  static getDerivedStateFromError(error: Error): Partial<TabErrorBoundaryState> {
    return { hasError: true, moduleLoadFailure: /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|ChunkLoadError|ERR_CLOSED_SERVER|Request is outdated/i.test(`${error?.name || ''} ${error?.message || ''}`) };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    try {
      sendTelemetryEvent({
        type: 'ERROR',
        error: {
          message: error?.message || String(error),
          stack: error?.stack || '',
          componentStack: info?.componentStack || '',
          section: this.props.label,
          severity: 'ERROR',
          breadcrumbs: getBreadcrumbs(),
          url: typeof window !== 'undefined' ? window.location.pathname + window.location.search : '',
        },
      });
    } catch {}

    // Keep an interrupted preview mounted while its server is restarted.
    if (IS_DEV_PREVIEW) return;

    try {
      if (!sessionStorage.getItem(RELOAD_FLAG)) {
        sessionStorage.setItem(RELOAD_FLAG, '1');
        this.setState({ reloading: true });
        // Fresh HTML + chunks resolve stale-version mixes.
        setTimeout(() => window.location.reload(), 350);
      }
    } catch {
      // sessionStorage unavailable (private mode etc.) — fall through to the card.
    }
  }

  handleManualReload = () => {
    this.setState({ reloading: true });
    try { sessionStorage.removeItem(RELOAD_FLAG); } catch {}
    window.location.reload();
  };

  handleRetry = () => {
    try { sessionStorage.removeItem(RELOAD_FLAG); } catch {}
    this.setState({ hasError: false, reloading: false, moduleLoadFailure: false });
  };

  handleBack = () => {
    this.setState({ hasError: false, reloading: false, moduleLoadFailure: false });
    this.props.onBack?.();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <ErrorSurface overlay={this.props.overlay} onClose={this.handleBack}>
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          This section couldn't load
        </h2>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          {IS_DEV_PREVIEW && this.state.moduleLoadFailure
            ? 'A preview file could not load. Wait for the preview server to be ready, then reload this page. Reloading may discard unsaved changes.'
            : 'The app may have just been updated, or a file failed to load. Reloading usually fixes this.'}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {!(IS_DEV_PREVIEW && this.state.moduleLoadFailure) && <button
            type="button"
            onClick={this.handleRetry}
            disabled={this.state.reloading}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60 shadow-sm cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Try again
          </button>}
          <button
            type="button"
            onClick={this.handleManualReload}
            disabled={this.state.reloading}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${this.state.reloading ? 'animate-spin' : ''}`} aria-hidden="true" />
            {this.state.reloading ? 'Reloading…' : 'Reload app'}
          </button>
          {this.props.onBack && (
            <button
              type="button"
              onClick={this.handleBack}
              disabled={this.state.reloading}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {this.props.backLabel || 'Back to Filings'}
            </button>
          )}
        </div>
      </ErrorSurface>
    );
  }
}
