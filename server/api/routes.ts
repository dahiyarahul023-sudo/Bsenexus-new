import { readResultHistory } from '../services/resultHistoryRead.js';
import { telegramLinksRouter } from './telegramLinks.js';
import { requireVerifiedTelegramTarget, telegramLinkCommand } from '../database/telegramLinksDao.js';
import { startHistorySync, historySyncStatus } from '../services/historicalFilings.js';
import { createAdrHandler } from './adr.js';
import express from "express";
import { parseCalendarScope } from '../../src/shared/calendarScope.js';
import bcrypt from "bcryptjs";
import { getSettings, saveSettings } from "../database/settingsDao.js";
import { getLogs, addLog, clearLogs } from "../database/logDao.js";
import { saveFeedback, getAllFeedback, markFeedbackRead } from "../database/feedbackDao.js";
import { getRecentAnnouncements, markAnnouncementSent, getAnnouncementById, processedBloomFilter, sentBloomFilter, isAnnouncementProcessed, isAnnouncementSent, getBloomFilterDiagnostics } from "../database/announcementDao.js";
import { isBseFiling } from '../../src/shared/filingSource.js';
import { generateDirectSummary, generateAndSendSummary, askAppHelpAI } from "../services/gemini.js";
import { escapeHTML, isMarketHoursIST } from "../utils/helpers.js";
import { resolvePersonalTelegramTarget } from '../utils/telegramTarget.js';
import { resumeFirestoreNetwork, pauseFirestoreNetwork, persistStorageMode } from "../database/firebase.js";
import { requireAuth, requireAdmin, requireProOrAdmin, aiRateLimiter, telegramRateLimiter, apiRateLimiter } from "../security/auth.js";
import { runSecurityAudit, executeSimulatedPenTest } from "../security/hardening.js";
import { fetchBseDocument, isAllowedBseDocumentUrl, readBoundedDocument } from '../utils/bseDocument.js';
import {
  getAllWatchlists,
  renameWatchlist,
  addWatchlist,
  deleteWatchlist,
  toggleWatchlist,
  addSymbolToWatchlist,
  addSymbolsToWatchlist,
  updateSymbolPriorityInWatchlist,
  updateSymbolPriorityAcrossAllWatchlists,
  removeSymbolFromWatchlist,
  removeSymbolsFromWatchlistBatch,
  updateSymbolsPriorityBatch,
  clearWatchlistSymbols,
  clearAllWatchlistsSymbols,
  resetUserWatchlistsToDefault,
  sanitizeUserId
} from "../database/watchlistDao.js";
import { getBseHealth, testBSEConnection, syncWatchlistHistoricalData, syncSingleStockHistoricalData, backfillRecentAnnouncements, getBackupStalenessMetrics, isBseSourceBlocked, getBseFeedStaleness } from "../services/bse.js";
import { getAllStockEntries, resolveStockDetails, getScripCode } from "../utils/stockResolver.js";
import { invalidateMonitorConfigCache, processAnnouncements } from "../services/monitor.js";
import { wantsTelegramEnable } from "../utils/alertDecision.js";
import { getTelegramHealth, sendToTelegram, getBotUsername } from "../services/telegram.js";
import { 
  getResultsCalendarData, 
  fetchAndSyncResultsCalendar, 
  syncSingleStockResultsCalendar,
  getStockResultsHistory, 
  broadcastUpcomingMeetingsToTelegram,
  fetchDeepHistoricalResultsForStock,
  autoFetchDeepHistoricalResults,
  fetchDeepHistoricalResultsForWatchlist,
  boostPreResultWindow,
  getPreResultRunupAnnouncements
} from "../services/resultsCalendarService.js";
import { getStorageStatusReport, runAutoStorageCleanup, triggerManualTestStorageAlert, pruneAnnouncementsByPercentage } from "../services/storageMonitor.js";
import { getManualStorageMode, setManualStorageMode, resetQuotaExceededFlag, isFirestoreQuotaExceeded, resetAdminPermissionDenied, isAdminPermissionDenied } from "../database/localStore.js";
import { getCompanyIntelligence, getCompanyFilingCount, generateCompanyAiOverview, fetchStockQuote } from "../services/companyIntelService.js";
import { filterNotifications, getAllNotifications, getUnreadNotificationCount, markNotificationRead, markNotificationsReadBatch, markAllNotificationsRead, clearAllNotifications } from "../database/notificationDao.js";
import { circuitRegistry } from "../utils/circuitBreaker.js";
import { 
  fetchGeneralMarketNews, 
  fetchStockSpecificNews, 
  getWatchlistNews, 
  sendNewsToTelegram, 
  sendWatchlistNewsDigestToTelegram,
  processAutomatedNewsAlerts,
  NEWS_FEEDS
} from "../services/stockNewsService.js";
import { 
  getUserProfile, 
  saveUserProfile, 
  isUsernameAvailable, 
  generateUniqueUsername,
  claimFreeSummaryDemo,
  releaseFreeSummaryDemo
} from "../database/usersDao.js";
import { getAllAlertRules, saveAlertRule, saveAlertPresets, toggleAlertRule, deleteAlertRule, AlertRuleError } from "../database/alertRulesDao.js";
import { checkServerAiQuota, consumeServerAiQuota, checkAndConsumeServerAiQuota, refundServerAiQuota, completeServerAiQuotaReservation, getServerAiQuotaStatus, resetServerAiQuota } from "../services/aiQuotaService.js";
import { getTodayUsage, quotaConsumedPct } from "../services/ai/providerQuotaLedger.js";
import { MODEL_REGISTRY, TASK_CHAINS, providerKeyPresent } from "../services/ai/modelRegistry.js";
import { verifyAllModels } from "../services/ai/verifyModels.js";
import { readLocalJson } from "../database/localStore.js";
import { classifyMaterialEvent } from "../services/timelineClassifier.js";
import { searchCompany } from "./search.js";
import { fetchLiveMarketIndices, getMarketSessionStatus } from "../services/marketIndicesService.js";
import { getAdrSnapshot } from '../services/adrService.js';
import { getLiveStoryFeed } from "../services/storyFeedService.js";
import { sendOneSignalPush, isOneSignalConfigured, ONESIGNAL_APP_ID } from "../services/oneSignal.js";
import { 
  recordTelemetry, 
  getDiagnosticsSummary, 
  clearDiagnostics, 
  triggerCrashTelegramAlert,
  getApprovedBugRules,
  addApprovedBugRule,
  deleteApprovedBugRule
} from "../database/diagnosticsDao.js";
import { seoRouter } from "./seoRoutes.js";
import { reconcilePaymentEntitlement } from "../database/paymentEntitlementsDao.js";
import { isPaymentStoreUnavailable } from "../database/paymentStore.js";
import { giftAccessRouter } from './giftAccess.js';
import { getAccessProfile } from '../services/subscriptionAccess.js';
import { paymentsRouter } from "./payments.js";
import { referralsRouter } from "./referrals.js";
import { faqRouter } from "./faq.js";
import { notesRouter } from "./notes.js";
import { impactRadarRouter } from "./impactRadar.js";
import { pageRenderCache, staticGuideCache, apiResponseCache } from "../utils/renderCache.js";
import { getMarketGuides, getMarketGuideBySlug } from "../services/marketGuidesService.js";
import { invalidateUserWatchlistCache } from '../database/watchlistDao.js';
import { aiConnectionsRouter } from '../ai/http.js';
import { connectionsEnabled } from '../ai/policy.js';
import { aiPluginRouter } from "./aiPlugin.js";

export const apiRouter = express.Router();
apiRouter.use(telegramLinksRouter);

// Universal AI Plugin & OpenAPI Action Gateway (ChatGPT, Gemini, Agents)
apiRouter.use("/ai/connections", aiConnectionsRouter);
apiRouter.use("/ai", aiPluginRouter);

// Mount Super SEO Suite (11 Verified Skills Engine)
apiRouter.use("/seo", requireAdmin, aiRateLimiter, seoRouter);

// Cashfree one-time Pro payments (create-order / verify / webhook / status)
apiRouter.use("/payments", paymentsRouter);
apiRouter.use("/gifts", giftAccessRouter);

// Referral partner & creator affiliate program
apiRouter.use("/referrals", referralsRouter);

// Public AI FAQ section (bank-first, AI fallback behind server-side quotas)
apiRouter.use("/faq", faqRouter);

// Saved Notes (login-required, Firestore-first)
apiRouter.use("/notes", notesRouter);
apiRouter.use("/impact-radar", impactRadarRouter);

// Educational Market Guides API (Fail-safe, cached)
apiRouter.get("/market-guides", (_req, res) => {
  const guides = getMarketGuides();
  res.json({
    success: true,
    total: guides.length,
    guides
  });
});

apiRouter.get("/market-guides/:slug", (req, res) => {
  const guide = getMarketGuideBySlug(req.params.slug);
  if (!guide) {
    return res.status(404).json({ success: false, error: "Market guide not found" });
  }
  res.json({
    success: true,
    guide
  });
});

// Public client config — only values safe to expose in the browser.
// (Sentry DSN is public by design; it identifies the project, it is not a secret key.)
apiRouter.get("/config/public", (_req, res) => {
  res.json({
    sentryDsn: process.env.SENTRY_DSN || process.env.VITE_SENTRY_DSN || null,
  });
});

// Health Check Endpoint with Circuit Breakers & Cache Telemetry
apiRouter.get("/health", (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  // SECURITY (24 Oct 2026 audit INFO-1): anonymous callers only learn that the
  // process is alive. Upstream health, cache and circuit-breaker internals help
  // an attacker time attacks, so they are admin-only.
  if ((req as any).user?.isAdmin !== true) {
    return res.json({ status: "ok", timestamp: Date.now() });
  }
  res.json({
    status: "ok", 
    uptime: process.uptime(),
    bseSource: { ...getBseHealth(), ...getBseFeedStaleness() },
    timestamp: Date.now(),
    circuitBreakers: circuitRegistry.getAllStatuses(),
    caches: {
      pages: pageRenderCache.getStats(),
      api: apiResponseCache.getStats(),
      guides: staticGuideCache.getStats()
    }
  });
});

// Retired fire-and-forget poll route: it released request CPU before ingestion.
// Only the secret-protected /api/cron/poll-announcements may trigger a cycle.
apiRouter.get("/cron/poll", (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(410).json({ success: false, error: 'Use the configured Cloud Scheduler polling endpoint.' });
});

apiRouter.get("/ping", (_req, res) => {
  res.type('text/plain').send('pong');
});

// Cache Telemetry & Diagnostics API
apiRouter.get("/cache/stats", requireAdmin, (_req, res) => {
  res.json({
    success: true,
    pages: pageRenderCache.getStats(),
    api: apiResponseCache.getStats(),
    guides: staticGuideCache.getStats()
  });
});

// Admin Cache Invalidation API
apiRouter.post("/cache/clear", requireAdmin, (req, res) => {
  const namespace = req.body?.namespace as string | undefined;
  if (namespace === 'pages') {
    pageRenderCache.clear();
  } else if (namespace === 'api') {
    apiResponseCache.clear();
  } else if (namespace === 'guides') {
    staticGuideCache.clear();
  } else {
    pageRenderCache.clear();
    apiResponseCache.clear();
    staticGuideCache.clear();
  }
  addLog('INFO', 'CACHE', `Render and API cache flushed (namespace: ${namespace || 'all'}) by admin`).catch(() => {});
  res.json({
    success: true,
    message: `Cache cleared successfully (${namespace || 'all'})`
  });
});

// Circuit Breaker Telemetry & Status API
apiRouter.get("/circuit-breakers", requireAdmin, (_req, res) => {
  res.json({
    success: true,
    circuitBreakers: circuitRegistry.getAllStatuses()
  });
});

// Reset a specific circuit breaker manually (Admin only)
apiRouter.post("/circuit-breakers/:name/reset", requireAdmin, (req, res) => {
  const breaker = circuitRegistry.get(req.params.name);
  if (!breaker) {
    return res.status(404).json({ success: false, error: `Circuit breaker '${req.params.name}' not found` });
  }
  breaker.reset();
  addLog('INFO', 'CIRCUIT_BREAKER', `Circuit breaker '${req.params.name}' was manually reset by admin`).catch(() => {});
  res.json({
    success: true,
    message: `Circuit breaker '${req.params.name}' reset successfully`,
    status: breaker.getStatus()
  });
});

// Reset all circuit breakers manually (Admin only)
apiRouter.post("/circuit-breakers/reset-all", requireAdmin, (_req, res) => {
  circuitRegistry.resetAll();
  addLog('INFO', 'CIRCUIT_BREAKER', 'All circuit breakers were manually reset by admin').catch(() => {});
  res.json({
    success: true,
    message: "All circuit breakers reset successfully",
    circuitBreakers: circuitRegistry.getAllStatuses()
  });
});

// Helper to safely extract verified user ID from authenticated JWT
export function getReqUserId(req: express.Request): string {
  const user = (req as any).user;
  if (user && user.uid && user.uid !== 'guest') {
    return sanitizeUserId(user.uid);
  }
  return 'guest';
}



// SSRF Safe URL Validator (strictly restricts fetch/proxy to official BSE India domains)
function isAllowedBseUrl(urlStr: string): boolean {
  return isAllowedBseDocumentUrl(urlStr);
}

function sanitizeSafeUrl(urlStr?: string): string | null {
  if (!urlStr || typeof urlStr !== 'string') return null;
  const trimmed = urlStr.trim();
  if (/^https?:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=]+$/i.test(trimmed)) {
    return trimmed;
  }
  return null;
}

apiRouter.get("/settings", async (req, res) => {
  const settings = await getSettings();
  const isAdmin = (req as any).user?.isAdmin === true;
  const uid = getReqUserId(req);
  let userMuted = false;
  if (uid && uid !== 'guest') {
    const profile = await getUserProfile(uid);
    if (profile) {
      userMuted = Boolean(profile.muteInAppNotifications ?? profile.notificationPreferences?.muteInAppNotifications);
    }
  } else {
    userMuted = !!settings.muteInAppNotifications;
  }
  
  res.json({
    botToken: isAdmin ? (settings.botToken ? "•••••••••••••••••••••••••••••" : "") : "",
    chatId: isAdmin ? settings.chatId : "",
    botUsername: getBotUsername(),
    telegramBotConfigured: Boolean(settings.botToken || process.env.TELEGRAM_BOT_TOKEN),
    isRunning: settings.isRunning,
    isFilterEnabled: settings.isFilterEnabled,
    excludeKeywords: settings.excludeKeywords || "",
    telegramAlertPriority: settings.telegramAlertPriority || 'HIGH_ONLY',
    telegramAlertCategory: settings.telegramAlertCategory || 'RESULTS_ONLY',
    telegramWatchlistOnly: settings.telegramWatchlistOnly !== undefined ? settings.telegramWatchlistOnly : true,
    telegramAlertsEnabled: settings.telegramAlertsEnabled !== false,
    telegramAiSummaryEnabled: settings.telegramAiSummaryEnabled !== false,
    muteCrashAlerts: !!settings.muteCrashAlerts,
    muteInAppNotifications: !!userMuted,
    hasAppPin: !!settings.appPinHash,
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    envConfigured: {
      botToken: !!process.env.TELEGRAM_BOT_TOKEN,
      chatId: isAdmin ? !!process.env.TELEGRAM_CHAT_ID : false,
      appPin: !!process.env.APP_PIN,
      geminiKey: !!process.env.GEMINI_API_KEY
    },
  });
});

// Settings Modification (Strictly Admin Only)
apiRouter.post("/settings", requireAdmin, async (req, res) => {
  const updated = { ...req.body };
  if (updated.botToken === "•••••••••••••••••••••••••••••" || (typeof updated.botToken === 'string' && !updated.botToken.trim())) {
    delete updated.botToken;
  }
  if (typeof updated.chatId === 'string' && !updated.chatId.trim()) {
    delete updated.chatId;
  }

  if (updated.clearPin) {
    updated.appPinHash = "";
  } else if (updated.newPin) {
    updated.appPinHash = bcrypt.hashSync(updated.newPin, 10);
  }

  delete updated.clearPin;
  delete updated.newPin;

  await saveSettings(updated);
  invalidateMonitorConfigCache();
  res.json({ success: true });
});

apiRouter.get("/logs", requireAdmin, async (req, res) => {
  const limitParam = parseInt(req.query.limit as string) || 300;
  res.json({
    logs: await getLogs(limitParam),
    bseHealth: getBseHealth(),
    backupMetrics: getBackupStalenessMetrics(),
    telegramHealth: getTelegramHealth(),
  });
});

// Clear System Logs (Strictly Admin Only)
apiRouter.delete("/logs", requireAdmin, async (req, res) => {
  await clearLogs();
  await addLog('INFO', 'SYSTEM', 'Engine activity logs were cleared by admin user');
  res.json({ success: true, logs: await getLogs(100) });
});

// ---- AI Gateway: provider/model usage dashboard (Strictly Admin Only) ----
// Dikhata hai: har provider+model ne aaj kitne requests/tokens kharch kiye,
// 429 kitni baar aaya, quota kitna % bhara, kaunsa model exhausted hai,
// aur aaj sabse zyada AI use karne wale top users.
apiRouter.get("/admin/ai-usage", requireAdmin, async (req, res) => {
  try {
    const usage = getTodayUsage();
    const models = MODEL_REGISTRY.map((m) => {
      const today = usage.find((u) => u.provider === m.provider && u.modelId === m.modelId) || null;
      return {
        alias: m.alias,
        provider: m.provider,
        modelId: m.modelId,
        verified: m.verifiedOk,
        keyPresent: providerKeyPresent(m.provider),
        role: m.role,
        limits: m.limits,
        today: today
          ? {
              requests: today.requests,
              promptTokens: today.promptTokens,
              completionTokens: today.completionTokens,
              totalTokens: today.totalTokens,
              errors429: today.errors429,
              errorsOther: today.errorsOther,
              quotaPct: Math.round(quotaConsumedPct(today, m.limits) * 10) / 10,
              exhausted: today.exhausted,
              exhaustedUntil: today.exhaustedUntil,
              lastError: today.lastError,
              lastSuccessAt: today.lastSuccessAt,
            }
          : null,
      };
    });

    // Top AI consumers (per-user, IST day) — existing ai_usage.json se
    const ist = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const todayIST = `${ist.getFullYear()}-${String(ist.getMonth() + 1).padStart(2, '0')}-${String(ist.getDate()).padStart(2, '0')}`;
    const userUsage = readLocalJson<Record<string, number>>('ai_usage.json', {});
    const perUser: Record<string, number> = {};
    for (const [k, v] of Object.entries(userUsage)) {
      if (k.endsWith(`_${todayIST}`)) {
        const uid = k.slice(0, -(todayIST.length + 1));
        perUser[uid] = (perUser[uid] || 0) + (v as number);
      }
    }
    const topUsers = Object.entries(perUser)
      .map(([uid, count]) => ({ uid, aiCalls: count }))
      .sort((a, b) => b.aiCalls - a.aiCalls)
      .slice(0, 10);

    res.json({
      success: true,
      dayUTC: new Date().toISOString().slice(0, 10),
      dayIST: todayIST,
      chains: TASK_CHAINS,
      models,
      topUsers,
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || String(e) });
  }
});

// ---- AI Gateway: model registry ko live catalogs se verify karo (Admin Only) ----
apiRouter.post("/admin/ai-verify", requireAdmin, async (req, res) => {
  try {
    await addLog('INFO', 'AI_VERIFY', 'Manual model verification triggered by admin');
    const report = await verifyAllModels();
    res.json({ success: true, report });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || String(e) });
  }
});

// Client Error & Sync Failure Logger (Receives frontend Firestore errors for Admin Diagnostics)
apiRouter.post("/client-log", requireAuth, async (req, res) => {
  try {
    const { level, module, message } = req.body || {};
    if (message) {
      await addLog(
        typeof level === 'string' ? level : 'WARNING',
        typeof module === 'string' ? module : 'CLIENT',
        String(message)
      );
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// In-app user feedback: saves to Firestore/local and notifies admin on Telegram.
apiRouter.post("/feedback", apiRateLimiter, async (req, res) => {
  try {
    const { type, message, email } = req.body || {};
    const cleanType = ['feedback', 'bug', 'feature'].includes(type) ? type : 'feedback';
    const cleanMessage = String(message || '').trim().slice(0, 2000);
    if (!cleanMessage) {
      return res.status(400).json({ success: false, error: 'Message is required.' });
    }
    const rawEmail = String(email || '').trim().slice(0, 120);
    const cleanEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail : '';

    const item = await saveFeedback({
      type: cleanType,
      message: cleanMessage,
      email: cleanEmail || undefined,
      userId: (req as any).user?.uid,
    });

    const typeLabel = cleanType === 'bug' ? '🐞 Bug Report' : cleanType === 'feature' ? '💡 Feature Idea' : '💬 Feedback';
    // Fire-and-forget admin notification; feedback is already persisted above.
    sendToTelegram(
      `📩 <b>New ${typeLabel}</b>\n\n${escapeHTML(cleanMessage)}${cleanEmail ? `\n\n✉️ ${escapeHTML(cleanEmail)}` : ''}\n\n🕒 <i>${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</i>`
    ).catch(() => {});

    res.json({ success: true, id: item.id });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Could not submit feedback. Please try again.' });
  }
});

// Admin: list user feedback
apiRouter.get("/feedback", requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit as string) || 100));
    res.json({ success: true, items: getAllFeedback(limit) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post("/test-gemini", requireAdmin, aiRateLimiter, async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      await addLog('WARNING', 'GEMINI', 'Test Gemini failed: GEMINI_API_KEY environment variable is not defined.');
      return res.status(400).json({ 
        success: false, 
        error: "GEMINI_API_KEY is not configured in the environment. Please add it to your environment secrets." 
      });
    }

    await addLog('INFO', 'GEMINI', 'Triggering test AI summary for sample quarterly earnings announcement...');
    const testCompany = "TATA CONSULTANCY SERVICES LTD";
    const testSubject = "Financial Results for the quarter ended December 31, 2024 (Q3 FY25)";
    const testDetails = "The Board of Directors approved the unaudited standalone and consolidated financial results. Highlights: Revenue from operations stood at ₹60,583 Cr compared to ₹58,229 Cr in Q3 FY24 (+4.0% YoY). Net Profit (PAT) was ₹12,040 Cr against ₹11,058 Cr in the corresponding quarter of previous year (+8.9% YoY). Operating Margin expanded by 50 bps to 25.0%. Interim dividend of ₹10 per equity share declared with record date January 17, 2025.";

    const summary = await generateDirectSummary(testCompany, testSubject, testDetails, 'RESULTS');
    if (summary) {
      return res.json({ success: true, aiSummary: summary });
    } else {
      return res.status(500).json({ 
        success: false, 
        error: "AI did not return an output. Please check the Engine Activity Logs tab for rate limit or quota errors." 
      });
    }
  } catch (err: any) {
    await addLog('ERROR', 'GEMINI', `Test Gemini exception: ${err.message}`);
    return res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.get("/announcements", 
  apiResponseCache.middleware({ ttlMs: 3 * 1000, publicCache: false }),
  async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    // Surface BSE source-block state so the UI can show a subtle "feed delayed"
    // indicator instead of silently showing stale data. Header (not body) keeps
    // the array response shape unchanged for existing clients.
    if (isBseSourceBlocked()) {
      res.setHeader('X-BSE-Source-Blocked', 'true');
    }
    // Honest staleness: the 403-block flag only covers rate-limit blocks. Timeouts /
    // network failures never set it, so the UI would show a fake green "Live" dot
    // on day-old data. Expose last-successful-fetch age; the client shows
    // "Feed delayed — last updated HH:MM" whenever the feed is genuinely stale.
    // (Skipped for the first 5 min after boot: the poller may not have completed
    // its first cycle yet, and "delayed" would be a lie.)
    try {
      const { lastSuccessfulFetchMs, bootMs, blocked } = getBseFeedStaleness();
      const nowMs = Date.now();
      const bootedAgoMs = nowMs - bootMs;
      const STALE_AFTER_MS = 15 * 60 * 1000;
      const isStale = bootedAgoMs > 5 * 60 * 1000 &&
        (lastSuccessfulFetchMs === 0 || (nowMs - lastSuccessfulFetchMs) > STALE_AFTER_MS);
      if (isStale) {
        res.setHeader('X-BSE-Feed-Stale', 'true');
        if (lastSuccessfulFetchMs > 0) {
          res.setHeader('X-BSE-Feed-Updated-At', String(lastSuccessfulFetchMs));
        }
      }
      // If feed has not refreshed in 15 seconds and source is healthy (not blocked/cooling down),
      // opportunistically trigger background poll so active user navigation keeps filings up to date.
      if (!blocked && (lastSuccessfulFetchMs === 0 || (nowMs - lastSuccessfulFetchMs) > 15 * 1000)) {
        processAnnouncements().catch(() => {});
      }
    } catch { /* non-fatal: staleness headers are best-effort */ }
    // Recent-feed response budget; full company history is separately paged.
    // DAO serves from in-memory cache (up to 10k items), so this costs no extra Firestore reads.
    const limitParam = Math.min(2500, Math.max(1, parseInt(req.query.limit as string) || 50));
    let symbols: string[] | undefined;
    if (req.query.symbols && typeof req.query.symbols === 'string') {
      symbols = req.query.symbols.split(',').map(s => s.trim()).filter(Boolean);
    } else if (Array.isArray(req.query.symbols)) {
      symbols = (req.query.symbols as string[]).map(s => String(s).trim()).filter(Boolean);
    }
    res.json(await getRecentAnnouncements(limitParam, symbols));
  }
);

apiRouter.get("/announcements/:id", async (req, res) => {
  try {
    const newsId = req.params.id;
    const item = await getAnnouncementById(newsId);
    if (!item) {
      return res.status(404).json({ success: false, error: "Announcement not found" });
    }
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json(item);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || "Failed to fetch announcement" });
  }
});

apiRouter.post("/announcements/refresh", requireAuth, aiRateLimiter, async (_req, res) => {
  try {
    const bseRes = await backfillRecentAnnouncements(3);
    const announcements = await getRecentAnnouncements(100);
    res.json({ success: true, count: bseRes?.count ?? 0, announcements });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || "Failed to refresh announcements" });
  }
});

apiRouter.get("/billing/quota", async (req, res) => {
  const uid = getReqUserId(req);
  const isAdminUser = (req as any).user?.isAdmin === true;
  try {
    const status = await getServerAiQuotaStatus(uid, isAdminUser);
    res.json(status);
  } catch { res.status(503).json({ success: false, error: "AI usage storage is unavailable. Please retry shortly." }); }
});

apiRouter.post("/billing/reset-quota", requireAdmin, async (req, res) => {
  try {
    const uid = getReqUserId(req);
    await resetServerAiQuota(uid);
    const status = await getServerAiQuotaStatus(uid, true);
    await addLog('INFO', 'AI_QUOTA', `AI summary quota reset for user ${uid}`);
    res.json({ success: true, message: "AI Quota reset successfully", status });
  } catch { res.status(503).json({ success: false, error: "AI usage storage is unavailable. Please retry shortly." }); }
});

apiRouter.post("/announcements/:id/generate-summary", requireAuth, aiRateLimiter, async (req, res) => {
  // Hoisted for the catch block: release the free-demo claim + refund quota on ANY throw.
  let uid = '';
  let isAdminUser = false;
  let isFreeDemo = false;
  let quotaConsumed = false;
  let quotaReservationId: string | undefined;
  let consumed: { remaining: number; dailyLimit: number; isPro: boolean } = { remaining: 0, dailyLimit: 0, isPro: false };
  try {
    uid = getReqUserId(req);
    isAdminUser = (req as any).user?.isAdmin === true;

    // Reject unauthenticated guests immediately to safeguard Gemini API
    if (!uid || uid === 'guest' || uid.startsWith('guest_') || uid.startsWith('trader_')) {
      return res.status(401).json({
        success: false,
        authRequired: true,
        error: "Google Sign-In Required: Sign in with Google to get 1 week (7 days) of Free Pro AI summaries."
      });
    }

    // Pro / active-trial check against the LIVE profile (JWT claim goes stale after purchase)
    let isProLike = isAdminUser;
    let profile: any = null;
    try {
      profile = await getAccessProfile(uid, { durable: true });
      const now = Date.now();
      isProLike = isProLike || profile?.tier === 'admin' || Boolean(profile?.proExpiresAt && profile.proExpiresAt > now);
    } catch (profileErr: any) {
      if (isPaymentStoreUnavailable(profileErr)) {
        return res.status(503).json({
          success: false,
          error: "Couldn't verify your Pro status right now. Please retry in a moment.",
        });
      }
      throw profileErr;
    }

    // FREE PLAN: exactly ONE AI summary demo — one disclosure, one time ever.
    // Claimed ATOMICALLY before generation (Firestore transaction + per-uid
    // mutex), so two concurrent requests can't both win it.
    let consumed = { remaining: 0, dailyLimit: 1, isPro: false };
    const newsId = req.params.id;
    let item = await getAnnouncementById(newsId);
    if (!item && req.body && req.body.companyName) {
      item = req.body;
    }
    if (!item) {
      return res.status(404).json({ error: "Announcement not found in memory or database" });
    }
    if (!isProLike) {
      const won = await claimFreeSummaryDemo(uid);
      if (!won) {
        return res.status(403).json({
          success: false,
          demoUsed: true,
          upgradeRequired: true,
          error: "You've used your one free AI summary demo. Upgrade to Pro — one-time plans from ₹59 — for 100 AI summaries/day."
        });
      }
      isFreeDemo = true; // this single request owns the demo; released if generation fails
    } else {
      // LOGIC-002 fix (1 Oct 2026 audit): Atomically check+consume BEFORE generation.
      // Previously used check-then-generate-then-consume which had a race: N concurrent
      // requests all passed the check (used<100), all generated, all consumed → user
      // got N summaries on a quota that should only allow (100-used) more.
      // Now consume atomically up-front; if generation fails, refund below.
      const quotaCheck = await checkAndConsumeServerAiQuota(uid, isAdminUser);
      if (!quotaCheck.allowed) {
        return res.status(429).json({
          success: false,
          error: quotaCheck.error || "Daily AI summary quota reached.",
          upgradeRequired: true,
          remainingQuota: 0,
          dailyLimit: quotaCheck.dailyLimit
        });
      }
      consumed = { remaining: quotaCheck.remaining, dailyLimit: quotaCheck.dailyLimit, isPro: quotaCheck.isPro };
      quotaReservationId = quotaCheck.reservationId;
      quotaConsumed = true; // track for refund on generation failure
    }

    // AI summary language: user's Settings choice (default English).
    // Each language is generated directly and cached in its own field.
    const reqLang = (req.body && (req.body as any).lang) || req.query.lang;
    const summaryLang = reqLang === 'hinglish' ? 'hinglish' : 'english';
    let summary: string | null = null;
    try {
      summary = await generateDirectSummary(
        item.companyName || item.SLONGNAME || "",
        item.subject || item.NEWSSUB || "",
        item.details || item.HEADLINE || "",
        item.category || "OTHER",
        item.pdfLink || item.attachmentUrl || "",
        newsId,
        summaryLang
      );
    } catch (genErr: any) {
      // The outer catch owns cleanup; refund each reservation only once.
      throw genErr;
    }
    if (!summary) {
      // Generation failed (returned null) — refund quota + release free demo
      if (quotaConsumed) { try { await refundServerAiQuota(uid, isAdminUser, quotaReservationId); } catch {} }
      if (isFreeDemo) { try { await releaseFreeSummaryDemo(uid); } catch {} }
      return res.status(500).json({
        success: false,
        error: "AI Summary generation failed or rate limited. Check Engine Activity Logs tab for details."
      });
    }

    completeServerAiQuotaReservation(quotaReservationId);
    // Quota was already consumed atomically above; nothing more to burn.
    res.json({
      success: true,
      aiSummary: summary,
      aiSummaryLang: summaryLang,
      ...(isFreeDemo ? { freeDemo: true } : {}),
      remainingQuota: consumed.remaining,
      dailyLimit: consumed.dailyLimit,
      isPro: consumed.isPro
    });
  } catch (e: any) {
    // Generation threw — release the free demo claim + refund quota so the user can retry it
    if (isFreeDemo) { try { await releaseFreeSummaryDemo(uid); } catch {} }
    if (quotaConsumed) { try { await refundServerAiQuota(uid, isAdminUser, quotaReservationId); } catch {} }
    res.status(isPaymentStoreUnavailable(e) ? 503 : 500).json({ error: isPaymentStoreUnavailable(e) ? "AI usage storage is unavailable. Please retry shortly." : e.message });
  }
});

apiRouter.get("/watchlists", requireProOrAdmin, async (req, res) => {
  const uid = getReqUserId(req);
  if (connectionsEnabled()) invalidateUserWatchlistCache(uid);
  res.json(await getAllWatchlists(uid));
});

apiRouter.post("/watchlists", requireProOrAdmin, async (req, res) => {
  const uid = getReqUserId(req);
  const id = await addWatchlist(req.body.name, uid);
  res.json({ id });
});

apiRouter.delete("/watchlists/:id", requireProOrAdmin, async (req, res) => {
  const uid = getReqUserId(req);
  try {
    const deleted = await deleteWatchlist(req.params.id, uid);
    if (!deleted) return res.status(404).json({success:false,error:'Watchlist not found in your account.'});
    invalidateMonitorConfigCache();
    res.json({ success: true });
  } catch {
    res.status(503).json({success:false,error:'Watchlist storage is unavailable. Please retry.'});
  }
});

apiRouter.delete("/watchlists/all/symbols", requireProOrAdmin, async (req, res) => {
  const uid = getReqUserId(req);
  await clearAllWatchlistsSymbols(uid);
  invalidateMonitorConfigCache();
  res.json({ success: true, message: "All watchlists cleared" });
});

apiRouter.delete("/watchlists/:id/symbols", requireProOrAdmin, async (req, res) => {
  const uid = getReqUserId(req);
  await clearWatchlistSymbols(req.params.id, uid);
  invalidateMonitorConfigCache();
  res.json({ success: true, message: "Watchlist cleared" });
});

apiRouter.post("/watchlists/reset-default", requireProOrAdmin, async (req, res) => {
  const uid = getReqUserId(req);
  const data = await resetUserWatchlistsToDefault(uid);
  invalidateMonitorConfigCache();
  res.json({ success: true, data });
});

apiRouter.post(["/watchlists/sync", "/watchlists/sync-historical"], requireProOrAdmin, async (req, res) => {
  const mode = req.query.mode || req.body?.mode;
  if (mode === 'background' || mode === 'full') {
    syncWatchlistHistoricalData().catch(console.error);
    return res.json({ success: true, background: true, message: "Full watchlist historical sync initiated in background" });
  }
  const result = await syncWatchlistHistoricalData();
  res.json(result);
});

// Watchlist stock sync is Pro-only; the results-calendar path stays available to signed-in users.
apiRouter.post("/watchlists/sync-stock", requireProOrAdmin, async (req, res) => {
  const { symbol, scripCode } = req.body;
  const target = scripCode || symbol;
  const [histResult, calResult] = await Promise.allSettled([
    syncSingleStockHistoricalData(target),
    syncSingleStockResultsCalendar(target, scripCode)
  ]);
  res.json({
    success: true,
    symbol: target,
    historical: histResult.status === 'fulfilled' ? histResult.value : null,
    calendar: calResult.status === 'fulfilled' ? calResult.value : null
  });
});

apiRouter.post("/results-calendar/sync-stock", requireAuth, async (req, res) => {
  const { symbol, scripCode } = req.body;
  const target = scripCode || symbol;
  const [histResult, calResult] = await Promise.allSettled([
    syncSingleStockHistoricalData(target),
    syncSingleStockResultsCalendar(target, scripCode)
  ]);
  res.json({
    success: true,
    symbol: target,
    historical: histResult.status === 'fulfilled' ? histResult.value : null,
    calendar: calResult.status === 'fulfilled' ? calResult.value : null
  });
});

apiRouter.get(
  "/stock-master",
  apiResponseCache.middleware({ ttlMs: 60 * 60 * 1000, publicCache: true }),
  async (_req, res) => {
    res.json(getAllStockEntries());
  }
);

apiRouter.patch("/watchlists/:id/toggle", requireProOrAdmin, async (req, res) => {
  const uid = getReqUserId(req);
  if (typeof req.body?.isActive !== 'boolean') return res.status(400).json({ success: false, error: 'isActive must be a boolean.' });
  if (!await toggleWatchlist(req.params.id, req.body.isActive, uid)) return res.status(404).json({ success: false, error: 'Watchlist not found.' });
  syncWatchlistHistoricalData().catch(console.error);
  res.json({ success: true });
});

apiRouter.post("/watchlists/:id/symbols", requireProOrAdmin, async (req, res) => {
  const uid = getReqUserId(req);
  const { symbol, priority, category, scripCode, companyName } = req.body;
  const sym = typeof symbol === 'string' ? symbol.trim().toUpperCase() : '';
  if (sym.length > 60 || (scripCode != null && !/^\d{6}$/.test(String(scripCode))) || (companyName != null && (typeof companyName !== 'string' || companyName.length > 200))) return res.status(400).json({success:false,error:'Invalid company identity'});
  if (!sym) {
    return res.status(400).json({ success: false, error: "Symbol is required" });
  }

  await addSymbolToWatchlist(req.params.id, sym, priority || 'HIGH', category, uid, {scripCode: scripCode ? String(scripCode) : undefined, companyName: typeof companyName === 'string' ? companyName.trim() : undefined});
  invalidateMonitorConfigCache();
  // Instant single-stock sync for BOTH Announcements AND Results Calendar in parallel!
  Promise.allSettled([
    syncSingleStockHistoricalData(sym),
    syncSingleStockResultsCalendar(sym)
  ]).catch(console.error);
  res.json({ success: true });
});

apiRouter.patch("/watchlists/:id/symbols/:symbol/priority", requireProOrAdmin, async (req, res) => {
  const uid = getReqUserId(req);
  const { priority, category } = req.body;
  await updateSymbolPriorityInWatchlist(req.params.id, req.params.symbol, priority, category, uid);
  invalidateMonitorConfigCache();
  res.json({ success: true });
});

apiRouter.post("/watchlists/:id/symbols/bulk", requireProOrAdmin, async (req, res) => {
  const uid = getReqUserId(req);
  if (Array.isArray(req.body.symbols)) {
    const isAdminUser = (req as any).user?.isAdmin === true || uid === 'admin';
    const profile = uid !== 'guest' ? await getAccessProfile(uid, { durable: true }) : null;
    const isPro = isAdminUser || (profile?.tier === 'pro' && (!profile.proExpiresAt || profile.proExpiresAt > Date.now()));

    const cleanInputSymbols = req.body.symbols
      .map((item: any) => (typeof item === 'string' ? item : item?.symbol || '').trim().toUpperCase())
      .filter(Boolean);

    if (!isPro) {
      const existingLists = await getAllWatchlists(uid);
      const totalSymbols = new Set(
        existingLists.flatMap(l => (l.items || []).map((it: any) => (typeof it === 'string' ? it : it?.symbol || '').toUpperCase())).filter(Boolean)
      );

      const newSymbolsToAdd = cleanInputSymbols.filter((s: string) => !totalSymbols.has(s));
      if (totalSymbols.size + newSymbolsToAdd.length > 5) {
        return res.status(402).json({
          success: false,
          error: "Adding these stocks exceeds the Free Tier 5-stock limit. Upgrade to Pro for unlimited stocks.",
          upgradeRequired: true
        });
      }
    }

    await addSymbolsToWatchlist(req.params.id, req.body.symbols, uid);
    invalidateMonitorConfigCache();
    // Instant sync all newly added symbols in parallel without blocking UI
    cleanInputSymbols.forEach((sym: string) => {
      syncSingleStockHistoricalData(sym).catch(console.error);
      syncSingleStockResultsCalendar(sym).catch(console.error);
    });
  }
  res.json({ success: true });
});

apiRouter.get("/search-company", async (req, res) => {
  try {
    const rawQ = req.query.q;
    const q = typeof rawQ === 'string' ? rawQ.slice(0, 100).trim() : '';
    if (!q) {
      return res.json([]);
    }
    const results = await searchCompany(q);
    res.json(results);
  } catch (e) {
    res.json([]);
  }
});

apiRouter.get("/stock/resolve", async (req, res) => {
  try {
    const rawQ = req.query.q || req.query.symbol;
    const q = typeof rawQ === 'string' ? rawQ.slice(0, 100).trim() : '';
    if (!q) {
      return res.status(400).json({ error: "Missing query" });
    }
    const cleanSym = q.toUpperCase();
    let scrip = getScripCode(cleanSym) || (/^\d{6}$/.test(cleanSym) ? cleanSym : '');
    let name = cleanSym;
    let symbol = cleanSym;

    if (!scrip || !/^\d{6}$/.test(scrip)) {
      const dynamic = await resolveStockDetails(q);
      if (dynamic) {
        scrip = dynamic.scripCode || scrip;
        symbol = dynamic.symbol || symbol;
        name = dynamic.name || name;
      }
    }

    if (!scrip) {
      const list = await searchCompany(q);
      const match = list.find((it: any) => it.scripCode && /^\d{6}$/.test(it.scripCode)) || list[0];
      if (match) {
        scrip = match.scripCode || scrip;
        symbol = match.symbol || symbol;
        name = match.name || name;
      }
    }

    const cdnUrl = scrip && /^\d{6}$/.test(scrip)
      ? `https://assets-netstorage.groww.in/stock-assets/logos/GSTK${scrip}.png`
      : `https://assets-netstorage.groww.in/stock-assets/logos/${symbol}.png`;

    res.json({
      success: true,
      symbol,
      scripCode: scrip,
      name,
      logoUrl: cdnUrl
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

apiRouter.delete("/watchlists/:id/symbols/:symbol", requireProOrAdmin, async (req, res) => {
  const uid = getReqUserId(req);
  await removeSymbolFromWatchlist(req.params.id, req.params.symbol, uid);
  invalidateMonitorConfigCache();
  res.json({ success: true });
});

apiRouter.post("/watchlists/:id/symbols/remove-batch", requireProOrAdmin, async (req, res) => {
  try {
    const uid = getReqUserId(req);
    const symbols = Array.isArray(req.body.symbols) ? req.body.symbols : [];
    if (symbols.length > 0) {
      await removeSymbolsFromWatchlistBatch(req.params.id, symbols, uid);
      invalidateMonitorConfigCache();
    }
    res.json({ success: true, removedCount: symbols.length });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post("/watchlists/:id/symbols/priority-batch", requireProOrAdmin, async (req, res) => {
  try {
    const uid = getReqUserId(req);
    const updates = Array.isArray(req.body.updates) ? req.body.updates : [];
    if (updates.length > 0) {
      await updateSymbolsPriorityBatch(req.params.id, updates, uid);
      invalidateMonitorConfigCache();
    }
    res.json({ success: true, updatedCount: updates.length });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const handleToggleRoute = async (req: any, res: any) => {
  const isRunningVal = typeof req.body.isRunning === 'boolean'
    ? req.body.isRunning
    : typeof req.body.is_running === 'number'
      ? req.body.is_running === 1
      : Boolean(req.body.isRunning);

  await saveSettings({ isRunning: isRunningVal });
  await addLog(
    "INFO",
    "SYSTEM",
    isRunningVal ? "Monitoring started" : "Monitoring stopped",
  );
  res.json({ isRunning: isRunningVal, is_running: isRunningVal ? 1 : 0 });
};

apiRouter.post("/toggle", requireAdmin, handleToggleRoute);
apiRouter.post("/toggle-engine", requireAdmin, handleToggleRoute);

apiRouter.post("/test-telegram", requireAdmin, telegramRateLimiter, async (req, res) => {
  let { botToken, chatId } = req.body;
  const currentSettings = await getSettings();
  if (botToken === "•••••••••••••••••••••••••••••" || !botToken)
    botToken = currentSettings.botToken;

  const targetChatId = chatId || currentSettings.chatId;

  if (!botToken || !targetChatId) {
    return res.status(400).json({ success: false, error: "Bot Token and Channel/Chat ID are required" });
  }

  const result = await sendToTelegram(
    "👋 <b>Root Admin Test Message</b>\n\nYour global Telegram channel integration is working perfectly! Bsenexus Engine is ready.",
    targetChatId
  );
  if (result.success) {
    await addLog('SUCCESS', 'TELEGRAM', `Admin test message sent successfully to ${targetChatId}`);
    res.json({ success: true });
  } else {
    await addLog('ERROR', 'TELEGRAM', `Admin test message failed: ${result.error}`);
    res.status(500).json({ success: false, error: result.error });
  }
});

// Admin Push Notification Broadcast (OneSignal)
apiRouter.post("/admin/push/broadcast", requireAdmin, async (req, res) => {
  try {
    const { title, message, url } = req.body || {};
    if (!title || !message) {
      return res.status(400).json({ success: false, error: "Title and message are required." });
    }
    if (!isOneSignalConfigured()) {
      return res.status(400).json({
        success: false,
        error: "OneSignal is not configured with a valid REST API key. Configure ONESIGNAL_REST_API_KEY in the server environment."
      });
    }
    const result = await sendOneSignalPush({
      title: String(title).trim(),
      message: String(message).trim(),
      url: url ? String(url).trim() : 'https://bsenexus.in'
    });
    if (result.ok) {
      await addLog('SUCCESS', 'ONESIGNAL', `Admin broadcast push dispatched: "${title}" (recipients: ${result.recipients || 0})`);
      return res.json({ success: true, id: result.id, recipients: result.recipients });
    }
    return res.status(500).json({ success: false, error: result.error });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to dispatch broadcast push' });
  }
});

apiRouter.get("/push/status", async (_req, res) => {
  res.json({
    configured: isOneSignalConfigured(),
    appId: ONESIGNAL_APP_ID
  });
});

// Dedicated Personal Telegram Alert Test for Registered/Pro users (Does NOT touch global admin settings)
apiRouter.post("/users/test-telegram", requireProOrAdmin, telegramRateLimiter, async (req, res) => {
  try {
    const uid = getReqUserId(req);
    const { chatId } = req.body || {};
    const userProf = await getUserProfile(uid);
    const rawTargetChatId = (chatId && typeof chatId === 'string' && chatId.trim()) ? chatId.trim() : (userProf?.telegramChatId || '');

    if (!rawTargetChatId) {
      return res.status(400).json({ success: false, error: "Please enter your numerical Telegram Chat ID" });
    }

    const settings = await getSettings();
    const botToken = settings.botToken || process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return res.status(400).json({ 
        success: false, 
        error: "Global Telegram Bot is not configured by Admin yet. Please check back shortly." 
      });
    }

    const cleanChatId = await requireVerifiedTelegramTarget(uid, rawTargetChatId, settings.chatId || process.env.TELEGRAM_CHAT_ID);
    const userName = (req as any).user?.displayName || (req as any).user?.email?.split('@')[0] || userProf?.displayName || 'Trader';
    const isAiSummaryOn = userProf?.notificationPreferences?.telegramAiSummaryEnabled !== false;
    const isAlertsOn = userProf?.notificationPreferences?.telegramAlertsEnabled !== false;

    const testMsg = `👋 <b>Bsenexus Personal Alert Test</b>\n\nHello <b>${escapeHTML(userName)}</b>!\n\nYour personal Telegram test was <b>DELIVERED</b>.\n\n⚙️ <b>Current Configuration:</b>\n• Alert Status: ${isAlertsOn ? '🔔 <b>Active (ON)</b>' : '🔕 <b>Muted/Paused (OFF)</b>'}\n• Gemini AI Summary: ${isAiSummaryOn ? '✨ <b>Enabled (ON)</b>' : '⚡ <b>Disabled (Raw Filings Only)</b>'}\n\nYou will receive real-time corporate filings for your Watchlist stocks directly to this chat.\n\n🕒 <i>${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</i>`;

    const result = await sendToTelegram(testMsg, cleanChatId);
    if (result.success) {
      await addLog('SUCCESS', 'TELEGRAM', `Personal test alert delivered to user ${uid} (${cleanChatId})`);
      res.json({ success: true, messageId: result.messageId });
    } else {
      await addLog('ERROR', 'TELEGRAM', `Personal test alert failed for user ${uid} (${cleanChatId}): ${result.error}`);
      
      const botUser = getBotUsername();
      let friendlyError = result.error || "Could not deliver message to Telegram.";
      const errStr = (result.error || '').toLowerCase();
      if (errStr.includes('chat not found') || errStr.includes('bot was blocked') || errStr.includes('user is deactivated') || errStr.includes('chat_id is empty')) {
        friendlyError = `Telegram bot cannot reach your Chat ID yet. Telegram requires you to start the bot first: Please open @${botUser} on Telegram (or tap https://t.me/${botUser}), press "Start" (/start), then click "Send test alert" again!`;
      }

      res.status(400).json({ 
        success: false, 
        error: friendlyError 
      });
    }
  } catch (err: any) {
    res.status(err.status === 403 ? 403 : 500).json({ success: false, error: err.message });
  }
});

// Live Username Availability Check Endpoint (Real-time Cloud Check)
apiRouter.get("/users/check-username", async (req, res) => {
  try {
    const rawUsername = (req.query.username as string) || '';
    const currentUid = (req as any).user?.uid !== 'guest' ? (req as any).user?.uid : undefined;
    const userEmail = (req as any).user?.email || undefined;

    const check = await isUsernameAvailable(rawUsername, currentUid, userEmail);
    let suggestion: string | undefined = undefined;

    if (!check.available) {
      suggestion = await generateUniqueUsername(rawUsername, currentUid, userEmail);
    }

    res.json({
      success: true,
      available: check.available,
      cleanUsername: check.cleanUsername,
      reason: check.reason,
      suggestion
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// User Profile Management Endpoints (Isolated per UID with Strict Cloud Uniqueness)
apiRouter.get("/users/profile", requireAuth, async (req, res) => {
  try {
    const uid = getReqUserId(req);
    const userEmail = (req as any).user?.email;

    // Repair the paid-entitlement mirror before returning the profile. This
    // is deliberately read-only with respect to themes/preferences: it only
    // restores payment fields from durable payment sources.
    await reconcilePaymentEntitlement(uid);
    let profile = await getUserProfile(uid);

    // If profile exists but has no unique username, or is colliding, auto-assign one
    if (profile && !profile.username) {
      const base = profile.displayName || (userEmail ? userEmail.split('@')[0] : 'trader');
      const uniqueUsername = await generateUniqueUsername(base, uid, userEmail);
      profile = await saveUserProfile(uid, { username: uniqueUsername }, true);
    }

    if (!profile) {
      return res.status(404).json({
        success: false,
        profileMissing: true,
        error: 'Profile not found.',
      });
    }

    res.json({ success: true, profile: profile ? await getAccessProfile(uid, { durable: true }) : profile });
  } catch (err: any) {
    if (isPaymentStoreUnavailable(err)) {
      return res.status(503).json({
        success: false,
        profileUnavailable: true,
        error: 'Profile is temporarily unavailable. Please retry in a moment.',
      });
    }
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ---- Telegram Pro-gating helpers -------------------------------------------
// Live Pro/trial/admin check. Fail-closed: any profile-read failure => false.
// (The JWT `isPro` claim is never trusted — it goes stale when Pro expires.)
async function isProLikeUser(uid: string, isAdminUser: boolean): Promise<boolean> {
  if (isAdminUser) return true;

  // Paid entitlement is separate from the mutable profile. Check it first;
  // if the durable payment store is unavailable, propagate the failure so
  // callers return 503 rather than falsely treating a paid user as Free.
  const reconciled = await reconcilePaymentEntitlement(uid);
  if (reconciled.entitlement && reconciled.entitlement.proExpiresAt > Date.now()) {
    return true;
  }

  const p = await getAccessProfile(uid, { durable: true });
  if (!p) return false;
  const now = Date.now();
  return p.tier === 'admin' || Boolean(p.proExpiresAt && p.proExpiresAt > now);
}

const TELEGRAM_PRO_ERROR = "Telegram alerts are a Pro feature. Upgrade to Pro — one-time plans from ₹59 — to link Telegram and receive instant alerts.";

apiRouter.post("/users/profile", requireAuth, async (req, res) => {
  try {
    const uid = getReqUserId(req);
    const body = req.body || {};

    // Strict whitelist: displayName, username, telegramChatId, telegramUsername, notificationPreferences
    // Explicitly ignored: tier, proExpiresAt, email, maxWatchlistStocks, isAdmin, isOwner, uid
    const sanitizedPatch: Record<string, any> = {};

    if (body.displayName !== undefined) {
      sanitizedPatch.displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
    }
    if (body.username !== undefined) {
      sanitizedPatch.username = typeof body.username === 'string' ? body.username.trim() : '';
    }
    if (body.telegramChatId !== undefined) {
      sanitizedPatch.telegramChatId = typeof body.telegramChatId === 'string' ? body.telegramChatId.trim() : (body.telegramChatId === null ? null : undefined);
    }
    if (body.telegramUsername !== undefined) {
      sanitizedPatch.telegramUsername = typeof body.telegramUsername === 'string' ? body.telegramUsername.trim() : (body.telegramUsername === null ? null : undefined);
    }
    if (body.muteInAppNotifications !== undefined) {
      sanitizedPatch.muteInAppNotifications = Boolean(body.muteInAppNotifications);
    }
    if (body.notificationPreferences !== undefined && typeof body.notificationPreferences === 'object' && body.notificationPreferences !== null) {
      // SECURITY (1 Oct 2026 audit): Strict field whitelist for notificationPreferences.
      // Previously the entire client-supplied object was passed through — a malicious
      // client could inject arbitrary fields that would land in the users/<uid> doc.
      // Now we keep ONLY the known, type-safe fields from UserNotificationPreferences.
      // Any unknown key is silently dropped.
      const rawNp = body.notificationPreferences as Record<string, any>;
      const cleanedNp: Record<string, any> = {};
      // Boolean toggles
      const booleanKeys = [
        'resultsAndEarnings', 'orderWinsAndExpansion', 'dividendsAndBonus',
        'acquisitionsAndMergers', 'creditRatings', 'muteRoutineFilings',
        'muteInAppNotifications', 'stocksHighPriority', 'stocksMediumPriority',
        'stocksLowPriority', 'concallsAndInvestorMeets', 'boardMeetingsAndOutcomes',
        'insiderTradingAndSAST', 'creditRatingChanges', 'annualReportsAndAudits',
        'telegramNewsAlerts', 'telegramAlertsEnabled', 'telegramAiSummaryEnabled', 'adrAlertsEnabled', 'storyNavigationButtons',
      ];
      for (const k of booleanKeys) {
        if (k in rawNp && typeof rawNp[k] === 'boolean') cleanedNp[k] = rawNp[k];
      }
      // String array fields
      if (Array.isArray(rawNp.telegramNewsSources)) {
        cleanedNp.telegramNewsSources = rawNp.telegramNewsSources.filter((s: any) => typeof s === 'string').slice(0, 50);
      }
      if (Array.isArray(rawNp.telegramNewsCategories)) {
        cleanedNp.telegramNewsCategories = rawNp.telegramNewsCategories.filter((s: any) => typeof s === 'string').slice(0, 50);
      }
      // Enum fields with strict validation
      if (rawNp.telegramAlertScope === 'WATCHLIST_ONLY' || rawNp.telegramAlertScope === 'ALL_MARKET') {
        cleanedNp.telegramAlertScope = rawNp.telegramAlertScope;
      }
      if (rawNp.aiSummaryLang === 'hinglish' || rawNp.aiSummaryLang === 'english') {
        cleanedNp.aiSummaryLang = rawNp.aiSummaryLang;
      }
      if (rawNp.designTheme === 'classic' || rawNp.designTheme === 'softglass') {
        cleanedNp.designTheme = rawNp.designTheme;
      }
      if (rawNp.alertPriority === 'HIGH_ONLY' || rawNp.alertPriority === 'HIGH_MEDIUM' || rawNp.alertPriority === 'ALL') {
        cleanedNp.alertPriority = rawNp.alertPriority;
      }
      if (rawNp.alertScope === 'WATCHLIST_ONLY' || rawNp.alertScope === 'ALL_MARKET') {
        cleanedNp.alertScope = rawNp.alertScope;
      }
      if (rawNp.alertCategory === 'ALL' || rawNp.alertCategory === 'RESULTS_ONLY' || rawNp.alertCategory === 'RESULTS_AND_CONCALLS' || rawNp.alertCategory === 'RESULTS_AND_MATERIAL') {
        cleanedNp.alertCategory = rawNp.alertCategory;
      }
      sanitizedPatch.notificationPreferences = cleanedNp;
    }

    // Telegram is Pro-only: block link/enable attempts here too, so the
    // client fallback from /users/telegram/settings can't bypass the gate.
    // Unlinking (null chat id) and language-only changes stay allowed.
    const np = (sanitizedPatch.notificationPreferences || {}) as any;
    const tgPatch = {
      telegramChatId: sanitizedPatch.telegramChatId,
      telegramAlertsEnabled: np.telegramAlertsEnabled,
      telegramAiSummaryEnabled: np.telegramAiSummaryEnabled,
      telegramAlertScope: np.telegramAlertScope,
      telegramNewsAlerts: np.telegramNewsAlerts,
    };
    let existingForGate = null;
    try {
      existingForGate = await getUserProfile(uid, { durable: true });
    } catch (gateErr: any) {
      if (isPaymentStoreUnavailable(gateErr)) {
        return res.status(503).json({
          success: false,
          profileUnavailable: true,
          error: 'Profile is temporarily unavailable. Please retry in a moment.',
        });
      }
      throw gateErr;
    }
    if (wantsTelegramEnable(tgPatch, existingForGate)) {
      const proLike = await isProLikeUser(uid, (req as any).user?.isAdmin === true);
      if (!proLike) {
        return res.status(403).json({ success: false, proRequired: true, error: TELEGRAM_PRO_ERROR });
      }
    }

    if (sanitizedPatch.telegramChatId) {
      const settings = await getSettings();
      sanitizedPatch.telegramChatId = await requireVerifiedTelegramTarget(uid, sanitizedPatch.telegramChatId, settings.chatId || process.env.TELEGRAM_CHAT_ID);
    } else if (sanitizedPatch.telegramChatId === null || sanitizedPatch.telegramChatId === '') {
      await telegramLinkCommand('unlink', uid);
    }
    const updatedProfile = await saveUserProfile(uid, { ...sanitizedPatch, uid }, false, { durable: true });
    invalidateMonitorConfigCache(uid);
    res.json({ success: true, profile: await getAccessProfile(uid, { durable: true }) });
  } catch (err: any) {
    if (isPaymentStoreUnavailable(err)) {
      return res.status(503).json({
        success: false,
        profileUnavailable: true,
        error: 'Profile could not be saved right now. Please retry in a moment.',
      });
    }
    if (err.code === 'USERNAME_UNAVAILABLE') {
      return res.status(409).json({ 
        success: false, 
        error: err.message, 
        code: 'USERNAME_UNAVAILABLE',
        suggestion: err.suggestion 
      });
    }
    return res.status(err.status === 403 ? 403 : 500).json({ success: false, error: err.message });
  }
});

// Dedicated User Telegram Settings Management (Toggle, AI Summary, Disconnect/Unlink, Scope)
// Telegram is a PRO-ONLY feature. Anyone may unlink, and anyone may change
// just the AI summary language — but linking / enabling Telegram requires Pro.
apiRouter.post("/users/telegram/settings", requireAuth, async (req, res) => {
  try {
    const uid = getReqUserId(req);
    const {
      telegramChatId,
      telegramUsername,
      telegramAlertsEnabled,
      telegramAiSummaryEnabled,
      telegramAlertScope,
      aiSummaryLang,
      unlink
    } = req.body || {};

    let existingProfile = null;
    try {
      existingProfile = await getUserProfile(uid, { durable: true });
    } catch (profileErr: any) {
      if (isPaymentStoreUnavailable(profileErr)) {
        return res.status(503).json({
          success: false,
          profileUnavailable: true,
          error: 'Profile is temporarily unavailable. Please retry in a moment.',
        });
      }
      throw profileErr;
    }
    const currentPrefs = existingProfile?.notificationPreferences || ({} as any);

    // Change-based gate: linking a chat id or flipping any Telegram toggle /
    // scope requires Pro. Language-only saves (which echo unchanged prefs)
    // and unlinking stay open to everyone.
    if (!unlink && wantsTelegramEnable(
      { telegramChatId, telegramAlertsEnabled, telegramAiSummaryEnabled, telegramAlertScope },
      existingProfile
    )) {
      const proLike = await isProLikeUser(uid, (req as any).user?.isAdmin === true);
      if (!proLike) {
        return res.status(403).json({
          success: false,
          proRequired: true,
          error: TELEGRAM_PRO_ERROR
        });
      }
    }

    const cleanSummaryLang = aiSummaryLang === 'english' ? 'english' : aiSummaryLang === 'hinglish' ? 'hinglish' : undefined;

    const updatedPrefs = {
      ...currentPrefs,
      ...(telegramAlertsEnabled !== undefined ? { telegramAlertsEnabled: Boolean(telegramAlertsEnabled) } : {}),
      ...(telegramAiSummaryEnabled !== undefined ? { telegramAiSummaryEnabled: Boolean(telegramAiSummaryEnabled) } : {}),
      ...(telegramAlertScope !== undefined ? { telegramAlertScope: telegramAlertScope } : {}),
      ...(cleanSummaryLang !== undefined ? { aiSummaryLang: cleanSummaryLang } : {}),
    };

    const patch: Record<string, any> = {
      notificationPreferences: updatedPrefs,
      uid
    };

    if (unlink) {
      patch.telegramChatId = null;
      patch.telegramUsername = null;
      updatedPrefs.telegramAlertsEnabled = false;
    } else {
      if (telegramChatId !== undefined) {
        patch.telegramChatId = typeof telegramChatId === 'string' ? telegramChatId.trim() : (telegramChatId === null ? null : undefined);
      }
      if (telegramUsername !== undefined) {
        patch.telegramUsername = typeof telegramUsername === 'string' ? telegramUsername.trim().replace(/^@/, '') : (telegramUsername === null ? null : undefined);
      }
    }

    if (patch.telegramChatId) {
      const settings = await getSettings();
      patch.telegramChatId = await requireVerifiedTelegramTarget(uid, patch.telegramChatId, settings.chatId || process.env.TELEGRAM_CHAT_ID);
    } else if (unlink || patch.telegramChatId === null || patch.telegramChatId === '') {
      await telegramLinkCommand('unlink', uid);
    }
    const updatedProfile = await saveUserProfile(uid, patch, false, { durable: true });
    invalidateMonitorConfigCache(uid);

    res.json({
      success: true,
      profile: await getAccessProfile(uid, { durable: true }),
      telegramChatId: updatedProfile.telegramChatId,
      telegramAlertsEnabled: updatedProfile.notificationPreferences?.telegramAlertsEnabled !== false,
      telegramAiSummaryEnabled: updatedProfile.notificationPreferences?.telegramAiSummaryEnabled !== false,
      telegramAlertScope: updatedProfile.notificationPreferences?.telegramAlertScope || 'WATCHLIST_ONLY',
      aiSummaryLang: updatedProfile.notificationPreferences?.aiSummaryLang || 'english'
    });
  } catch (err: any) {
    if (isPaymentStoreUnavailable(err)) {
      return res.status(503).json({
        success: false,
        profileUnavailable: true,
        error: 'Profile is temporarily unavailable. Please retry in a moment.',
      });
    }
    return res.status(err.status === 403 ? 403 : 500).json({ success: false, error: err.message });
  }
});

apiRouter.post("/test-bse", requireAdmin, async (req, res) => {
  const testRes = await testBSEConnection();
  if (!testRes.success) {
    await addLog('ERROR', 'BSE', `Test BSE fetch failed: ${testRes.error || "No data returned"}`);
    return res.status(500).json({ success: false, error: testRes.error || "No data returned from BSE." });
  }

  const companyName = testRes.company;
  await addLog('SUCCESS', 'BSE', `Test BSE fetch successful. Latest record: ${companyName}`);

  // Try sending test alert to Telegram if token is set
  try {
    await sendToTelegram(`🛠️ <b>BSE FETCH TEST</b>\n\nSuccessfully connected to BSE India!\nLatest Record: <b>${escapeHTML(companyName)}</b>`);
  } catch (e) {
    // Ignore telegram notification error during BSE test
  }

  res.json({ success: true, company: companyName });
});

apiRouter.patch("/watchlists/:id/name", requireProOrAdmin, async (req, res) => {
  const uid = getReqUserId(req);
  if (typeof req.body?.name !== 'string' || !req.body.name.trim() || req.body.name.trim().length > 100) return res.status(400).json({ success: false, error: 'Watchlist name must contain 1–100 characters.' });
  if (!await renameWatchlist(req.params.id, req.body.name, uid)) return res.status(404).json({ success: false, error: 'Watchlist not found.' });
  res.json({ success: true });
});

apiRouter.post("/send-to-telegram-manual", requireAdmin, telegramRateLimiter, async (req, res) => {
  try {
    const { newsId, companyName, subject, details, category, pdfLink, attachmentUrl, scripCode, calendarUrl } = req.body;
    if (!isBseFiling({ newsId, pdfLink: pdfLink || attachmentUrl })) return res.status(400).json({ success: false, error: 'Telegram filing alerts use BSE filings only.' });

    if (!companyName || !subject) {
      return res.status(400).json({ success: false, error: "Missing required announcement fields" });
    }

    const effectivePdf = sanitizeSafeUrl(pdfLink || attachmentUrl || '');
    const safeCalendarUrl = sanitizeSafeUrl(calendarUrl);
    const formattedDate = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    let messageText = `⚡ <b>MANUAL ALERT: ${escapeHTML(companyName)}</b>\n\n`;
    messageText += `📌 <b>Subject:</b> ${escapeHTML(subject)}\n`;
    if (scripCode) {
      messageText += `🔢 <b>Scrip Code:</b> <code>${escapeHTML(scripCode)}</code>\n`;
    }
    if (details) {
      messageText += `📝 <b>Details:</b> ${escapeHTML(details.length > 300 ? details.substring(0, 300) + '...' : details)}\n`;
    }
    if (safeCalendarUrl) {
      messageText += `\n📅 <b>Calendar Event:</b> <a href="${escapeHTML(safeCalendarUrl)}">Add to Google Calendar (1-Click)</a>\n`;
    }
    if (effectivePdf) {
      messageText += `\n📄 <a href="${escapeHTML(effectivePdf)}">View Attachment (PDF)</a>\n`;
    }
    messageText += `\n🕒 <i>${formattedDate}</i>`;

    const telegramRes = await sendToTelegram(messageText);

    if (!telegramRes.success || !telegramRes.messageId) {
      await addLog('ERROR', 'TELEGRAM', `Manual send failed for ${companyName}: ${telegramRes.error || 'Unknown error'}`);
      return res.status(500).json({ success: false, error: telegramRes.error || "Failed to send to Telegram. Please check Bot Token & Chat ID in Config." });
    }

    const messageId = telegramRes.messageId;
    if (newsId) {
      await markAnnouncementSent(newsId, messageId);
    }
    await addLog('SUCCESS', 'TELEGRAM', `Manual alert sent to Telegram for ${companyName}`);

    // Trigger AI summary generation & send as reply automatically if requested
    const shouldSendAi = req.body.includeAiSummary !== undefined ? Boolean(req.body.includeAiSummary) : true;
    if (shouldSendAi && category === 'RESULTS') {
      generateAndSendSummary(messageId, companyName, subject, details || '', category || 'OTHER', effectivePdf || '', newsId, undefined, 'english', scripCode)
        .catch(err => addLog('ERROR', 'GEMINI', `Manual AI summary send error: ${err.message}`));
    }

    res.json({ success: true, messageId });
  } catch (err: any) {
    await addLog('ERROR', 'TELEGRAM', `Manual send exception: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post("/send-holiday-telegram", requireAdmin, telegramRateLimiter, async (req, res) => {
  try {
    const { name, date, day, isMuhuratTrading, muhuratTiming, description, calendarUrl } = req.body;
    if (!name || !date) {
      return res.status(400).json({ success: false, error: "Missing holiday name or date" });
    }

    const safeCalendarUrl = sanitizeSafeUrl(calendarUrl);

    let messageText = `🏖️ <b>MARKET HOLIDAY ALERT (BSE / NSE INDIA)</b>\n\n`;
    messageText += `🏛️ <b>Holiday:</b> ${escapeHTML(name)}\n`;
    messageText += `📅 <b>Date:</b> ${escapeHTML(date)} (${escapeHTML(day || 'Exchange Closed')})\n\n`;
    messageText += `🛑 <b>Market Status:</b> Trading is CLOSED for Capital Market (Equities), Derivatives (F&O), and Currency Segments.\n`;
    
    if (isMuhuratTrading) {
      messageText += `\n🪔 <b>Special Session:</b> Diwali Muhurat Trading will take place!\n⏰ <b>Timing:</b> ${escapeHTML(muhuratTiming || '06:15 PM - 07:15 PM IST')}\n`;
    }
    
    messageText += `\n⚡ <b>F&O Expiry Note:</b> Any derivative contracts scheduled to expire on this day will expire on the preceding trading day.\n`;
    
    if (safeCalendarUrl) {
      messageText += `\n📅 <b>Calendar Event:</b> <a href="${escapeHTML(safeCalendarUrl)}">Add Holiday to Google Calendar (1-Click)</a>\n`;
    }
    
    const formattedDate = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    messageText += `\n🕒 <i>Broadcasted via Bsenexus • ${formattedDate}</i>`;

    const telegramRes = await sendToTelegram(messageText);
    if (!telegramRes.success) {
      return res.status(500).json({ success: false, error: telegramRes.error || "Failed to broadcast holiday to Telegram" });
    }

    await addLog('SUCCESS', 'TELEGRAM', `Market Holiday alert broadcasted to Telegram: ${name} (${date})`);
    res.json({ success: true, messageId: telegramRes.messageId });
  } catch (err: any) {
    await addLog('ERROR', 'TELEGRAM', `Holiday broadcast error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.get("/results-calendar", async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'private, no-store');
    const filter = (req.query.filter as string || "all") as 'all' | 'today' | 'upcoming' | 'recent';
    const watchlistId = req.query.watchlistId as string;
    const scope = req.query.scope === undefined ? 'watchlist' : parseCalendarScope(req.query.scope);
    if (!scope) return res.status(400).json({ error: 'Invalid calendar scope' });
    const uid = getReqUserId(req);
    const data = await getResultsCalendarData(filter, watchlistId, uid, scope);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post("/results-calendar/refresh", requireAuth, aiRateLimiter, async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'private, no-store');
    const mode = (req.query.mode as string) || req.body?.mode;
    const filter = (req.query.filter as string || "all") as 'all' | 'today' | 'upcoming' | 'recent';
    const watchlistId = req.query.watchlistId as string;
    const scope = req.query.scope === undefined ? 'watchlist' : parseCalendarScope(req.query.scope);
    if (!scope) return res.status(400).json({ error: 'Invalid calendar scope' });
    const uid = getReqUserId(req);

    if (mode === 'full') {
      if (!(req as any).user?.isAdmin) return res.status(403).json({ success: false, error: 'Full system sync requires administrator access' });
      // Run full 200+ stock library scan in background non-blocking
      fetchAndSyncResultsCalendar(true).catch(console.error);
      const data = await getResultsCalendarData(filter, watchlistId, uid, scope);
      return res.json({ 
        success: true, 
        background: true, 
        message: "Full background sync initiated across all library stocks", 
        ...data 
      });
    }

    // Quick / Standard refresh: updates cache and declaration matching quickly (<1s)
    await fetchAndSyncResultsCalendar(false);
    const data = await getResultsCalendarData(filter, watchlistId, uid, scope);
    res.json({ success: true, ...data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post("/results-calendar/telegram-broadcast", requireAdmin, telegramRateLimiter, async (req, res) => {
  try {
    const forceAll = Boolean(req.body?.forceAll);
    const result = await broadcastUpcomingMeetingsToTelegram({ forceAll });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// Dynamic Live Market Story Feed Route
// ==========================================
apiRouter.get('/market/adr', createAdrHandler(getAdrSnapshot));

apiRouter.get("/story/feed", async (_req, res) => {
  try {
    res.setHeader('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');
    const feed = await getLiveStoryFeed();
    res.json({ success: true, ...feed });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// Multi-Source Stock News & 24/7 Telegram Alert Routes
// ==========================================
apiRouter.get(["/news", "/news/general"], async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');
    const force = req.query.refresh === 'true';
    const source = req.query.source as string;
    const items = await fetchGeneralMarketNews(force, source);
    res.json({ success: true, count: items.length, items });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.get("/news/watchlist", async (req, res) => {
  try {
    const uid = getReqUserId(req);
    const source = req.query.source as string;
    const result = await getWatchlistNews(uid, source);
    res.json({ success: true, count: result.items.length, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.get(
  "/news/sources",
  apiResponseCache.middleware({ ttlMs: 60 * 60 * 1000, publicCache: true }),
  async (_req, res) => {
    try {
      const uniqueSources = [
        { name: 'Economic Times', slug: 'et', logo: 'ET', feedsCount: 5, color: '#C026D3' },
        { name: 'LiveMint', slug: 'mint', logo: 'Mint', feedsCount: 4, color: '#EA580C' },
        { name: 'Moneycontrol', slug: 'moneycontrol', logo: 'MC', feedsCount: 4, color: '#0284C7' },
        { name: 'Business Standard', slug: 'bs', logo: 'BS', feedsCount: 3, color: '#DC2626' }
      ];
      res.json({ success: true, sources: uniqueSources, totalFeeds: NEWS_FEEDS.length });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

apiRouter.get("/news/stock/:symbol", async (req, res) => {
  try {
    const symbol = req.params.symbol;
    const company = req.query.company as string;
    const items = await fetchStockSpecificNews(symbol, company);
    res.json({ success: true, symbol, count: items.length, items });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post("/news/summarize", requireAuth, aiRateLimiter, async (req, res) => {
  // Hoisted for the catch block: release the free-demo claim + refund quota on ANY throw.
  let uid = '';
  let isAdminUser = false;
  let isFreeDemo = false;
  let quotaConsumed = false;
  let quotaReservationId: string | undefined;
  try {
    const { title, snippet, source, symbol, companyName, link } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, error: "News title required" });
    }
    uid = getReqUserId(req);
    isAdminUser = (req as any).user?.isAdmin === true;

    // Reject unauthenticated guests immediately to safeguard Gemini API
    if (!uid || uid === 'guest' || uid.startsWith('guest_') || uid.startsWith('trader_')) {
      return res.status(401).json({
        success: false,
        authRequired: true,
        error: "Google Sign-In Required: Sign in with Google to get 1 week (7 days) of Free Pro AI summaries."
      });
    }

    // Pro / active-trial check against the LIVE profile (fail-closed; never trusts the JWT claim)
    const isProLike = await isProLikeUser(uid, isAdminUser);

    // FREE PLAN: exactly ONE AI summary demo, one time ever — shared with the
    // disclosure summary demo (same atomic server-side flag).
    let consumed = { remaining: 0, dailyLimit: 1, isPro: false };
    if (!isProLike) {
      const won = await claimFreeSummaryDemo(uid);
      if (!won) {
        return res.status(403).json({
          success: false,
          demoUsed: true,
          upgradeRequired: true,
          error: "You've used your one free AI summary demo. Upgrade to Pro — one-time plans from ₹59 — for 100 AI summaries/day."
        });
      }
      isFreeDemo = true; // released below if generation fails
    } else {
      // LOGIC-002 fix (1 Oct 2026 audit): Atomically check+consume BEFORE generation.
      // Previously used check-then-generate-then-consume which had a race where
      // N concurrent requests all passed the check, all generated, all consumed.
      // Now consume atomically up-front; refund if generation fails.
      const quotaCheck = await checkAndConsumeServerAiQuota(uid, isAdminUser);
      if (!quotaCheck.allowed) {
        return res.status(429).json({
          success: false,
          error: quotaCheck.error || "Daily AI summary quota reached.",
          upgradeRequired: true,
          remainingQuota: 0,
          dailyLimit: quotaCheck.dailyLimit
        });
      }
      consumed = { remaining: quotaCheck.remaining, dailyLimit: quotaCheck.dailyLimit, isPro: quotaCheck.isPro };
      quotaReservationId = quotaCheck.reservationId;
      quotaConsumed = true;
    }

    const companyTarget = companyName || (symbol ? `${symbol}` : (source || "Market News"));
    const details = `${snippet || title}\n\nPublisher: ${source || 'Financial Media'}\nArticle URL: ${link || ''}`;
    let summary: string | null = null;
    try {
      summary = await generateDirectSummary(companyTarget, title, details, 'NEWS');
    } catch (genErr: any) {
      throw genErr; // The outer catch owns cleanup.
    }

    if (!summary) {
      if (quotaConsumed) { try { await refundServerAiQuota(uid, isAdminUser, quotaReservationId); } catch {} }
      if (isFreeDemo) { try { await releaseFreeSummaryDemo(uid); } catch {} }
      return res.status(500).json({ success: false, error: "Gemini AI was unable to summarize this news story." });
    }

    completeServerAiQuotaReservation(quotaReservationId);
    // Quota was already consumed atomically above; nothing more to burn.
    res.json({
      success: true,
      aiSummary: summary,
      remainingQuota: consumed.remaining,
      dailyLimit: consumed.dailyLimit,
      isPro: consumed.isPro
    });
  } catch (err: any) {
    // Generation threw — release the free demo claim + refund quota so the user can retry it
    if (isFreeDemo) { try { await releaseFreeSummaryDemo(uid); } catch {} }
    if (quotaConsumed) { try { await refundServerAiQuota(uid, isAdminUser, quotaReservationId); } catch {} }
    // Payment-store outage must never silently treat a paid user as Free.
    if (isPaymentStoreUnavailable(err)) {
      return res.status(503).json({
        success: false,
        error: "Couldn't verify your subscription right now. Please retry in a moment."
      });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post("/news/telegram/send", requireProOrAdmin, telegramRateLimiter, async (req, res) => {
  try {
    const { newsItem, chatId } = req.body;
    if (!newsItem || !newsItem.title) {
      return res.status(400).json({ success: false, error: "News item payload required" });
    }
    let destination = chatId;
    if ((req as any).user?.isAdmin !== true) {
      const [profile, settings] = await Promise.all([getUserProfile(getReqUserId(req)), getSettings()]);
      try { destination = await requireVerifiedTelegramTarget(getReqUserId(req), resolvePersonalTelegramTarget(profile?.telegramChatId, chatId, settings.chatId || process.env.TELEGRAM_CHAT_ID), settings.chatId || process.env.TELEGRAM_CHAT_ID); }
      catch (error: any) { return res.status(403).json({ success: false, error: error.message }); }
    }
    const result = await sendNewsToTelegram(newsItem, destination);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post("/news/telegram/digest", requireProOrAdmin, telegramRateLimiter, async (req, res) => {
  try {
    const uid = getReqUserId(req);
    const { chatId } = req.body;
    let destination = chatId;
    if ((req as any).user?.isAdmin !== true) {
      const [profile, settings] = await Promise.all([getUserProfile(uid), getSettings()]);
      try { destination = await requireVerifiedTelegramTarget(getReqUserId(req), resolvePersonalTelegramTarget(profile?.telegramChatId, chatId, settings.chatId || process.env.TELEGRAM_CHAT_ID), settings.chatId || process.env.TELEGRAM_CHAT_ID); }
      catch (error: any) { return res.status(403).json({ success: false, error: error.message }); }
    }
    const result = await sendWatchlistNewsDigestToTelegram(uid, destination);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get or Set 24/7 Cloud Telegram News Alert Preferences
apiRouter.get("/news/telegram/preferences", async (req, res) => {
  try {
    const uid = getReqUserId(req);
    if (uid && uid !== 'anonymous') {
      const user = await getUserProfile(uid);
      if (user) {
        const prefs = user.notificationPreferences || ({} as any);
        return res.json({
          success: true,
          enabled: prefs.telegramNewsAlerts !== false,
          sources: prefs.telegramNewsSources || ['Economic Times', 'LiveMint', 'Moneycontrol', 'Business Standard'],
          categories: prefs.telegramNewsCategories || ['all']
        });
      }
    }
    const settings = await getSettings();
    res.json({
      success: true,
      enabled: settings.autoTelegramNews !== false,
      sources: settings.telegramNewsSources || ['Economic Times', 'LiveMint', 'Moneycontrol', 'Business Standard'],
      categories: settings.telegramNewsCategories || ['all']
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Toggle 24/7 Cloud Automated News Alerts & Categories for the user
apiRouter.post("/news/telegram/toggle-auto", requireAuth, async (req, res) => {
  try {
    const uid = getReqUserId(req);
    const { enabled, sources, categories } = req.body;

    if (uid && uid !== 'anonymous') {
      const user = await getAccessProfile(uid, { durable: true });
      if (user) {
        // Telegram is PRO-ONLY for enabling/configuring, but DISABLING must
        // always be allowed — even for expired/free users (kill-switch rule).
        const proActive = Boolean(user.tier === 'admin' || (user.proExpiresAt && user.proExpiresAt > Date.now()));
        const wantsEnable = enabled === true;
        if (!proActive && wantsEnable) {
          return res.status(403).json({ success: false, proRequired: true, error: TELEGRAM_PRO_ERROR });
        }
        const prefs = user.notificationPreferences || ({} as any);
        if (enabled !== undefined) prefs.telegramNewsAlerts = enabled === true;
        // Non-Pro users may only turn OFF; source/category configuration
        // stays a Pro-only action.
        if (proActive) {
          if (Array.isArray(sources)) prefs.telegramNewsSources = sources;
          if (Array.isArray(categories)) prefs.telegramNewsCategories = categories;
        }
        
        await saveUserProfile(uid, { notificationPreferences: prefs });
        return res.json({
          success: true,
          enabled: prefs.telegramNewsAlerts,
          sources: prefs.telegramNewsSources,
          categories: prefs.telegramNewsCategories
        });
      }
    }

    // Fallback to global settings — admin only
    if (!(req as any).user?.isAdmin) {
      return res.status(403).json({ success: false, error: "Admin access required." });
    }
    const settings = await getSettings();
    await saveSettings({
      autoTelegramNews: enabled !== undefined ? enabled === true : settings.autoTelegramNews,
      telegramNewsSources: Array.isArray(sources) ? sources : settings.telegramNewsSources,
      telegramNewsCategories: Array.isArray(categories) ? categories : settings.telegramNewsCategories
    });

    res.json({
      success: true,
      enabled: enabled === true,
      sources: Array.isArray(sources) ? sources : settings.telegramNewsSources,
      categories: Array.isArray(categories) ? categories : settings.telegramNewsCategories
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Trigger immediate manual check of automated news worker (admin only — it dispatches real Telegram messages)
apiRouter.post("/news/telegram/trigger-worker", requireAdmin, async (_req, res) => {
  try {
    const result = await processAutomatedNewsAlerts();
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Storage and Quota Management Endpoints (Admin Protected)
apiRouter.get("/storage/status", requireAdmin, async (req, res) => {
  try {
    const report = await getStorageStatusReport();
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post("/storage/cleanup", requireAdmin, async (req, res) => {
  try {
    const result = await runAutoStorageCleanup(true);
    const report = await getStorageStatusReport();
    res.json({ success: true, ...result, report });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post("/storage/test-alert", requireAdmin, async (req, res) => {
  try {
    const level = parseInt(req.body.level) || 50;
    if (level !== 50 && level !== 90 && level !== 100) {
      return res.status(400).json({ success: false, error: "Invalid level. Must be 50, 90, or 100." });
    }
    const result = await triggerManualTestStorageAlert(level as 50 | 90 | 100);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Storage Quota Mode Controls (Automatic vs Manual Override)
apiRouter.get("/storage/quota-mode", requireAdmin, (req, res) => {
  const mode = getManualStorageMode();
  const isQuotaExceeded = isFirestoreQuotaExceeded();
  const isPermissionDenied = isAdminPermissionDenied();
  res.json({
    mode,
    isQuotaExceeded,
    isPermissionDenied,
    effectiveStorage: (isQuotaExceeded || isPermissionDenied) ? 'LOCAL_JSON' : 'FIRESTORE'
  });
});

apiRouter.post("/storage/quota-mode", requireAdmin, async (req, res) => {
  const { mode } = req.body;
  if (mode !== 'AUTO' && mode !== 'FORCE_LOCAL' && mode !== 'FORCE_FIRESTORE') {
    return res.status(400).json({ success: false, error: "Invalid storage mode" });
  }
  setManualStorageMode(mode);
  // Mirror the choice into Firestore so a republish/restart cannot silently
  // reset the admin's manual switch back to AUTO.
  void persistStorageMode(mode);
  if (mode === 'FORCE_FIRESTORE' || mode === 'AUTO') {
    resetAdminPermissionDenied();
    await resumeFirestoreNetwork();
  } else if (mode === 'FORCE_LOCAL') {
    await pauseFirestoreNetwork();
  }
  await addLog('INFO', 'STORAGE', `Storage quota mode manually set to ${mode}`);
  res.json({
    success: true,
    mode: getManualStorageMode(),
    isQuotaExceeded: isFirestoreQuotaExceeded(),
    isPermissionDenied: isAdminPermissionDenied(),
    effectiveStorage: (isFirestoreQuotaExceeded() || isAdminPermissionDenied()) ? 'LOCAL_JSON' : 'FIRESTORE'
  });
});

apiRouter.post("/storage/reset-quota", requireAdmin, async (req, res) => {
  resetQuotaExceededFlag();
  resetAdminPermissionDenied();
  await resumeFirestoreNetwork();
  await addLog('INFO', 'STORAGE', 'Firestore quota and permission denial flags reset manually by admin. Firestore network resumed.');
  res.json({
    success: true,
    isQuotaExceeded: isFirestoreQuotaExceeded(),
    isPermissionDenied: isAdminPermissionDenied(),
    effectiveStorage: (isFirestoreQuotaExceeded() || isAdminPermissionDenied()) ? 'LOCAL_JSON' : 'FIRESTORE'
  });
});

apiRouter.post("/storage/reset-permission", requireAdmin, async (req, res) => {
  resetAdminPermissionDenied();
  await resumeFirestoreNetwork();
  await addLog('INFO', 'STORAGE', 'Firestore permission denied flag reset manually by admin. Re-enabling Firestore connection attempts.');
  res.json({
    success: true,
    isQuotaExceeded: isFirestoreQuotaExceeded(),
    isPermissionDenied: isAdminPermissionDenied(),
    effectiveStorage: (isFirestoreQuotaExceeded() || isAdminPermissionDenied()) ? 'LOCAL_JSON' : 'FIRESTORE'
  });
});

// Admin Percentage Disclosure Pruning with Safe Floor (Admin PIN protected)
apiRouter.post("/admin/announcements/prune-percentage", requireAdmin, async (req, res) => {
  try {
    const { percentage, pin } = req.body;
    const settings = await getSettings();

    // Verify Admin PIN if configured
    if (settings.appPinHash) {
      if (!pin) {
        return res.status(401).json({ success: false, error: "Admin PIN is required to prune disclosures" });
      }
      const match = await bcrypt.compare(String(pin), settings.appPinHash);
      if (!match) {
        return res.status(403).json({ success: false, error: "Invalid Admin PIN" });
      }
    }

    const pctNum = parseInt(percentage, 10);
    if (isNaN(pctNum) || pctNum < 5 || pctNum > 90) {
      return res.status(400).json({ success: false, error: "Percentage must be between 5% and 90%" });
    }

    // Min floor of at least 100 recent live disclosures + 100% of watchlist results
    const result = await pruneAnnouncementsByPercentage(pctNum, 100);
    const report = await getStorageStatusReport();
    res.json({ success: true, ...result, report });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Stock Results & Historical Earnings Disclosures
apiRouter.get("/stock-results-history", async (req, res) => {
  try {
    const symbol = (req.query.symbol as string) || '';
    const scripCode = (req.query.scripCode as string) || '';
    const companyName = (req.query.companyName as string) || '';
    
    if (!symbol && !scripCode && !companyName) {
      return res.status(400).json({ error: "Missing symbol or scripCode" });
    }
    res.setHeader('Cache-Control', 'no-store');
    const result = await readResultHistory(symbol, scripCode, companyName, req.query.autoSync !== '0');
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Explicit archive start returns a worker receipt; polling never starts new exchange work.
// The worker is bounded, duplicate-safe by filing ID and reports storage failures explicitly.
apiRouter.post("/stocks/:scripCode/fetch-deep-history", requireProOrAdmin, aiRateLimiter, async (req, res) => {
  try {
    const scripCode = req.params.scripCode;
    const yearsNum = Number(req.body?.years ?? 1);
    if (!/^\d{6}$/.test(scripCode) || !Number.isInteger(yearsNum) || yearsNum < 1 || yearsNum > 5) return res.status(400).json({ success: false, error: 'Valid BSE code and 1–5 whole years required' });
    const job = startHistorySync(scripCode, yearsNum);
    res.setHeader('Cache-Control', 'no-store');
    res.status(job.state === 'running' ? 202 : 200).json({ success: true, job });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.get("/stocks/:scripCode/fetch-deep-history", requireProOrAdmin, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const years = Number(req.query.years ?? 1);
  if (!/^\d{6}$/.test(req.params.scripCode) || !Number.isInteger(years) || years < 1 || years > 5 || typeof req.query.id !== 'string') return res.status(400).json({ success: false, error: 'Invalid archive status request' });
  const job = historySyncStatus(req.params.scripCode, years, req.query.id);
  if (!job) return res.status(404).json({ success: false, error: 'Archive worker status unavailable after restart or on this instance. Saved records remain available; retry sync.' });
  res.json({ success: true, job });
});

// Deep Historical Sync for all active Watchlist stocks (1 to 5 years)
apiRouter.post("/watchlist/fetch-deep-history", requireAdmin, aiRateLimiter, async (req, res) => {
  try {
    const { years } = req.body;
    const result = await fetchDeepHistoricalResultsForWatchlist(parseInt(years, 10) || 1);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Boost Priority for 10-day Pre-Result Announcements Window
apiRouter.post("/stocks/:scripCode/boost-runup-priority", requireAdmin, async (req, res) => {
  try {
    const scripCode = req.params.scripCode;
    const { symbol, resultDate, windowDays } = req.body;
    const result = await boostPreResultWindow(scripCode, symbol, resultDate, parseInt(windowDays, 10) || 10);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get all announcements in the 10-day Pre-Result Runup Window
apiRouter.get("/stocks/:scripCode/runup-announcements", async (req, res) => {
  try {
    const scripCode = req.params.scripCode;
    const symbol = (req.query.symbol as string) || '';
    const resultDate = (req.query.resultDate as string) || '';
    const windowDays = parseInt(req.query.windowDays as string, 10) || 10;
    const announcements = getPreResultRunupAnnouncements(scripCode, symbol, resultDate, windowDays);
    res.json({ success: true, count: announcements.length, announcements, windowDays, resultDate });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Priority Sync Across All Watchlists
apiRouter.patch("/watchlists/symbols/:symbol/priority-sync", requireProOrAdmin, async (req, res) => {
  try {
    const { priority, category } = req.body;
    const symbol = req.params.symbol;
    if (!symbol) {
      return res.status(400).json({ error: "Missing symbol" });
    }
    const uid = getReqUserId(req);
    await updateSymbolPriorityAcrossAllWatchlists(symbol, priority || 'HIGH', category, uid);
    syncWatchlistHistoricalData().catch(console.error);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Interactive AI Help Assistant for Bsenexus Guide
apiRouter.post("/help/ask-ai", requireProOrAdmin, aiRateLimiter, async (req, res) => {
  try {
    const { question, history } = req.body;
    if (!question || typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({ success: false, error: "Question cannot be empty" });
    }
    const cleanQuestion = question.trim().slice(0, 500);
    const safeHistory = Array.isArray(history) ? history.slice(-10) : [];
    const uid = getReqUserId(req);
    const answer = await askAppHelpAI(cleanQuestion, safeHistory, { uid });
    res.json({ success: true, answer });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Resilient BSE PDF Resolver & Proxy (SSRF-protected, strictly restricted to BSE domains)
apiRouter.get("/pdf-open", async (req, res) => {
  try {
    const rawUrl = (req.query.url as string) || '';
    const filename = (req.query.file as string) || '';
    const newsId = (req.query.newsId as string) || '';

    const candidateUrls: string[] = [];

    if (rawUrl && isAllowedBseUrl(rawUrl)) {
      candidateUrls.push(rawUrl);
      if (rawUrl.includes('/AttachLive/')) {
        candidateUrls.push(rawUrl.replace('/AttachLive/', '/AttachHis/'));
      } else if (rawUrl.includes('/AttachHis/')) {
        candidateUrls.push(rawUrl.replace('/AttachHis/', '/AttachLive/'));
      }
    }

    if (filename) {
      const cleanFile = filename.replace(/^.*[\\\/]/, '').replace(/[^a-zA-Z0-9_\-\.]/g, '').trim();
      if (cleanFile) {
        candidateUrls.push(`https://www.bseindia.com/xml-data/corpfiling/AttachLive/${cleanFile}`);
        candidateUrls.push(`https://www.bseindia.com/xml-data/corpfiling/AttachHis/${cleanFile}`);
      }
    }

    if (newsId) {
      const cleanNewsId = newsId.replace(/[^a-zA-Z0-9_\-]/g, '');
      if (cleanNewsId) {
        candidateUrls.push(`https://www.bseindia.com/corporates/anndet_new.aspx?origid=${encodeURIComponent(cleanNewsId)}`);
      }
    }

    // Try candidates in order with standard browser headers to prevent hotlink blocks
    for (const testUrl of candidateUrls) {
      // Re-verify each candidate is on bseindia.com
      if (!isAllowedBseUrl(testUrl)) continue;

      try {
        const response = await fetchBseDocument(testUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'application/pdf,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Referer': 'https://www.bseindia.com/'
          },
          signal: AbortSignal.timeout(5000)
        });

        if (response.ok) {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/pdf') || testUrl.toLowerCase().endsWith('.pdf')) {
            const cleanSafeName = (filename || 'bse_filing.pdf').replace(/[^a-zA-Z0-9_\-\.]/g, '');
            res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400');
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="${cleanSafeName}"`);
            return res.send(await readBoundedDocument(response));
          } else if (testUrl.includes('anndet_new.aspx')) {
            return res.redirect(testUrl);
          }
        }
      } catch {
        // Try next candidate url
      }
    }

    // Direct fallback if proxy fetch fails
    if (candidateUrls.length > 0 && isAllowedBseUrl(candidateUrls[0])) {
      return res.redirect(candidateUrls[0]);
    }
    return res.redirect('https://www.bseindia.com/corporates/ann.html');
  } catch (err: any) {
    return res.redirect('https://www.bseindia.com/corporates/ann.html');
  }
});

// ==========================================
// FEATURE 1: COMPANY INTELLIGENCE & QUOTE
// ==========================================

apiRouter.get("/company-filing-counts", async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const stocks = typeof req.query.stocks === 'string' ? [...new Set(req.query.stocks.split(','))] : [];
  if (!stocks.length || stocks.length > 20 || stocks.some(code => !/^\d{6}$/.test(code) && code !== 'BSE')) return res.status(400).json({ success: false, error: 'Provide 1–20 exact BSE codes or BSE operator identity' });
  const items: Record<string, any> = {};
  for (let i = 0; i < stocks.length; i += 4) await Promise.all(stocks.slice(i, i + 4).map(async code => {
    try { items[code] = { ...await getCompanyFilingCount(code === 'BSE' ? '' : code, code === 'BSE' ? 'BSE' : ''), available: true }; }
    catch { items[code] = { available: false }; }
  }));
  res.json({ success: true, items });
});

apiRouter.get("/company-intel/:identifier", async (req, res) => {
  try {
    const identifier = req.params.identifier;
    const scripCode = (req.query.scripCode as string) || (/^\d+$/.test(identifier) ? identifier : '');
    const symbol = (req.query.symbol as string) || (!/^\d+$/.test(identifier) ? identifier : '');

    const intel = await getCompanyIntelligence(scripCode, symbol);
    res.json(intel);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.all("/company-intel/:identifier/ai-overview", requireProOrAdmin, aiRateLimiter, async (req, res) => {
  let uid = '';
  let isAdminUser = false;
  let quotaConsumed = false;
  let quotaReservationId: string | undefined;
  try {
    uid = getReqUserId(req);
    isAdminUser = (req as any).user?.isAdmin === true;

    // LOGIC-002 fix (1 Oct 2026 audit): Atomically check+consume BEFORE generation.
    // Previously used check-then-generate-then-consume which had a race where
    // N concurrent requests all passed the check, all generated, all consumed.
    // Now consume atomically up-front; refund if generation fails.
    const quotaCheck = await checkAndConsumeServerAiQuota(uid, isAdminUser);
    if (!quotaCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: quotaCheck.error || "Daily AI summary quota reached.",
        upgradeRequired: true,
        remainingQuota: 0,
        dailyLimit: quotaCheck.dailyLimit
      });
    }
    quotaReservationId = quotaCheck.reservationId;
    quotaConsumed = true;
    const consumed = { remaining: quotaCheck.remaining, dailyLimit: quotaCheck.dailyLimit, isPro: quotaCheck.isPro };

    const identifier = req.params.identifier;
    const scripCode = (req.query.scripCode as string) || (req.body?.scripCode as string) || (/^\d+$/.test(identifier) ? identifier : '');
    const symbol = (req.query.symbol as string) || (req.body?.symbol as string) || (!/^\d+$/.test(identifier) ? identifier : '');

    // Honor the user's AI summary language (Settings → Telegram Alerts & AI Summaries); default English
    let overviewLang: 'hinglish' | 'english' = 'english';
    try {
      const prof = await getUserProfile(uid);
      if ((prof as any)?.notificationPreferences?.aiSummaryLang === 'hinglish') overviewLang = 'hinglish';
    } catch { /* default stays english */ }

    let aiOverview: string | null = null;
    try {
      aiOverview = await generateCompanyAiOverview(scripCode, symbol, overviewLang);
    } catch (genErr: any) {
      throw genErr; // The outer catch owns cleanup.
    }
    if (!aiOverview) {
      if (quotaConsumed) { try { await refundServerAiQuota(uid, isAdminUser, quotaReservationId); } catch {} }
      return res.status(500).json({ success: false, error: "Gemini AI was unable to generate company overview." });
    }

    completeServerAiQuotaReservation(quotaReservationId);
    // Quota was already consumed atomically above; nothing more to burn.
    res.json({
      success: true,
      aiOverview,
      remainingQuota: consumed.remaining,
      dailyLimit: consumed.dailyLimit,
      isPro: consumed.isPro
    });
  } catch (err: any) {
    if (quotaConsumed) { try { await refundServerAiQuota(uid, isAdminUser, quotaReservationId); } catch {} }
    res.status(isPaymentStoreUnavailable(err) ? 503 : 500).json({ success: false, error: isPaymentStoreUnavailable(err) ? "AI usage storage is unavailable. Please retry shortly." : err.message });
  }
});

apiRouter.get("/stocks/:symbol/quote", async (req, res) => {
  try {
    const quote = await fetchStockQuote(req.params.symbol);
    if (!quote) {
      return res.status(404).json({ error: "Quote not found" });
    }
    res.json(quote);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// FEATURE 2: MATERIAL CORPORATE ACTIONS TIMELINE
// ==========================================

apiRouter.get("/material-events", async (req, res) => {
  try {
    const category = (req.query.category as string) || 'ALL';
    const limitParam = parseInt(req.query.limit as string) || 100;
    const recent = await getRecentAnnouncements(300);

    const events = [];
    for (const ann of recent) {
      const evt = classifyMaterialEvent({
        id: ann.id,
        subject: ann.subject,
        details: ann.details,
        companyName: ann.companyName,
        scrip_cd: ann.scrip_cd,
        bseTime: ann.bseTime,
        pdfLink: ann.pdfLink,
        priority: ann.priority,
        category: ann.category,
        timestamp: ann.bseTimestamp || ann.fetched_at
      });

      if (evt) {
        if (category === 'ALL' || evt.eventType === category) {
          events.push(evt);
        }
      }
    }

    res.json({ events: events.slice(0, limitParam) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// FEATURE 3: IN-APP NOTIFICATION INBOX
// ==========================================

apiRouter.get("/notifications", async (req, res) => {
  try {
    const uid = getReqUserId(req);
    const limitParam = parseInt(req.query.limit as string) || 100;
    const watchlistOnly = req.query.watchlistOnly === 'true';
    const type = typeof req.query.type === 'string' ? req.query.type : undefined;
    const unreadOnly = req.query.unreadOnly === 'true';

    const [inbox, profile] = await Promise.all([
      getAllNotifications(uid, 500, { watchlistOnly: false }),
      uid && uid !== 'guest' ? getUserProfile(uid) : Promise.resolve(null),
    ]);
    const notifs = filterNotifications(inbox, limitParam, { watchlistOnly, type, unreadOnly });

    let isMuted = false;
    if (profile) {
      isMuted = Boolean(profile.muteInAppNotifications ?? profile.notificationPreferences?.muteInAppNotifications);
    }

    // While muted, the bell stays silent: unread badges report zero.
    // (Existing notifications remain listed; only new triggers are suppressed.)
    const unreadCount = isMuted ? 0 : inbox.filter(n=>!n.isRead).length;
    const watchlistUnreadCount = isMuted ? 0 : inbox.filter(n=>!n.isRead && n.isWatchlist).length;

    res.json({ notifications: notifs, unreadCount, watchlistUnreadCount, muteInAppNotifications: isMuted });
  } catch (err: any) {
    res.status(isPaymentStoreUnavailable(err) ? 503 : 500).json({ success: false, error: isPaymentStoreUnavailable(err) ? "Notification storage is unavailable. Please retry shortly." : err.message });
  }
});

apiRouter.get("/notifications/unread-count", requireAuth, async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store');
  try {
    const uid = getReqUserId(req);
    const watchlistOnly = req.query.watchlistOnly === 'true';
    const [profile, rawCount] = await Promise.all([
      uid && uid !== 'guest' ? getUserProfile(uid) : Promise.resolve(null),
      getUnreadNotificationCount(uid, watchlistOnly),
    ]);
    const isMuted = profile
      ? Boolean(profile.muteInAppNotifications ?? profile.notificationPreferences?.muteInAppNotifications)
      : false;
    const count = isMuted ? 0 : rawCount;
    res.json({ unreadCount: count });
  } catch (err: any) {
    res.status(isPaymentStoreUnavailable(err) ? 503 : 500).json({ success: false, error: isPaymentStoreUnavailable(err) ? "Notification storage is unavailable. Please retry shortly." : err.message });
  }
});

apiRouter.post("/notifications/:id/read", requireAuth, async (req, res) => {
  try {
    const uid = getReqUserId(req);
    const ok = await markNotificationRead(req.params.id, uid);
    res.status(ok ? 200 : 404).json({ success: ok });
  } catch (err: any) {
    res.status(isPaymentStoreUnavailable(err) ? 503 : 500).json({ success: false, error: isPaymentStoreUnavailable(err) ? "Notification storage is unavailable. Please retry shortly." : err.message });
  }
});

apiRouter.post("/notifications/read-batch", requireAuth, async (req, res) => {
  try {
    const uid = getReqUserId(req);
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    const count = await markNotificationsReadBatch(ids, uid);
    res.json({ success: true, updatedCount: count });
  } catch (err: any) {
    res.status(isPaymentStoreUnavailable(err) ? 503 : 500).json({ success: false, error: isPaymentStoreUnavailable(err) ? "Notification storage is unavailable. Please retry shortly." : err.message });
  }
});

apiRouter.post("/notifications/read-all", requireAuth, async (req, res) => {
  try {
    const uid = getReqUserId(req);
    await markAllNotificationsRead(uid);
    res.json({ success: true });
  } catch (err: any) {
    res.status(isPaymentStoreUnavailable(err) ? 503 : 500).json({ success: false, error: isPaymentStoreUnavailable(err) ? "Notification storage is unavailable. Please retry shortly." : err.message });
  }
});

apiRouter.delete("/notifications", requireAuth, async (req, res) => {
  try {
    const uid = getReqUserId(req);
    await clearAllNotifications(uid);
    res.json({ success: true });
  } catch (err: any) {
    res.status(isPaymentStoreUnavailable(err) ? 503 : 500).json({ success: false, error: isPaymentStoreUnavailable(err) ? "Notification storage is unavailable. Please retry shortly." : err.message });
  }
});

apiRouter.post("/notifications/toggle-mute", requireAuth, async (req, res) => {
  try {
    const uid = getReqUserId(req);
    const explicitMute = typeof req.body?.mute === 'boolean' ? req.body.mute : null;

    // Fast path (the app always sends an explicit value): respond INSTANTLY and
    // persist in the background. Awaiting Firestore here used to leave the UI
    // stuck on a disabled mute button for a minute or more.
    if (uid && uid !== 'guest' && explicitMute !== null) {
      res.json({ success: true, muteInAppNotifications: explicitMute });
      (async () => {
        try {
          const userProfile = await getUserProfile(uid);
          const updatedPrefs = {
            ...(userProfile?.notificationPreferences || {}),
            muteInAppNotifications: explicitMute
          };
          await saveUserProfile(uid, {
            muteInAppNotifications: explicitMute,
            notificationPreferences: updatedPrefs as any
          }, true);
          invalidateMonitorConfigCache(uid);
        } catch {}
      })();
      return;
    }

    let shouldMute: boolean;
    if (uid && uid !== 'guest') {
      const userProfile = await getUserProfile(uid);
      const currentMute = userProfile
        ? Boolean(userProfile.muteInAppNotifications ?? userProfile.notificationPreferences?.muteInAppNotifications)
        : false;
      shouldMute = explicitMute !== null ? explicitMute : !currentMute;

      if (userProfile) {
        const updatedPrefs = {
          ...(userProfile.notificationPreferences || {}),
          muteInAppNotifications: shouldMute
        };
        await saveUserProfile(uid, {
          muteInAppNotifications: shouldMute,
          notificationPreferences: updatedPrefs as any
        }, true);
      }
    } else {
      shouldMute = explicitMute !== null ? explicitMute : true;
    }

    res.json({ success: true, muteInAppNotifications: shouldMute });
  } catch (err: any) {
    res.status(isPaymentStoreUnavailable(err) ? 503 : 500).json({ success: false, error: isPaymentStoreUnavailable(err) ? "Notification storage is unavailable. Please retry shortly." : err.message });
  }
});

// ==========================================
// FEATURE 3 (CONT.): ADVANCED ALERT RULES
// ==========================================

apiRouter.get("/alert-rules", requireAuth, async (req, res) => {
  try {
    const uid = getReqUserId(req);
    const rules = await getAllAlertRules(uid);
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ rules });
  } catch (err: any) {
    res.status(err instanceof AlertRuleError ? err.status : 500).json({ success: false, error: err.message });
  }
});

apiRouter.post("/alert-rules", requireAuth, async (req, res) => {
  try {
    const uid = getReqUserId(req);
    const rule = await saveAlertRule(req.body, uid);
    res.json({ success: true, rule });
  } catch (err: any) {
    res.status(err instanceof AlertRuleError ? err.status : 500).json({ success: false, error: err.message });
  }
});

apiRouter.patch("/alert-rules/:id/toggle", requireAuth, async (req, res) => {
  try {
    const uid = getReqUserId(req);
    const { enabled } = req.body;
    const ok = await toggleAlertRule(req.params.id, enabled, uid);
    res.status(ok ? 200 : 404).json({ success: ok });
  } catch (err: any) {
    res.status(err instanceof AlertRuleError ? err.status : 500).json({ success: false, error: err.message });
  }
});

apiRouter.delete("/alert-rules/:id", requireAuth, async (req, res) => {
  try {
    const uid = getReqUserId(req);
    const ok = await deleteAlertRule(req.params.id, uid);
    res.status(ok ? 200 : 404).json({ success: ok });
  } catch (err: any) {
    res.status(err instanceof AlertRuleError ? err.status : 500).json({ success: false, error: err.message });
  }
});

apiRouter.put("/alert-rules/presets", requireAuth, async (req,res) => {
  try {const rules=await saveAlertPresets(req.body,getReqUserId(req));res.json({success:true,rules});}
  catch(err:any){res.status(err instanceof AlertRuleError?err.status:500).json({success:false,error:err instanceof AlertRuleError?err.message:'Unable to save alert presets.'});}
});

// ==========================================
// FEATURE: REAL-TIME MARKET INDICES & OVERVIEW
// ==========================================

apiRouter.get(
  "/market/indices",
  apiResponseCache.middleware({ ttlMs: 15 * 1000, publicCache: true }),
  async (_req, res) => {
    try {
      const data = await fetchLiveMarketIndices();
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

apiRouter.get(
  "/market/status",
  apiResponseCache.middleware({ ttlMs: 30 * 1000, publicCache: true }),
  (_req, res) => {
    try {
      const status = getMarketSessionStatus();
      res.json(status);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// ==========================================
// FEATURE: IN-HOUSE SYSTEM HEALTH & CRASH DIAGNOSTICS (ADMIN ONLY)
// ==========================================

// Lightweight ingestion endpoint (used by client telemetry)
// SECURITY (1 Oct 2026 audit SEC-008): Previously unauthenticated + no per-IP
// throttle. Attackers could spam admin's Telegram with fake crash alerts and
// bloat local diagnostics.json. Now requires auth + per-IP throttle + strict
// field whitelist (no spread of arbitrary req.body fields).
apiRouter.post("/telemetry/event", aiRateLimiter, async (req, res) => {
  try {
    const uid = getReqUserId(req);
    if (!uid || uid === 'guest') {
      return res.status(401).json({ success: false, error: "Authentication required for telemetry." });
    }
    // Strict field whitelist — don't spread arbitrary req.body fields.
    // Type-cast to the expected union types so TS doesn't reject our sanitization.
    const body = req.body || {};
    const rawType = String(body.type || '').substring(0, 45).toUpperCase() as any;
    const validTypes = ['ERROR', 'PERFORMANCE', 'WEB_VITAL', 'API_METRIC', 'DEVICE_INFO'];
    const type = validTypes.includes(rawType) ? rawType : 'ERROR';
    const rawSeverity = String(body.error?.severity || 'ERROR').substring(0, 45).toUpperCase() as any;
    const validSeverities = ['CRITICAL', 'ERROR', 'WARNING'];
    const severity = validSeverities.includes(rawSeverity) ? rawSeverity : 'ERROR';
    const event = await recordTelemetry({
      type,
      userId: uid,
      device: body.device && typeof body.device === 'object' ? body.device : undefined,
      performance: body.performance && typeof body.performance === 'object' ? body.performance : undefined,
      error: body.error && typeof body.error === 'object' ? {
        message: String(body.error.message || '').substring(0, 990),
        stack: body.error.stack ? String(body.error.stack).substring(0, 4900) : undefined,
        severity,
        url: body.error.url ? String(body.error.url).substring(0, 490) : undefined,
      } : undefined,
      api: body.api && typeof body.api === 'object' ? body.api : undefined,
    });
    res.json({ success: true, eventId: event.id });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin-only diagnostics summary & detailed crash logs
apiRouter.get("/admin/diagnostics", requireAdmin, async (req, res) => {
  try {
    const summary = await getDiagnosticsSummary();
    const bse = await getBseHealth();
    const telegram = await getTelegramHealth();
    const settings = await getSettings();
    
    res.json({
      success: true,
      ...summary,
      muteCrashAlerts: !!settings.muteCrashAlerts,
      backendServices: {
        bse,
        telegram,
        database: {
          status: isFirestoreQuotaExceeded() ? 'LOCAL_STORAGE_MODE' : 'OPTIMAL_FIRESTORE',
          storageMode: getManualStorageMode()
        }
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin-only clear diagnostics logs
apiRouter.post("/admin/diagnostics/clear", requireAdmin, async (req, res) => {
  try {
    await clearDiagnostics();
    res.json({ success: true, message: "Diagnostics logs cleared successfully" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin-only test crash Telegram alert
apiRouter.post("/admin/diagnostics/test-alert", requireAdmin, async (req, res) => {
  try {
    const testEvent = {
      id: `test_${Date.now()}`,
      type: 'ERROR' as const,
      timestamp: Date.now(),
      device: {
        type: 'MOBILE' as const,
        os: 'Android 14 (Simulated)',
        browser: 'Chrome Mobile 124',
        screen: '390x844',
        connection: '4g'
      },
      error: {
        message: "Simulated Frontend Bug: Cannot read properties of undefined (reading 'announcement_id')",
        stack: "TypeError: Cannot read properties of undefined\n    at renderAnnouncementCard (Announcements.tsx:412:18)\n    at Object.invokeGuardedCallbackProd (react-dom.production.min.js:189:12)",
        severity: 'CRITICAL' as const,
        breadcrumbs: [
          { action: "Click: Watchlists Tab", category: "ui", timestamp: Date.now() - 4000 },
          { action: "Click: Filter HIGH Priority", category: "filter", timestamp: Date.now() - 2000 },
          { action: "Click: Expand RELIANCE Details", category: "card", timestamp: Date.now() - 500 }
        ],
        url: "/dashboard?tab=watchlists&view=dense"
      }
    };

    const sent = await triggerCrashTelegramAlert(testEvent, true);
    res.json({ 
      success: sent, 
      message: sent ? "Test crash alert sent to Telegram successfully!" : "Failed to send test alert. Please verify Telegram Bot Token & Chat ID in Settings."
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin-only: Get all approved/muted bug rules
apiRouter.get("/admin/diagnostics/approved-bugs", requireAdmin, (req, res) => {
  try {
    const rules = getApprovedBugRules();
    res.json({ success: true, rules });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin-only: Add an approved/muted bug rule
apiRouter.post("/admin/diagnostics/approved-bugs", requireAdmin, (req, res) => {
  try {
    const { pattern, name, reason } = req.body;
    if (!pattern || typeof pattern !== 'string' || !pattern.trim()) {
      return res.status(400).json({ success: false, error: "Error pattern is required" });
    }
    const rule = addApprovedBugRule(pattern.trim(), name, reason);
    res.json({ success: true, rule, rules: getApprovedBugRules() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin-only: Delete an approved/muted bug rule
apiRouter.delete("/admin/diagnostics/approved-bugs/:id", requireAdmin, (req, res) => {
  try {
    const ok = deleteApprovedBugRule(req.params.id);
    res.json({ success: ok, rules: getApprovedBugRules() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin-only: Toggle global crash alerts mute
apiRouter.post("/admin/diagnostics/toggle-mute-alerts", requireAdmin, async (req, res) => {
  try {
    const settings = await getSettings();
    const shouldMute = typeof req.body.mute === 'boolean' ? req.body.mute : !settings.muteCrashAlerts;
    await saveSettings({ muteCrashAlerts: shouldMute });
    addLog('INFO', 'TELEMETRY', `Global crash alert muting set to ${shouldMute}`);
    res.json({ success: true, muteCrashAlerts: shouldMute });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 20-POINT SECURITY AUDIT & PENETRATION TESTING
// ==========================================

// Audit status of all 20 launch security items
apiRouter.get("/security/audit", requireAdmin, async (req, res) => {
  try {
    const user = (req as any).user;
    const auditReport = await runSecurityAudit(user);
    res.json({ success: true, ...auditReport });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Execute simulated live penetration test against endpoints
apiRouter.post("/security/pen-test", requireAdmin, async (req, res) => {
  try {
    const penTestReport = await executeSimulatedPenTest(`http://127.0.0.1:${Number(process.env.PORT) || 3000}`);
    await addLog('INFO', 'SECURITY', `Simulated Penetration Test executed: ${penTestReport.blockedAttacks}/${penTestReport.totalAttacks} attack vectors blocked successfully`);
    res.json({ success: true, ...penTestReport });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin-only: Real-time Bloom Filter Telemetry
apiRouter.get("/admin/bloom-stats", requireAdmin, async (_req, res) => {
  try {
    const stats = getBloomFilterDiagnostics();
    res.json({ success: true, ...stats });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin-only: Test an ID / Scrip live against the Bloom Filter
apiRouter.get("/admin/bloom-test", requireAdmin, async (req, res) => {
  try {
    const testId = String(req.query.id || '').trim();
    if (!testId) {
      return res.status(400).json({ success: false, error: "Missing 'id' query parameter" });
    }

    const processedIndices = processedBloomFilter.getBitIndices(testId);
    const sentIndices = sentBloomFilter.getBitIndices(testId);
    const mightBeProcessed = processedBloomFilter.has(testId);
    const mightBeSent = sentBloomFilter.has(testId);
    const actuallyProcessed = await isAnnouncementProcessed(testId);
    const actuallySent = await isAnnouncementSent(testId);

    res.json({
      success: true,
      id: testId,
      processed: {
        mightBeInSet: mightBeProcessed,
        actuallyInSet: actuallyProcessed,
        bitIndices: processedIndices,
        bypassedDbScan: !mightBeProcessed
      },
      sent: {
        mightBeInSet: mightBeSent,
        actuallyInSet: actuallySent,
        bitIndices: sentIndices,
        bypassedDbScan: !mightBeSent
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});




