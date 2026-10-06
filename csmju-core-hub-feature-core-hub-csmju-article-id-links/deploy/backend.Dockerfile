# CSMJU2030 Core Hub — Core API (NestJS 11 + Prisma 7)
# Build from the repository root:  docker build -f deploy/backend.Dockerfile .
#
# Security posture:
#   * multi-stage: compilers and devDependencies never reach the runtime image
#   * runs as the unprivileged `node` user
#   * signing keys are NOT in the image — mounted at runtime (see compose)
#   * no .env baked in — every secret arrives through the environment

# ---------- build stage ----------
FROM node:22-bookworm-slim AS builder

WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
# Prisma picks its schema-engine binary by the OpenSSL it finds at install
# time; without this it falls back to the 1.1.x engine, which the OpenSSL 3
# runtime image cannot use (and the read-only container cannot download).
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && corepack enable pnpm

# prisma.config.ts only attaches a datasource when DATABASE_URL is set, and
# `prisma generate` needs no database — so the build stays offline.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json backend/prisma.config.ts backend/
# The package's postinstall runs `prisma generate`, so the schema must be
# in place before the first install.
COPY backend/prisma backend/prisma
RUN pnpm install --frozen-lockfile --filter core-api...

COPY backend/ backend/
RUN pnpm --filter core-api exec prisma generate \
 && pnpm --filter core-api build \
 && cp -r backend/generated backend/dist/generated

# Drop devDependencies but keep postinstall output (bcrypt native binding,
# Prisma engines) — do not add --ignore-scripts here.
RUN pnpm install --frozen-lockfile --prod --filter core-api... \
 && pnpm store prune

# ---------- runtime stage ----------
FROM node:22-bookworm-slim AS runner

# Prisma's migration engine links against OpenSSL.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

COPY package.json pnpm-workspace.yaml ./
COPY backend/package.json backend/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/backend/dist ./backend/dist
COPY backend/prisma ./backend/prisma
COPY backend/prisma.config.ts ./backend/prisma.config.ts
COPY deploy/backend-entrypoint.sh ./backend/entrypoint.sh

RUN chmod 0555 ./backend/entrypoint.sh \
 && mkdir -p /app/backend/keys /app/backend/uploads \
 && chown -R node:node /app

USER node
WORKDIR /app/backend
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/v1/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "dist/src/main.js"]
