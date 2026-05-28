# Traefik-UI

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A full-featured web UI for managing your Traefik reverse proxy. Monitor routers, services, middlewares, and TLS certificates — all from a clean, responsive interface with role-based access control and single sign-on support.

## Features

- 📊 **Dashboard** with real-time stats (router counts, service health, entrypoints, version)
- 🔀 **HTTP, TCP, and UDP router management**
- ⚙️ **Service configuration** with load balancer details
- 🧩 **Middleware management** (HTTP and TCP)
- 🔒 **TLS certificate viewer** (ACME certs from acme.json)
- 📜 **Access log viewer** with filtering (CLF and JSON formats)
- 🔌 **Entrypoints viewer**
- 📈 **System monitoring** (CPU, memory, uptime)
- 🔐 **JWT authentication** with argon2id passwords
- 🔑 **OIDC SSO** — OpenID Connect single sign-on with PKCE flow, auto-provisioning, multiple IdP support
- 🛡️ **RBAC** — Role-based access control with 20 permissions, 3 built-in roles (super_admin, operator, viewer)
- 👥 **User management** — Admin CRUD for users, groups, roles, permissions
- 📝 **Audit logging** — Tracks admin actions (create, update, delete)
- 📄 **Config file viewer & editor** — Static and dynamic Traefik YAML configs with validation, formatting, and in-place editing
- 🌙 **Dark mode** support
- 📱 **Responsive design**
- 🐳 **Podman/Docker Compose deployment**
- 🔒 **IdP client secrets encrypted at rest** (AES-GCM)

## Tech Stack

| Component | Technology |
|---|---|
| Monorepo | Turborepo 2.5 + Bun Workspaces |
| Backend | Hono.js 4 + Bun |
| Database | SQLite via `bun:sqlite` |
| Auth | JWT (24h) + argon2id + OIDC SSO (PKCE) |
| RBAC | Permission-based (20 permissions, 3 built-in roles) |
| Frontend | React 18 + Vite 6 + Tailwind CSS 3 + shadcn/ui |
| State | Zustand 5 + TanStack Query 5 |
| Charts | Recharts |
| Shared | TypeScript type definitions |
| Container | Podman/Docker |

## Architecture

Traefik-UI uses a **registry-driven architecture** to eliminate code duplication and simplify adding new Traefik features.

The core design is a single source of truth — the **protocol/resource registry** (`packages/backend/src/traefik/registry.ts`) — which defines all protocols (HTTP, TCP, UDP), resource types (routers, services, middlewares), and their relationships. The generic Traefik client and API routes auto-generate from this registry.

```
Registry (data) → Generic client (fetch) → Generic routes (/api) → React pages (UI)
```

**Adding a new protocol** requires only adding one entry to the registry — no other code changes needed.

**On the frontend**, React Router handles client-side routing, TanStack Query manages server state, Zustand manages client state, and shadcn/ui provides base components.

## Quick Start

```bash
git clone <repo>
cd Traefik-UI
podman compose up -d
```

Then open **http://localhost:3000** — on first run, a random admin password is generated and printed to logs.

Get the generated password:

```bash
podman compose logs traefik-ui | grep "Password:"
```

**Default credentials on first run:**

- Username: `admin`
- Password: _(see logs above)_

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

## API Endpoints

### Authentication (`/api/auth`)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | `/api/auth/login` | Login with username/password | No |
| POST | `/api/auth/logout` | Logout (client discards token) | No |
| GET | `/api/auth/me` | Get current user info + permissions | Yes |
| POST | `/api/auth/change-password` | Change user password | Yes |
| POST | `/api/auth/refresh` | Refresh JWT token | Yes |

### SSO (`/api/auth/sso`)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/api/auth/sso/providers` | List enabled SSO providers | No |
| GET | `/api/auth/sso/:id/initiate` | Initiate OIDC SSO flow | No |
| GET | `/api/auth/sso/callback` | OIDC callback (code exchange) | No |

### Admin — Users (`/api/admin/users`)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/api/admin/users` | List all users with roles | Yes + RBAC |
| GET | `/api/admin/users/:id` | Get user detail | Yes + RBAC |
| PUT | `/api/admin/users/:id` | Update user (active, email, roles) | Yes + RBAC |
| DELETE | `/api/admin/users/:id` | Delete user | Yes + RBAC |

### Admin — Groups (`/api/admin/groups`)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/api/admin/groups` | List all groups with member counts | Yes + RBAC |
| GET | `/api/admin/groups/:id` | Get group detail (users, roles) | Yes + RBAC |
| POST | `/api/admin/groups` | Create group | Yes + RBAC |
| PUT | `/api/admin/groups/:id` | Update group | Yes + RBAC |
| DELETE | `/api/admin/groups/:id` | Delete group | Yes + RBAC |

### Admin — Roles (`/api/admin/roles`)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/api/admin/roles` | List all roles with permissions | Yes + RBAC |
| GET | `/api/admin/roles/:id` | Get role detail | Yes + RBAC |
| POST | `/api/admin/roles` | Create role | Yes + RBAC |
| PUT | `/api/admin/roles/:id` | Update role | Yes + RBAC |
| DELETE | `/api/admin/roles/:id` | Delete role (built-in roles protected) | Yes + RBAC |

### Admin — Permissions (`/api/admin/permissions`)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/api/admin/permissions` | List all permissions | Yes + RBAC |
| GET | `/api/admin/permissions/:id` | Get permission detail | Yes + RBAC |

### Admin — SSO Providers (`/api/admin/sso-providers`)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/api/admin/sso-providers` | List all IdP configurations | Yes + RBAC |
| GET | `/api/admin/sso-providers/:id` | Get IdP detail | Yes + RBAC |
| POST | `/api/admin/sso-providers` | Create IdP | Yes + RBAC |
| PUT | `/api/admin/sso-providers/:id` | Update IdP | Yes + RBAC |
| DELETE | `/api/admin/sso-providers/:id` | Delete IdP | Yes + RBAC |

### Resources (`/api`) — Registry-driven, auto-generated

The generic resource router handles routers, services, and middlewares for all protocols. Endpoints:

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/api/:resourceType` | List resource across all protocols | Yes |
| GET | `/api/:resourceType/:protocol` | List resources for a protocol | Yes |
| GET | `/api/:resourceType/:protocol/:name` | Get resource detail (with associated resources) | Yes |

Where `resourceType` = `routers` | `services` | `middlewares`, `protocol` = `http` | `tcp` | `udp`.

Adding a new protocol to the registry automatically creates the corresponding routes.

### Dashboard (`/api/dashboard`)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/api/dashboard/` | Dashboard stats & overview | Yes |
| GET | `/api/dashboard/health` | Dashboard health check | Yes |

### Overview (`/api/overview`)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/api/overview/` | Traefik overview | Yes |
| GET | `/api/overview/raw` | Raw overview data | Yes |
| GET | `/api/overview/version` | Traefik version info | Yes |

### TLS (`/api/tls`)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/api/tls/certificates` | List TLS certificates | Yes |
| GET | `/api/tls/options` | TLS options | Yes |

### Logs (`/api/logs`)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/api/logs/access` | Access logs (with filtering) | Yes |
| GET | `/api/logs/error` | Error logs | Yes |

### Entrypoints (`/api/entrypoints`)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/api/entrypoints/` | List all entrypoints | Yes |
| GET | `/api/entrypoints/:name` | Get entrypoint detail | Yes |

### System (`/api/system`)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/api/system/stats` | System stats (CPU, memory) | Yes |
| GET | `/api/system/config` | UI configuration | Yes |
| GET | `/api/system/health` | System health | No |
| GET | `/api/system/acme` | ACME certificate summary | Yes |

### Config File (`/api/configfile`)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/api/configfile/static` | Static config (YAML→JSON, or `?raw=true`) | Yes |
| PUT | `/api/configfile/static` | Update static config (YAML body) | Yes |
| GET | `/api/configfile/dynamic` | Dynamic config (YAML→JSON, or `?raw=true`) | Yes |
| PUT | `/api/configfile/dynamic` | Update dynamic config (YAML body) | Yes |
| POST | `/api/configfile/validate` | Validate YAML against Traefik JSON Schema | Yes |
| POST | `/api/configfile/format` | Parse and re-format YAML | Yes |

### Config CRUD (`/api/config-crud`)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/api/config-crud/:resourceType` | Read dynamic config resources (`?protocol=http`) | Yes |
| POST | `/api/config-crud/:resourceType` | Create/update a resource in dynamic config | Yes |
| DELETE | `/api/config-crud/:resourceType/:protocol/:name` | Delete a resource from dynamic config | Yes |

Where `resourceType` = `routers` | `services` | `middlewares`.

### Health

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/api/health` | Public health check | No |

## Development

```bash
bun install           # Install dependencies
bun run dev           # Start dev servers (turbo)
bun run build         # Build all packages
bun run test          # Run all tests
bun run typecheck     # Type check all packages
bun run lint          # Lint all packages
bun run format        # Format all packages
```

The dev server runs with `--watch` mode for auto-reload on changes. The backend test suite uses Bun's built-in test runner. The frontend uses Vitest + React Testing Library for unit tests and Playwright for E2E.

## Project Structure

```
Traefik-UI/
├── packages/
│   ├── backend/                # @traefik-ui/backend — Hono.js API server
│   │   ├── src/
│   │   │   ├── index.ts        # Server entry point
│   │   │   ├── app.ts          # Hono app, route registration, middleware
│   │   │   ├── config.ts       # Environment configuration
│   │   │   ├── api/            # API route modules
│   │   │   │   ├── admin/      # Admin CRUD (users, groups, roles, permissions, sso-providers)
│   │   │   │   ├── dashboard.ts
│   │   │   │   ├── overview.ts
│   │   │   │   ├── resources.ts    # Registry-driven generic resource router
│   │   │   │   ├── tls.ts
│   │   │   │   ├── logs.ts
│   │   │   │   ├── entrypoints.ts
│   │   │   │   ├── system.ts
│   │   │   │   ├── configfile.ts   # Config viewer + editor + validator
│   │   │   │   └── config-crud.ts  # Dynamic config resource CRUD
│   │   │   ├── auth/           # Auth routes + JWT middleware + OIDC SSO + RBAC
│   │   │   ├── traefik/        # Traefik API client + protocol/resource registry
│   │   │   ├── db/             # SQLite schema + migrations
│   │   │   └── lib/            # Logger, audit, crypto
│   │   └── tests/              # Integration and unit tests
│   ├── frontend/               # @traefik-ui/frontend — React SPA
│   │   └── src/
│   │       ├── main.tsx        # React entry point
│   │       ├── app.tsx         # React Router routes
│   │       ├── components/     # UI components + shadcn/ui primitives
│   │       ├── routes/         # Page-level route components
│   │       ├── stores/         # Zustand stores (auth, ui)
│   │       ├── hooks/          # Custom React hooks
│   │       ├── lib/            # API client, query client, utils
│   │       ├── providers/      # Context providers (auth)
│   │       └── styles/         # Tailwind CSS
│   └── shared/                 # @traefik-ui/shared — shared types
│       └── src/types/
│           └── traefik.ts      # Traefik API type definitions
├── turbo.json                  # Turborepo task config
├── compose.yml                 # Docker/Podman Compose
├── Containerfile               # Multi-stage container build
└── .github/workflows/          # CI (test+build), Release (Docker), CodeQL
```

## CI/CD

- **CI** (`.github/workflows/ci.yml`): format check, lint, typecheck, test, build on push/PR to main
- **Release** (`.github/workflows/release.yml`): Build multi-arch Docker image (amd64+arm64), push to GHCR, cosign signing on tag `v*`
- **CodeQL** (`.github/workflows/codeql.yml`): Security analysis on PRs + weekly schedule

## License

MIT License — see [LICENSE](LICENSE) for details.