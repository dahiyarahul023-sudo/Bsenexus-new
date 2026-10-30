import { randomBytes } from 'node:crypto';

// Only trusted template input may translate the public build marker. A private
// process token avoids blessing injected nonce="__CSP_NONCE__" in final HTML.
export const CSP_NONCE_PLACEHOLDER = `__BN_CSP_${randomBytes(24).toString('hex')}__`;
export function prepareTrustedHtml(html: string): string {
  return html.replaceAll('__CSP_NONCE__', CSP_NONCE_PLACEHOLDER);
}
export function renderNonceHtml(html: string, nonce: string): string {
  return html.replaceAll(CSP_NONCE_PLACEHOLDER, nonce);
}
