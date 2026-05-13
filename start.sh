#!/bin/sh

# Exit immediately if a command exits with a non-zero status.
set -e

echo "🚀 Starting deployment script..."

# 1. Apply database migrations
# We use `deploy` instead of `dev` in production. It applies pending migrations
# to the database without attempting to recreate the schema or prompt for input.
echo "📦 Running Prisma migrations..."
npx prisma migrate deploy

# 2. Start the NestJS application
# Using node directly on the compiled main file is the most performant way to run NestJS in production
echo "🟢 Starting NestJS application..."
node dist/src/main.js
