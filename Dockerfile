# ---------------------------------------------------------
# Stage 1: Dependencies & Builder
# ---------------------------------------------------------
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install pnpm for efficient package management
RUN npm install -g pnpm

# Copy package.json and lock files
COPY package.json pnpm-lock.yaml ./
# Copy Prisma schema before installing dependencies so `prisma generate` can run automatically if configured,
# or we run it explicitly right after.
COPY prisma ./prisma/

# Install ALL dependencies (including devDependencies for building)
RUN pnpm install --frozen-lockfile

# Generate Prisma Client (CRITICAL step before building NestJS)
RUN npx prisma generate

# Copy the rest of the application source code
COPY . .

# Build the NestJS application
RUN pnpm run build

# ---------------------------------------------------------
# Stage 2: Production Final Image
# ---------------------------------------------------------
FROM node:20-alpine AS production

# Set Node environment to production for framework optimizations
ENV NODE_ENV=production

WORKDIR /app

# Install dependencies needed by Puppeteer in Alpine
# (Puppeteer requires certain system libraries to run Chromium headless)
RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont \
      nodejs \
      yarn

# Tell Puppeteer to use the installed Chromium instead of downloading its own
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copy necessary files from the builder stage
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
# Copy the start script
COPY --from=builder /app/start.sh ./

# Install ONLY production dependencies to keep the image size minimal
RUN npm install -g pnpm && pnpm install --prod --frozen-lockfile

# Generate Prisma Client again for the production stage
RUN npx prisma generate

# Ensure the start script is executable
RUN chmod +x ./start.sh

# Change ownership of the app directory to the non-root 'node' user
RUN chown -R node:node /app

# Switch to the non-root user for enhanced container security
USER node

# Expose the standard NestJS port
EXPOSE 3000

# Run the startup script which handles DB migrations before booting the app
CMD ["./start.sh"]
