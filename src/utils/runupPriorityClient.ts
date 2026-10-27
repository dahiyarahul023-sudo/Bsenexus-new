import { customFetch } from '../api';

export class RunupPriorityError extends Error {
  constructor(message: string, public recovery: 'admin-pin' | 'sign-in' | 'retry' = 'retry') { super(message); this.name = 'RunupPriorityError'; }
}
export async function changeRunupPriority(input: { scripCode: string; symbol: string; resultDate: string; windowDays: number }, signal: AbortSignal,
  request = customFetch): Promise<{ boostedCount: number; announcements: any[] }> {
  const response = await request(`/api/stocks/${encodeURIComponent(input.scripCode)}/boost-runup-priority`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol: input.symbol, resultDate: input.resultDate, windowDays: input.windowDays }), signal,
  });
  let data: any;
  try { data = await response.json(); } catch (error) {
    if (signal.aborted) throw error;
    if (response.ok) throw new RunupPriorityError('The priority response was unreadable. Refresh the filings to check the update before trying again.');
    throw new RunupPriorityError(`Priority update was blocked before a readable app response (HTTP ${response.status}). If using AI Studio preview, retry on bsenexus.in.`);
  }
  if (!response.ok || data?.success !== true) {
    if (response.status === 403 && data?.adminElevationRequired === true)
      throw new RunupPriorityError('Verify your Master PIN to update shared filing priorities. Admin access lasts 15 minutes.', 'admin-pin');
    if (response.status === 401) throw new RunupPriorityError('Sign in again to update filing priority.', 'sign-in');
    if (response.status === 403 && /^Server returned non-JSON response/.test(String(data?.error || '')))
      throw new RunupPriorityError('Priority update was blocked before a readable app response (HTTP 403). If using AI Studio preview, retry on bsenexus.in.');
    throw new RunupPriorityError(typeof data?.error === 'string' ? data.error.slice(0,400) : `Priority update unavailable (HTTP ${response.status}). Please retry.`);
  }
  if (!Number.isInteger(data.boostedCount) || data.boostedCount < 0 || !Array.isArray(data.announcements))
    throw new RunupPriorityError('The priority response could not be confirmed. Refresh the filings before trying again.');
  return { boostedCount: data.boostedCount, announcements: data.announcements };
}
