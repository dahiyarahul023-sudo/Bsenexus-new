import { createHash, randomBytes } from "node:crypto";
import { isIP } from "node:net";
import { z } from "zod";

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
export function validateRedirect(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new AiError("invalid_redirect");
  }
  if (
    raw.length > 2048 ||
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    u.hash ||
    u.port ||
    isIP(u.hostname) ||
    !u.hostname.includes(".") ||
    /(^|\.)(localhost|local|internal|test|invalid)$/.test(u.hostname)
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
  toDate: z.string().max(10).optional().describe("Inclusive IST end. For one day, set it equal to fromDate, e.g. tomorrow."),
  daysAhead: z.number().int().min(1).max(60).default(14),
  limit: z.number().int().min(1).max(25).default(20),
  offset: z.number().int().min(0).max(10000).default(0),
};
export const TOOL_SPECS = {
  account_context: {
    scope: "account:read",
    pro: false,
    write: false,
    description:
      "Read the connected account identity, current plan, permissions and remaining allowance. No user ID argument.",
    schema: z.object({}).strict(),
  },
  company_lookup: {
    scope: "market:read",
    pro: false,
    write: false,
    description:
      "Find a company by exact symbol, six-digit BSE code or name. Ambiguous queries return candidates; ask the user to choose.",
    schema: z.object({ query: company }).strict(),
  },
  filings_search: {
    scope: "market:read",
    pro: false,
    write: false,
    description:
      "Read bounded company filings. Resolve ambiguous company names first. Empty results describe available coverage, not proof that no filing exists.",
    schema: z
      .object({
        company: company.optional(),
        category: z.string().max(50).optional(),
        limit: z.number().int().min(1).max(25).default(10),
        before: z.string().datetime().optional(),
      })
      .strict(),
  },
  results_read: {
    scope: "market:read",
    pro: false,
    write: false,
    description:
      "Use for already declared quarterly results and available summaries for one company. For future result dates use meetings_read or watchlist_results_upcoming. Include source links; metrics are not independently validated.",
    schema: z.object({ company }).strict(),
  },
  meetings_read: {
    scope: "market:read",
    pro: false,
    write: false,
    description:
      "Use for upcoming or tomorrow's result dates across the market or one company. Includes today by default, nearest date first. Use fromDate=tomorrow,toDate=tomorrow for only tomorrow. For the user's watchlist use watchlist_results_upcoming.",
    schema: z.object({ company: company.optional(), ...calendarDates }).strict(),
  },
  watchlist_results_upcoming: {
    scope: "watchlists:read",
    pro: true,
    write: false,
    description:
      "Use for upcoming result dates of the connected account's watchlist stocks in one call. No need to fetch every stock first. All active watchlists by default, or an exact watchlistId. Also requires market:read. Includes today, nearest first; use fromDate=tomorrow,toDate=tomorrow for tomorrow only.",
    schema: z.object({ watchlistId: id.optional(), ...calendarDates }).strict(),
  },
  watchlists_read: {
    scope: "watchlists:read",
    pro: true,
    write: false,
    description: "Read compact metadata and up to five preview stocks for your watchlists; use IDs for edits. For upcoming results call watchlist_results_upcoming directly.",
    schema: z
      .object({ offset: z.number().int().min(0).max(10000).default(0) })
      .strict(),
  },
  watchlist_create: {
    scope: "watchlists:write",
    pro: true,
    write: true,
    description:
      "Create an empty watchlist in the connected account. Use a stable requestId for retries.",
    schema: z
      .object({ name: z.string().trim().min(1).max(80), requestId })
      .strict(),
  },
  watchlist_rename: {
    scope: "watchlists:write",
    pro: true,
    write: true,
    description:
      "Rename an existing watchlist by its exact ID. Preserve requestId on retries.",
    schema: z
      .object({
        watchlistId: id,
        name: z.string().trim().min(1).max(80),
        requestId,
      })
      .strict(),
  },
  watchlist_toggle: {
    scope: "watchlists:write",
    pro: true,
    write: true,
    description: "Enable or pause an owned watchlist without deleting it.",
    schema: z
      .object({ watchlistId: id, active: z.boolean(), requestId })
      .strict(),
  },
  watchlist_add_stock: {
    scope: "watchlists:write",
    pro: true,
    write: true,
    description:
      "Add one exactly identified company to an owned watchlist. Resolve ambiguous names before calling.",
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
    scope: "watchlists:write",
    pro: true,
    write: true,
    description:
      "Remove one stock from an owned watchlist only when requested by the user. No bulk deletion.",
    schema: z.object({ watchlistId: id, company, requestId }).strict(),
  },
  watchlist_priority: {
    scope: "watchlists:write",
    pro: true,
    write: true,
    description: "Set a stock priority in one owned watchlist.",
    schema: z
      .object({ watchlistId: id, company, priority, requestId })
      .strict(),
  },
  preferences_update: {
    scope: "profile:write",
    pro: false,
    write: true,
    description:
      "Change only summary language or in-app mute preference. Cannot change identity, subscription or notification destinations.",
    schema: z
      .object({
        summaryLanguage: z.enum(["english", "hinglish"]).optional(),
        muteInAppNotifications: z.boolean().optional(),
        requestId,
      })
      .strict(),
  },
  watchlist_stocks_read: {
    scope: "watchlists:read",
    pro: true,
    write: false,
    description: "Read a page of up to 25 stocks in one owned watchlist.",
    schema: z
      .object({
        watchlistId: id,
        offset: z.number().int().min(0).max(10000).default(0),
      })
      .strict(),
  },
  notes_read: {
    scope: "notes:read",
    pro: false,
    write: false,
    description: "Read up to 10 notes belonging to the connected account.",
    schema: z
      .object({ offset: z.number().int().min(0).max(200).default(0) })
      .strict(),
  },
  note_create: {
    scope: "notes:write",
    pro: false,
    write: true,
    description:
      "Save a text note in the connected account. No arbitrary remote links or HTML execution.",
    schema: z
      .object({
        text: z.string().trim().min(1).max(2000),
        tags: z.array(z.string().trim().min(1).max(24)).max(8).default([]),
        requestId,
      })
      .strict(),
  },
  note_update: {
    scope: "notes:write",
    pro: false,
    write: true,
    description: "Edit the text of one owned note using its exact ID.",
    schema: z
      .object({
        noteId: id,
        text: z.string().trim().min(1).max(2000),
        requestId,
      })
      .strict(),
  },
  notifications_read: {
    scope: "alerts:read",
    pro: false,
    write: false,
    description:
      "Read up to 20 notifications addressed to the connected account.",
    schema: z.object({}).strict(),
  },
  alert_preferences_read: {
    scope: "alerts:read",
    pro: false,
    write: false,
    description:
      "Read your alert category switches without exposing delivery destinations.",
    schema: z.object({}).strict(),
  },
  alert_preferences_update: {
    scope: "alerts:write",
    pro: true,
    write: true,
    description:
      "Update selected alert category switches. Cannot change Telegram destinations or send messages.",
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
    scope: "analysis:generate",
    pro: false,
    write: true,
    description:
      "Get or generate a summary for an existing filing ID. Uses the same website AI allowance; no user prompts or arbitrary URLs accepted. Preserve requestId on retry.",
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
export function allowance(pro: boolean) {
  return {
    daily: pro ? 200 : 20,
    perMinute: pro ? 20 : 5,
    writes: pro ? 50 : 5,
  };
}
