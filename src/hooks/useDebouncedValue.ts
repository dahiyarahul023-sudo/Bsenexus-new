import { useState, useEffect } from 'react';

/**
 * useDebouncedValue — returns a debounced copy of the input value.
 * The returned value only updates after `delayMs` has elapsed without
 * a new change. Used to prevent re-renders / expensive filter pipelines
 * on every keystroke.
 *
 * PERF-008 (Oct 2026 audit): Announcements search input was triggering
 * O(n × 6) filter + O(n log n) sort + O(n²) cluster on EVERY keystroke.
 * With 300+ items, each keystroke took 30-80ms on mobile. Debouncing
 * to 180ms reduces this to a single pass after the user stops typing.
 */
export function useDebouncedValue<T>(value: T, delayMs: number = 180): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
