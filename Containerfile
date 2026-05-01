# ---- Build Stage ----
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile --production
COPY tsconfig.json ./
COPY src/ ./src/
# Build the TypeScript (optional, Bun can run TS directly)
RUN bun build src/index.ts --outdir dist --target bun

# ---- Production Stage ----
FROM oven/bun:1-slim AS production
WORKDIR /app

# Create non-root user
RUN groupadd -r traefikui && useradd -r -g traefikui traefikui

# Copy built files and node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./

# Copy static frontend assets
COPY src/public/ ./public/

# Create data directory for SQLite
RUN mkdir -p /app/data && chown -R traefikui:traefikui /app

USER traefikui

# Expose the UI port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Run the server
CMD ["bun", "run", "dist/index.js"]