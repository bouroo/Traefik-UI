# syntax=docker/dockerfile:1

# ============================================================
# Traefik UI — Multi-stage Containerfile
# ============================================================

# ---- Build Args ----
ARG BUN_VERSION=1

# ============================================================
# Stage 1: Dependencies
# ============================================================
FROM oven/bun:${BUN_VERSION} AS deps
WORKDIR /app

# Copy package manifests for dependency installation (best layer caching)
COPY package.json turbo.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/backend/package.json packages/backend/
COPY packages/frontend/package.json packages/frontend/

# Copy lockfile to lock dependency versions
COPY bun.lock* ./

# Install all workspace dependencies (frozen for reproducible builds)
RUN bun install --frozen-lockfile

# ============================================================
# Stage 2: Build
# ============================================================
FROM deps AS build
WORKDIR /app

# Copy shared package (types only — built via tsc if needed, otherwise consumed as TS source)
COPY packages/shared/ packages/shared/

# Build backend — bundles all deps into a single self-contained JS file
COPY packages/backend/tsconfig.json packages/backend/
COPY packages/backend/src/ packages/backend/src/
RUN bun build packages/backend/src/index.ts --outdir dist --target bun

# Build frontend — Vite outputs static assets to packages/frontend/dist/
COPY packages/frontend/tsconfig.json packages/frontend/
COPY packages/frontend/tsconfig.node.json packages/frontend/
COPY packages/frontend/src/ packages/frontend/src/
COPY packages/frontend/tailwind.config.ts packages/frontend/
COPY packages/frontend/postcss.config.js packages/frontend/
COPY packages/frontend/vite.config.ts packages/frontend/
COPY packages/frontend/index.html packages/frontend/
COPY packages/frontend/components.json packages/frontend/

WORKDIR /app/packages/frontend
RUN bun run build
WORKDIR /app

# ============================================================
# Stage 3: Production
# ============================================================
FROM oven/bun:${BUN_VERSION}-slim AS production

# OCI standard image labels
LABEL org.opencontainers.image.title="Traefik UI"
LABEL org.opencontainers.image.description="A full-featured web UI for managing Traefik reverse proxy"
LABEL org.opencontainers.image.source="https://github.com/user/traefik-ui"
LABEL org.opencontainers.image.vendor="Traefik UI"
LABEL org.opencontainers.image.licenses="MIT"

WORKDIR /app

# Create non-root user with fixed UID/GID for reproducible permissions
RUN groupadd -g 10001 traefikui && \
    useradd -u 10001 -g 10001 -s /bin/sh traefikui

# Copy bundled backend (self-contained single file from `bun build --target bun`)
COPY --from=build /app/dist ./dist

# Copy node_modules — `bun build --target bun` typically inlines dependencies,
# but copying it is a safety net for any native modules or runtime resolution edge cases.
# May be removed once the bundle is verified fully self-contained.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./

# Copy built frontend assets (served as static fallback at /app/public/)
COPY --from=build /app/packages/frontend/dist ./public/

# Migration SQL files — resolved via import.meta.url at runtime relative to dist/index.js
COPY --from=build /app/packages/backend/src/db/migrations ./migrations/

# Create writable data directory (SQLite database lives here at runtime)
RUN mkdir -p /app/data && \
    chown -R traefikui:traefikui /app

# Production environment defaults
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV DB_PATH=/app/data/traefik-ui.db

# Drop privileges — run as non-root
USER traefikui

EXPOSE 3000

# Healthcheck uses Bun directly (curl is not available in oven/bun:*-slim)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD ["bun", "-e", "fetch('http://localhost:3000/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"]

ENTRYPOINT ["bun", "dist/index.js"]
