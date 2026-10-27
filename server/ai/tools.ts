import { getAccessProfile } from '../services/subscriptionAccess.js';
import {
  aiDb,
  aiRpc,
  readConnectionToken,
} from "../database/aiConnectionsDao.js";
import {
  getUserProfile,
  claimFreeSummaryDemo,
  releaseFreeSummaryDemo,
  invalidateUserProfileCache,
} from "../database/usersDao.js";
import { getPaymentEntitlement } from "../database/paymentEntitlementsDao.js";
import { getAllNotifications } from "../database/notificationDao.js";
import { getAnnouncementById, cacheAiConnectionSummary } from "../database/announcementDao.js";
import {
  checkAndConsumeServerAiQuota,
  refundServerAiQuota,
  completeServerAiQuotaReservation,
} from "../services/aiQuotaService.js";
import { summarizeFilingPdf, cachedFilingSummary, filingSummarySource, summaryCacheField } from "./filingSummary";
import { invalidateUserWatchlistCache } from "../database/watchlistDao.js";
import { invalidateMonitorConfigCache } from "../services/monitor.js";
import {
  AiError,
  allowance,
  hashSecret,
  parseTool,
  resourceUrl,
} from "./policy.js";
import {
  companyCandidates,
  exactCompany,
  filingsData,
  resultsData,
  meetingsData,
} from "./market.js";
import { getResultsCalendarSnapshot } from "../services/resultsCalendarService.js";
import { calendarWindow, compactWatchlistStock, selectCalendarMeetings } from "./calendarRead.js";

export function publicToolResult(name: string, result: any) {
  return name.startsWith('watchlist_') && result?.watchlist && Object.hasOwn(result.watchlist,'is_active') ? {...result,watchlist:{...result.watchlist,is_active:result.watchlist.is_active!==0 && result.watchlist.is_active!==false}} : result;
}
export async function accountState(uid: string) {
  const [profile, entitlement] = await Promise.all([
    getAccessProfile(uid, { durable: true }),
    getPaymentEntitlement(uid),
  ]);
  if (!profile) throw new AiError("account_missing", 401);
  const pro =
    profile.tier === "admin" ||
    Math.max(
      Number(profile.proExpiresAt || 0),
      Number(entitlement?.proExpiresAt || 0),
    ) > Date.now();
  return { profile, pro, limits: allowance(pro, uid) };
}
export async function connectedState(token: string) {
  const { row, grant } = await readConnectionToken(token);
  if (row.resource !== resourceUrl()) throw new AiError("invalid_token", 401);
  return { grant, ...(await accountState(grant.uid)) };
}
export function createAiToolRunner(
  overrides: {
    state?: typeof connectedState;
    rpc?: typeof aiRpc;
    db?: typeof aiDb;
    calendar?: typeof getResultsCalendarSnapshot;
    filings?: typeof filingsData;
    results?: typeof resultsData;
    meetings?: typeof meetingsData;
    notifications?: typeof getAllNotifications;
    filing?: typeof getAnnouncementById;
    summarize?: typeof summarizeFilingPdf;
    cacheSummary?: typeof cacheAiConnectionSummary;
    quota?: { consume: typeof checkAndConsumeServerAiQuota; refund: typeof refundServerAiQuota; complete: typeof completeServerAiQuotaReservation; claimFree: typeof claimFreeSummaryDemo; releaseFree: typeof releaseFreeSummaryDemo };
  } = {},
) {
  const state = overrides.state || connectedState,
    rpc = overrides.rpc || aiRpc,
    dbCall = overrides.db || aiDb;
  const calendar = overrides.calendar || getResultsCalendarSnapshot;
  const quota = overrides.quota || {consume:checkAndConsumeServerAiQuota,refund:refundServerAiQuota,complete:completeServerAiQuotaReservation,claimFree:claimFreeSummaryDemo,releaseFree:releaseFreeSummaryDemo};
  return async function (token: string, name: string, input: unknown) {
    const { spec, args } = parseTool(name, input);
    if (name === "meetings_read" || name === "watchlist_results_upcoming") calendarWindow(args);
    const { grant, profile, pro, limits } = await state(token);
    const uid = grant.uid;
    if (!grant.scopes.includes(spec.scope))
      throw new AiError(
        "scope_required",
        403,
        "Reconnect and allow this specific permission.",
      );
    if (name === "watchlist_results_upcoming" && !grant.scopes.includes("market:read"))
      throw new AiError("scope_required", 403, "Reconnect and allow market:read and watchlists:read.");
    if (spec.pro && !pro)
      throw new AiError(
        "pro_required",
        403,
        "An active Bsenexus Pro subscription or trial is required.",
      );
    const fingerprint = hashSecret(JSON.stringify({ name, args }));
    const reservation = await rpc("reserve_ai_connection", {
      p_uid: uid,
      p_write: spec.write,
      p_daily: limits.daily,
      p_minute: limits.perMinute,
      p_write_limit: limits.writes,
      p_request: spec.write ? args.requestId : null,
      p_fingerprint: spec.write ? fingerprint : null,
      p_tool: spec.write ? name : null,
    });
    if (reservation.replay) {
      if (reservation.result?.error)
        throw new AiError(
          reservation.result.error,
          reservation.result.status || 409,
        );
      return publicToolResult(name, reservation.result);
    }
    try {
      if (name === "account_context")
        return {
          id: hashSecret("ai-profile:" + uid),
          name: profile.displayName || profile.username || "Bsenexus account",
          plan: pro ? "pro" : "free",
          permissions: grant.scopes,
          allowance: {
            ...limits,
            remaining: reservation.remaining,
            resetTimezone: "Asia/Kolkata",
          },
          websiteAiAllowance:
            "Shared with existing website summaries. Cached reads do not generate a new model call.",
        };
      if (name === "company_lookup") {
        const exact = companyCandidates(args.query);
        const entries = exact.length ? exact : companyCandidates(args.query, true);
        const approximate = !exact.length && entries.length > 0;
        return {
          found: entries.length === 1 && !approximate,
          ambiguous: entries.length > 1,
          approximate,
          ...(entries.length === 1 && !approximate
            ? { company: { symbol: entries[0].symbol, scripCode: entries[0].scripCode, name: entries[0].name } }
            : {
                candidates: entries.map((e) => ({
                  symbol: e.symbol,
                  scripCode: e.scripCode,
                  name: e.name,
                })),
              }),
        };
      }
      if (name === "filings_search") return (overrides.filings || filingsData)(args);
      if (name === "results_read") return (overrides.results || resultsData)(args.company, args);
      if (name === "meetings_read")
        return (overrides.meetings || meetingsData)(args.company, args.daysAhead, args);
      if (name === "watchlist_results_upcoming") {
        const row = await dbCall((db) =>
          db.from("user_watchlists").select("lists").eq("uid", uid).maybeSingle(),
        );
        const lists = Array.isArray(row?.lists) ? row.lists : [];
        const selected = args.watchlistId
          ? lists.filter((l: any) => String(l.id) === args.watchlistId)
          : lists.filter((l: any) => l.is_active !== 0 && l.is_active !== false);
        if (args.watchlistId && !selected.length) throw new AiError("not_found", 404);
        const codes = new Set<string>();
        for (const list of selected) for (const raw of (Array.isArray(list.items) ? list.items : [])) {
          const stock = compactWatchlistStock(raw);
          if (stock.scripCode) codes.add(stock.scripCode);
          else if (stock.symbol) {
            const matches = companyCandidates(stock.symbol);
            if (matches.length === 1) codes.add(matches[0].scripCode);
          }
        }
        const snapshot = codes.size ? await calendar() : { items: [], lastUpdated: 0 };
        return {
          ...selectCalendarMeetings(snapshot, args, codes),
          watchlistCount: selected.length,
          watchlistStockCount: codes.size,
        };
      }
      if (name === "watchlists_read") {
        const row = await dbCall((db) =>
          db
            .from("user_watchlists")
            .select("lists")
            .eq("uid", uid)
            .maybeSingle(),
        );
        const lists = Array.isArray(row?.lists) ? row.lists : [];
        return {
          watchlists: lists.slice(args.offset, args.offset + 20).map((l) => ({
            id: String(l.id || "").slice(0, 100),
            name: String(l.name || "").slice(0, 80),
            is_active: l.is_active !== 0 && l.is_active !== false,
            stockCount: (l.items || []).length,
            preview: (Array.isArray(l.items) ? l.items : []).slice(0, 5).map(compactWatchlistStock),
          })),
          nextOffset: lists.length > args.offset + 20 ? args.offset + 20 : null,
        };
      }
      if (name === "watchlist_stocks_read") {
        const row = await dbCall((db) =>
          db
            .from("user_watchlists")
            .select("lists")
            .eq("uid", uid)
            .maybeSingle(),
        );
        const list = (row?.lists || []).find(
          (l: any) => String(l.id) === args.watchlistId,
        );
        if (!list) throw new AiError("not_found", 404);
        const items = Array.isArray(list.items) ? list.items : [];
        return {
          items: items.slice(args.offset, args.offset + 25).map(compactWatchlistStock),
          nextOffset: items.length > args.offset + 25 ? args.offset + 25 : null,
        };
      }
      if (name === "notes_read") {
        const rows = await dbCall((db) =>
          db
            .from("user_notes")
            .select("note")
            .eq("user_id", uid)
            .order("updated_at", { ascending: false })
            .range(args.offset, args.offset + 9),
        );
        return {
          notes: (rows || []).map((r) => {
            const { userId, ...note } = r.note;
            return note;
          }),
          nextOffset: rows.length === 10 ? args.offset + 10 : null,
        };
      }
      if (name === "notifications_read")
        return {
          notifications: (await (overrides.notifications || getAllNotifications)(uid, 20)).map((n) => ({
            id: n.id,
            title: n.title,
            message: n.message,
            isRead: n.isRead,
            timestamp: n.timestamp,
          })),
        };
      if (name === "alert_preferences_read") {
        const allowed = [
          "resultsAndEarnings",
          "orderWinsAndExpansion",
          "dividendsAndBonus",
          "acquisitionsAndMergers",
          "creditRatings",
          "muteRoutineFilings",
          "boardMeetingsAndOutcomes",
          "annualReportsAndAudits",
        ];
        return {
          preferences: Object.fromEntries(
            allowed.map((k) => [
              k,
              (profile.notificationPreferences as any)?.[k] ?? null,
            ]),
          ),
        };
      }
      if (name === "filing_summary") {
        const item = await (overrides.filing || getAnnouncementById)(args.filingId);
        if (!item) throw new AiError("not_found", 404);
        filingSummarySource(item);
        const cached = cachedFilingSummary(item, args.language);
        let summary = cached,
          receipt: string | undefined,
          freeClaim = false;
        try {
          if (!summary) {
            if (pro) {
              const q = await quota.consume(uid, false);
              if (!q.allowed)
                throw new AiError("generation_quota_exceeded", 429, q.error);
              receipt = q.reservationId;
            } else {
              freeClaim = await quota.claimFree(uid);
              if (!freeClaim)
                throw new AiError(
                  "free_demo_used",
                  403,
                  "Your website free summary demo has already been used.",
                );
            }
            summary = await (overrides.summarize || summarizeFilingPdf)(item, args.language);
            if (!summary) throw new AiError("generation_unavailable", 503);
          }
          const result = {
            success: true,
            ...summary!,
            cached: Boolean(cached),
            filingId: args.filingId,
            language: args.language,
          };
          const saved = await dbCall((db) =>
            db
              .from("ai_connection_operations")
              .update({ result })
              .eq("uid", uid)
              .eq("request_id", args.requestId)
              .eq("fingerprint", fingerprint)
              .select("request_id"),
          );
          if (!Array.isArray(saved) || saved.length !== 1) throw new AiError('operation_unavailable',503,'The summary receipt could not be confirmed.');
          quota.complete(receipt);
          if (!cached) { try { (overrides.cacheSummary || cacheAiConnectionSummary)(args.filingId, summaryCacheField(args.language), summary); } catch {} }
          return result;
        } catch (e) {
          if (receipt) await quota.refund(uid, false, receipt);
          if (freeClaim) await quota.releaseFree(uid);
          throw e;
        }
      }
      const payload = { ...args };
      delete payload.requestId;
      if (args.company) {
        const e = exactCompany(args.company);
        payload.stock = {
          symbol: e.symbol,
          scripCode: e.scripCode,
          companyName: e.name,
          priority: args.priority || "HIGH",
        };
        delete payload.company;
      }
      const result = await rpc("mutate_ai_account", {
        p_uid: uid,
        p_request: args.requestId,
        p_fingerprint: fingerprint,
        p_tool: name,
        p_args: payload,
        p_grant: grant.id,
      });
      invalidateUserWatchlistCache(uid);
      invalidateUserProfileCache(uid);
      invalidateMonitorConfigCache(uid);
      return publicToolResult(name, result);
    } catch (e) {
      if (spec.write) {
        const err =
          e instanceof AiError ? e : new AiError("operation_unavailable", 503);
        await dbCall((db) =>
          db
            .from("ai_connection_operations")
            .update({ result: { error: err.code, status: err.status } })
            .eq("uid", uid)
            .eq("request_id", args.requestId)
            .eq("fingerprint", fingerprint)
            .is("result", null)
            .select("request_id"),
        ).catch(() => {});
      }
      throw e;
    }
  };
}
export const runAiTool = createAiToolRunner();
