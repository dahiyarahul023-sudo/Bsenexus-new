export type HomeResource<T> = { ok: true; value: T } | { ok: false; status: number };
/** Each section owns its failure; cancellation belongs to the page owner. */
export async function readHomeResource<T>(request: typeof fetch, url: string, signal: AbortSignal, valid: (body: any) => boolean): Promise<HomeResource<T>> {
  try {
    const response = await request(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]) });
    if (!response.ok) return { ok: false, status: response.status };
    const value = await response.json();
    return valid(value) ? { ok: true, value } : { ok: false, status: 502 };
  } catch {
    if (signal.aborted) throw signal.reason;
    return { ok: false, status: 503 };
  }
}
