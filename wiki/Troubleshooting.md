# Troubleshooting

Common issues and how to fix them. If something here doesn't match what you see, capture the relevant log line and open an issue.

## Traefik API not reachable

Symptoms: dashboard shows zero counts, log viewer is empty, "fetch failed" or 502 errors in the UI.

Checks:

- `TRAEFIK_API_URL` correctly set. In `compose.yml` the default is `http://traefik:8080` (compose-internal DNS); override to `http://localhost:8080` for host Traefik.
- From inside the backend container: `podman exec traefik-ui wget -qO- http://traefik:8080/api/version` should return JSON.
- If Traefik is behind basic auth, set both `TRAEFIK_API_USERNAME` and `TRAEFIK_API_PASSWORD`.
- In the production overlay the Traefik API port is intentionally not published; the UI talks to it over the internal Compose network only. Don't try to reach it from your laptop in that setup.

## First-run password lost

The first-run admin password is generated randomly and printed **once to stdout** (not the structured log). Recover it before the container restarts:

```bash
podman compose logs traefik-ui | grep "Password:"
```

If you no longer have that output:

- Set `ADMIN_PASSWORD` in your environment and restart — on next start with an empty `users` table the bootstrap will use it. (Deleting the data volume / DB_PATH is the nuclear option.)
- Or create a new admin directly in the database (then change its password through the UI).

## Login is rate-limited

The login endpoint is rate-limited at **10 requests per minute per IP**. Hitting it faster returns HTTP 429 with a `Retry-After` header. Other auth endpoints have a 20/min/IP cap, and the rest of the API a 100/min/IP cap. Wait out the window or fix whatever script is hammering the endpoint.

In unit/integration tests the limiter is disabled with `RATE_LIMIT_DISABLED=true` — don't disable it in prod.

## SQLite permission errors on a host bind mount

If you bind-mount `./data` from the host and the container runs as `traefikui` (UID 10001), the directory must be writable by that UID. Easiest fixes:

```bash
chown -R 10001:10001 ./data
```

or use a **named volume** in production (`compose.prod.yml` does this for you), which sidesteps Linux UID / permission mismatch entirely.

## Config file editor refuses to save

The config file editor writes back to `STATIC_CONFIG_PATH` / `DYNAMIC_CONFIG_PATH` on the host. If it fails:

- The mount is read-only. Make it read-write in compose or your orchestrator.
- The file's parent directory is not writable by the container's UID.
- YAML fails Traefik's JSON Schema validation — the editor will show the schema errors; fix them and try again.

## Health endpoints

Two health endpoints, useful for `kubectl` liveness / readiness probes or compose `healthcheck`:

- `GET /api/health` — public, used by container healthcheck. Returns `ok` or `degraded`.
- `GET /api/system/health` — more detail, may require auth depending on configuration.

Quick local check:

```bash
curl -s http://localhost:3000/api/health
```

## Frontend can't reach the backend

In dev, the Vite server proxies `/api` to `http://localhost:3000`. If the backend is on a different host or port, configure the proxy in `packages/frontend/vite.config.ts`. In production the UI and API are served from the same origin so this isn't an issue.

## See also

- [[Configuration]] — every env var explained
- [[Installation]] — first-run admin bootstrap
- [[Administration#Production hardening]] — secrets and overlays
