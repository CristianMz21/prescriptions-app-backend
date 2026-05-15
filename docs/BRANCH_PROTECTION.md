# Branch protection — `main`

`main` is the deployment branch. Every change must land via a pull request that
passes the full CI matrix; direct pushes and force-pushes are blocked.

These rules are not auto-applied. A maintainer with `admin` scope on the
GitHub token applies them manually by running:

```bash
gh auth status                      # confirm admin scope
bash scripts/apply-branch-protection.sh
```

The script is idempotent — re-running it is a no-op when the rules are already
in place; it updates them when they differ.

## Rules enforced

| Rule | Setting |
| --- | --- |
| Pull request required | ✅ (no direct pushes) |
| Required approvals | 1 |
| Dismiss stale approvals on new push | ✅ |
| Require code owner review | ❌ (no CODEOWNERS file) |
| Require status checks to pass | ✅ |
| Require branches up to date before merging | ✅ (`strict: true`) |
| Required status check contexts | `Lint`, `Typecheck`, `Test Coverage`, `Build`, `OpenAPI`, `SonarCloud`, `Forbidden Patterns`, `SonarCloud Code Analysis` |
| Require conversation resolution | ✅ |
| Require linear history | ✅ (squash/rebase only) |
| Include administrators | ✅ (admins not exempt) |
| Allow force pushes | ❌ |
| Allow deletions | ❌ |
| Require signed commits | ❌ (opt-in; flip to `true` when keys are provisioned) |

## How status-check contexts are spelled

GitHub matches required contexts against the `name:` field of each job (or the
job ID when no name is set). The script's contexts list mirrors the names in
`.github/workflows/ci-pr.yml` exactly:

- `Lint` (from job `lint`)
- `Typecheck`
- `Test Coverage`
- `Build`
- `OpenAPI`
- `SonarCloud`
- `Forbidden Patterns`
- `SonarCloud Code Analysis` — the external check posted by SonarCloud after
  the Quality Gate runs. With `-Dsonar.qualitygate.wait=true` the scan job
  already fails on QG failure, but listing the external check here ensures
  branches cannot merge while QG is "in progress".

## When to update

- Adding or renaming a CI job → update the `contexts` array in
  `scripts/apply-branch-protection.sh` and re-run the script.
- Adding a second maintainer → bump `required_approving_review_count`.
- Adding a `CODEOWNERS` file → flip `require_code_owner_reviews` to `true`.

## Verification after applying

```bash
gh api repos/CristianMz21/prescriptions-app-backend/branches/main/protection \
  | jq '{
      required_status_checks,
      enforce_admins: .enforce_admins.enabled,
      allow_force_pushes: .allow_force_pushes.enabled,
      allow_deletions: .allow_deletions.enabled
    }'
```

The output should show `enforce_admins: true`, `allow_force_pushes: false`,
`allow_deletions: false`, and every required context from the table above.
