# Settings avatar follow-up — 2026-10-10

Starting main: 75a0183b53d13994522b0ca66368ab3247374b52.
User screenshot Screenshot_20261010_164627_Edge.jpg circles the generic Settings Account & Identity icon even though header has selected Sprout. Request: selected avatar on Settings profile and a change option inside Settings.

- Changed SettingsTab renderSectionRow: account row uses shared UserAvatar at reserved 32px instead of generic icon; other section icons unchanged.
- Changed Account & Identity Profile row: shared avatar40px, bounded/truncated username and minimum-width text prevent narrow-width squeeze. Existing button still opens Edit Profile.
- Changed Account section: direct Change avatar toggle reveals existing AvatarPicker. Parent owns scroll; no nested modal. Edit Profile retains its existing picker. Active section/sheet/account changes close draft UI, so two pickers are not mounted simultaneously. Guests do not receive direct save controls.
- Changed Settings search profile registry: avatar/character/photo terms discover the account controls.
- Reviewed-compatible: Firebase confirmed save, duplicate/account guards, provider photo/initials restore, header/UserProfileModal rendering, theme tokens, paid ring, profile name/handle/Telegram form and company logos. No save controller/API/backend changes.
- Impact: npm run map:impact -- src/components/SettingsTab.tsx; source search traced renderSectionRow, activeSection, activeSheet, profile registry and identity form.
- Screenshot_20261010_164551_Edge.jpg shows AI Studio Vite websocket connection errors; Screenshot_20261010_164559_Edge.jpg is blank. Those observations do not establish an avatar failure; no environment configuration or websocket changes made in this bounded request.
- Verification: npm run lint, npm run build, 8 existing avatar save/SSR/asset tests, npm run test:map, map:generate and map:check. Final command evidence inspected before pushing. Build's existing large-chunk warning remains; version bump restored.
- Browser/device interaction, keyboard walkthrough and real Firebase save remain unverified because local preview access is blocked in the environment. compile_applet/lint_applet unavailable; repository typecheck/build equivalents used. Source/build/test evidence is not deployment proof.
- Delivery: direct main push authorized in standing session; CI and deployed/live state reported separately.
