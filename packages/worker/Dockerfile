# DevFlow Worker Dockerfile
# Use debian-based image for Temporal compatibility (Alpine has issues with native modules)
FROM node:20-slim AS base

# Install required system dependencies for Temporal
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# Set working directory
WORKDIR /app

# Copy workspace files
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY tsconfig.json ./

# ================================
# Dependencies Stage
# ================================
FROM base AS deps

# Copy package.json files for all packages
COPY packages/common/package.json ./packages/common/
COPY packages/sdk/package.json ./packages/sdk/
COPY packages/api/package.json ./packages/api/
COPY packages/worker/package.json ./packages/worker/

# Install dependencies
RUN pnpm install --frozen-lockfile

# ================================
# Build Stage
# ================================
FROM base AS builder

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages

# Copy source code
COPY packages/common ./packages/common
COPY packages/sdk ./packages/sdk
COPY packages/worker ./packages/worker

# Build common package
WORKDIR /app/packages/common
RUN pnpm build

# Build SDK package
WORKDIR /app/packages/sdk
RUN pnpm build

# Generate Prisma Client in builder stage (it has all dependencies)
WORKDIR /app/packages/api
COPY packages/api/prisma ./prisma
RUN pnpm prisma:generate

# Build Worker
WORKDIR /app/packages/worker
RUN pnpm build

# ================================
# Production Stage
# ================================
FROM node:20-slim AS production

# Install required system dependencies for Temporal
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

WORKDIR /app

# Copy package files
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/common/package.json ./packages/common/
COPY packages/sdk/package.json ./packages/sdk/
COPY packages/api/package.json ./packages/api/
COPY packages/worker/package.json ./packages/worker/

# Install all dependencies (needed for prisma generate)
RUN pnpm install --frozen-lockfile

# Copy built artifacts from builder
COPY --from=builder /app/packages/common/dist ./packages/common/dist
COPY --from=builder /app/packages/common/package.json ./packages/common/
COPY --from=builder /app/packages/sdk/dist ./packages/sdk/dist
COPY --from=builder /app/packages/sdk/package.json ./packages/sdk/
COPY --from=builder /app/packages/worker/dist ./packages/worker/dist
COPY --from=builder /app/packages/api/prisma ./packages/api/prisma

# Set working directory to API and generate Prisma client
WORKDIR /app/packages/api
RUN pnpm prisma:generate

# Set working directory to Worker
WORKDIR /app/packages/worker

# Start the worker
CMD ["node", "dist/index.js"]
