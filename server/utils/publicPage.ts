import { lookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import { isIP } from 'node:net';

// Conservatively use public IPv4 destinations. IPv6-only scraping is unsupported.
export function isPublicIpv4(address: string): boolean {
  if (isIP(address) !== 4) return false;
  const [a, b, c] = address.split('.').map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
    (a === 192 && b === 0) || (a === 192 && b === 2) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113));
}

export async function fetchPublicPage(urlStr: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    let target = new URL(urlStr);
    for (let redirects = 0; redirects <= 3; redirects++) {
      if (!['https:', 'http:'].includes(target.protocol) || target.username || target.password ||
          (target.port && target.port !== (target.protocol === 'https:' ? '443' : '80'))) {
        throw new Error('Only public HTTP/HTTPS pages on standard ports are supported.');
      }
      const addresses = await lookup(target.hostname, { all: true, family: 4 });
      if (!addresses.length || addresses.some(item => !isPublicIpv4(item.address))) {
        throw new Error('Private, reserved and local network destinations are forbidden.');
      }
      // Pin the checked address for this connection: a second DNS lookup cannot rebind it.
      const address = addresses[0].address;
      const result = await new Promise<{ status: number; location?: string; body: string }>((resolve, reject) => {
        const request = (target.protocol === 'https:' ? https : http).get(target, {
          signal: controller.signal, family: 4,
          lookup: ((_host: string, options: any, callback: any) => options.all
            ? callback(null, [{ address, family: 4 }]) : callback(null, address, 4)) as any,
          headers: { 'User-Agent': 'Bsenexus-SEO-Auditor/2.0', Accept: 'text/html,application/xhtml+xml', 'Accept-Encoding': 'identity' },
        }, response => {
          const status = response.statusCode || 0;
          if ([301, 302, 303, 307, 308].includes(status)) {
            response.destroy(); resolve({ status, location: response.headers.location, body: '' }); return;
          }
          if (status < 200 || status >= 300) { response.resume(); reject(new Error(`Page returned HTTP ${status}`)); return; }
          const chunks: Buffer[] = []; let size = 0;
          response.on('data', chunk => {
            size += chunk.length;
            if (size > 2 * 1024 * 1024) { response.destroy(new Error('Page exceeds the 2 MB download limit.')); return; }
            chunks.push(Buffer.from(chunk));
          });
          response.on('end', () => resolve({ status, body: Buffer.concat(chunks).toString('utf8') }));
          response.on('error', reject);
        });
        request.on('error', reject);
      });
      if (!result.location) {
        if (result.status >= 300) throw new Error('Redirect has no destination.');
        return result.body;
      }
      if (redirects === 3) throw new Error('Too many page redirects.');
      target = new URL(result.location, target);
    }
    throw new Error('Page download failed.');
  } finally { clearTimeout(timer); }
}
