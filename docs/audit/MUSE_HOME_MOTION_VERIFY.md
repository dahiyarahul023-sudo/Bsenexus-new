# Muse — homepage motion and device verification

## Scope

Homepage-only branch: `feat/connected-homepage-motion`, based on production main `5776ebb25c96b46454e20e5b4e5f1aa7127eb5ce`. The payment/staging work in PR #4 remains paused. This branch has no database migration, payment, authentication or quota policy change.

Use the reviewed homepage branch in an isolated visual preview if your tools support it. Record the actual source commit and preview URL. If AI Studio still cannot select the branch, report that limitation; do not change the production app's source or merge a different PR to manufacture a preview. No infrastructure setup is requested in this handoff.

## What changed

- Explore Features scrolls to Core Features and moves keyboard focus there; Enter Live Terminal keeps its terminal destination.
- Phone preview fits narrow screens; desktop support cards enter once, while phone movement follows bounded scroll progress. Mobile support cards stack.
- Feature selection changes its sample panel, CTA, metric and graph together. The tour starts only via Play, pauses on hover/focus and while offscreen/hidden, and stops on manual feature selection. Reduced-motion users get manual controls.
- One illustrative INFY filing now connects source → AI figures → revenue graph → watchlist alert. Desktop scroll advances stages; every stage is also available by button on all widths. Mobile/tablet use normal document flow.
- INFY sample figures now match between feed and AI panel. October sample calendar starts on Thursday. The watchlist sample has five stocks and says five.
- Removed an unused homepage interval. Reduced motion disables new scroll/pointer effects; reveal content is immediately visible, and the ambient canvas responds to preference changes.

Everything in these new previews is sample data. Do not generate a real AI summary or trigger Telegram/payment calls to test motion.

## Required visual checks

1. At the page top, confirm neither CTA nor the phone's edges are cut off at 320, 390 and 430 CSS px. Check bottom scroll too. Inspect cards individually: document overflow alone does not prove their inner text fits.
2. Activate Explore Features with touch and with keyboard Enter. It must reach the feature heading below the sticky header, without opening login. The keyboard focus must move to the feature section. Enter Live Terminal must retain its normal route/login behavior.
3. Select all four features. The panel, metric, graph and CTA must agree. AI shows illustrative INFY revenue +7.8%; it must not remain on the old +12.4% figure. The graph card must not cover the panel on phone/tablet.
4. Play and Pause the feature tour. Move focus into it and manually select a feature; no timer should then overwrite the selection. Background the tab and return. Reduced-motion mode must not auto-cycle or scroll-scrub the new scenes.
5. On desktop, scroll slowly forward/backward through all four filing stages. Check the source/AI figures/graph/alert retain the same company; connections, active step and graph endpoint must agree. Tap each stage on mobile. Repeated taps must remain responsive.
6. Toggle dark/light theme, rotate portrait/landscape, use split view/resizable windows, increase browser text/zoom to 200%, and change reduced-motion preference while open. Check keyboard focus visibility, header overlap, graph labels and touch targets.
7. Check scrolling/graph motion on the actual devices available. Record visible stutter, frames dropped, or interaction delay; do not infer a 60fps guarantee from viewport emulation.

## Device evidence

Cover actual iPhone Safari, iPad Safari (portrait, landscape and split view), Mac Safari/Chrome, Windows desktop Chrome/Firefox, Android phone Chrome, and Samsung tablet if available. Record device, OS, browser version, viewport, input method, theme and motion preference. Mark every case PASS, FAIL or NOT RUN. Emulation is useful but must be labeled emulation, never an actual iPhone/iPad test.

Return screenshots/video, console errors and exact reproduction steps for failures to the existing `Bsenexus-Codex-Muse` Drive folder. If actual devices are unavailable, return the browser evidence and explicitly leave those checks pending. Codex will repair source issues.

## Release boundary

This is a visual-review handoff, not a statement that these changes are live. Do not merge PR #4 or run migration 006 for this homepage work. Record any future homepage merge and deployed revision separately; a source push or preview is not a production verification.
