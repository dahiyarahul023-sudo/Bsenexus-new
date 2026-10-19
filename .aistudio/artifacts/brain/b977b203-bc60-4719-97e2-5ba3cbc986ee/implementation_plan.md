# Universal AI Plugin & Action Schema for ChatGPT, Gemini & Custom Chatbots

Enable any external AI model (ChatGPT Custom GPTs, Google Gemini Tools, Claude Projects, Telegram bots, or custom LLM agents) to extract real-time BSE corporate filings, financial results, board meetings, and company intelligence directly from BSE Nexus via open, standardized OpenAPI 3.1 actions and an interactive web playground.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural parameters have been established based on your feedback:

- **Confirmed Integration Standard**: Universal OpenAPI 3.1 Action Schema + Gemini Function Declarations (`/api/ai/openapi.json` and `/api/ai/gemini-tools.json`). Compatible natively with ChatGPT Custom GPTs, Gemini SDK, LangChain, LlamaIndex, and Cursor/Copilot.
- **Confirmed Data Scope**: Complete financial & regulatory intelligence — real-time BSE filings, quarterly earnings & financial scorecards, upcoming board meetings/dividends, and curated company profiles with BSE scrip resolution.
- **Confirmed Authentication & Access**: Instant open access with sensible rate limiting (no mandatory API keys or signups to start). Full CORS support, edge caching, and graceful 429 throttling.
- **Confirmed Interactive Experience**: Dedicated `/plugin` (and `/ai-plugin`) interactive portal on BSE Nexus featuring 1-click schema copying, setup guides for ChatGPT and Gemini, and an interactive in-browser query test console.

---

## 1. Overview & Core Concept

### What It Does
Provides an ultra-lightweight, high-speed AI integration layer on top of BSE Nexus. Any user can take the BSE Nexus OpenAPI URL (`https://bsenexus.in/api/ai/openapi.json`) and paste it into a ChatGPT Custom GPT, Gemini agent, or Telegram bot. The AI model automatically gains the ability to answer live questions like:
- *"Did Reliance release any new BSE announcements today?"*
- *"Show me Tata Motors Q2 FY26 financial results and profit margin."*
- *"When is the next board meeting for Infosys regarding dividends?"*
- *"Give me all high-impact SEBI Regulation 30 filings from this morning."*

### Target Audience & Persona
1. **Retail Investors & Traders**: Wanting to ask their personal ChatGPT / Gemini mobile app for instant BSE filing updates while on the go.
2. **Community Managers & FinTech Creators**: Running Telegram or Discord trading channels that want an instant bot without coding backend scrapers.
3. **Developers & Financial Analysts**: Building automated research pipelines or algorithmic tracking using Python, LangChain, or TypeScript.
4. **BSE Nexus Growth**: Driving massive organic discovery and domain authority as third-party AI assistants cite `bsenexus.in` in every answer.

---

## 2. User Experience & Visual Design

### Key User Flows

```
[User visits /plugin or /ai-plugin]
       │
       ├──► 1-Click "Copy OpenAPI URL" (for ChatGPT Custom GPT Action)
       │
       ├──► 1-Click "Copy Gemini Tools Schema" (for Google GenAI SDK / Gemini Pro)
       │
       ├──► "Interactive Test Console" (Run live query: e.g. "Reliance Board Meeting", see real JSON output)
       │
       └──► "Quick Setup Guides" (Step-by-step visual cards for ChatGPT, Gemini, and Telegram bots)
```

### Visual Identity & Theme (SaaS Developer Console & Apple Motion)
- **Aesthetic Direction**: High-density financial terminal aesthetic matching BSE Nexus's dark slate palette (`#0B0F19`, `#121624`), emerald accents (`#10B981`), and crisp hairline borders (`rgba(255,255,255,0.08)`).
- **Typography**: 
  - Headlines & Section Titles: `Outfit` / `Plus Jakarta Sans` with tight negative tracking (`-0.02em`).
  - Code Blocks & API Parameters: `JetBrains Mono` with tabular numerals (`tabular-nums`).
  - Body Text: Clean 15px `Plus Jakarta Sans` with generous leading (`1.6`).
- **Interactive Micro-Interactions**:
  - 1-Click copy buttons with instant green checkmark and haptic feedback.
  - Interactive "Run Test Call" button executing live fetch with latency timer (e.g. `⚡ 68ms`).
  - Collapsible response viewer with syntax highlighting and formatted payload tabs.
- **Top Bar & Navigation Integration**:
  - Added clean text link to `/plugin` in the main nav menu and footer under "Developers & AI".

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: OpenAPI 3.1 Spec vs Proprietary Plugin Manifest
- **Chosen Approach**: Standard OpenAPI 3.1 schema served at `/api/ai/openapi.json` + manifest at `/.well-known/ai-plugin.json`.
- **Why**: OpenAI deprecated legacy ChatGPT plugins in favor of Custom GPT Actions (which use OpenAPI specifications), and Google Gemini Function Calling also imports directly from OpenAPI schemas. One specification supports 100% of modern LLMs.
- **Trade-off**: Requires strict parameter validation on query endpoints, handled efficiently via Express route schemas.

### Decision 2: Open Public Access vs API Key Requirement
- **Chosen Approach**: Open access with IP-based token-bucket rate limiting (e.g., 60 requests/minute per IP, burstable to 120), plus an optional header `x-api-key` for power users in the future.
- **Why**: Eliminates 100% of user friction. A user can connect their AI in under 10 seconds without having to create an account, verify email, or manage keys.
- **Security & Reliability Safeguards**:
  - In-memory rate limiting with 60s sliding window.
  - Edge caching (`Cache-Control: public, max-age=30, s-maxage=60, stale-while-revalidate=120`) so identical requests hit memory cache without stressing BSE upstream scrapers.
  - Query sanitization and payload cap (max 25 results per page).

### Decision 3: AI-Optimized Response Payloads
- **Chosen Approach**: Clean JSON with stripped HTML, normalized dates (`ISO 8601`), plain-English category tags, and direct permalinks back to BSE Nexus (`https://bsenexus.in/announcement/:newsId`).
- **Why**: Standard web scraping returns messy HTML and huge payloads that consume the LLM's context window. Our AI endpoints return concise, token-efficient summaries that reduce LLM token usage by ~70%.

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                   EXTERNAL AI CLIENTS & CONSUMERS                      │
│   ChatGPT Custom Actions  │  Google Gemini 2.5/3  │  Telegram / Python  │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     │ HTTPS (OpenAPI / JSON)
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 BSE NEXUS AI GATEWAY (server.ts)                       │
│                                                                        │
│   GET /.well-known/ai-plugin.json     ──► Manifest Metadata            │
│   GET /api/ai/openapi.json            ──► OpenAPI 3.1 Specifications   │
│   GET /api/ai/gemini-tools.json       ──► Gemini Function Declarations │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ Rate Limiter & CORS Middleware (Allow * for AI tools)          │   │
│   └────────────────────────────────┬───────────────────────────────┘   │
│                                    │                                   │
│   ┌────────────────────────────────┴───────────────────────────────┐   │
│   │                      AI ENDPOINT HANDLERS                      │   │
│   │                                                                │   │
│   │  • /api/ai/v1/filings          ──► Recent announcements        │   │
│   │  • /api/ai/v1/results          ──► Quarterly earnings & stats  │   │
│   │  • /api/ai/v1/board-meetings   ──► Scheduled board meetings    │   │
│   │  • /api/ai/v1/company          ──► Scrip, ISIN, company intel │   │
│   └────────────────────────────────┬───────────────────────────────┘   │
└────────────────────────────────────┼───────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 BSE NEXUS CORE DATA & CACHE SERVICES                   │
│   announcements.json  │  corporateActions.ts  │  financialResults.ts   │
└────────────────────────────────────────────────────────────────────────┘
```

### Proposed Endpoints & Schema Specifications

1. `GET /api/ai/openapi.json`:
   - Complete OpenAPI 3.1 document with semantic operation descriptions optimized for LLM function-calling routing.
2. `GET /api/ai/v1/filings`:
   - Query params: `symbol` (e.g. `RELIANCE`), `category` (e.g. `Board Meeting`, `Financial Results`, `Order Wins`), `limit` (default 10, max 25).
   - Response: Array of `{ id, symbol, companyName, scripCode, headline, summary, category, timestamp, pdfUrl, nexusUrl }`.
3. `GET /api/ai/v1/results`:
   - Query params: `symbol`, `quarter` (e.g. `Q2-FY26`), `year`.
   - Response: Financial metrics `{ symbol, period, revenue, ebitda, netProfit, marginPercent, filingUrl }`.
4. `GET /api/ai/v1/board-meetings`:
   - Query params: `symbol`, `daysAhead` (default 14).
   - Response: Scheduled events `{ symbol, meetingDate, purpose, announcementDate }`.
5. `GET /api/ai/v1/company`:
   - Query params: `query` (symbol or BSE scrip code or company name).
   - Response: Profile `{ symbol, scripCode, name, isin, sector, marketCapCategory, recentFilingCount }`.
6. `GET /plugin` & `/ai-plugin`:
   - Public frontend portal displaying 1-click copy cards, setup guides, and interactive query playground.

---

## 5. Implementation Phases

- **Phase 1: Backend AI Gateway & OpenAPI Specification** (`server/services/aiGatewayService.ts` & `server.ts`)
  - Implement `/api/ai/openapi.json` and `/.well-known/ai-plugin.json`.
  - Add `/api/ai/v1/*` endpoint handlers with token-efficient formatting, CORS headers, and in-memory rate limiting.
- **Phase 2: Automated Tests & Verification** (`server/tests/aiGateway.test.ts`)
  - Verify JSON schemas parse strictly against OpenAPI 3.1 validators.
  - Verify endpoints handle symbol lookups, case insensitivity, rate limits, and 404/400 errors gracefully.
- **Phase 3: Interactive Developer & AI Portal** (`src/components/AiPluginPage.tsx`)
  - Build responsive interactive playground with live query simulation, copy-paste snippets for ChatGPT and Gemini, and setup cards.
  - Wire client-side route `/plugin` and `/ai-plugin` into `App.tsx` and sitemap.
- **Phase 4: Verification & Build**
  - Run `compile_applet`, `lint_applet`, and test suite to ensure 0 errors and zero regressions.
