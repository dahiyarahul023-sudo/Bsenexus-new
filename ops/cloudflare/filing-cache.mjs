// Candidate for the staging Worker. Pass the existing origin fetch as fetchOrigin.
const filingPath = '/api/announcements';
const viewerCacheControl = 'public, max-age=0, must-revalidate';
const edgeCacheControl = 'public, max-age=6, must-revalidate';

function viewerResponse(response) {
  const headers = new Headers(response.headers);
  headers.set('cache-control', viewerCacheControl);
  return new Response(response.body, { status: response.status, headers });
}

export async function fetchFilingFeed(request, { cache, fetchOrigin, waitUntil }) {
  const url = new URL(request.url);
  if (url.pathname !== filingPath || request.method !== 'GET' ||
      request.headers.has('authorization') || request.headers.has('cookie') ||
      request.headers.has('range') || request.headers.has('if-none-match') ||
      request.headers.has('if-modified-since')) {
    return fetchOrigin(request);
  }

  // The origin's query parameters can change the number or identity of filings.
  // Keep the complete URL, and isolate this policy from the legacy cache entry.
  const cacheUrl = new URL(url);
  cacheUrl.searchParams.append('__bse_edge_cache', 'filings-v2');
  const key = new Request(cacheUrl);
  const requestControl = request.headers.get('cache-control') || '';
  if (!/\b(?:no-cache|no-store|max-age=0)\b/i.test(requestControl)) {
    const cached = await cache.match(key).catch(() => undefined);
    if (cached) return viewerResponse(cached);
  }

  const upstream = await fetchOrigin(request);
  const upstreamControl = upstream.headers.get('cache-control') || '';
  const vary = (upstream.headers.get('vary') || '').toLowerCase();
  if (upstream.status !== 200 ||
      !upstream.headers.get('content-type')?.toLowerCase().startsWith('application/json') ||
      !/\bpublic\b/i.test(upstreamControl) || /\b(?:private|no-cache|no-store)\b/i.test(upstreamControl) ||
      upstream.headers.has('set-cookie') || (vary && vary !== 'accept-encoding') ||
      /\bno-store\b/i.test(requestControl)) {
    return upstream;
  }

  const headers = new Headers(upstream.headers);
  headers.set('cache-control', edgeCacheControl);
  waitUntil(cache.put(key, new Response(upstream.clone().body, { status: upstream.status, headers })).catch(() => {}));
  return viewerResponse(upstream);
}
