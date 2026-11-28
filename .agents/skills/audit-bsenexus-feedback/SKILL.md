---
name: audit-bsenexus-feedback
description: Audit or implement BSE Nexus mobile interactions, button feedback, refresh, haptics, gestures, navigation and simple version labels. Use for nested Watchlist, filing, Settings, admin or PWA journeys.
---

# Interaction and feedback review

1. Walk each task from the user's entry point to its outcome. Check Guest, Pro and admin permissions. Make the common action visible beside its context. Remove duplicate actions when the surviving route serves the same role. Give physical Back and an explicit close action a predictable focus and scroll destination.
2. Use approximately 44 CSS px for common touch controls. Keep a visible pressed state and keyboard focus. Use a short movement or surface change where it clarifies what was pressed. See how the state reads at rest with Reduced Motion and on platforms with no vibration.
3. Treat haptics as optional reinforcement. One light tick may signal an intentional gesture crossing its threshold. Reserve confirmation for an accepted or verified outcome. Foreground polling, focus, ordinary scrolling and failed requests use visual or text feedback. Pull gestures stay quiet.
4. Refresh in place. Deduplicate repeated input and retain the last good data. Name the read scope. Test failure, cancellation, retry, account switch and completion with real response outcomes. Protect ingestion cadence.
5. Give swipe actions an equivalent visible control. Preserve vertical scrolling, system Back and keyboard semantics. Swipe may reveal an action, with an explicit press required for a mutation or quota-using summary. Test the one-handed path before retaining that interaction.
6. Show a short version such as `v2.6.88` in the footer. Keep full build metadata one press away for support. Prefer on-demand admin diagnostics with provider console access when the service already supplies the information.
7. Record actual results at 360px, 390px, tablet and desktop, plus available iPhone Safari and Android Chrome/PWA. Describe evidence gaps by device or state.

References are [Apple HIG Playing haptics](https://developer.apple.com/design/human-interface-guidelines/playing-haptics) and [MDN Navigator.vibrate](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/vibrate).
