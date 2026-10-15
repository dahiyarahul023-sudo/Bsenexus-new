# Implementation Plan: Groww-Style Live Market Story Section

Redesign and elevate the Market Story experience on BSE Nexus to match modern fintech standards (Groww / Instagram stories): replacing out-of-place stock photography with clean company logos, real-time BSE indices and announcement metrics, a prominent top-carousel bar on the dashboard, and Apple-grade fluid gesture interactions.

---

## 1. Context & Identified Pain Points

### What was problematic previously:
1. **Hidden Entry Point**: The story modal was tucked away inside a tiny avatar ring in the header (`Layout.tsx`), leading to poor discoverability.
2. **"Strange" Out-of-Place Visuals**: Slides relied on heavy Unsplash/stock photography (factory chimneys, office workers, handshake photos) that look artificial and untrustworthy in a serious financial terminal.
3. **Data Disconnect**: When `/api/story/feed` failed or had stale data, the client fell back to generic placeholders rather than seamlessly surfacing real live announcements, indices, and board meetings.
4. **Desktop & Touch Experience**: Missing the snappy, intuitive top-row carousel seen on Groww and Instagram where users can preview stories at a glance.

---

## 2. Architecture & Data Flow

```
[BSE Announcements / Indices / Calendar] 
           │
           ▼
[Backend: /api/story/feed (storyFeedService.ts)]
   ├── Cached Indices (Sensex, Nifty, VIX, FII/DII)
   ├── Real Bluechip Movers (Gainers / Losers with Live Quotes)
   ├── High-Impact SEBI Reg 30 Filings (Orders, Mergers, Dividends)
   └── Upcoming Board Meetings & Financial Results
           │
           ▼
[Frontend Service: storyData.ts]
   ├── SWR Caching & Live Polling (60s interval)
   ├── Seamless Fallback to /api/announcements & /api/results-calendar
   └── Clean Brand Logos & Data Normalization (Zero Stock Photos)
           │
           ├──► [Top Story Carousel Bar] (Dashboard / Home view)
           │        ├── Segmented Ring Capsules (Sensex, Movers, Filings, Results)
           │        ├── Unviewed Gradient Ring / Viewed State
           │        └── Smooth Horizontal Scroll with Rubber-band physics
           │
           └──► [Groww-Style Story Viewer Modal] (TodayMarketStoryModal.tsx)
                    ├── Segmented Progress Bar per Chapter
                    ├── Clean Brand Logos + Real Badges + Live Metrics
                    ├── Direct Actions (View Stock Intel, Read PDF, Add to Watchlist)
                    └── Apple Fluid Gestures (Swipe, Pause on Hold, Pull-to-dismiss)
```

---

## 3. Proposed Changes

### Phase 1: Backend Feed Hardening (`server/services/storyFeedService.ts` & `server/api/routes.ts`)
- Ensure `/api/story/feed` always returns fresh, verified data with a resilient 30s cache and 60s stale-while-revalidate.
- Enforce clean data payloads without mock data:
  - **Chapter 1: Market Pulse** — Real BSE Sensex, Nifty 50, market status (Open / Closed / Pre-market), and FII/DII flow.
  - **Chapter 2: Top Movers** — Real Gainers and Losers with live prices, percentage change, and scrip codes.
  - **Chapter 3: Major Corporate Actions & Filings** — Filtered SEBI Reg 30 announcements (Order Wins, Demergers, Dividend declarations).
  - **Chapter 4: Upcoming Results** — Upcoming Q2/Q3 earnings meetings with dates and symbols.

### Phase 2: Clean Frontend Story Engine (`src/components/story/storyData.ts` & `StoryVisuals.tsx`)
- Remove all Unsplash / stock photo URL dependencies and placeholder images.
- Standardize all slides around:
  - Clean company logos via `CompanyBrandLogo` (vector symbols, initials with high-contrast colored backgrounds).
  - High-impact stat chips (e.g., `₹2,450.10 (+3.2%)`, `₹1,200 Cr Order Win`, `Dividend ₹15/share`).
  - Concise bullet takeaways instead of generic filler text.
  - Quick action buttons: **Open Intel**, **View BSE PDF**, **Add to Watchlist**.

### Phase 3: Top Dashboard Carousel Bar (`src/components/story/StoryCarouselBar.tsx`)
- Create a dedicated, highly polished horizontal carousel bar placed directly at the top of the main dashboard / home screen.
- Features:
  - 4 curated story capsules:
    1. 📈 **Market Pulse** (Sensex / Nifty live snapshot)
    2. 🚀 **Top Movers** (Leading gainers & losers)
    3. ⚡ **Major Filings** (High-impact BSE announcements)
    4. 📅 **Earnings Radar** (Upcoming results meetings)
  - Unread active story ring with vibrant gradient border; muted ring once viewed (persisted in `localStorage`).
  - Direct click to open the viewer starting specifically at that chapter.
  - Responsive horizontal drag/scroll with fluid momentum and edge rubber-banding.

### Phase 4: Apple-Grade Fluid Story Viewer Modal (`src/components/TodayMarketStoryModal.tsx`)
- Implement Apple fluid design principles:
  - **1:1 Touch Tracking**: Drag down to dismiss with rubber-banding resistance.
  - **Velocity Handoff & Momentum**: Natural spring dismissal and gesture recognition.
  - **Instant Feedback**: Press-and-hold anywhere immediately pauses story progress.
  - **Tap Navigation**: Left 30% goes back, right 70% goes forward.
  - **Deep-link Integration**: Direct hooks into `openIntelModal` and BSE PDF viewer.

---

## 4. Verification Plan

### Build & Integrity Checks:
1. Run `compile_applet` and `lint_applet` to ensure zero compilation or TypeScript errors.
2. Verify impact across dependent components (`Layout.tsx`, `HomeForYou.tsx`, `Announcements.tsx`).

### Browser & Runtime Testing:
1. Verify `/api/story/feed` delivers valid JSON with real BSE data.
2. Confirm the top carousel bar renders seamlessly on both mobile (horizontal scrollable) and desktop without layout shifts.
3. Verify clicking any story capsule opens the Groww-style viewer at the chosen chapter.
4. Test touch gestures: tap left/right, hold to pause, swipe horizontally, and pull-down to dismiss.
5. Verify clean brand logos and live metric pills render crisply in both Dark and Light themes without stock photos.
