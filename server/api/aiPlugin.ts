import express from 'express';
import rateLimit from 'express-rate-limit';
import { getRecentAnnouncements } from '../database/announcementDao.js';
import { getStockResultsHistory, getResultsCalendarData } from '../services/resultsCalendarService.js';
import { resolveStockDetails, getAllStockEntries } from '../utils/stockResolver.js';

export const aiPluginRouter = express.Router();

// 1. High-Performance In-Memory TTL Cache to eliminate DB/CPU exhaustion attacks
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class FastMemoryCache {
  private store = new Map<string, CacheEntry<any>>();
  private readonly maxEntries = 500;

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    if (this.store.size >= this.maxEntries) {
      // Prune oldest 20% to prevent heap exhaustion
      const keysToDelete = Array.from(this.store.keys()).slice(0, 100);
      for (const k of keysToDelete) this.store.delete(k);
    }
    this.store.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  clear(): void {
    this.store.clear();
  }
}

export const aiCache = new FastMemoryCache();

// 2. Exploit Protection: HTTP Method Lockdown (strictly GET, HEAD, OPTIONS)
aiPluginRouter.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed. BSE Nexus AI Gateway strictly permits GET and HEAD operations only.'
    });
  }
  // URI Length Guard to prevent buffer overflow / ReDoS attempts
  if (req.originalUrl && req.originalUrl.length > 512) {
    return res.status(414).json({
      success: false,
      error: 'URI Too Long. Query parameters exceed maximum permitted length of 512 characters.'
    });
  }
  next();
});

// 3. Strict Anti-Abuse Rate Limiter for AI Agent & Bot consumers (40 req/min per IP)
const aiPluginRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute sliding window
  max: 40, // Max 40 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    forwardedHeader: false,
    default: true,
  },
  message: {
    success: false,
    error: "Rate limit exceeded (40 requests per minute per IP). BSE Nexus protects system resources from automated scraping. Please retry in 60 seconds."
  }
});

// Apply rate limiter first
aiPluginRouter.use(aiPluginRateLimiter);

// 4. CORS & Caching headers for AI agent consumers
aiPluginRouter.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=120');
  next();
});

export function getAiPluginManifest() {
  return {
    schema_version: "v1",
    name_for_human: "BSE Nexus Indian Stock Intelligence",
    name_for_model: "bsenexus_market_intelligence",
    description_for_human: "Real-time BSE announcements, regulatory corporate filings, quarterly financial results, and board meetings for Indian listed companies.",
    description_for_model: "Plugin for querying live Bombay Stock Exchange (BSE) regulatory filings, corporate announcements under SEBI LODR Regulation 30, quarterly earnings reports, upcoming board meetings, and company scrip codes. Use this tool whenever a user asks about Indian stock market announcements, corporate filings, quarterly financial results, dividends, or company board decisions.",
    auth: {
      type: "none"
    },
    api: {
      type: "openapi",
      url: "https://bsenexus.in/api/ai/openapi.json"
    },
    logo_url: "https://bsenexus.in/icon-192.png",
    contact_email: "admin@bsenexus.in",
    legal_info_url: "https://bsenexus.in/terms"
  };
}

export function getOpenApiSpec() {
  return {
    openapi: "3.1.0",
    info: {
      title: "BSE Nexus AI Plugin API",
      version: "1.0.0",
      description: "Live real-time BSE (Bombay Stock Exchange) corporate announcements, regulatory filings under SEBI LODR Regulation 30, quarterly financial results, board meetings, and company intelligence. Optimized for ChatGPT Custom Actions, Google Gemini Tools, and autonomous AI agents.",
      contact: {
        name: "BSE Nexus Platform",
        url: "https://bsenexus.in",
        email: "admin@bsenexus.in"
      }
    },
    servers: [
      {
        url: "https://bsenexus.in",
        description: "BSE Nexus Live Production Gateway"
      }
    ],
    paths: {
      "/api/ai/v1/filings": {
        get: {
          operationId: "getBseFilings",
          summary: "Search and fetch recent BSE corporate announcements and regulatory filings",
          description: "Returns real-time corporate announcements filed on the Bombay Stock Exchange (BSE), including material disclosures under SEBI LODR Regulation 30, order wins, financial results, dividend declarations, credit rating revisions, and board decisions.",
          parameters: [
            {
              name: "symbol",
              in: "query",
              required: false,
              description: "NSE/BSE stock ticker (e.g. RELIANCE, TCS, INFY, TATAMOTORS, HDFCBANK) or 6-digit BSE Scrip Code (e.g. 500325). If omitted, returns latest market-wide disclosures.",
              schema: {
                type: "string"
              }
            },
            {
              name: "category",
              in: "query",
              required: false,
              description: "Filter by filing category or material keyword (e.g. 'Board Meeting', 'Financial Results', 'Order / Contract', 'Dividend', 'Acquisition', 'Credit Rating', 'General').",
              schema: {
                type: "string"
              }
            },
            {
              name: "limit",
              in: "query",
              required: false,
              description: "Maximum number of disclosures to return (default: 10, max: 25).",
              schema: {
                type: "integer",
                default: 10,
                minimum: 1,
                maximum: 25
              }
            }
          ],
          responses: {
            "200": {
              description: "List of BSE corporate disclosures formatted for AI comprehension.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      count: { type: "integer" },
                      symbol: { type: "string" },
                      category: { type: "string" },
                      filings: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            id: { type: "string" },
                            symbol: { type: "string" },
                            companyName: { type: "string" },
                            scripCode: { type: "string" },
                            headline: { type: "string" },
                            summary: { type: "string" },
                            category: { type: "string" },
                            publishedAt: { type: "string" },
                            pdfUrl: { type: "string" },
                            nexusUrl: { type: "string" }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/ai/v1/results": {
        get: {
          operationId: "getQuarterlyResults",
          summary: "Fetch quarterly financial results and earnings history for a listed company",
          description: "Returns quarterly financial statements, revenue, net profit, EBITDA, and profit margins for Indian companies listed on the BSE.",
          parameters: [
            {
              name: "symbol",
              in: "query",
              required: true,
              description: "Stock ticker (e.g. RELIANCE, TATAMOTORS, INFY, ICICIBANK) or 6-digit BSE Scrip Code.",
              schema: {
                type: "string"
              }
            }
          ],
          responses: {
            "200": {
              description: "Quarterly financial results history.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      symbol: { type: "string" },
                      scripCode: { type: "string" },
                      companyName: { type: "string" },
                      resultsCount: { type: "integer" },
                      results: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            quarterKey: { type: "string" },
                            period: { type: "string" },
                            meetingDate: { type: "string" },
                            revenue: { type: "number" },
                            netProfit: { type: "number" },
                            ebitda: { type: "number" },
                            marginPercent: { type: "number" },
                            filingUrl: { type: "string" },
                            nexusResultsUrl: { type: "string" }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/ai/v1/board-meetings": {
        get: {
          operationId: "getBoardMeetings",
          summary: "Fetch upcoming and scheduled board meetings and corporate action agendas",
          description: "Returns upcoming board meetings scheduled by companies to consider financial results, dividend payouts, bonus issues, stock splits, or fundraising.",
          parameters: [
            {
              name: "symbol",
              in: "query",
              required: false,
              description: "Filter by stock symbol (e.g. TCS, WIPRO, HDFCBANK). If omitted, returns market-wide upcoming meetings.",
              schema: {
                type: "string"
              }
            },
            {
              name: "daysAhead",
              in: "query",
              required: false,
              description: "Lookahead window in days (default: 14, max: 60).",
              schema: {
                type: "integer",
                default: 14,
                minimum: 1,
                maximum: 60
              }
            }
          ],
          responses: {
            "200": {
              description: "List of scheduled board meetings.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      count: { type: "integer" },
                      meetings: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            symbol: { type: "string" },
                            scripCode: { type: "string" },
                            companyName: { type: "string" },
                            meetingDate: { type: "string" },
                            purpose: { type: "string" },
                            daysLeft: { type: "integer" }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/ai/v1/company": {
        get: {
          operationId: "getCompanyIntel",
          summary: "Look up company BSE scrip code, sector, and basic identity by ticker or name",
          description: "Resolves company name, official 6-digit BSE Scrip Code, NSE Symbol, sector, and recent filing volume for stock lookup.",
          parameters: [
            {
              name: "query",
              in: "query",
              required: true,
              description: "Company name, symbol, or BSE scrip code (e.g. 'Reliance', '500325', 'TATA MOTORS').",
              schema: {
                type: "string"
              }
            }
          ],
          responses: {
            "200": {
              description: "Company intelligence and scrip profile.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      found: { type: "boolean" },
                      company: {
                        type: "object",
                        properties: {
                          symbol: { type: "string" },
                          scripCode: { type: "string" },
                          name: { type: "string" },
                          sector: { type: "string" },
                          nexusCompanyUrl: { type: "string" }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  };
}

export function getGeminiToolsSpec() {
  const openApi = getOpenApiSpec();
  const functionDeclarations = [];

  for (const [pathKey, pathObj] of Object.entries(openApi.paths)) {
    const getMethod = (pathObj as any).get;
    if (!getMethod) continue;

    const properties: Record<string, any> = {};
    const required: string[] = [];

    if (Array.isArray(getMethod.parameters)) {
      for (const param of getMethod.parameters) {
        properties[param.name] = {
          type: param.schema?.type || "string",
          description: param.description || param.name
        };
        if (param.required) {
          required.push(param.name);
        }
      }
    }

    functionDeclarations.push({
      name: getMethod.operationId,
      description: `${getMethod.summary}. ${getMethod.description}`,
      parameters: {
        type: "OBJECT",
        properties,
        required: required.length > 0 ? required : undefined
      }
    });
  }

  return { functionDeclarations };
}

// 1. OpenAPI 3.1 Spec Endpoint
aiPluginRouter.get('/openapi.json', (_req, res) => {
  res.json(getOpenApiSpec());
});

// 2. ChatGPT Plugin Manifest Endpoint
aiPluginRouter.get(['/ai-plugin.json', '/.well-known/ai-plugin.json'], (_req, res) => {
  res.json(getAiPluginManifest());
});

// 3. Google Gemini Function Declarations Endpoint
aiPluginRouter.get('/gemini-tools.json', (_req, res) => {
  res.json(getGeminiToolsSpec());
});

// 4. Filings endpoint (15s in-memory TTL cache)
aiPluginRouter.get('/v1/filings', async (req, res) => {
  try {
    const rawSymbol = String(req.query.symbol || '').trim().replace(/[^a-zA-Z0-9._\-]/g, '').slice(0, 20);
    const rawCategory = String(req.query.category || '').trim().slice(0, 50);
    const limitNum = Math.min(Math.max(parseInt(String(req.query.limit || '10'), 10) || 10, 1), 25);

    const cacheKey = `filings:${rawSymbol}:${rawCategory}:${limitNum}`;
    const cached = aiCache.get<any>(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    let targetSym = '';
    let targetScrip = '';

    if (rawSymbol) {
      if (/^\d{5,7}$/.test(rawSymbol)) {
        targetScrip = rawSymbol;
      } else {
        targetSym = rawSymbol.toUpperCase();
        const resolved = await resolveStockDetails(targetSym);
        if (resolved?.scripCode) targetScrip = resolved.scripCode;
      }
    }

    const announcements = await getRecentAnnouncements(500);

    let filtered = announcements.filter(ann => {
      if (targetScrip && String(ann.scrip_cd || ann.scripCode || '').trim() === targetScrip) {
        return true;
      }
      if (targetSym) {
        const annSym = String(ann.symbol || '').trim().toUpperCase();
        if (annSym === targetSym) return true;
        const text = `${ann.companyName || ''} ${ann.subject || ''}`.toUpperCase();
        if (text.includes(targetSym)) return true;
        return false;
      }
      return true;
    });

    if (rawCategory) {
      const catLower = rawCategory.toLowerCase();
      filtered = filtered.filter(ann => {
        const c = String(ann.category || ann.category_name || '').toLowerCase();
        const s = String(ann.subject || '').toLowerCase();
        return c.includes(catLower) || s.includes(catLower);
      });
    }

    const sliced = filtered.slice(0, limitNum);

    const filings = sliced.map(ann => {
      const sym = ann.symbol || '';
      const scrip = ann.scrip_cd || ann.scripCode || '';
      const newsId = ann.newsid || ann.news_id || ann.id;
      const permalinkSymbol = sym || scrip || 'MARKET';

      return {
        id: String(newsId || ''),
        symbol: sym,
        companyName: ann.companyName || ann.company_name || '',
        scripCode: scrip,
        headline: ann.subject || '',
        summary: ann.aiSummary || ann.more || '',
        category: ann.category || ann.category_name || 'Corporate Disclosure',
        publishedAt: ann.dt_tm || (ann.bseTimestamp ? new Date(ann.bseTimestamp).toISOString() : ''),
        pdfUrl: ann.pdfLink || ann.attachmentname || '',
        nexusUrl: newsId ? `https://bsenexus.in/filing/${encodeURIComponent(permalinkSymbol)}/${newsId}` : 'https://bsenexus.in/announcements'
      };
    });

    const payload = {
      success: true,
      count: filings.length,
      symbol: rawSymbol || undefined,
      category: rawCategory || undefined,
      filings
    };

    aiCache.set(cacheKey, payload, 15 * 1000);
    res.setHeader('X-Cache', 'MISS');
    res.json(payload);
  } catch (_error: any) {
    res.status(500).json({
      success: false,
      error: 'Unable to retrieve corporate filings at this moment. Please retry shortly.'
    });
  }
});

// 5. Results endpoint (60s in-memory TTL cache)
aiPluginRouter.get('/v1/results', async (req, res) => {
  try {
    const rawSymbol = String(req.query.symbol || '').trim().replace(/[^a-zA-Z0-9._\-]/g, '').slice(0, 20);
    if (!rawSymbol) {
      return res.status(400).json({
        success: false,
        error: "Missing required query parameter: 'symbol' (e.g. RELIANCE, TATAMOTORS, 500325)"
      });
    }

    let sym = rawSymbol.toUpperCase();
    let scrip = '';
    if (/^\d{5,7}$/.test(rawSymbol)) {
      scrip = rawSymbol;
      sym = '';
    }

    const resolved = await resolveStockDetails(rawSymbol);
    if (resolved) {
      if (resolved.symbol) sym = resolved.symbol.toUpperCase();
      if (resolved.scripCode) scrip = resolved.scripCode;
    }

    const cacheKey = `results:${sym}:${scrip}`;
    const cached = aiCache.get<any>(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    const history = await getStockResultsHistory(sym, scrip);

    const formatted = history.slice(0, 8).map(h => ({
      quarterKey: h.quarterKey || '',
      period: h.periodOrMeeting || h.quarterKey || '',
      meetingDate: h.meetingDate || h.boardMeetingDate || '',
      declarationDate: h.declarationDate || '',
      headline: h.subject || '',
      summary: h.aiSummary || h.details || '',
      pdfUrl: h.pdfLink || '',
      nexusResultsUrl: sym && h.quarterKey ? `https://bsenexus.in/results/${encodeURIComponent(sym)}/${encodeURIComponent(h.quarterKey)}` : undefined
    }));

    const payload = {
      success: true,
      symbol: sym || rawSymbol,
      scripCode: scrip,
      companyName: resolved?.name || sym,
      resultsCount: formatted.length,
      results: formatted
    };

    aiCache.set(cacheKey, payload, 60 * 1000);
    res.setHeader('X-Cache', 'MISS');
    res.json(payload);
  } catch (_error: any) {
    res.status(500).json({
      success: false,
      error: 'Unable to retrieve financial results at this moment. Please retry shortly.'
    });
  }
});

// 6. Board meetings endpoint (60s in-memory TTL cache)
aiPluginRouter.get('/v1/board-meetings', async (req, res) => {
  try {
    const rawSymbol = String(req.query.symbol || '').trim().toUpperCase().replace(/[^a-zA-Z0-9._\-]/g, '').slice(0, 20);
    const daysAhead = Math.min(Math.max(parseInt(String(req.query.daysAhead || '14'), 10) || 14, 1), 60);

    const cacheKey = `meetings:${rawSymbol}:${daysAhead}`;
    const cached = aiCache.get<any>(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    const calendarData = await getResultsCalendarData('upcoming', undefined, undefined, 'market');
    let meetings = Array.isArray(calendarData?.items) ? calendarData.items : [];
    if (rawSymbol) {
      meetings = meetings.filter(m => {
        const mSym = String(m.symbol || '').toUpperCase();
        const mScrip = String(m.scripCode || '');
        const mName = String(m.companyName || '').toUpperCase();
        return mSym === rawSymbol || mScrip === rawSymbol || mName.includes(rawSymbol);
      });
    }

    if (daysAhead) {
      meetings = meetings.filter(m => typeof m.daysLeft === 'number' && m.daysLeft <= daysAhead && m.daysLeft >= 0);
    }

    const formatted = meetings.slice(0, 20).map(m => ({
      symbol: m.symbol || '',
      scripCode: m.scripCode || '',
      companyName: m.companyName || '',
      meetingDate: m.meetingDate || '',
      purpose: m.purpose || 'Board Meeting / Results Consideration',
      daysLeft: m.daysLeft ?? null
    }));

    const payload = {
      success: true,
      count: formatted.length,
      symbol: rawSymbol || undefined,
      daysAhead,
      meetings: formatted
    };

    aiCache.set(cacheKey, payload, 60 * 1000);
    res.setHeader('X-Cache', 'MISS');
    res.json(payload);
  } catch (_error: any) {
    res.status(500).json({
      success: false,
      error: 'Unable to retrieve board meetings schedule at this moment. Please retry shortly.'
    });
  }
});

// 7. Company lookup endpoint (10m in-memory TTL cache)
aiPluginRouter.get('/v1/company', async (req, res) => {
  try {
    const query = String(req.query.query || '').trim().replace(/[^a-zA-Z0-9._\-\s]/g, '').slice(0, 60);
    if (!query) {
      return res.status(400).json({
        success: false,
        error: "Missing required query parameter: 'query' (e.g. 'Reliance', '500325', 'INFY')"
      });
    }

    const cacheKey = `company:${query.toUpperCase()}`;
    const cached = aiCache.get<any>(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    let resolved = await resolveStockDetails(query);

    if (!resolved) {
      const all = getAllStockEntries();
      const qUpper = query.toUpperCase();
      resolved = all.find(e => 
        e.symbol.toUpperCase() === qUpper || 
        e.scripCode === query || 
        e.name.toUpperCase().includes(qUpper) ||
        (Array.isArray(e.nameKeywords) && e.nameKeywords.some(k => k.includes(qUpper)))
      ) || null;
    }

    if (!resolved) {
      const notFoundPayload = {
        success: true,
        found: false,
        query,
        message: `Company '${query}' not found in BSE curated directory.`
      };
      aiCache.set(cacheKey, notFoundPayload, 60 * 1000);
      res.setHeader('X-Cache', 'MISS');
      return res.json(notFoundPayload);
    }

    const payload = {
      success: true,
      found: true,
      company: {
        symbol: resolved.symbol,
        scripCode: resolved.scripCode,
        name: resolved.name,
        sector: resolved.sector || 'Listed Equity',
        nexusCompanyUrl: `https://bsenexus.in/company/${encodeURIComponent(resolved.symbol)}`
      }
    };

    aiCache.set(cacheKey, payload, 10 * 60 * 1000);
    res.setHeader('X-Cache', 'MISS');
    res.json(payload);
  } catch (_error: any) {
    res.status(500).json({
      success: false,
      error: 'Unable to look up company directory at this moment.'
    });
  }
});
