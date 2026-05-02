# Traefik-UI

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A full-featured web UI for managing your Traefik reverse proxy. Monitor routers, services, middlewares, and TLS certificates — all from a clean, responsive interface.

## Features

- 📊 **Dashboard** with real-time stats (router counts, service health, entrypoints, version)
- 🔀 **HTTP, TCP, and UDP router management**
- ⚙️ **Service configuration** with load balancer details
- 🧩 **Middleware management** (HTTP and TCP)
- 🔒 **TLS certificate viewer** (ACME certs from acme.json)
- 📜 **Access log viewer** with filtering (CLF and JSON formats)
- 🔌 **EntryPoints viewer**
- 📈 **System monitoring** (CPU, memory, uptime)
- 🔐 **JWT authentication** with argon2id passwords
- 📄 **Config file viewer** (static and dynamic Traefik YAML configs)
- 🌙 **Dark mode** support
- 📱 **Responsive design**
- 🐳 **Podman/Docker Compose deployment**

## Tech Stack

| Component | Technology                              |
| --------- | --------------------------------------- |
| Backend   | Hono.js + Bun                           |
| Database  | SQLite via `bun:sqlite`                 |
| Auth      | JWT + argon2id                          |
| Frontend  | Vanilla JS + Tailwind CSS + Remix Icons |
| Container | Podman/Docker                           |

## Architecture

Traefik-UI uses a **registry-driven architecture** to eliminate code duplication and simplify adding new Traefik features.

The core design is a single source of truth — the **protocol/resource registry** (`src/traefik/registry.ts`) — which defines all protocols (HTTP, TCP, UDP), resource types (routers, services, middlewares), and their relationships. The generic Traefik client and API routes auto-generate from this registry.

```
Registry (data) → Generic client (fetch) → Generic routes (/api) → Page modules (UI)
```

**Adding a new protocol** (e.g., gRPC) requires only adding one entry to the registry — no other code changes needed.

**On the frontend**, all page modules self-register via `registerPage()` in a data-driven router. Shared utilities (`utils.js`) and reusable UI components (`components.js`) are defined once and used everywhere.

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

| Variable               | Default                          | Description                           |
| ---------------------- | -------------------------------- | ------------------------------------- |
| `PORT`                 | `3000`                           | Server port                           |
| `HOST`                 | `0.0.0.0`                        | Server host                           |
| `TRAEFIK_API_URL`      | `http://traefik:8080`            | Traefik API endpoint                  |
| `DB_PATH`              | `./data/traefik-ui.db`           | SQLite database path                  |
| `JWT_SECRET`           | `change-me-in-production-please` | JWT signing secret (change in prod!)  |
| `TRAEFIK_API_USERNAME` | _(empty)_                        | Optional Traefik API username         |
| `TRAEFIK_API_PASSWORD` | _(empty)_                        | Optional Traefik API password         |
| `ACCESS_LOG_PATH`      | _(empty)_                        | Path to Traefik access log file       |
| `ACME_JSON_PATH`       | _(empty)_                        | Path to ACME certificates JSON file   |
| `DYNAMIC_CONFIG_PATH`  | _(empty)_                        | Path to Traefik dynamic config YAML   |
| `STATIC_CONFIG_PATH`   | _(empty)_                        | Path to Traefik static config YAML    |
| `LOG_LEVEL`            | `info`                           | Log level (`debug`, `info`, `silent`) |
| `CORS_ORIGIN`          | `*`                              | CORS allowed origin                   |

## API Endpoints

### Authentication (`/api/auth`)

| Method | Endpoint                    | Description                    | Auth Required |
| ------ | --------------------------- | ------------------------------ | ------------- |
| POST   | `/api/auth/login`           | Login with username/password   | No            |
| POST   | `/api/auth/logout`          | Logout (client discards token) | No            |
| GET    | `/api/auth/me`              | Get current user info          | Yes           |
| POST   | `/api/auth/change-password` | Change user password           | Yes           |
| POST   | `/api/auth/refresh`         | Refresh JWT token              | Yes           |

### Dashboard (`/api/dashboard`)

| Method | Endpoint                | Description                | Auth Required |
| ------ | ----------------------- | -------------------------- | ------------- |
| GET    | `/api/dashboard/`       | Dashboard stats & overview | Yes           |
| GET    | `/api/dashboard/health` | Dashboard health check     | Yes           |

### Routers (`/api/routers`)

| Method | Endpoint                  | Description                     | Auth Required |
| ------ | ------------------------- | ------------------------------- | ------------- |
| GET    | `/api/routers/`           | List all routers (HTTP/TCP/UDP) | Yes           |
| GET    | `/api/routers/http`       | List HTTP routers               | Yes           |
| GET    | `/api/routers/http/:name` | Get HTTP router detail          | Yes           |
| GET    | `/api/routers/tcp`        | List TCP routers                | Yes           |
| GET    | `/api/routers/tcp/:name`  | Get TCP router detail           | Yes           |
| GET    | `/api/routers/udp`        | List UDP routers                | Yes           |
| GET    | `/api/routers/udp/:name`  | Get UDP router detail           | Yes           |

> These routes are auto-generated from the protocol/resource registry. Adding a new protocol automatically creates the corresponding routes.

### Services (`/api/services`)

| Method | Endpoint                   | Description                      | Auth Required |
| ------ | -------------------------- | -------------------------------- | ------------- |
| GET    | `/api/services/`           | List all services (HTTP/TCP/UDP) | Yes           |
| GET    | `/api/services/http`       | List HTTP services               | Yes           |
| GET    | `/api/services/http/:name` | Get HTTP service detail          | Yes           |
| GET    | `/api/services/tcp`        | List TCP services                | Yes           |
| GET    | `/api/services/tcp/:name`  | Get TCP service detail           | Yes           |
| GET    | `/api/services/udp`        | List UDP services                | Yes           |
| GET    | `/api/services/udp/:name`  | Get UDP service detail           | Yes           |

> These routes are auto-generated from the protocol/resource registry. Adding a new protocol automatically creates the corresponding routes.

### Middlewares (`/api/middlewares`)

| Method | Endpoint                      | Description                     | Auth Required |
| ------ | ----------------------------- | ------------------------------- | ------------- |
| GET    | `/api/middlewares/`           | List all middlewares (HTTP/TCP) | Yes           |
| GET    | `/api/middlewares/http`       | List HTTP middlewares           | Yes           |
| GET    | `/api/middlewares/http/:name` | Get HTTP middleware detail      | Yes           |
| GET    | `/api/middlewares/tcp`        | List TCP middlewares            | Yes           |
| GET    | `/api/middlewares/tcp/:name`  | Get TCP middleware detail       | Yes           |

> These routes are auto-generated from the protocol/resource registry. Adding a new protocol automatically creates the corresponding routes.

### TLS (`/api/tls`)

| Method | Endpoint                | Description           | Auth Required |
| ------ | ----------------------- | --------------------- | ------------- |
| GET    | `/api/tls/certificates` | List TLS certificates | Yes           |
| GET    | `/api/tls/options`      | TLS options           | Yes           |

### Logs (`/api/logs`)

| Method | Endpoint           | Description                  | Auth Required |
| ------ | ------------------ | ---------------------------- | ------------- |
| GET    | `/api/logs/access` | Access logs (with filtering) | Yes           |
| GET    | `/api/logs/error`  | Error logs                   | Yes           |

### Config File (`/api/configfile`)

| Method | Endpoint                  | Description                        | Auth Required |
| ------ | ------------------------- | ---------------------------------- | ------------- |
| GET    | `/api/configfile/static`  | Traefik static config (YAML→JSON)  | Yes           |
| GET    | `/api/configfile/dynamic` | Traefik dynamic config (YAML→JSON) | Yes           |

### Entrypoints (`/api/entrypoints`)

| Method | Endpoint                 | Description           | Auth Required |
| ------ | ------------------------ | --------------------- | ------------- |
| GET    | `/api/entrypoints/`      | List all entrypoints  | Yes           |
| GET    | `/api/entrypoints/:name` | Get entrypoint detail | Yes           |

### System (`/api/system`)

| Method | Endpoint             | Description                | Auth Required |
| ------ | -------------------- | -------------------------- | ------------- |
| GET    | `/api/system/stats`  | System stats (CPU, memory) | Yes           |
| GET    | `/api/system/config` | UI configuration           | Yes           |
| GET    | `/api/system/health` | System health (no auth)    | No            |
| GET    | `/api/system/acme`   | ACME certificate summary   | Yes           |

### Overview (`/api/overview`)

| Method | Endpoint                | Description          | Auth Required |
| ------ | ----------------------- | -------------------- | ------------- |
| GET    | `/api/overview/`        | Traefik overview     | Yes           |
| GET    | `/api/overview/raw`     | Raw overview data    | Yes           |
| GET    | `/api/overview/version` | Traefik version info | Yes           |

### Health

| Method | Endpoint      | Description         | Auth Required |
| ------ | ------------- | ------------------- | ------------- |
| GET    | `/api/health` | Public health check | No            |

## Development

```bash
# Install dependencies
bun install

# Start dev server with auto-reload
bun run dev

# Type check
bun run typecheck

# Run all tests
bun test

# Lint
bun run lint

# Format code
bun run format

# Build for production
bun run build
```

The dev server runs with `--watch` mode for auto-reload on changes. The test suite uses Bun's built-in test runner with an in-memory SQLite database.

## Project Structure

```
Traefik-UI/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # CI pipeline (typecheck, build)
│       └── release.yml               # Release workflow
├── src/
│   ├── index.ts                      # Entry point, server bootstrap
│   ├── app.ts                        # Main Hono app, route registration, middleware
│   ├── config.ts                     # Environment variable configuration
│   ├── auth/
│   │   ├── routes.ts                 # Auth endpoints (login, logout, me, change-password, refresh)
│   │   └── middleware.ts             # JWT verification middleware
│   ├── api/
│   │   ├── dashboard.ts              # Dashboard stats endpoint
│   │   ├── resources.ts              # Generic resource endpoints (routers, services, middlewares)
│   │   ├── tls.ts                    # TLS certificate viewer
│   │   ├── logs.ts                   # Access/error log viewer
│   │   ├── entrypoints.ts            # Entrypoints viewer
│   │   ├── system.ts                 # System stats, config, health
│   │   ├── overview.ts               # Traefik overview data
│   │   └── configfile.ts             # Static/dynamic config file viewer
│   ├── traefik/
│   │   ├── client.ts                 # Generic Traefik API client with type definitions
│   │   └── registry.ts               # Protocol/resource type registry
│   ├── db/
│   │   ├── index.ts                  # Database initialization
│   │   └── schema.ts                 # SQLite schema definitions
│   └── public/
│       ├── index.html                # Main SPA entry point
│       ├── login.html                # Login page
│       └── assets/
│           ├── css/
│           │   └── style.css         # Custom styles
│           └── js/
│               ├── app.js            # Main app logic, navigation, routing
│               ├── auth.js           # Authentication logic
│               ├── dashboard.js      # Dashboard UI
│               ├── routers.js        # Routers UI
│               ├── services.js       # Services UI
│               ├── middlewares.js    # Middlewares UI
│               ├── tls.js            # TLS certificates UI
│               ├── system.js         # System stats UI
│               ├── router.js         # SPA router
│               ├── utils.js          # Shared utilities
│               └── components.js     # Reusable UI components
├── tests/                            # Integration and unit tests
│   ├── integration.test.ts
│   ├── api-core.test.ts
│   ├── api-extra.test.ts
│   ├── auth.test.ts
│   ├── client.test.ts
│   ├── mock-traefik.ts
│   ├── helpers.ts
│   ├── env.ts
│   └── integration-helpers.ts
├── traefik/
│   └── dynamic.yml                   # Sample Traefik dynamic config
├── compose.yml                       # Podman/Docker Compose deployment
├── Containerfile                     # Container build
├── data/                             # SQLite database storage (created at runtime)
├── bun.lock                          # Bun lockfile
├── package.json                      # Node/Bun dependencies
├── tsconfig.json                     # TypeScript config
├── eslint.config.mjs                 # ESLint configuration
├── .prettierrc                       # Prettier configuration
├── bunfig.toml                       # Bun configuration
└── LICENSE                           # MIT License
```

## License

MIT License — see [LICENSE](LICENSE) for details.
