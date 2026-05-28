INSERT INTO permissions (name, description) VALUES
  ('traefik.dashboard.read', 'Access dashboard overview'),
  ('traefik.routers.read', 'View routers'),
  ('traefik.services.read', 'View services'),
  ('traefik.middlewares.read', 'View middlewares'),
  ('traefik.tls.read', 'View TLS certificates'),
  ('traefik.entrypoints.read', 'View entrypoints'),
  ('traefik.logs.read', 'View access logs'),
  ('traefik.config.read', 'Read config files'),
  ('traefik.config.write', 'Write config files'),
  ('traefik.overview.read', 'View Traefik overview'),
  ('system.stats.read', 'View system stats'),
  ('system.config.read', 'View UI config'),
  ('system.acme.read', 'View ACME certificates'),
  ('system.users.read', 'View users'),
  ('system.users.write', 'Manage users'),
  ('system.roles.read', 'View roles'),
  ('system.roles.write', 'Manage roles'),
  ('system.idp.read', 'View identity providers'),
  ('system.idp.write', 'Manage identity providers');

INSERT INTO roles (name, description) VALUES
  ('super_admin', 'Full system access'),
  ('operator', 'Can view and modify Traefik resources, cannot manage users/roles/IdP'),
  ('viewer', 'Read-only access');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'super_admin';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'operator'
  AND p.name NOT LIKE 'system.users.%'
  AND p.name NOT LIKE 'system.roles.%'
  AND p.name NOT LIKE 'system.idp.%';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'viewer' AND p.name LIKE '%.read';