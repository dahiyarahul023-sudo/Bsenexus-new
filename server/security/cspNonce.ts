import { randomBytes } from 'node:crypto';

/** Server-owned trial setting. Permission to merge is separate from activation. */
export function isCspReportOnlyEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.CSP_REPORT_ONLY_ENABLED === 'true';
}

/** The worker reads deployment policy from its own server-served script. */
export function renderCspServiceWorker(source: string, enabled: boolean): string {
  return `self.__BSENEXUS_CSP_REPORT_ONLY__ = ${enabled};\n${source}`;
}

// Only trusted template input may translate the public build marker. A private
// process token avoids blessing injected nonce="__CSP_NONCE__" in final HTML.
export const CSP_NONCE_PLACEHOLDER = `__BN_CSP_${randomBytes(24).toString('hex')}__`;
export function prepareTrustedHtml(html: string): string {
  return html.replaceAll('__CSP_NONCE__', CSP_NONCE_PLACEHOLDER);
}
export function renderNonceHtml(html: string, nonce: string | null): string {
  if (nonce === null) {
    // With no trial policy, retain deterministic HTML and normal validators.
    return html.replaceAll(` nonce="${CSP_NONCE_PLACEHOLDER}"`, '').replaceAll(CSP_NONCE_PLACEHOLDER, '');
  }
  return html.replaceAll(CSP_NONCE_PLACEHOLDER, nonce);
}
