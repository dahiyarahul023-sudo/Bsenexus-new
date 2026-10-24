export interface NavigationSample {
  requestStart: number;
  responseStart: number;
  loadEventEnd: number;
  domContentLoadedEventEnd: number;
}

/** Missing/unfinished measurements stay absent; slow visits stay in the sample. */
export function navigationMetrics(sample: NavigationSample | undefined, path: string) {
  if (!sample) return null;
  const result: { path: string; measurementVersion: 2; pageLoadTimeMs?: number; ttfbMs?: number; domContentLoadedMs?: number } = { path, measurementVersion: 2 };
  const observedEnd = (value: number) => Number.isFinite(value) && value > 0;
  if (observedEnd(sample.loadEventEnd)) result.pageLoadTimeMs = Math.round(sample.loadEventEnd);
  if (observedEnd(sample.domContentLoadedEventEnd)) result.domContentLoadedMs = Math.round(sample.domContentLoadedEventEnd);
  if (Number.isFinite(sample.requestStart) && sample.requestStart >= 0 && observedEnd(sample.responseStart) && sample.responseStart >= sample.requestStart) {
    result.ttfbMs = Math.round(sample.responseStart - sample.requestStart);
  }
  return Object.keys(result).length > 2 ? result : null;
}
