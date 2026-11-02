# Change: Streamline Landing Page & Apple-Style Fluid Motion

## Problem Statement
The landing page had grown excessively oversized (~2,488 lines), featuring heavy redundant sections, repeated copy blocks (e.g. scattered About summaries), an unnecessary 30-stock directory that bloated the public DOM, and static presentation without modern scroll-driven kinetic feedback.

## Implementation Details
1. **Clutter Elimination & Mobile/Desktop Viewport Stability**:
   - Replaced the heavy static 30-stock company list with the hardware-accelerated, single-row `MarketTickerTape`.
   - Eliminated the broken `300vh` sticky scroll track in `Kinetic3DFlythrough.tsx` which caused massive white gaps and layout collapse on mobile and desktop viewports.
   - Replaced tacky "Stage 1 2 3" text with organic fluid component transitions.
2. **Multi-Company Catalyst Calendar Grid & 3D Red Calendar (`UpcomingCatalystsGrid.tsx` & `CalendarDateBadge3D.tsx`)**:
   - Built the Apple-style `CalendarDateBadge3D` with rich crimson-red top header, metallic spiral binder rings, crisp white tear-off paper body, and bold tabular dates.
   - Applied `CalendarDateBadge3D` consistently across the corporate catalysts grid and Hero calendar CTA.
   - Fixed `reliance.svg` viewBox to `730 -10 885 830` so the official Reliance gold flame roundel renders centered and razor sharp, avoiding cut-off or blurry blobs.
   - Refined `CompanyLogo.tsx` with high-contrast tiles and smooth hover micro-interactions.
   - Replaced clumsy floating pill tags with clean Apple frosted glass panels and inline metadata.
3. **Authentic Official Brand Icons & Unified Telegram Logos**:
   - Replaced generic Lucide icons in `CoreCapabilitiesBento.tsx` (Pillar 2) and Hero trust badges with the authentic, official Telegram logo (sky-blue gradient roundel with crisp white paper airplane).
   - Standardized official vector brand marks for Telegram, Instagram, X, Threads, and LinkedIn across the entire landing page.
4. **Institutional AI Emblem (`AiIntelligenceLogo.tsx`)**:
   - Replaced generic sparkle icons with a bespoke multi-axis diamond vector emblem representing algorithmic analysis and low-latency intelligence.
5. **Theme-Matched Community Social Banner (`CommunitySocialBanner.tsx`)**:
   - Replaced hardcoded `#1A1828` dark box with a theme-adaptive frosted glass banner (`bg-white/85 dark:bg-slate-900/75`).
   - Integrated official brand SVGs and direct channels: Instagram (`@bsenexus`), Telegram (`@BseNexusOfficial`), X (`@bsenexus`), Threads (`@bsenexus`), and LinkedIn.
6. **Pricing Tiers Unification & Elimination of Duplicates**:
   - Distinct, verified pricing cards: Weekly Pro (₹89), Monthly Pro (₹299), and Annual Pro (₹2,699) with explicit light/dark background elevation and zero duplicate 299 values.
7. **Dynamic Scroll-Linked Ambient Lighting & Apple Glass Design**:
   - `ParticleRibbons.tsx`: Upgraded with real-time `window.scrollY` progression and touch listeners (`touchstart`, `touchmove`). As the user scrolls, a dynamic spotlight smoothly glides across the viewport along an organic S-curve, morphing section colors (Hero Cyan → Catalysts Emerald → Results Royal Blue → Bento Violet → Pricing Teal) and expanding gently near interactive buttons and cards.
   - Light Mode Consistency: Pure high-contrast surfaces (`bg-white/95 dark:bg-slate-900/85`) across Bento grid, Catalysts, and Plan cards with zero unreadable dark artifacts.
8. **Verification**:
   - `lint_applet` (`tsc --noEmit`) verified with 0 errors.
   - `compile_applet` passed cleanly.
   - `spider-map.json` and `spider-map.html` regenerated with `npm run map:generate` and verified with `npm run map:check` and `npm run test:map` (6/6 tests passing).
   - Dev server returning 200 HTTP status.
