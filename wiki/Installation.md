# Installation

Three install paths: compose quick start, dev mode from source, and the published container image.

## 1. Compose quick start (recommended)

The repo ships a `compose.yml` that runs both Traefik and Traefik-UI.

```bash
git clone <repo>
cd Traefik-UI
podman compose up -d
```

Open **http://localhost:3000**. On first run, the backend prints a randomly generated admin password to stdout — fetch it from the logs:

```bash
podman compose logs traefik-ui | grep "Password:"
```

Default credentials: username `admin`, password from logs.

> Docker also works — replace `podman` with `docker` in the commands above.

## 2. From source / development

Requires [Bun 1.2.4](https://bun.sh). Install dependencies once, then start both servers:

```bash
bun install
bun run dev
```

This starts, via Turborepo:

- Backend on **http://localhost:3000** (Hono.js on Bun, `--watch` mode)
- Frontend on **http://localhost:5173** (Vite dev server, proxies `/api` to `:3000`)

Other useful scripts:

```bash
bun run build         # build all packages
bun run test          # run all tests
bun run typecheck     # tsc --noEmit
bun run lint          # ESLint (backend only)
bun run format        # Prettier write
```

The backend defaults to a SQLite file at `./data/traefik-ui.db` and points at `TRAEFIK_API_URL=http://traefik:8080`. For local dev against a running Traefik on the host, override the URL — e.g. `TRAEFIK_API_URL=http://localhost:8080`.

## 3. Container image (GHCR)

Multi-arch images (amd64 + arm64) are published to GitHub Container Registry on every `v*` tag, cosign-signed.

```bash
podman pull ghcr.io/<owner>/traefik-ui:latest
```

To run only the UI container (pointing at an existing Traefik you already expose), you still need the database and either a host bind mount or a named volume. The simplest path is still `podman compose up -d` from the repo, which brings up both Traefik and Traefik-UI.

## First-run admin bootstrap

When the `users` table is empty, the backend creates an `admin` account:

- If `ADMIN_PASSWORD` is set (non-empty), it is used as the password.
- If `ADMIN_PASSWORD` is unset/empty, a random 12-character password is generated and printed **once to stdout** (not the structured log) so it isn't lost in log aggregation pipelines.

Recommended for production: pre-set `ADMIN_USERNAME` and `ADMIN_PASSWORD` via your secrets manager, or use OIDC SSO for the initial admin and rotate the local password immediately. See [[Administration#Production hardening]].

## What's next

- [[Configuration]] — tune every environment variable
- [[Single-Sign-On]] — wire up OIDC instead of local login
- [[Troubleshooting]] — if something doesn't come up cleanly
