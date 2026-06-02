# syntax=docker/dockerfile:1

# Pin digest so CI catches unexpected upstream changes.
# To update: docker pull node:22-alpine && docker inspect node:22-alpine --format '{{index .RepoDigests 0}}'
ARG NODE_IMAGE=node:22-alpine@sha256:9bef0ef1e268f60627da9ba7d7605e8831d5b56ad07487d24d1aa386336d1944

# Stage 1: Install dependencies
# NOTE: The project contains both package-lock.json and pnpm-lock.yaml.
# package-lock.json is chosen as the source of truth because npm is the primary package manager.
# pnpm-lock.yaml is explicitly omitted from COPY to ensure clean, deterministic npm-based builds.
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Stage 2: Build the application
FROM ${NODE_IMAGE} AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
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
