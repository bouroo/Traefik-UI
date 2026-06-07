# Traefik-UI Agents

## Project Structure
- **Monorepo** (Bun 1.2.4 + Turbo 2.5.4): `packages/backend`, `packages/frontend`, `packages/shared`
- **Backend**: Hono v4 (TypeScript), SQLite (`bun:sqlite`), JWT auth (24h expiry), argon2id passwords (timeCost=3, memoryCost=65536), Bun test runner
- **Frontend**: React 18 + Vite 6 + Tailwind CSS 3 + shadcn/ui (Radix primitives) + Zustand 5 + TanStack Query 5 + React Router 6 + Recharts + Lucide icons + Sonner toasts
- **Shared**: TypeScript types (`TraefikRouter`, `TraefikService`, `TraefikMiddleware`, `TraefikEntryPoint`, `TraefikOverview`, `TraefikVersion`, `TraefikRawData`) shared across packages

### Backend File Map
```
packages/backend/src/
├── index.ts              # Server entry point (Bun.serve, graceful shutdown)
├── app.ts                # Hono app, CORS, route registration, static serving, error handler
├── config.ts             # Environment config (env vars with defaults)
├── api/
│   ├── admin/
│   │   ├── users.ts      # User CRUD (list, get, update, delete)
│   │   ├── groups.ts     # Group CRUD (list, get, create, update, delete)
│   │   ├── roles.ts      # Role CRUD (list, get, create, update, delete; built-in roles protected)
│   │   ├── permissions.ts # Permission list (read-only)
│   │   └── sso-providers.ts # IdP CRUD (list, get, create, update, delete)
│   ├── dashboard.ts      # Dashboard stats & health
│   ├── overview.ts       # Traefik overview, raw data, version
│   ├── resources.ts      # Registry-driven generic resource router (routers/services/middlewares for all protocols)
│   ├── routers.ts        # Legacy router endpoints (HTTP, TCP, UDP) — not registered in app.ts
│   ├── services.ts       # Legacy service endpoints (HTTP, TCP, UDP) — not registered in app.ts
│   ├── middlewares.ts    # Legacy middleware endpoints (HTTP, TCP) — not registered in app.ts
│   ├── tls.ts            # TLS certificates and options
│   ├── logs.ts           # Access and error log endpoints
│   ├── logs-parser.ts    # CLF and JSON log parsing utilities + filtering
│   ├── entrypoints.ts    # Entrypoint list and detail
│   ├── system.ts         # System stats, config, health, ACME summary
│   ├── configfile.ts     # Static/dynamic config viewer, editor, validator, formatter
│   └── config-crud.ts    # Dynamic config resource CRUD (create/update/delete resources)
├── auth/
│   ├── routes.ts         # Login, logout, me, change-password, refresh
│   ├── sso-routes.ts     # OIDC SSO initiation, callback, provider list
│   ├── middleware.ts      # JWT auth middleware (sets userId/username on context), token generation
│   ├── oidc.ts           # OIDC discovery, authorize URL builder, code exchange (PKCE)
│   └── rbac.ts           # Permission resolution (user→roles + groups→roles), requirePermission, requireResourcePermission
├── traefik/
│   ├── client.ts         # Traefik API client (fetchTraefik, per-protocol getters, entrypoints, overview, version)
│   └── registry.ts       # Protocol/resource registry (PROTOCOLS, RESOURCE_TYPES, associated resources)
├── db/
│   ├── index.ts          # Database singleton (getDb, closeDb, resetDb), WAL mode, migration runner
│   ├── schema.ts         # Base schema (users, settings, api_keys), random admin password on first run, assignAdminRoles
│   └── migrations/
│       ├── runner.ts     # Sequential SQL migration runner with tracking table
│       ├── 002_rbac_schema.sql  # roles, permissions, groups, user_groups, group_roles, user_roles, identity_providers, audit_logs
│       └── 003_seed_rbac.sql    # 19 permissions + 3 built-in roles (super_admin, operator, viewer)
└── lib/
    ├── logger.ts         # Structured logging (logInfo, logError, logDebug, logWarn), level from LOG_LEVEL env
    ├── audit.ts          # Audit log writer (inserts into audit_logs table)
    └── crypto.ts         # AES-GCM encrypt/decrypt for IdP client secrets (key derived from ENCRYPTION_KEY)
```

### Frontend File Map
```
packages/frontend/src/
├── main.tsx              # React entry point
├── app.tsx               # React Router route definitions
├── vitest-setup.ts       # Vitest test setup
├── components/
│   ├── ui/               # shadcn/ui primitives (badge, button, card, dialog, dropdown-menu, input, label, skeleton, table, tabs, tooltip)
│   ├── app-shell.tsx     # App layout shell (sidebar, header, navigation)
│   ├── data-grid.tsx     # Reusable data grid component
│   └── permission-guard.tsx # RBAC permission guard component
├── routes/
│   ├── admin/            # Admin pages (index, users, groups, roles, idp)
│   ├── __tests__/        # Route component tests
│   ├── dashboard.tsx, routers.tsx, services.tsx, middlewares.tsx
│   ├── entrypoints.tsx, tls.tsx, logs.tsx, system.tsx
│   ├── configfile.tsx, login.tsx, placeholder-pages.tsx
├── stores/
│   ├── auth-store.ts     # Zustand auth state (token, user)
│   └── ui-store.ts       # Zustand UI state (theme, sidebar)
├── hooks/
│   └── use-auth.ts       # Auth hook (login, logout, token management)
├── lib/
│   ├── api.ts            # API client (fetch wrapper with auth headers)
│   ├── query-client.ts   # TanStack Query client setup
│   └── utils.ts          # Utility functions (cn, etc.)
├── providers/
│   └── auth-provider.tsx # Auth context provider
└── styles/               # Tailwind CSS
```

## Conventions

### Spec-Driven Development
- **Spec first**: Before writing code, create or update a spec in `.agents/plans/`
- **REASONS canvas**: Clarify Requirements, Entities, Approach, Structure, Operations, Norms, Safeguards
- **Spec is truth**: Spec and code must stay in sync — update spec when code changes
- **Design before implement**: Lock intent before writing code

### Architecture
- **Registry-driven**: `src/traefik/registry.ts` defines all protocols (HTTP, TCP, UDP) and resource types (routers, services, middlewares). The generic client and API routes derive from this registry.
- **Adding a new protocol**: Add one entry to `PROTOCOLS` in registry.ts — no other code changes needed.
- **Legacy route files**: `routers.ts`, `services.ts`, `middlewares.ts` in `src/api/` are NOT registered in `app.ts`. The registry-driven `resources.ts` handles all resource routes.

### Auth Pattern
- **Local auth**: JWT Bearer token (`Authorization: Bearer <token>`), argon2id passwords, `is_admin` flag on users table
- **First-run**: Random admin password generated (12 chars), printed to logs, saved to `admin-credentials.txt` in data directory
- **SSO**: OIDC via `oauth4webapi` — PKCE flow, auto-provisioning (creates user with `source='oidc'`), IdP admin CRUD at `/api/admin/sso-providers`
- **RBAC**: Permission-based access control — 19 permissions, 3 built-in roles (super_admin, operator, viewer), user-group-role assignment chain
- Backend sets `userId` and `username` on Hono context via `authMiddleware`
- `requirePermission` and `requireResourcePermission` middleware for RBAC enforcement
- IdP client secrets encrypted at rest via AES-GCM (`src/lib/crypto.ts`)

### Error Handling
- Return JSON errors: `{ error: "message", code?: string }` with appropriate HTTP status
- Never `throw` for expected errors — return `c.json(...)` responses
- Never `process.exit()` — let errors propagate or handle gracefully
- Log actionable info only: use `logInfo`, `logError`, `logDebug`, `logWarn` from `src/lib/logger.ts`

### Database
- SQLite via `bun:sqlite`, opened with WAL mode and foreign keys enabled
- Schema in `src/db/schema.ts` — creates `users`, `settings`, `api_keys` tables + default admin user with random password
- Migration system: `src/db/migrations/runner.ts` — applies `.sql` files sequentially with tracking table
- Existing migrations:
  - `002_rbac_schema.sql`: `roles`, `permissions`, `role_permissions`, `groups`, `user_groups`, `group_roles`, `user_roles`, `identity_providers`, `audit_logs` tables
  - `003_seed_rbac.sql`: 19 permissions + 3 built-in roles (super_admin gets all, operator gets non-system.*.write, viewer gets all *.read)
- `assignAdminRoles()` in schema.ts auto-assigns `super_admin` role to admin users with no role assignments
- Use migrations for ALL schema changes

### Naming & Code Style
- ESLint + Prettier
- Routes return `c.json()` — no side effects in route handlers
- Business logic lives in `src/lib/` — not in route handlers
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
