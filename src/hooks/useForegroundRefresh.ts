import { useEffect, useRef } from 'react';

/** Only the active visible resource refreshes. Resume events coalesce with its pending read. */
export function useForegroundRefresh(callback: () => void | Promise<void>, intervalMs: number, enabled: boolean, resourceKey = '') {
  const current = useRef(callback); current.current = callback;
  useEffect(() => {
    if (!enabled) return;
    let alive = true, busy = false, lastStarted = -Infinity;
    const run = async () => {
      if (!alive || document.hidden || busy || Date.now() - lastStarted < 2500) return;
      busy = true; lastStarted = Date.now();
      try { await current.current(); } catch { /* The resource owns its retry/error state. */ }
      finally { busy = false; }
    };
    const resume = () => { void run(); };
    void run();
    const timer = window.setInterval(resume, intervalMs);
    document.addEventListener('visibilitychange', resume);
    for (const event of ['focus', 'pageshow', 'online']) window.addEventListener(event, resume);
    return () => {
      alive = false; window.clearInterval(timer);
      document.removeEventListener('visibilitychange', resume);
      for (const event of ['focus', 'pageshow', 'online']) window.removeEventListener(event, resume);
    };
  }, [enabled, intervalMs, resourceKey]);
}
