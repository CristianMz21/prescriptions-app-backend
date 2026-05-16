#!/usr/bin/env bash
# QA acceptance check #10 — README setup ≤ 15 minutes.
#
# Walks the canonical bring-up path documented in README.md
# (install → prisma generate → migrate dev → seed) against an
# already-running Postgres (provided either by the surrounding CI
# job's `services:` block or by the dev's docker-compose). Exits
# non-zero if any step fails OR if the total wall-clock exceeds
# 900 seconds.
#
# Intentionally does NOT start the backend server — that's a follow-up
# step that depends on app-level wiring; the brief's #10 is about
# bring-up readiness (DB-side), not server boot.
#
# Usage:
#   QA_SETUP_BUDGET_SECONDS=900 bash scripts/qa-setup-stopwatch.sh
#
# Env:
#   QA_SETUP_BUDGET_SECONDS  hard cap in seconds (default 900 = 15min)

set -euo pipefail

BUDGET="${QA_SETUP_BUDGET_SECONDS:-900}"
START=$(date +%s)

echo "▶ pnpm install --frozen-lockfile"
pnpm install --frozen-lockfile

echo "▶ pnpm exec prisma generate"
pnpm exec prisma generate

echo "▶ pnpm exec prisma migrate deploy"
pnpm exec prisma migrate deploy

echo "▶ pnpm exec prisma db seed"
pnpm exec prisma db seed

echo "▶ pnpm run qa:seed-smoke (validate seed contract)"
pnpm run qa:seed-smoke

END=$(date +%s)
ELAPSED=$((END - START))

echo ""
echo "=== QA setup stopwatch ==="
echo "elapsed: ${ELAPSED}s (budget: ${BUDGET}s)"

if [ "$ELAPSED" -gt "$BUDGET" ]; then
  echo "❌ Setup exceeded the ${BUDGET}s budget"
  exit 1
fi
echo "✅ Setup within ${BUDGET}s budget"
