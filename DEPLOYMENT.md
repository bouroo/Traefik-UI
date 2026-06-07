# Deployment Guide — Traefik-UI with Podman

This guide covers building the Traefik-UI container image and running the full stack (Traefik reverse proxy + Traefik-UI) using **Podman**.

## Prerequisites

- **Podman** ≥ 4.0 installed and configured for rootless mode.
- **Bun** ≥ 1.2.4 (only required for local development / running E2E tests against dev servers).
- A working directory with the repository cloned.

## 1. Build the Container Image

The repository includes a multi-stage `Containerfile` (Dockerfile-compatible) that builds the monorepo and produces a production image based on `oven/bun:1-slim`.

```bash
# From the repository root
podman build -f Containerfile -t traefik-ui:latest .
```

### Build Tips
- Podman uses Buildah under the hood; builds are rootless by default.
- If you encounter SELinux issues with volumes later, the `compose.yml` already sets `security_opt: [label=disable]` for both services.
- To verify the image was built successfully:
  ```bash
  podman images | grep traefik-ui
  ```

## 2. Standalone Container Run

If you only want to run the UI container (without the Traefik proxy) for quick smoke-testing:

```bash
podman run -d \
  --name traefik-ui \
  -p 3000:3000 \
  -e PORT=3000 \
  -e HOST=0.0.0.0 \
  -e JWT_SECRET=change-me-to-a-random-secret-in-production \
  -e TRAEFIK_API_URL=http://host.containers.internal:8080 \
  -e DB_PATH=/app/data/traefik-ui.db \
  -e LOG_LEVEL=info \
  -e CORS_ORIGIN='*' \
  -v ./data/data:/app/data:Z \
  traefik-ui:latest
```

> **Note**: `host.containers.internal` lets the container reach services on the host. If you do not have a Traefik proxy running locally, the UI will still start but show a "disconnected" status on the dashboard.

### Check Health

```bash
# Wait a few seconds, then:
curl -s http://localhost:3000/api/health | jq .
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-06-07T..."
}
```

### Stop / Remove

```bash
podman stop traefik-ui
podman rm traefik-ui
```

## 3. Full Stack with Podman Compose

The repository includes a `compose.yml` that defines two services:

- `traefik-proxy` — Traefik v3 reverse proxy with API/dashboard enabled.
- `traefik-ui` — This management UI.

### 3.1 Prepare Data Directories

```bash
mkdir -p data/traefik/logs data/data
touch data/traefik/acme.json
chmod 600 data/traefik/acme.json
```

Ensure `data/traefik/dynamic.yml` exists (it is mounted read-write by the UI). A minimal starter:

```yaml
# data/traefik/dynamic.yml
http:
  routers:
    dummy:
      rule: "Host(\`localhost\`)"
      service: dummy
  services:
    dummy:
      loadBalancer:
        servers:
          - url: "http://127.0.0.1"
```

### 3.2 Start the Stack

```bash
podman compose up -d
```

If your Podman setup does not provide the `compose` sub-command, use the standalone `podman-compose` tool:

```bash
podman-compose up -d
```

### 3.3 Verify Services

```bash
# Traefik dashboard (insecure mode for local testing)
open http://localhost:8080

# Traefik-UI
curl -s http://localhost:3000/api/health | jq .
open http://localhost:3000
```

### 3.4 View Logs

```bash
# Traefik proxy
podman logs -f traefik-proxy

# Traefik-UI
podman logs -f traefik-ui
```

### 3.5 Stop the Stack

```bash
podman compose down
# or
podman-compose down
```

## 4. Rootless Volume Permissions (SQLite)

The UI writes to an SQLite database inside the container. When using host-mounted directories with rootless Podman, the container runs as your host UID by default, but `compose.yml` sets `user: "0:0"` so the container process can write to the volume.

If you prefer **not** running the container as root inside the namespace, create a named volume instead:

```yaml
# In compose.yml, replace the host mount with:
volumes:
  ui-data:
```

and attach it:

```yaml
services:
  traefik-ui:
    volumes:
      - ui-data:/app/data
```

Then run:

```bash
podman compose up -d
```

## 5. Production Hardening Checklist

### Secrets & Credentials

- [ ] Change `JWT_SECRET` to a cryptographically random string (≥ 32 bytes). Example: `openssl rand -base64 48`.
- [ ] Set `ENCRYPTION_KEY` explicitly (do not rely on the `JWT_SECRET` fallback). This key encrypts IdP client secrets at rest via AES-GCM.
- [ ] Retrieve the generated admin password from the container logs (`podman compose logs traefik-ui | grep "Password:"`) and change it immediately after first login. The password is also saved to `admin-credentials.txt` in the data directory on first run.
- [ ] Set `TRAEFIK_API_USERNAME` and `TRAEFIK_API_PASSWORD` if the Traefik API requires authentication.

### Network & CORS

- [ ] Restrict `CORS_ORIGIN` to your exact domain (e.g., `https://traefik-ui.example.com`) instead of `*`.
- [ ] Terminate TLS in front of the UI — use Traefik itself, Caddy, nginx, or a cloud load balancer with a valid certificate.
- [ ] Remove `--api.insecure=true` from the Traefik proxy command and protect the Traefik API with basic auth, IP whitelist, or a dedicated entrypoint on an internal network.
- [ ] Do not expose port 8080 (Traefik API/dashboard) publicly; restrict it to the `traefik-net` internal network or localhost only.

### Container Security

- [ ] Avoid running as `user: "0:0"` — use a named volume for `/app/data` instead of a host mount, or set correct host directory ownership to UID `10001` (the `traefikui` user created in the Containerfile).
- [ ] Run with `--read-only --tmpfs /tmp` and mount only required paths (`/app/data`, `/var/log/traefik`, `/etc/traefik`) as volumes.
- [ ] Set resource limits: `--memory=512m --cpus=1.0` (or equivalent in `compose.yml` via `deploy.resources`).
- [ ] Pin image tags to a specific version (e.g., `traefik-ui:1.0.0`) instead of `:latest` for reproducibility.

### Authentication & RBAC

- [ ] Configure OIDC/SSO via an identity provider (Keycloak, Authelia, etc.) using the Admin → SSO Providers page for centralized auth.
- [ ] Create least-privilege roles (Operator, Viewer) and assign users to groups instead of granting `super_admin` to all users.
- [ ] Disable the local admin account or set a strong password if OIDC is the sole auth method.

### Database & Persistence

- [ ] Back up the SQLite database regularly — it is a single file at `DB_PATH` (default: `/app/data/traefik-ui.db`).
- [ ] Use a named volume instead of a host bind mount to avoid SELinux and permission issues in rootless Podman.
- [ ] Set `ACME_JSON_PATH` and `DYNAMIC_CONFIG_PATH` to `:ro` (read-only) mounts if the UI does not need to modify Traefik configuration.

### Logging & Monitoring

- [ ] Set `LOG_LEVEL=warn` or `LOG_LEVEL=error` in production to reduce log noise (default is `info`).
- [ ] Enable container log rotation: `--log-opt max-size=10m --log-opt max-file=3`.
- [ ] Monitor the `/api/health` endpoint (the Containerfile includes a `HEALTHCHECK`) with your orchestration platform.

### Traefik Proxy

- [ ] Enable Let's Encrypt via `certificatesresolvers` (commented out in `compose.yml`) for automatic TLS certificate management.
- [ ] Set `--api.dashboard=false` if you do not need the Traefik dashboard (Traefik-UI provides its own).

## 6. Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| `podman build` fails on `bun install` | Missing lockfile or network issue | Run `bun install` locally first to regenerate `bun.lock` |
| `SQLite: readonly database` | Host volume permissions | Ensure the host directory is writable by the container user, or use a named volume |
| Health check returns `connection refused` | Server still starting | Wait 5–10 seconds; the container has a 5-second start period |
| SELinux denials on volume access | Rootless + SELinux enforcing | Use `:Z` or `:z` label on volumes, or `security_opt: [label=disable]` |
| E2E tests fail against container | Container not exposing port 3000 | Verify `podman ps` shows port mapping `0.0.0.0:3000->3000/tcp` |
