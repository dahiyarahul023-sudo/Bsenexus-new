/** Parse a code or our complete share URL without stripping/truncating its identity. */
export function parseReferralInput(input: string): string | null {
  const raw = input.trim();
  if (!raw || raw.length > 2048) return null;
  let candidate = raw;
  const isUrl = /^https?:\/\//i.test(raw);
  const isBareLink = /^(?:www\.)?bsenexus\.in(?:[/?#]|$)/i.test(raw);
  if (isUrl || isBareLink) {
    try {
      const url = new URL(isBareLink ? `https://${raw}` : raw);
      if (!['https:', 'http:'].includes(url.protocol) ||
          !['bsenexus.in', 'www.bsenexus.in'].includes(url.hostname.toLowerCase()) ||
          url.username || url.password || url.port) return null;
      const refs = [...url.searchParams].filter(([key]) => key.toLowerCase() === 'ref');
      if (refs.length !== 1) return null;
      candidate = refs[0][1].trim();
    } catch { return null; }
  }
  // Validate ASCII before folding case: never turn arbitrary Unicode into an alias.
  return /^[a-z0-9_-]{3,20}$/i.test(candidate) ? candidate.toUpperCase() : null;
}

/** Presentation only: backend aliases remain canonical and case-insensitive. */
export function formatReferralLink(code: string): string {
  return `https://bsenexus.in/?ref=${encodeURIComponent(code.toLowerCase())}`;
}
