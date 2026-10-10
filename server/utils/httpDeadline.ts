// Keep the deadline active through response body consumption, even when an
// upstream/mock ignores AbortSignal. Parent cancellation stops later retries.
export async function withHttpDeadline<T>(
  action: (signal: AbortSignal) => Promise<T>, timeoutMs: number, parent?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  try {
    const deadline = new Promise<never>((_, reject) => {
      onAbort = () => { controller.abort(); reject(new Error('HTTP request cancelled')); };
      if (parent?.aborted) { onAbort(); return; }
      parent?.addEventListener('abort', onAbort, { once: true });
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error(`HTTP request timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
    if (parent?.aborted) return await deadline;
    return await Promise.race([Promise.resolve().then(() => action(controller.signal)), deadline]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    if (onAbort) parent?.removeEventListener('abort', onAbort);
  }
}
