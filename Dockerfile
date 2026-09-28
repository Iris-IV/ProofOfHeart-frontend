# syntax=docker/dockerfile:1

# Pin digest so CI catches unexpected upstream changes.
# To update: docker pull node:22-alpine && docker inspect node:22-alpine --format '{{index .RepoDigests 0}}'
ARG NODE_IMAGE=node:22-alpine@sha256:9bef0ef1e268f60627da9ba7d7605e8831d5b56ad07487d24d1aa386336d1944

# Stage 1: Install dependencies
# NOTE: The project contains both package-lock.json and pnpm-lock.yaml.
# package-lock.json is chosen as the source of truth because npm is the primary package manager.
# pnpm-lock.yaml is explicitly omitted from COPY to ensure clean, deterministic npm-based builds.
# This stage is optimized for maximum cache reuse - only invalidates when dependencies change.
FROM ${NODE_IMAGE} AS deps
WORKDIR /app

# Copy only dependency manifests first - most stable layer
COPY package.json package-lock.json ./

# Install dependencies in a separate layer for better caching
RUN npm ci --no-audit --no-fund --prefer-offline

# Stage 2: Build the application
FROM ${NODE_IMAGE} AS builder
WORKDIR /app

# Copy installed dependencies from deps stage (reuses cache if deps unchanged)
COPY --from=deps /app/node_modules ./node_modules

# Layer 1: Dependency manifests (rarely change)
COPY package.json package-lock.json ./

# Layer 2: Configuration files (change infrequently)
COPY next.config.ts tsconfig.json postcss.config.mjs eslint.config.mjs ./
COPY .prettierrc .prettierignore ./

# Layer 3: Localization files (change occasionally)
COPY messages ./messages

# Layer 4: Static assets (change occasionally)
COPY public ./public

# Layer 5: Source code (changes most frequently - placed last for optimal caching)
COPY src ./src

ENV NEXT_TELEMETRY_DISABLED=1

# Use Next.js standalone output for smaller image size
RUN npm run build

# Stage 3: Minimal production image
FROM ${NODE_IMAGE} AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root user created in deps stage reused here
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Copy only the standalone output and static assets
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# Probe the existing /api/health endpoint every 30 s.
# Unhealthy after 3 consecutive failures (90 s window).
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
