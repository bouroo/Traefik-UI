# Access Control

Traefik-UI uses a permission-based RBAC model: every action is gated on one of **19 permissions**, and every user is assigned one or more **roles** that bundle those permissions. UI elements and API routes both check the same enforcement layer (`packages/backend/src/auth/rbac.ts`).

## Built-in roles

Three roles ship out of the box and cannot be deleted:

| Role          | What it can do                                                                                            |
| ------------- | --------------------------------------------------------------------------------------------------------- |
| `super_admin` | Full access — user / group / role / IdP management, all resource pages, config editor                     |
| `operator`    | Day-2 operations: view and edit Traefik resources, edit config files, no user / role / IdP administration |
| `viewer`      | Read-only across all resources, logs, dashboard, and system stats                                         |

The admin pages (Users, Roles, Groups) list these out as you create new accounts. Screenshots: `docs/screenshots/admin-users.png`, `docs/screenshots/admin-roles.png`, `docs/screenshots/admin-groups.png`.

## Creating custom roles

Use the Roles admin page to add a new role:

1. Click **Create role**, give it a name and (optional) description.
2. Pick the permissions it grants from the full 19-permission list.
3. Save. The role is now assignable to users and groups.

Built-in roles are protected from deletion; custom roles are deletable as long as no user / group still references them.

## Users

CRUD on user accounts (active flag, email, role assignments, group memberships). The Users admin page exposes filtering and role assignment inline. Screenshot: `docs/screenshots/admin-users.png`.

## Groups

Groups bundle users for role assignment at scale — assign a role to a group and every member inherits it. Useful for teams ("ops-team", "devs", "viewers") rather than per-user role churn. Screenshot: `docs/screenshots/admin-groups.png`.

## Audit logging

Mutations through admin endpoints (create / update / delete on users, groups, roles, IdPs) are recorded in the audit log. See [[Administration#Audit logging]].

## Permissions reference

The full list of 19 permissions is exposed read-only through `GET /api/admin/permissions`. Browse it via the backend or by inspecting `packages/backend/src/auth/rbac.ts`.

> Screenshot paths above are relative to the main repo (`docs/screenshots/...`). See [README → Screenshots](../README.md#screenshots).
