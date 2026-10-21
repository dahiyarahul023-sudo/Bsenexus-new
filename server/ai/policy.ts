import { createHash, randomBytes } from "node:crypto";
import { isIP } from "node:net";
import { z } from "zod";
import { FILING_CATEGORIES } from "./filingText";

export const SCOPES = [
  "market:read",
  "account:read",
  "watchlists:read",
  "watchlists:write",
  "profile:write",
  "notes:read",
  "notes:write",
  "alerts:read",
  "alerts:write",
  "analysis:generate",
] as const;
export const SCOPE_LABELS: Record<string, string> = {
  "market:read": "Read company filings, results and PDF links",
  "account:read": "Identify your account and view allowances",
  "watchlists:read": "Read your watchlists",
  "watchlists:write": "Create and customise your watchlists",
  "profile:write": "Change summary language and in-app mute preference",
  "notes:read": "Read your saved notes",
  "notes:write": "Create and edit your saved notes",
  "alerts:read": "Read your notifications and alert preferences",
  "alerts:write": "Change permitted alert preferences",
  "analysis:generate":
    "Generate filing summaries using your existing AI allowance",
};
export const hashSecret = (s: string) =>
  createHash("sha256").update(s).digest("hex");
export const newSecret = (kind: string) =>
  `bnx_${kind}_${randomBytes(32).toString("base64url")}`;
export function publicOrigin(): string {
  const u = new URL(process.env.AI_PUBLIC_ORIGIN || "https://bsenexus.in");
  if (
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    u.pathname !== "/" ||
    (u.protocol !== "https:" &&
      !(
        process.env.NODE_ENV !== "production" &&
        ["localhost", "127.0.0.1"].includes(u.hostname)
      ))
  )
    throw new Error("Invalid AI_PUBLIC_ORIGIN");
  return u.origin;
}
export const connectionsEnabled = () =>
  process.env.AI_CONNECTIONS_ENABLED === "true";
export const resourceUrl = () => publicOrigin() + "/mcp";
export class AiError extends Error {
  constructor(
    public code: string,
    public status = 400,
    message?: string,
  ) {
    super(message || code.replaceAll("_", " "));
  }
}
function isLoopbackCallback(raw: string, u: URL) {
  return u.protocol === 'http:' && ['localhost','127.0.0.1'].includes(u.hostname) && /^http:\/\/(?:localhost|127\.0\.0\.1)(?::[0-9]+)?(?:\/|$)/.test(raw);
}
export function validateRedirect(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new AiError("invalid_redirect");
  }
  if (
    raw.length > 2048 ||
    (u.protocol !== "https:" && !isLoopbackCallback(raw, u)) ||
    u.username ||
    u.password ||
    u.hash ||
    (!isLoopbackCallback(raw,u) && (u.port || isIP(u.hostname) || !u.hostname.includes(".") || /(^|\.)(localhost|local|internal|test|invalid)$/.test(u.hostname)))
  )
    throw new AiError("invalid_redirect");
  return u.href;
}
export const requestId = z
  .string()
  .min(16)
  .max(80)
  .regex(/^[A-Za-z0-9_-]+$/);
const id = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9_-]+$/);
const company = z.string().trim().min(1).max(60);
const priority = z.enum(["HIGH", "MEDIUM", "LOW"]);
const calendarDates = {
  fromDate: z.string().max(10).optional().describe("Inclusive IST start: today (default), tomorrow or YYYY-MM-DD."),
  toDate: z.string().max(10).optional().describe("Inclusive IST end. A matching fromDate selects a single day, including tomorrow."),
  daysAhead: z.number().int().min(1).max(60).default(14),
  limit: z.number().int().min(1).max(25).default(20),
  offset: z.number().int().min(0).max(10000).default(0),
};
export const TOOL_SPECS = {
  account_context: {
    title: 'Account and allowances',
    scope: "account:read",
    pro: false,
    write: false,
    description: 'Returns the connected account identity, plan, granted permissions and remaining connector allowance.',
    schema: z.object({}).strict(),
  },
  company_lookup: {
    title: 'Find a company',
    scope: "market:read",
    pro: false,
    write: false,
    description: 'Returns verified company identities for a symbol, six-digit BSE code or name. Ambiguous and approximate name matches return candidates; renamed symbols resolve to the current identity.',
    schema: z.object({ query: company }).strict(),
  },
  filings_search: {
    title: 'Search company filings',
    scope: "market:read",
    pro: false,
    write: false,
    description: 'Returns newest-first stored filings with exchange links and bounded text. Supports category and publication-time filters, brief/full detail and timestamp-plus-ID pagination. Coverage is a limited stored window, not the complete market archive.',
    schema: z
      .object({
        company: company.optional(),
        category: z.string().max(50).transform(v=>v.trim().toUpperCase()).pipe(z.enum(FILING_CATEGORIES)).optional(),
        limit: z.number().int().min(1).max(25).default(10),
        before: z.string().datetime().optional().describe("Exclusive publication timestamp. Pagination pairs nextBefore with nextBeforeId."),
        beforeId: z.string().min(1).max(100).optional(),
        after: z.string().datetime().optional().describe("Inclusive published timestamp; day boundaries use Asia/Kolkata."),
        detail: z.enum(["brief", "full"]).default("brief"),
      })
      .strict(),
  },
  results_read: {
    title: 'Declared results filings',
    scope: "market:read",
    pro: false,
    write: false,
    description: 'Returns declared quarterly results filing records for one company: headline, dates, bounded text and official PDF links. Revenue, EBITDA, PAT, EPS and YoY/QoQ figures are not extracted by this tool. Pagination is newest first; scheduled dates are separate calendar data.',
    schema: z.object({ company, limit: z.number().int().min(1).max(8).default(8), offset: z.number().int().min(0).max(200).default(0), detail: z.enum(["brief", "full"]).default("brief") }).strict(),
  },
  meetings_read: {
    title: 'Upcoming results dates',
    scope: "market:read",
    pro: false,
    write: false,
    description: 'Returns scheduled results-related meeting dates from available stored coverage, across companies or for one company. Includes today by default and sorts nearest first. Dates and today/tomorrow boundaries use Asia/Kolkata; complete market coverage is not available.',
    schema: z.object({ company: company.optional(), ...calendarDates }).strict(),
  },
  watchlist_results_upcoming: {
    title: 'Watchlist results dates',
    scope: "watchlists:read",
    pro: true,
    write: false,
    description: 'Returns upcoming results-related dates for the connected account’s active watchlists or one owned watchlistId. Requires market:read and watchlists:read plus active Pro/trial. Includes today, nearest first; supports an inclusive IST date range in one call.',
    schema: z.object({ watchlistId: id.optional(), ...calendarDates }).strict(),
  },
  watchlists_read: {
    title: 'Read watchlists',
    scope: "watchlists:read",
    pro: true,
    write: false,
    description: 'Returns paginated watchlist metadata with boolean active state and up to five preview stocks per owned list. Upcoming result dates are available separately.',
    schema: z
      .object({ offset: z.number().int().min(0).max(10000).default(0) })
      .strict(),
  },
  watchlist_create: {
    title: 'Create a watchlist',
    scope: "watchlists:write",
    pro: true,
    write: true,
    description: 'Creates an empty watchlist in the connected account. Matching requestId retries replay the stored outcome.',
    schema: z
      .object({ name: z.string().trim().min(1).max(80), requestId })
      .strict(),
  },
  watchlist_rename: {
    title: 'Rename a watchlist',
    scope: "watchlists:write",
    pro: true,
    write: true,
    description: 'Renames one owned watchlist by ID. Matching requestId retries replay the stored outcome.',
    schema: z
      .object({
        watchlistId: id,
        name: z.string().trim().min(1).max(80),
        requestId,
      })
      .strict(),
  },
  watchlist_toggle: {
    title: 'Pause or enable a watchlist',
    scope: "watchlists:write",
    pro: true,
    write: true,
    description: 'Enables or pauses one owned watchlist without deleting it. Matching requestId retries replay the stored outcome.',
    schema: z
      .object({ watchlistId: id, active: z.boolean(), requestId })
      .strict(),
  },
  watchlist_add_stock: {
    title: 'Add a stock',
    scope: "watchlists:write",
    pro: true,
    write: true,
    description: 'Adds one exactly identified company to an owned watchlist. Ambiguous or approximate identities are rejected. Matching requestId retries replay the stored outcome.',
    schema: z
      .object({
        watchlistId: id,
        company,
        priority: priority.default("HIGH"),
        requestId,
      })
      .strict(),
  },
  watchlist_remove_stock: {
    title: 'Remove a stock',
    scope: "watchlists:write",
    pro: true,
    write: true,
    description: 'Removes one exactly identified stock from one owned watchlist. Bulk deletion is unavailable. Matching requestId retries replay the stored outcome.',
    schema: z.object({ watchlistId: id, company, requestId }).strict(),
  },
  watchlist_priority: {
    title: 'Change stock priority',
    scope: "watchlists:write",
    pro: true,
    write: true,
    description: 'Sets HIGH, MEDIUM or LOW priority for one stock in an owned watchlist. Matching requestId retries replay the stored outcome.',
    schema: z
      .object({ watchlistId: id, company, priority, requestId })
      .strict(),
  },
  preferences_update: {
    title: 'Update account preferences',
    scope: "profile:write",
    pro: false,
    write: true,
    description: 'Changes only summary language or in-app mute preference for the connected account. Identity, subscription and delivery destinations are excluded.',
    schema: z
      .object({
        summaryLanguage: z.enum(["english", "hinglish"]).optional(),
        muteInAppNotifications: z.boolean().optional(),
        requestId,
      })
      .strict(),
  },
  watchlist_stocks_read: {
    title: 'Read watchlist stocks',
    scope: "watchlists:read",
    pro: true,
    write: false,
    description: 'Returns a page of up to 25 stocks in one owned watchlist, with bounded company identity and priority fields.',
    schema: z
      .object({
        watchlistId: id,
        offset: z.number().int().min(0).max(10000).default(0),
      })
      .strict(),
  },
  notes_read: {
    title: 'Read saved notes',
    scope: "notes:read",
    pro: false,
    write: false,
    description: 'Returns up to 10 saved notes belonging to the connected account, with offset pagination.',
    schema: z
      .object({ offset: z.number().int().min(0).max(200).default(0) })
      .strict(),
  },
  note_create: {
    title: 'Create a note',
    scope: "notes:write",
    pro: false,
    write: true,
    description: 'Creates a text note in the connected account. Text is stored as data; remote HTML or URLs are not executed.',
    schema: z
      .object({
        text: z.string().trim().min(1).max(2000),
        tags: z.array(z.string().trim().min(1).max(24)).max(8).default([]),
        requestId,
      })
      .strict(),
  },
  note_update: {
    title: 'Update a note',
    scope: "notes:write",
    pro: false,
    write: true,
    description: 'Updates the text of one note owned by the connected account, identified by noteId. Matching requestId retries replay the stored outcome.',
    schema: z
      .object({
        noteId: id,
        text: z.string().trim().min(1).max(2000),
        requestId,
      })
      .strict(),
  },
  notifications_read: {
    title: 'Read notifications',
    scope: "alerts:read",
    pro: false,
    write: false,
    description: 'Returns up to 20 notifications addressed to the connected account.',
    schema: z.object({}).strict(),
  },
  alert_preferences_read: {
    title: 'Read alert preferences',
    scope: "alerts:read",
    pro: false,
    write: false,
    description: 'Returns the connected account’s alert category switches, without delivery destinations.',
    schema: z.object({}).strict(),
  },
  alert_preferences_update: {
    title: 'Update alert preferences',
    scope: "alerts:write",
    pro: true,
    write: true,
    description: 'Updates selected alert category switches for the connected account. Telegram destinations and message sending are excluded.',
    schema: z
      .object({
        resultsAndEarnings: z.boolean().optional(),
        orderWinsAndExpansion: z.boolean().optional(),
        dividendsAndBonus: z.boolean().optional(),
        acquisitionsAndMergers: z.boolean().optional(),
        creditRatings: z.boolean().optional(),
        muteRoutineFilings: z.boolean().optional(),
        boardMeetingsAndOutcomes: z.boolean().optional(),
        annualReportsAndAudits: z.boolean().optional(),
        requestId,
      })
      .strict(),
  },
  filing_summary: {
    title: 'Analyze a filing PDF',
    scope: "analysis:generate",
    pro: false,
    write: true,
    description: 'Returns a cached or newly generated AI analysis of an existing filing’s official exchange PDF in English or Roman Hinglish. Document coverage and provenance are included. New generation uses the website AI allowance; unavailable PDFs or providers return an error with no heuristic summary. Matching requestId retries replay the stored outcome.',
    schema: z
      .object({
        filingId: id,
        language: z.enum(["english", "hinglish"]).default("english"),
        requestId,
      })
      .strict(),
  },
} as const;
export type ToolName = keyof typeof TOOL_SPECS;
export function parseTool(name: string, args: unknown) {
  if (!Object.hasOwn(TOOL_SPECS, name)) throw new AiError("unknown_tool", 404);
  const spec = TOOL_SPECS[name as ToolName];
  const parsed = spec.schema.safeParse(args);
  if (!parsed.success)
    throw new AiError(
      "invalid_arguments",
      400,
      parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")
        .slice(0, 400),
    );
  if (name === "filings_search" && ((parsed.data as any).beforeId && !(parsed.data as any).before))
    throw new AiError("invalid_arguments", 400, "beforeId requires before.");
  if (name === "filings_search" && (parsed.data as any).after && (parsed.data as any).before &&
      Date.parse((parsed.data as any).after) >= Date.parse((parsed.data as any).before))
    throw new AiError("invalid_arguments", 400, "after must precede before.");
  if (
    name === "preferences_update" &&
    !("summaryLanguage" in parsed.data) &&
    !("muteInAppNotifications" in parsed.data)
  )
    throw new AiError("invalid_arguments", 400, "Choose a preference.");
  if (
    name === "alert_preferences_update" &&
    Object.keys(parsed.data).length === 1
  )
    throw new AiError("invalid_arguments", 400, "Choose an alert preference.");
  return { spec, args: parsed.data as Record<string, any> };
}
export function allowance(pro: boolean, uid?: string) {
  const expires = Date.parse(process.env.AI_REVIEWER_UNTIL || "");
  if (uid?.startsWith("mcp-reviewer-") && uid === process.env.AI_REVIEWER_UID && expires > Date.now() && expires <= Date.now()+31*86400000) return { daily: 1000, perMinute: 40, writes: 200 };
  return {
    daily: pro ? 200 : 20,
    perMinute: pro ? 20 : 5,
    writes: pro ? 50 : 5,
  };
}
