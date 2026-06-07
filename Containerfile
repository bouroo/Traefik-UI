# ---- Build Stage ----
FROM oven/bun:1 AS build
WORKDIR /app

COPY package.json turbo.json tsconfig.base.json ./

COPY packages/shared/package.json packages/shared/
COPY packages/backend/package.json packages/backend/
COPY packages/frontend/package.json packages/frontend/

COPY bun.lock* ./

RUN bun install --frozen-lockfile

COPY packages/shared/ packages/shared/

COPY packages/backend/tsconfig.json packages/backend/
COPY packages/backend/src/ packages/backend/src/

RUN bun build packages/backend/src/index.ts --outdir dist --target bun

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

# ---- Production Stage ----
FROM oven/bun:1-slim AS production
WORKDIR /app

RUN groupadd -r traefikui && useradd -r -g traefikui traefikui

COPY --from=build /app/dist ./dist

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./

COPY --from=build /app/packages/frontend/dist ./public/

# Migration SQL files (resolved via import.meta.url at runtime)
COPY --from=build /app/packages/backend/src/db/migrations ./migrations/

RUN mkdir -p /app/data && chown -R traefikui:traefikui /app

USER traefikui

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

ENTRYPOINT ["bun", "dist/index.js"]
