# Change: pin workflow actions and weekly dependency updates (Task 7 / WF-1)

- Starting commit: `7200ff2cba5bb28b9052c4d05eeb813c3c2650cf`, latest origin/main checked before branch.
- Objective: replace mutable action tags with full commit SHAs, retain contents:read and persist-credentials:false, no pull_request_target; configure weekly grouped actions/npm Dependabot updates.
- Verified official source, 30 October 2026: GitHub refs/tags/v7 for actions/checkout resolves directly to commit 3d3c42e5aac5ba805825da76410c181273ba90b1; actions/setup-node v7 resolves directly to commit 949feb2413d6458794dcd2491c4babbbce0c15c1. No action major/runtime change. Tag names remain comments for reviewers/Dependabot.
- Impact: first `npm run map:impact -- package.json .github/workflows/backend-rules.yml` reports unknown .github path (map intentionally excludes .github); reran successfully for package.json before editing, inspected workflow job/action/permission/cache/install/build consumers manually. Relevant domains: operations and document-startup-security. Generated map is not proof of CI execution.
- Source of truth: .github/workflows/backend-rules.yml and new .github/dependabot.yml. Every checkout/setup-node occurrence pinned; trigger/job commands/Node version/permissions/credential policy unchanged. Dependabot weekly group for GitHub actions; npm minor/patch updates grouped, major upgrades remain individually reviewable, no automatic merge.
- Consumers: all four GitHub jobs changed only in action identity; npm lockfile/application/schema/prices/referrals unchanged. Existing GitHub App permissions must permit workflow writes; CI evidence to be read from final PR head.
- Scope: CI/config only, no runtime or rendered behavior. No new unit test for this small configuration change; independent YAML/action-ref validation and actual hosted CI are the acceptance evidence, not implementation-mirroring tests.
- Commands/results: pending below; all required local checks will run. New map output reflects operations-domain documentation, since .github files are outside the scanner.
- Owner steps/rollback: review/merge separately; Dependabot may require repository enablement. No deployment/migration. Revert workflow/config PR to restore prior setup (and tag-movement risk).
- Risks: SHA pins limit moved-tag risk, but action-code review and package/runner trust remain necessary. Configured npx bun version is unchanged; this task does not audit every transitive CI download.
- Delivery: pending commit/PR; not merged; CI pending; browser not applicable; not deployed.

## Actual verification

- `npm ci`: passed (661 packages, eight local Firebase patches).
- Final serialized checks all exited **0**: `npm run lint`, `npm test` (**873 passed**, 33 suites, no skipped/failed), `npm run build` (actual prebuild/TypeScript/Vite/budget/server/copy), `npm run map:generate`, `npm run test:map` (**6/6**), `npm run map:check`. Incidental version bump reverted.
- Independent YAML parse/assertions passed: eight full SHA-pinned checkout/setup-node references, contents:read, every checkout persist-credentials:false, no pull_request_target, exactly two weekly grouped ecosystems. No new unit test or old-code execution; original mutable tags are directly observable in the diff.
- `git diff --check`: passed. Browser/runtime/migration/deployment checks are not applicable to CI-only changes. Hosted CI must still run on the actual PR SHA; local passing results do not satisfy that separate gate.
