/** Only official HTTPS BSE documents may be fetched by the server. */
export function isAllowedBseDocumentUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password &&
      (!u.port || u.port === '443') &&
      ['bseindia.com', 'www.bseindia.com', 'api.bseindia.com'].includes(u.hostname.toLowerCase());
  } catch { return false; }
}

export async function fetchBseDocument(url: string, options: RequestInit = {}): Promise<Response> {
  // Validate EVERY redirect before issuing its request. Native fetch's default
  // redirect-following would let an allowed host redirect to cloud metadata.
  let current = url;
  const signal = options.signal || AbortSignal.timeout(25_000);
  for (let hop = 0; hop <= 3; hop++) {
    if (!isAllowedBseDocumentUrl(current)) throw new Error('Only official HTTPS BSE document URLs are allowed');
    const response = await fetch(current, { ...options, signal, redirect: 'manual' });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get('location');
    await response.body?.cancel();
    if (!location || hop === 3) throw new Error('Invalid or excessive document redirects');
    current = new URL(location, current).href;
  }
  throw new Error('Excessive document redirects');
}

/** Enforce the limit during download, before an arbitrary body fills RAM. */
export async function readBoundedDocument(response: Response, maxBytes = 25 * 1024 * 1024): Promise<Buffer> {
  if (Number(response.headers.get('content-length') || 0) > maxBytes) {
    await response.body?.cancel();
    throw new Error('Document exceeds the download limit');
  }
  const reader = response.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) { await reader.cancel(); throw new Error('Document exceeds the download limit'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks, bytes);
}
