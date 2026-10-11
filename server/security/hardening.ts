import fs from 'fs';
import path from 'path';

export interface SecurityCheckResult {
  id: number;
  title: string;
  category: string;
  status: 'passed' | 'warning' | 'failed';
  details: string;
  remediation: string;
  lastTested: number;
}

// 1. Path Traversal & File Upload Safeguard (Items 14 & 9)
export function preventPathTraversal(filePath: string): boolean {
  if (!filePath || typeof filePath !== 'string') return true;
  let decoded: string;
  try { decoded = decodeURIComponent(filePath); } catch { return false; }
  if (decoded.includes('../') || decoded.includes('..\\') || decoded.includes('\0')) {
    return false;
  }
  return true;
}

// 2. Input Sanitizers (Items 9, 11, 13)
export function sanitizeStockQuery(input: string): string {
  if (!input || typeof input !== 'string') return '';
  // Strip control chars, SQL-style quotes, HTML tags, limit length to 80
  return input
    .replace(/[<>'";\\{}()\[\]=]/g, '')
    .trim()
    .slice(0, 80);
}

export function sanitizeScripCode(input: string): string {
  if (!input || typeof input !== 'string') return '';
  // Scrip codes are strictly 6 numeric digits or uppercase alphanumeric
  const clean = input.replace(/[^0-9A-Za-z]/g, '').slice(0, 12);
  return clean;
}

// This checklist is an evidence register, not a certification or a pentest.
const CHECKS: [string, string, string][] = [
  [
    "Hide API Keys & Secrets",
    "Credentials",
    "Never prefix sensitive keys with VITE_. Ensure JWT_SECRET is minimum 32 characters in production."
  ],
  [
    "Enable RLS & Database Rules",
    "Database Access",
    "Verify the deployed Supabase RLS policies AND RPC EXECUTE privileges; repository rules are not deployed-state evidence."
  ],
  [
    "Prevent & Test IDOR Attacks",
    "Authorization",
    "Never trust user-supplied ID in URL params without verifying request.user.uid === params.id."
  ],
  [
    "Scan Git Secrets & Environment Files",
    "Version Control",
    "Always maintain .gitignore to strictly exclude .env and service accounts before git commit."
  ],
  [
    "Verify Admin Authorization and Step-Up Authentication",
    "Access Control",
    "Ensure requireAdmin middleware is mounted on all mutation and system configuration endpoints."
  ],
  [
    "Test Multi-Tenant User Isolation",
    "Data Privacy",
    "Enforce tenant prefixing or per-user subcollections for all user-authored entities."
  ],
  [
    "Rate Limit APIs & Prevent DoS",
    "Network Defense",
    "Ensure reverse proxy X-Forwarded-For headers are trusted so IP-based rate limiting operates accurately."
  ],
  [
    "Lock Storage Buckets & Local Disk Quota",
    "Storage Security",
    "Do not expose direct Firebase Cloud Storage upload URLs without strict write rules."
  ],
  [
    "Validate All Request Inputs",
    "Input Validation",
    "Never pass unsanitized client strings directly into backend file operations or database queries."
  ],
  [
    "Block Unauthenticated Mutation Routes",
    "Authentication",
    "Reject unauthenticated requests with HTTP 401 Unauthorized and prompt for Google Sign-In."
  ],
  [
    "Test SQL & NoSQL Injection Attacks",
    "Database Security",
    "Use parameterized queries and execute injection tests against an isolated database."
  ],
  [
    "Remove Sensitive Credentials from Logs",
    "Logging & Telemetry",
    "Strip authorization headers, access tokens, and passwords before passing to logger."
  ],
  [
    "Block Request Field Tampering",
    "Integrity",
    "Whitelist only specific allowed fields when copying req.body to internal state models."
  ],
  [
    "Restrict File Uploads & Prevent Path Traversal",
    "File System",
    "Disable arbitrary file uploads. For document analysis, rely on verified external BSE URLs."
  ],
  [
    "Secure Server Logic & Error Masking",
    "Server Hardening",
    "Never return err.stack to clients in production environments."
  ],
  [
    "Trim API Responses & Strip Sensitive Metadata",
    "Information Disclosure",
    "Omit password hashes and third-party secret tokens from JSON payloads."
  ],
  [
    "Secure Auth Sessions & Cookies",
    "Session Management",
    "Always configure HttpOnly to prevent XSS session theft, and enforce SameSite to prevent CSRF."
  ],
  [
    "Scan Dependencies for Known CVEs",
    "Software Supply Chain",
    "Run npm audit and assess patched versions and runtime reachability before updating dependencies."
  ],
  [
    "Test Record-Level Access Control",
    "Authorization",
    "Always verify that resource.userId === authenticatedUser.uid before deleting or mutating records."
  ],
  [
    "Attack Your Own App (Pen-Test Verification)",
    "Red Team & Pentest",
    "Regularly execute automated penetration tests prior to deployment."
  ]
];

export async function runSecurityAudit(_adminUser?: unknown) {
  const timestamp = Date.now();
  const checks: SecurityCheckResult[] = CHECKS.map(([title, category, remediation], i) => ({
    id: i + 1, title, category, status: 'warning',
    details: 'Not verified by this runtime checklist. Requires source review, isolated tests or deployed configuration evidence.',
    remediation, lastTested: 0,
  }));
  const secretConfigured = Boolean(process.env.JWT_SECRET?.trim() && process.env.JWT_SECRET.trim().length >= 32);
  Object.assign(checks[0], {
    status: secretConfigured ? 'passed' : 'failed', lastTested: timestamp,
    details: secretConfigured
      ? 'Observed: JWT_SECRET contains at least 32 characters. This does not establish randomness or absence of leaked keys.'
      : 'Observed: JWT_SECRET is missing or shorter than 32 characters. Other credentials were not audited.',
  });
  for (const [id, filename, required] of [
    [2, 'firestore.rules', ['isOwner(userId)', 'isAdmin()']],
    [4, '.gitignore', ['.env*']],
  ] as const) {
    try {
      const content = fs.readFileSync(path.resolve(process.cwd(), filename), 'utf8');
      const present = required.every(part => content.includes(part));
      Object.assign(checks[id - 1], {
        lastTested: timestamp,
        details: `Observed local ${filename}: expected markers ${present ? 'present' : 'missing'}. Deployed permissions and committed secrets have not been verified.`,
      });
    } catch { checks[id - 1].details = `Local ${filename} is unavailable. Deployed controls remain unverified.`; }
  }
  const passedCount = checks.filter(c => c.status === 'passed').length;
  const warningCount = checks.filter(c => c.status === 'warning').length;
  const failedCount = checks.filter(c => c.status === 'failed').length;
  return { score: Math.round(passedCount / checks.length * 100), totalChecks: checks.length,
    passedCount, warningCount, failedCount, timestamp, checks };
}

export interface PenTestResult {
  name: string; target: string; payload: string; expected: string;
  actualStatus: number; blocked: boolean; mitigation: string;
  outcome: 'blocked' | 'unexpected' | 'inconclusive';
}

// Read-only anonymous guard probes. These do not prove IDOR, injection or
// SSRF protection, and never submit a mutation if a guard is accidentally absent.
export async function executeSimulatedPenTest(baseUrl = `http://127.0.0.1:${Number(process.env.PORT) || 3000}`) {
  const base = new URL(baseUrl);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname) || base.protocol !== 'http:') {
    throw new Error('Guard probes must target this server on loopback');
  }
  const paths = ['/api/logs', '/api/security/audit', '/api/admin/diagnostics',
    '/api/watchlists', '/api/feedback', '/api/users/profile'];
  const results: PenTestResult[] = [];
  for (const target of paths) {
    const common = { name: 'Anonymous route guard', target: `GET ${target}`, payload: '(no credentials)',
      expected: '401 or 403', mitigation: 'An HTTP rejection only verifies this anonymous request; other attack classes remain untested.' };
    try {
      const res = await fetch(new URL(target, base), { redirect: 'manual', signal: AbortSignal.timeout(3000) });
      await res.body?.cancel();
      const blocked = res.status === 401 || res.status === 403;
      results.push({ ...common, actualStatus: res.status, blocked,
        outcome: blocked ? 'blocked' : res.status >= 500 || res.status === 404 ? 'inconclusive' : 'unexpected' });
    } catch {
      results.push({ ...common, actualStatus: 0, blocked: false, outcome: 'inconclusive',
        mitigation: 'No HTTP response was received; authentication protection could not be tested.' });
    }
  }
  return { testedAt: Date.now(), totalAttacks: results.length,
    blockedAttacks: results.filter(r => r.blocked).length,
    inconclusiveAttacks: results.filter(r => r.outcome === 'inconclusive').length, results };
}
