# Traefik-UI Agents

## Project Structure
- **Monorepo** (Bun 1.2.4 + Turbo 2.5.4): `packages/backend`, `packages/frontend`, `packages/shared`
- **Backend**: Hono v4 (TypeScript), SQLite (`bun:sqlite`), JWT auth (24h expiry), argon2id passwords (timeCost=3, memoryCost=65536), Bun test runner
- **Frontend**: React 18 + Vite 6 + Tailwind CSS 3 + shadcn/ui (Radix primitives) + Zustand 5 + TanStack Query 5 + React Router 6 + Recharts + Lucide icons + Sonner toasts
- **Shared**: TypeScript types (`TraefikRouter`, `TraefikService`, `TraefikMiddleware`, `TraefikEntryPoint`, `TraefikOverview`, `TraefikVersion`, `TraefikRawData`) shared across packages

## Conventions

### Spec-Driven Development
- **Spec first**: Before writing code, create or update a spec in `.agents/plans/`
- **REASONS canvas**: Clarify Requirements, Entities, Approach, Structure, Operations, Norms, Safeguards
- **Spec is truth**: Spec and code must stay in sync — update spec when code changes
- **Design before implement**: Lock intent before writing code

### Auth Pattern
- **Local auth**: JWT Bearer token (`Authorization: Bearer <token>`), argon2id passwords, `is_admin` flag on users table
- **SSO**: OIDC via `oauth4webapi` — PKCE flow, auto-provisioning, IdP admin CRUD at `/api/admin/sso-providers`
- **RBAC**: Permission-based access control — 20 permissions, 3 built-in roles (super_admin, operator, viewer), user-group-role assignment chain
- Backend sets `userId` and `username` on Hono context via `authMiddleware`
- `requirePermission` and `requireResourcePermission` middleware for RBAC enforcement
- IdP client secrets encrypted at rest via AES-GCM (`src/lib/crypto.ts`)

### Error Handling
- Return JSON errors: `{ error: "message", code?: string }` with appropriate HTTP status
- Never `throw` for expected errors — return `c.json(...)` responses
- Never `process.exit()` — let errors propagate or handle gracefully
- Log actionable info only: use `logInfo`, `logError`, `logDebug`, `logWarn` from `src/lib/logger.ts`

### Database
- SQLite via `bun:sqlite`
- Schema in `src/db/schema.ts` — creates `users`, `settings`, `api_keys` tables + default admin user
- Migration system: `src/db/migrations/runner.ts` — applies `.sql` files sequentially with tracking table
- Existing migrations: `002_rbac_schema.sql` (roles, permissions, groups, user-groups, group-roles, user-roles tables), `003_seed_rbac.sql` (20 permissions + 3 built-in roles)
- Use migrations for ALL schema changes

### Naming & Code Style
- ESLint + Prettier
- Routes return `c.json()` — no side effects in route handlers
- Business logic lives in `src/lib/` or `src/services/` — not in route handlers
- Name tests as sentences (e.g., `it("returns 401 when token is missing")`)

### Testing Norms
- **Backend**: `bun test` (Bun's built-in test runner, Jest-compatible API)
- **Frontend (React)**: Vitest 3 + React Testing Library + jsdom
- **E2E**: Playwright 1.60 (Chromium)

## Running Commands
```sh
bun run dev          # All packages (turbo)
bun run build        # All packages
bun run test         # All packages
bun run typecheck    # All packages
bun run lint         # All packages
bun run lint:fix     # All packages
bun run format       # Format all packages
bun run format:check # Check formatting
```

## Environment Variables
| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server port |
| `HOST` | `0.0.0.0` | Server host |
| `TRAEFIK_API_URL` | `http://traefik:8080` | Traefik API endpoint |
| `DB_PATH` | `./data/traefik-ui.db` | SQLite database path |
| `JWT_SECRET` | `change-me-in-production-please` | JWT signing secret (change in prod!) |
| `ENCRYPTION_KEY` | falls back to JWT_SECRET | AES-GCM key for IdP client secrets |
| `TRAEFIK_API_USERNAME` | (empty) | Optional Traefik API username |
| `TRAEFIK_API_PASSWORD` | (empty) | Optional Traefik API password |
| `ACCESS_LOG_PATH` | (empty) | Path to Traefik access log file |
| `ACME_JSON_PATH` | (empty) | Path to ACME certificates JSON file |
| `DYNAMIC_CONFIG_PATH` | (empty) | Path to Traefik dynamic config YAML |
| `STATIC_CONFIG_PATH` | (empty) | Path to Traefik static config YAML |
| `LOG_LEVEL` | `info` | Log level (debug/info/warn/error/silent) |
| `CORS_ORIGIN` | `*` | CORS allowed origin |
