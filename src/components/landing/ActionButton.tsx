import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onAction: () => void;
  /** ms to show the processing spinner before firing the action */
  processingMs?: number;
}

/**
 * Navigation fires immediately. An explicitly requested processing interval
 * retains the spinner and duplicate-tap protection for existing callers.
 */
export function ActionButton({ onAction, processingMs = 0, children, disabled, className = '', ...rest }: ActionButtonProps) {
  const [processing, setProcessing] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);

  const handleClick = () => {
    if (processing || disabled) return;
    if (processingMs <= 0) { onAction(); return; }
    setProcessing(true);
    timer.current = window.setTimeout(() => {
      try { onAction(); } finally { setProcessing(false); }
    }, processingMs);
  };

  return (
    <button
      {...rest}
      type={rest.type ?? 'button'}
      disabled={disabled || processing}
      aria-busy={processing}
      onClick={handleClick}
      className={`inline-flex items-center justify-center gap-2 ${className}`}
    >
      {processing ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
          <span className="opacity-80">Processing…</span>
        </>
      ) : children}
    </button>
  );
}
