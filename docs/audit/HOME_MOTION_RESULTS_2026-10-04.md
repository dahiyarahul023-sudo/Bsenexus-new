# Homepage implementation and verification — 4 October 2026

Draft PR: https://github.com/dahiyarahul023-sudo/Bsenexus-new/pull/5

Branch: `feat/connected-homepage-motion`. Verified source commit: `fe09833c3ca3d4246de9b7355a57bbb74a5f58f4`, based directly on main `5776ebb25c96b46454e20e5b4e5f1aa7127eb5ce`. This document/evidence is added after the source commit. Production has not been changed. PR #4 and its payment/staging work remain paused.

## Delivered

An illustrative INFY filing connects source, AI figures, graph and watchlist alert. Desktop scroll selects the stage in either direction; explicit stage controls are available at every width, with normal document flow on mobile/tablet. Graph line and endpoint enter in sequence. The hero phone has bounded scroll movement and a fluid width; supporting cards enter once and stack on mobile.

Explore Features now scrolls and focuses Core Features. The original terminal CTA remains routed to the terminal. Feature selection changes the sample panel, metric, graph and CTA together, including consistent +7.8% INFY revenue figures. The tour is opt-in with Play/Pause and pauses on hover/focus, offscreen and hidden tabs. Manual feature selection stops the tour.

Corrected sample calendar alignment and the watchlist's five-stock label. Removed the unused hero timer. Added touch/pointer gating, visible keyboard outlines, a homepage reduced-motion configuration, immediate reduced-motion reveals, and ambient-canvas preference updates. Financial examples remain clearly illustrative.

## Validation

- 219 configured application tests passed. Initial unconfigured test execution correctly refused missing JWT_SECRET; rerun used a synthetic local test secret and no production credentials.
- TypeScript lint and final production build passed. AGENTS.md's named compile_applet/lint_applet tools are not exposed; repository lint/build were used. Build's automatic local version bump was reverted as directed by src/version.ts.
- 18/18 final Chromium 153 viewport scenarios passed: 320×780, 390×844, 430×932, 768×1024, 820×1180, 1024×768, 1440×900, 1920×1080 and 844×390, each with standard and reduced motion.
- These checked top/bottom document overflow, Explore destination, all feature/metric changes, graph and alert stage controls, tour controls and page errors. Zero document overflow and zero page JavaScript errors in the recorded scenes.
- Two additional desktop keyboard/scroll scenarios passed: Enter activates Explore and moves focus to Core Features; normal-motion scroll selects all four stages forward, while reduced motion retains manual stage controls.
- Supplementary 390px checks also passed theme switch, resize to landscape and 200% root text sizing. This is not a real browser zoom or physical-device test.
- Mobile screenshots were visually inspected. Two earlier screenshot-capture runs timed out at 820px in the local Chromium renderer; subsequent behavior-only runs completed. This does not prove frame performance on real hardware.

Evidence: `home-motion-browser-proof.json`. APIs were mocked and external network requests blocked in these browser checks. No genuine synthesis, payment or Telegram delivery was invoked.

## Still to verify

Actual iPhone/iPad Safari, Android/Samsung devices, Mac Safari, Firefox, browser zoom and reduced-motion preference changes while open, screen-reader behavior, and measured frame performance. These are pending, not PASS. The Instagram reel could not be viewed earlier, so exact matching of its transitions/timing is not claimed. This implements the requested connected-motion direction against our current homepage.

Muse's checklist is `MUSE_HOME_MOTION_VERIFY.md`, also saved in the existing Drive folder. If a branch preview is unavailable, report that blocker; do not alter production merely to obtain a preview. Keep the PR draft until visual/device review is available.
