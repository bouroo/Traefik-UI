# Administration

Day-2 operations: audit logs, identity administration, and the production hardening checklist.

## Audit logging

Every mutation through admin endpoints (create / update / delete on users, groups, roles, IdPs) is recorded with actor, target, action, and timestamp. Audit entries are append-only and available through the admin audit view — they are not exposed via public API and require admin permissions to read.

## User, group, role administration

Managed from the Admin menu:

- **Users** — create, deactivate, change email, assign roles and groups. Screenshot: `docs/screenshots/admin-users.png`.
- **Groups** — bundle users and assign roles collectively. Screenshot: `docs/screenshots/admin-groups.png`.
- **Roles** — built-in (`super_admin`, `operator`, `viewer`) plus custom. Built-in roles are protected from deletion. Screenshot: `docs/screenshots/admin-roles.png`.

See [[Access-Control]] for the model details and how to define custom roles.

## IdP management

Configure OpenID Connect providers from **Admin → IdP Providers**. Supports multiple providers, PKCE, and auto-provisioning. Client secrets are encrypted at rest. Screenshot: `docs/screenshots/admin-idp.png`. See [[Single-Sign-On]].

## Changing your own password

Logged-in users can rotate their own password from the profile menu; admins can also reset any non-SSO user's password. Passwords are hashed with argon2id before storage.

## Production hardening

The base `compose.yml` is a dev/demo stack. For production, layer the `compose.prod.yml` overlay:

```bash
export JWT_SECRET=$(openssl rand -base64 48)
export ENCRYPTION_KEY=$(openssl rand -base64 48)
export CORS_ORIGIN=https://traefik-ui.example.com

podman compose -f compose.yml -f compose.prod.yml up -d
```

What the production overlay gives you:

- **Non-root container** — runs as `traefikui` (UID 10001)
- **Named volume** for SQLite — no host bind-mount permission issues
- **Read-only root filesystem** with writable `/tmp` tmpfs
- **Resource limits** — 512 MB memory, 1.0 CPU
- **Secrets required** — `compose.prod.yml` refuses to start without `JWT_SECRET` and `ENCRYPTION_KEY`
- **No public Traefik API port** — port 8080 is not published; the UI talks to Traefik over the internal network only

Full checklist, including reverse-proxy TLS termination, network policies, and backup of the SQLite volume, lives in [DEPLOYMENT.md](../DEPLOYMENT.md) in the repo.

## See also

- [[Configuration]]
- [[Access-Control]]
- [[Single-Sign-On]]
- [[Troubleshooting]]
