# Change: availability recovery, measured startup/navigation improvements and security fixes

- Starting main: 3d925b0b41841a4636fa8336adf41b0339a09760.
- Objective: audit current and earlier assistant changes; fix confirmed failures without changing auth/payment/feed business policy.
- Evidence, commands, remaining risks and release/rollback: docs/audit/PERFORMANCE_SECURITY_2026-10-11.md.
- Impact commands: map:impact for App/Layout/screen transition/Firebase/SDK startup/responseHeaders; manually reviewed navigation, public, motion, identity, payments, offline/privacy and feed domain consumers. Generated maps/domains refreshed.
- Changed: feed/home lazy loading, skeleton/error fallback; default CTA timing; shared nav/tab indicators; transition scheduling/cleanup; decorative canvas budget; SDK startup; canonical headers; server-only key lookup.
- Reviewed-and-compatible: session/assessment/owner checks, payment/referral prices and grants, notes/watchlist authority, saved panels/scroll restoration, explicit processing interval, public embed/preview, polling/read API. Narrow migration preserves helper inputs and existing paid rows; payment bodies untouched.
- Blocked: new-source browser matrix, production SQL, republish, live speed/CI. Official browser archive invalid; host compile_applet/lint_applet unavailable. Source/tests/build are not browser acceptance.
- Navigation action entry points/state owners unchanged; default action immediate, real loading uses existing skeleton. Explicit busy interval preserved; existing tab boundary handles chunk errors. No draft/identity/paid-access mutation added.
- Security gates: production privilege issue persists until migration; do not apply broken 007. Structural CSP is not strict script mitigation; 0 npm advisories is not zero vulnerabilities.
- Delivery: local validation passed; main/CI/deployed/live status reported separately after publication. Browser/device and measured live performance remain completion gates.
