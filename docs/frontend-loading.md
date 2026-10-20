# Frontend loading rules

Use these rules when adding or editing screens. Reference: IBM Carbon loading patterns:
https://www.carbondesignsystem.com/building-blocks/core/patterns/loading

- Never fade the entire screen to zero opacity during navigation. Mount the destination in the same commit; show its real content or an eagerly imported Suspense fallback.
- Show skeletons only while content is actually unavailable. Do not add artificial delays or skeletons for synchronous Settings sections.
- Keep loaded content during background refresh. Empty states belong after loading completes; errors need their own recovery UI.
- Match the destination's container width, padding, card shape, responsive columns and saved list/grid preference. Reuse the destination grid where possible.
- Placeholder lengths follow content roles, not random values. Current shared defaults: title 62%, subtitle 36%, body 92% then 72%; short metadata stays compact. These are project defaults, not universal standards; adjust to the real component.
- Preserve known headings, navigation and usable controls. Skeletonize unavailable data, not every button or the whole modal shell.
- Use one calm loading rhythm, neutral light/dark colors and static placeholders for reduced motion. Do not invent preview data.
- Announce a concise loading status; hide decorative placeholders from assistive technology. Preserve focus and drafts across navigation.
- Load sections independently when possible. Replace each placeholder with ready content without moving surrounding controls unnecessarily.
- Validate slow loading, cached navigation, rapid changes, error/empty states and phone/tablet/desktop sizing for each changed screen.

Current coverage: terminal lazy-tab fallbacks, Home initial data, Notes initial data, and navigation/Settings transitions. Existing Filings, Results and News data skeletons remain in place. Apply the same rules to nested sections as they are edited.
