# Configuration

Traefik-UI is configured entirely through environment variables. Copy `.env.example` to `.env` (or pass them through Compose / your secrets manager) and customize. The full list:

| Variable               | Default                          | Description                                                                               |
| ---------------------- | -------------------------------- | ----------------------------------------------------------------------------------------- |
| `PORT`                 | `3000`                           | Server port                                                                               |
| `HOST`                 | `0.0.0.0`                        | Server bind address                                                                       |
| `TRAEFIK_API_URL`      | `http://traefik:8080`            | Traefik API endpoint                                                                      |
| `DB_PATH`              | `./data/traefik-ui.db`           | SQLite database file path                                                                 |
| `JWT_SECRET`           | `change-me-in-production-please` | JWT signing secret (change in prod!)                                                      |
| `ENCRYPTION_KEY`       | falls back to `JWT_SECRET`       | AES-GCM key for IdP client secrets at rest                                                |
| `TRAEFIK_API_USERNAME` | _(empty)_                        | Optional Traefik API basic-auth username                                                  |
| `TRAEFIK_API_PASSWORD` | _(empty)_                        | Optional Traefik API basic-auth password                                                  |
| `ACCESS_LOG_PATH`      | _(empty)_                        | Path to Traefik access log file                                                           |
| `ACME_JSON_PATH`       | _(empty)_                        | Path to ACME certificates JSON file                                                       |
| `DYNAMIC_CONFIG_PATH`  | _(empty)_                        | Path to Traefik dynamic config YAML                                                       |
| `STATIC_CONFIG_PATH`   | _(empty)_                        | Path to Traefik static config YAML                                                        |
| `LOG_LEVEL`            | `info`                           | Log level: `debug`, `info`, `warn`, `error`, `silent`                                     |
| `CORS_ORIGIN`          | `*`                              | CORS allowed origin                                                                       |
| `HSTS_ENABLED`         | `false`                          | Enable `Strict-Transport-Security` header (only when behind TLS)                          |
| `ADMIN_USERNAME`       | `admin`                          | Username used when bootstrapping the first admin account                                  |
| `ADMIN_PASSWORD`       | _(empty)_                        | If set, used as the first-run admin password; otherwise a random one is printed to stdout |

## Secrets

### `JWT_SECRET` — required in production

`JWT_SECRET` signs the 24-hour JWT issued at login. The default in `.env.example` is a placeholder; **never run a deployment with the placeholder**.

Generate one:

```bash
openssl rand -base64 48
```

For production, inject this via your secrets manager (Compose `secrets:`, Kubernetes `Secret`, Vault, etc.). The compose production overlay (`compose.prod.yml`) refuses to start if `JWT_SECRET` is unchanged from the default.

### `ENCRYPTION_KEY` — encrypts IdP client secrets at rest

IdP client secrets saved through the admin UI are encrypted with AES-GCM before being written to SQLite. The key is read from `ENCRYPTION_KEY`, and falls back to `JWT_SECRET` if unset.

Because rotating `ENCRYPTION_KEY` would invalidate all stored IdP secrets, the recommended approach is to set `ENCRYPTION_KEY` **independently** from `JWT_SECRET` in any environment that uses SSO:

```bash
export JWT_SECRET=$(openssl rand -base64 48)
export ENCRYPTION_KEY=$(openssl rand -base64 48)
```

## Traefik connection

`TRAEFIK_API_URL` must point at the Traefik instance you want to manage. If Traefik is fronted by basic auth, also set `TRAEFIK_API_USERNAME` and `TRAEFIK_API_PASSWORD`.

Local dev against a host Traefik:

```bash
TRAEFIK_API_URL=http://localhost:8080 bun run dev
```

In `compose.yml`, the default `http://traefik:8080` resolves to the sibling Traefik service on the internal Compose network.

## File paths

These four variables are optional. Set them to enable the corresponding UI surfaces:

- `ACCESS_LOG_PATH` — enables the access log viewer (filterable; CLF and JSON).
- `ACME_JSON_PATH` — enables the TLS certificate view (set permissions so the backend can read the file, e.g. `chmod 600` Traefik's `acme.json` and add the backend UID to the same group, or run the container with `user: 0:0` only in dev).
- `DYNAMIC_CONFIG_PATH` — enable in-place editing of dynamic config. The mount **must be read-write**.
- `STATIC_CONFIG_PATH` — enable in-place editing of static config. The mount **must be read-write**.

In production, the safest setup is to mount these read-only and edit through the dynamic-config path; for the UI editor to save, the mount must be writable.

## CORS, HSTS, logging

- `CORS_ORIGIN` defaults to `*` for dev convenience. In production, restrict it to your UI's origin, e.g. `CORS_ORIGIN=https://traefik-ui.example.com`.
- `HSTS_ENABLED=false` by default. Set to `true` **only when the UI itself is served behind TLS** — the production overlay leaves this off because the TLS termination is typically handled by an external Traefik / reverse proxy.
- `LOG_LEVEL` controls backend structured logging: `debug`, `info`, `warn`, `error`, `silent`.

## See also

- [[Installation]] — first-run admin bootstrap behavior depends on `ADMIN_PASSWORD`
- [[Administration#Production hardening]] — required secrets for `compose.prod.yml`
