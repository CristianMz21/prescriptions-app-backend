#!/usr/bin/env bash
# Apply strict branch protection on `main`.
# Idempotent: re-running updates rules to match this script's body.
# Requires `gh auth status` to show an admin-scoped token for the target repo.
#
# Usage:
#   bash scripts/apply-branch-protection.sh
#   REPO=Owner/Repo BRANCH=develop bash scripts/apply-branch-protection.sh

set -euo pipefail

REPO="${REPO:-CristianMz21/prescriptions-app-backend}"
BRANCH="${BRANCH:-main}"

echo "Applying branch protection on ${REPO}@${BRANCH}..."

gh api -X PUT "repos/${REPO}/branches/${BRANCH}/protection" \
  -H "Accept: application/vnd.github+json" \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Lint",
      "Typecheck",
      "Test Coverage",
      "Build",
      "OpenAPI",
      "SonarCloud",
      "Forbidden Patterns",
      "SonarCloud Code Analysis"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "required_approving_review_count": 1,
    "require_code_owner_reviews": false
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true,
  "required_signatures": false
}
JSON

echo "Done. Verifying with a read-back:"
gh api "repos/${REPO}/branches/${BRANCH}/protection" \
  | jq '{
      required_status_checks,
      enforce_admins: .enforce_admins.enabled,
      allow_force_pushes: .allow_force_pushes.enabled,
      allow_deletions: .allow_deletions.enabled,
      required_pull_request_reviews,
      required_linear_history: .required_linear_history.enabled,
      required_conversation_resolution: .required_conversation_resolution.enabled
    }'
