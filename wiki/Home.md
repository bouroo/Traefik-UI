# Traefik-UI Wiki

Traefik-UI is a full-featured web UI for managing your Traefik reverse proxy. It lets you inspect and edit routers, services, middlewares, TLS certificates, entrypoints, access logs, and system metrics — gated by JWT + OIDC SSO authentication with role-based access control for day-2 operations.

## Feature highlights

- Real-time dashboard with router / service / middleware / entrypoint counts and a Traefik-info card
- HTTP, TCP, and UDP router, service, and middleware management (registry-driven, single source of truth)
- TLS certificate viewer backed by `acme.json`
- Access log viewer with filtering for both CLF and JSON formats
- System monitoring (CPU, memory, uptime, disk)
- Config file viewer & editor for static and dynamic Traefik YAML — validate against the Traefik JSON Schema, format, and save in place
- OIDC SSO with PKCE, multiple IdP support, and auto-provisioning
- Role-based access control: 19 permissions, 3 built-in roles (`super_admin`, `operator`, `viewer`)
- User, group, role, and IdP management UI
- Audit logging for administrative actions
- Dark mode and responsive layout
- Podman / Docker Compose deployment

## Getting Started in 60 seconds

```bash
git clone <repo>
cd Traefik-UI
podman compose up -d
```

Then open **http://localhost:3000**.

On first run the users table is empty, so an `admin` account is created automatically. If `ADMIN_PASSWORD` is unset, a random 12-character password is generated and printed to the container's **stdout** (not the structured log). Retrieve it:

```bash
podman compose logs traefik-ui | grep "Password:"
```

Default credentials:

- Username: `admin`
- Password: the value printed to logs (or whatever you set via `ADMIN_PASSWORD`)

## Wiki pages

- [[Installation]] — Compose quick start, dev mode from source, and container images
- [[Configuration]] — Every environment variable explained
- [[Managing-Resources]] — Routers, services, middlewares, TLS, logs, system, config files
- [[Access-Control]] — RBAC, built-in and custom roles, users, groups
- [[Single-Sign-On]] — OIDC configuration, multiple IdPs, encryption at rest
- [[Administration]] — Day-2 operations, audit logs, production hardening
- [[Troubleshooting]] — Common problems and fixes
