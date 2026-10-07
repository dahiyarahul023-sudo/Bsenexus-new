## Purpose and user-visible effect

## Change evidence

Link `rule/changes/<name>.md`. State facts, unknowns and the starting commit.

## Connected effects

- Changed source of truth:
- Impact command and relevant `rule/domains.json` entries:
- API / UI / storage / RPC / job / cache / copy consumers checked:
- Frontend: routes / state-context / browser events / CSS-tokens / focus-scroll consumers:
- UI loading / empty / error / denied / stale / retry states:
- Security, failure and concurrency cases:

## Validation

Actual commands and results. Distinguish passing, failing and unavailable checks.

- [ ] Read `AGENTS.md` and `rule/README.md` before editing
- [ ] Updated semantic relationships and change record
- [ ] Regenerated the spider map and passed `npm run map:check`
- [ ] Verified relevant behavior, denied access and failure paths
- [ ] Disclosed remaining release blockers and rollback/deployment requirements

For frontend behavior or styling changes: record viewport/theme/keyboard/reduced-motion checks, browser evidence and any untested states. A map check or build is not a visual or accessibility pass.
