/** Nearest-rank percentiles over actual retained navigation samples. */
export function summarizeLoadTimes(values: number[]) {
  const samples = values.filter(value => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  const percentile = (fraction: number) => samples.length ? Math.round(samples[Math.ceil(fraction * samples.length) - 1]) : null;
  return {
    samples: samples.length,
    averageMs: samples.length ? Math.round(samples.reduce((sum, value) => sum + value, 0) / samples.length) : null,
    p75Ms: percentile(0.75),
    p95Ms: percentile(0.95),
  };
}
