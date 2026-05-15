#!/bin/sh

# Strict order: migrate -> seed -> start NestJS.
# `set -e` ensures any failure aborts the deploy (Render marks it failed).
set -e

echo "🚀 Starting deployment script (migrate -> seed -> start)..."

# 1. Apply database migrations.
echo "📦 [1/3] Running Prisma migrations..."
npx prisma migrate deploy

# 2. Run the idempotent seed. Halts the deploy on failure.
echo "🌱 [2/3] Running Prisma seed..."
npx prisma db seed

# 3. Start the NestJS application on 0.0.0.0:$PORT (Render contract).
echo "🟢 [3/3] Starting NestJS application..."
exec node dist/src/main.js
