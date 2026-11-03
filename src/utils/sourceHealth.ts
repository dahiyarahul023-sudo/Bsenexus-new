/** Request duration is distinct from exchange-publication or delivery latency. */
export function sourceHealthLabel(health?: {status?: string;latency?: number}) {
  const status=health?.status?.toLowerCase();
  return {
    status: status==='stable'||status==='healthy' ? 'BSE source responding' : status==='down' ? 'BSE source unavailable' : 'BSE source unverified',
    request: typeof health?.latency==='number' && Number.isFinite(health.latency) && health.latency>0 ? `Source request (${health.latency}ms)` : 'Source latency unverified',
  };
}
