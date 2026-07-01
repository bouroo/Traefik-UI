# AGENTS.md

High-signal notes for AI coding agents working in this repo. Read this before editing.

## Toolchain

- **Runtime/package manager: Bun 1.2.4** (pinned via `packageManager`). Use `bun`, not `npm`/`yarn`/`pnpm`. Install with `bun install`.
- **Monorepo: Turborepo + Bun workspaces**, three packages under `packages/`:
  - `@traefik-ui/backend` — Hono.js API server (Bun runtime, `bun:sqlite`)
  - `@traefik-ui/frontend` — React 18 + Vite SPA
  - `@traefik-ui/shared` — TypeScript types, **no build step** (source imported directly via `exports`)
- TypeScript strict mode, ESM everywhere (`"type": "module"`).

## Common commands

Run from repo root unless noted.

```bash
bun install
bun run dev          # turbo dev — backend (--watch) + frontend (vite)
bun run build        # turbo build (test & typecheck depend on ^build)
bun run test         # turbo test
bun run typecheck    # turbo typecheck
bun run lint         # turbo lint (backend only — see Quirks)
bun run lint:fix
bun run format       # prettier write
bun run format:check # CI/pre-commit uses this
```

`make <target>` wraps the same commands plus container/integration flows (`make help` lists all).

### Single-test / focused verification

- **Backend (Bun test runner):**
  ```bash
  cd packages/backend
  bun test                                    # all
  bun test tests/auth.test.ts                 # one file
  bun test -t "login returns a JWT"           # one test by name
  bun test tests/integration.test.ts          # integration (needs podman/docker)
  ```
- **Frontend (Vitest):**
  ```bash
  cd packages/frontend
  bun run test                  # vitest run (all)
  bunx vitest run src/lib/api   # by path
  bunx vitest -t "renders"      # by name
  bun run test:watch            # watch mode
  ```
- **E2E (Playwright):** `cd packages/frontend && bun run e2e`. Playwright auto-starts both dev servers via its `webServer` config (backend on :3000, frontend on :5173 which proxies `/api` → :3000). Requires podman/docker for the Traefik container in CI; locally it reuses already-running servers.

## Required command order

CI and git hooks enforce this pipeline — do not reorder:

```
format:check → lint → typecheck → test → build
```

- **`turbo.json`**: `test` depends on `build`; `typecheck` depends on `^build`. A stale/missing build can cause confusing failures — run `bun run build` first if you see import/resolution errors in tests or typecheck.
- **pre-commit hook** (`.husky/pre-commit`): runs `format:check`, `lint`, `typecheck`. Commits fail if any fails.
- **pre-push hook** (`.husky/pre-push`): runs `test`, then `build`.

## Architecture notes not obvious from filenames

- **Registry-driven core.** `packages/backend/src/traefik/registry.ts` is the single source of truth for protocols (http/tcp/udp) and resource types (routers/services/middlewares). The generic Traefik client (`traefik/client.ts`) and generic API routes (`api/resources.ts`) derive from it. **Adding a protocol = one registry entry**, nothing else. Do not hand-write per-protocol routes — extend the registry.
- **Legacy per-protocol route files exist** (`api/routers.ts`, `services.ts`, `middlewares.ts`) alongside the generic router. Prefer the registry path for new work; check which one a given endpoint actually uses before editing.
- **Backend entry:** `src/index.ts` (Bun.serve) → `src/app.ts` (Hono app, route registration, middleware). DB init runs at module load via `getDb()` in `index.ts`.
- **Frontend entry:** `src/main.tsx` → `src/app.tsx` (React Router). State: Zustand (`stores/`) for client, TanStack Query (`lib/query-client.ts`) for server. UI primitives in `components/ui/` are shadcn/ui — edit locally, not from a package.
- **Path alias:** frontend uses `@/` → `packages/frontend/src/` (vite + tsconfig).

## Database & migrations

- SQLite via `bun:sqlite`. Default path `./data/traefik-ui.db` (file; `:memory:` in tests).
- **Migrations are plain `.sql` files** in `packages/backend/src/db/migrations/`, applied in lexical (zero-padded) order by `runner.ts`. Tracked in a `migrations` table. To add a migration: drop a new `NNN_name.sql` file — no code registration needed. Schema also bootstrapped from `db/schema.ts`.
- **First run with empty users table** creates an admin account. If `ADMIN_PASSWORD` is unset, a random password is printed **to stdout** (not the structured log). See `.env.example`.

## Testing quirks

- **Backend tests must import `tests/env.ts` first** — it sets `DB_PATH=:memory:`, `LOG_LEVEL=silent`, `RATE_LIMIT_DISABLED=true`, etc. before any source module loads. New test files: `import './env';` (or a helper that does) as the first import.
- Rate limiting is disabled in unit tests via `RATE_LIMIT_DISABLED=true`; re-enable intentionally if testing the limiter.
- **Integration tests** (`tests/integration.test.ts`, `make test-integration`) require **podman or docker** on PATH — they spin up a real Traefik container. Same for `make test-container` (full compose stack) and `make test-e2e-container`.
- Helpers: `tests/helpers.ts`, `tests/client-helpers.ts`, `tests/mock-traefik.ts`. The mock Traefik is the basis for most unit tests — extend it rather than hitting a real API.
- Frontend Vitest uses jsdom + `src/vitest-setup.ts`; E2E specs live in `packages/frontend/e2e/` and are excluded from vitest.

## Quirks & gotchas

- **ESLint lints backend only.** `eslint.config.mjs` ignores `packages/frontend/src/**`. Frontend has no lint task; rely on `tsc --noEmit` (typecheck) and prettier there.
- **Prettier is the formatter** (root `.prettierrc`). Format check is part of CI and pre-commit — run `bun run format` before committing.
- **`@traefik-ui/shared` has no build.** Its `build` script is a no-op; consumers import `.ts` source directly. Don't add a build step without updating workspace `exports`.
- **Secrets:** `JWT_SECRET` (required, change from default) and `ENCRYPTION_KEY` (AES-GCM for IdP client secrets at rest; falls back to `JWT_SECRET`). Never commit either. Production overlay (`compose.prod.yml`) requires both.
- **Container runtime:** Podman is the default in docs/scripts; Docker works too. `Containerfile` is multi-stage and builds the backend `dist/` via `bun build`.
- **Dev ports:** backend `:3000`, frontend Vite `:5173` (proxies `/api` → `:3000`). Default `TRAEFIK_API_URL=http://traefik:8080` (compose service name); override for local dev against a real Traefik.

## CI

`.github/workflows/ci.yml` runs four jobs on push/PR to `main`: `build` (format:check → lint → typecheck → test → build), `integration` (Traefik container), `container-integration` (full compose stack), `e2e` (Playwright against dev servers). All require Bun + podman/docker. `release.yml` builds multi-arch image to GHCR on `v*` tags (cosign-signed); `codeql.yml` runs security analysis.

## Further reading

- `README.md` — full feature list, API endpoint reference, env vars, project structure
- `DEPLOYMENT.md` — production hardening checklist
- `.env.example` — all env vars with defaults and notes
