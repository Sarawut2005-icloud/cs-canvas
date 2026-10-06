# CSMJU2030 Core Hub — Frontend (Next.js 16, standalone output)
# Build from the repository root:  docker build -f deploy/frontend.Dockerfile .
#
# Security posture:
#   * multi-stage: only the traced standalone server ships in the image
#   * runs as the unprivileged `node` user
#   * BACKEND_API_URL is read at runtime (server-side only, never NEXT_PUBLIC_)

# ---------- build stage ----------
FROM node:22-bookworm-slim AS builder

WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable pnpm

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY frontend/package.json frontend/
RUN pnpm install --frozen-lockfile --filter frontend...

COPY frontend/ frontend/
# The host has little RAM; keep V8's heap in check during the build.
ENV NODE_OPTIONS=--max-old-space-size=1024
RUN pnpm --filter frontend build

# ---------- runtime stage ----------
FROM node:22-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3100

# Standalone output of a pnpm workspace keeps the workspace layout:
# /app/frontend/server.js with node_modules traced to /app/node_modules.
COPY --from=builder --chown=node:node /app/frontend/.next/standalone ./
COPY --from=builder --chown=node:node /app/frontend/.next/static ./frontend/.next/static
COPY --from=builder --chown=node:node /app/frontend/public ./frontend/public

USER node
EXPOSE 3100

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3100/welcome').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "frontend/server.js"]
