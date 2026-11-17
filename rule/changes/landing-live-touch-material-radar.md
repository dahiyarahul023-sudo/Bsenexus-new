# Change Record: Landing Live Touch Background, Material 3 Sign In, Responsive Preview & Impact Radar

## Summary
- **Pre-Login Live Touch & Pointer Background (`src/components/ui/ParticleRibbons.tsx`, `src/components/LandingPage.tsx`)**:
  - Restored and upgraded `<ParticleRibbons theme={theme} />` on the pre-login landing page so the background reacts immediately to every `pointerdown`, `pointermove`, `touchstart`, and `touchmove` interaction with expanding dual-ring Touch Sonar Ripples, radial/tangential node impulse, luminous spline trails, and magnetic telemetry constellation links.
  - Tuned distinct palettes for both **Light ("White") Mode** (`source-over` emerald/sky/indigo jewel tones over crisp light slate) and **Dark Mode** (bioluminescent emerald/cyan/indigo over `#060a10`), with adaptive particle/wave density across phone (`< 640px`), tablet (`640px–1024px`), and desktop (`>= 1024px`) viewports and `prefers-reduced-motion: reduce` support.
- **Google Material Design 3 Filled Sign In CTA (`src/components/LandingPage.tsx`)**:
  - Styled the Sign In button (`data-testid="landing-google-m3-signin"`) and primary CTA using Google Material Design 3 Filled Button geometry (`rounded-full`, `#0b57d0` primary fill in light mode / `#a8c7fa` tonal fill with `#062e6f` label in dark mode, elevation shadow, state-layer hover/active overlay, and instant pointer-down scale feedback).
- **Responsive & Unstuck Calendar and Filing Analysis Preview (`src/components/LandingPage.tsx`, `src/components/landing/UpcomingCatalystsGrid.tsx`, `src/components/landing/ResultsScrollDeck.tsx`, `src/components/landing/CoreCapabilitiesBento.tsx`)**:
  - Preloaded `LandingExamples` on hover/touch/focus while preserving dynamic import separation for startup performance budgets.
  - Wired working filter pills (`All Catalysts`, `Quarterly Results`, `Dividends & Board`) and non-truncating responsive company cards in `UpcomingCatalystsGrid.tsx`.
  - Replaced `motion.div` with `LazyMotion`-compatible `m.div` in `ResultsScrollDeck.tsx`, paused auto-advance on touch/pointer down as well as hover, and added horizontal swipe + explicit Prev/Next buttons.
- **Impact Radar Error/Empty State & SQL Migration Completeness (`src/components/ImpactRadar.tsx`, `supabase/migrations/*.sql`)**:
  - Restored missing SQL migration files required by PGlite contract tests and `rule/domains.json`.
  - Updated `ImpactRadar.tsx` so error states expose an in-place `Retry` button, do not simultaneously render empty-state copy when `state.error` is active (Rule F10), and highlight the active Market reaction filter tab (`is-selected`).

## Consumer Disposition
- `src/components/LandingPage.tsx`: **changed** — mounts `ParticleRibbons`, Material 3 Filled Sign In CTA, preload-on-intent preview disclosure, and shared `PRO_PLAN_LIST` / `AI_ALLOWANCE_COPY` pricing cards.
- `src/components/ui/ParticleRibbons.tsx`: **changed** — touch/pointer sonar ripples, spline trails, magnetic nodes, adaptive phone/tablet/desktop density, and light/dark mode palettes.
- `src/components/landing/UpcomingCatalystsGrid.tsx`: **changed** — interactive catalyst filter tabs, selected catalyst preview bar, and responsive card layout.
- `src/components/landing/ResultsScrollDeck.tsx`: **changed** — `m.div` LazyMotion compatibility, touch/pointer pause, swipe gesture handling, and Prev/Next buttons.
- `src/components/landing/CoreCapabilitiesBento.tsx`: **changed** — responsive glassmorphic capability cards with scrip-verified highlights.
- `src/components/ImpactRadar.tsx`: **changed** — in-place `Retry` action in error status, mutual exclusion between error banner and empty state copy, and `is-selected` class on reaction filter buttons.
- `src/App.tsx`: **reviewed-and-compatible** — passes `theme`, `setTheme`, `onEnterTerminal`, `onSelectCompany`, and `onNavigate` to `LandingPage`.
- `src/components/landing/LandingExamples.tsx`: **reviewed-and-compatible** — remains dynamically imported by `LandingPage.tsx` and composes `UpcomingCatalystsGrid` + `ResultsScrollDeck`.
- `server/db/impactRadarDao.ts`: **reviewed-and-compatible** — preserves Backend Rule R12 durability contract without silent local fallback.
