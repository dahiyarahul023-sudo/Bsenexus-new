/**
 * Resend transactional email — server-side mailer for the Pro payment receipt.
 *
 * Uses the Resend REST API directly via fetch (no npm dependency needed).
 * Required env (AI Studio Secrets, server-only):
 *   RESEND_API_KEY  — Resend API key (never VITE_, never sent to the client)
 * Optional env:
 *   RESEND_FROM_EMAIL — verified sender, defaults to receipts@bsenexus.in
 *
 * Until RESEND_API_KEY is set, isResendConfigured() returns false and the
 * /send-receipt endpoint answers 503 so the client can fall back to mailto.
 */

/** Raw key is read here and never leaves the server. Checks standard key names. */
function getApiKey(): string {
  return String(
    process.env.RESEND_API_KEY ||
    process.env.RESEND_KEY ||
    process.env.VITE_RESEND_API_KEY ||
    ''
  ).trim();
}

export function getResendFromEmail(): string {
  const custom = String(process.env.RESEND_FROM_EMAIL || '').trim();
  if (custom) {
    return custom.includes('<') ? custom : `BSE Nexus <${custom}>`;
  }
  return 'BSE Nexus <receipts@bsenexus.in>';
}

export function isResendConfigured(): boolean {
  return getApiKey().length > 0;
}

export interface ReceiptEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface ResendSendResult {
  ok: boolean;
  id?: string;
  error?: string;
}

/**
 * Send one transactional email via Resend. Returns { ok } — never throws
 * for API-level failures so the route can map them to clean 4xx/5xx.
 * If the configured domain is unverified in Resend, automatically tries
 * onboarding@resend.dev fallback.
 */
export async function sendReceiptEmail(input: ReceiptEmailInput): Promise<ResendSendResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { ok: false, error: 'not-configured' };
  }
  const to = input.to.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { ok: false, error: 'invalid-email' };
  }

  const primaryFrom = getResendFromEmail();
  let res: Response;
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: primaryFrom,
        to: [to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });
  } catch (err: any) {
    console.error('[Resend] network error:', err?.message || err);
    return { ok: false, error: 'network-error' };
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON body — fall through to status handling */
  }

  if (res.ok && data?.id) {
    return { ok: true, id: String(data.id) };
  }

  // If custom domain is not yet verified in Resend, retry once with onboarding@resend.dev
  const rawMsg = String((data && (data.message || data.error)) || '');
  if (!res.ok && rawMsg.toLowerCase().includes('not verified') && !primaryFrom.includes('onboarding@resend.dev')) {
    console.warn('[Resend] Domain unverified; retrying with onboarding@resend.dev fallback...');
    try {
      const retryRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'BSE Nexus <onboarding@resend.dev>',
          to: [to],
          subject: input.subject,
          html: input.html,
          text: input.text,
        }),
      });
      const retryData = await retryRes.json().catch(() => null);
      if (retryRes.ok && retryData?.id) {
        return { ok: true, id: String(retryData.id) };
      }
      res = retryRes;
      data = retryData || data;
    } catch (retryErr: any) {
      console.warn('[Resend] Fallback attempt failed:', retryErr?.message || retryErr);
    }
  }

  const apiError =
    (data && (data.message || data.error)) || `resend-http-${res.status}`;
  console.error('[Resend] send failed:', res.status, apiError);
  return { ok: false, error: String(apiError).slice(0, 250) };
}

/** Escape user-controlled text for the HTML receipt. */
export function escHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface ReceiptEmailData {
  orderId: string;
  planLabel: string;
  validityDays?: number;
  amount: number;
  currency: string;
  paidAtIso: string;
  validUntilIso: string;
  paymentMethod?: string;
}

/** Format an ISO date like the client receipt does (e.g. "12 Jan 2026, 15:38 IST"). */
function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const day = d.getDate();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const datePart = `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${datePart}, ${hh}:${mm}`;
  } catch {
    return iso;
  }
}

/**
 * Build the receipt email (HTML + plain text) from verified server-side
 * order data. Amounts come from PRO_PLANS via the caller — never from the
 * client — so the emailed invoice always matches what was charged.
 */
export function buildReceiptEmail(d: ReceiptEmailData): { subject: string; html: string; text: string } {
  const planLine = d.validityDays
    ? `1x ${d.planLabel} (${d.validityDays} days)`
    : `1x ${d.planLabel}`;
  const total = `₹${Number(d.amount).toFixed(2)} ${d.currency}`;
  const subject = `BSE Nexus invoice — ${d.orderId}`;

  const text = [
    'BSE Nexus — Invoice',
    '--------------------------------',
    `Invoice No.: ${d.orderId}`,
    `Issued Date: ${formatDate(d.paidAtIso)}`,
    `Valid Until: ${formatDate(d.validUntilIso)}`,
    'From: BSE Nexus (bsenexus.in)',
    '--------------------------------',
    `Item: ${planLine}`,
    `Total: ${total} (PAID via Cashfree)`,
    ...(d.paymentMethod ? [`Paid via: ${d.paymentMethod}`] : []),
    '--------------------------------',
    'Note: one-time payment, no auto-renewal.',
    'Thank you for going Pro!',
    'bsenexus.in',
  ].join('\n');

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:24px;">
<div style="background:#0f172a;border-radius:16px 16px 0 0;padding:24px;text-align:center;">
<div style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">BSE Nexus</div>
<div style="color:#94a3b8;font-size:12px;margin-top:4px;">Payment Invoice</div>
</div>
<div style="background:#ffffff;border-radius:0 0 16px 16px;padding:24px;color:#0f172a;">
<table style="width:100%;font-size:14px;border-collapse:collapse;">
<tr><td style="padding:6px 0;color:#64748b;">Invoice No.</td><td style="padding:6px 0;text-align:right;font-weight:700;">${escHtml(d.orderId)}</td></tr>
<tr><td style="padding:6px 0;color:#64748b;">Issued</td><td style="padding:6px 0;text-align:right;">${escHtml(formatDate(d.paidAtIso))}</td></tr>
<tr><td style="padding:6px 0;color:#64748b;">Valid Until</td><td style="padding:6px 0;text-align:right;">${escHtml(formatDate(d.validUntilIso))}</td></tr>
<tr><td style="padding:6px 0;color:#64748b;">Item</td><td style="padding:6px 0;text-align:right;">${escHtml(planLine)}</td></tr>
${d.paymentMethod ? `<tr><td style="padding:6px 0;color:#64748b;">Paid via</td><td style="padding:6px 0;text-align:right;">${escHtml(d.paymentMethod)}</td></tr>` : ''}
<tr><td style="padding:12px 0 6px;color:#64748b;font-weight:700;">Total Paid</td><td style="padding:12px 0 6px;text-align:right;font-weight:800;font-size:18px;">${escHtml(total)}</td></tr>
</table>
<p style="font-size:12px;color:#64748b;margin:16px 0 0;">One-time payment via Cashfree. No auto-renewal.</p>
<p style="font-size:12px;color:#64748b;margin:8px 0 0;">Thank you for going Pro! — bsenexus.in</p>
</div></div></body></html>`;

  return { subject, html, text };
}
