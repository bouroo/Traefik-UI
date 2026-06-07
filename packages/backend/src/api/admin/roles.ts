import { Hono } from 'hono';
import { getDb } from '../../db';
import { authMiddleware } from '../../auth/middleware';
import { requirePermission } from '../../auth/rbac';
import { logAudit } from '../../lib/audit';

const BUILT_IN_ROLES = ['super_admin', 'operator', 'viewer'];

const roles = new Hono();

roles.use('/*', authMiddleware);

roles.get('/', requirePermission('system.roles.read'), async (c) => {
  const db = getDb();
  const rows = db
    .query(
      `
    SELECT r.id, r.name, r.description, r.created_at,
           json_group_array(p.name) as permission_names
    FROM roles r
    LEFT JOIN role_permissions rp ON rp.role_id = r.id
    LEFT JOIN permissions p ON p.id = rp.permission_id
    GROUP BY r.id
    ORDER BY r.id
  `
    )
    .all() as {
    id: number;
    name: string;
    description: string | null;
    created_at: string;
    permission_names: string;
  }[];

  const result = rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    created_at: row.created_at,
    permission_names: JSON.parse(row.permission_names || '[]').filter((n: string) => n !== null),
  }));

  return c.json(result);
});

roles.get('/:id', requirePermission('system.roles.read'), async (c) => {
  const id = parseInt(c.req.param('id') || '');
  if (isNaN(id)) {
    return c.json({ error: 'Invalid ID' }, 400);
  }

  const db = getDb();
  const row = db
    .query(
      `
    SELECT r.id, r.name, r.description, r.created_at,
           json_group_array(p.name) as permission_names
    FROM roles r
    LEFT JOIN role_permissions rp ON rp.role_id = r.id
    LEFT JOIN permissions p ON p.id = rp.permission_id
    WHERE r.id = ?
    GROUP BY r.id
  `
    )
    .get(id) as
    | {
        id: number;
        name: string;
        description: string | null;
        created_at: string;
        permission_names: string;
      }
    | undefined;

  if (!row) {
    return c.json({ error: 'Role not found' }, 404);
  }

  return c.json({
    id: row.id,
    name: row.name,
    description: row.description,
    created_at: row.created_at,
    permission_names: JSON.parse(row.permission_names || '[]').filter((n: string) => n !== null),
  });
});

roles.post('/', requirePermission('system.roles.write'), async (c) => {
  let body: {
    name: string;
    description?: string;
    permission_ids: number[];
  };

  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  if (!body.name) {
    return c.json({ error: 'Missing required field: name' }, 400);
  }

  if (!body.permission_ids || !Array.isArray(body.permission_ids)) {
    return c.json({ error: 'Missing required field: permission_ids (array)' }, 400);
  }

  const db = getDb();
  const existing = db.query('SELECT id FROM roles WHERE name = ?').get(body.name);
  if (existing) {
    return c.json({ error: 'Role with this name already exists' }, 400);
  }

  const result = db.run('INSERT INTO roles (name, description) VALUES (?, ?)', [
    body.name,
    body.description ?? null,
  ]);
  const roleId = Number(result.lastInsertRowid);

  for (const permId of body.permission_ids) {
    db.run('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [
      roleId,
      permId,
    ]);
  }

  logAudit(c, 'role.create', 'role', String(roleId));
  return c.json({ id: roleId, name: body.name }, 201);
});

roles.put('/:id', requirePermission('system.roles.write'), async (c) => {
  const id = parseInt(c.req.param('id') || '');
  if (isNaN(id)) {
    return c.json({ error: 'Invalid ID' }, 400);
  }

  const db = getDb();
  const existing = db.query('SELECT * FROM roles WHERE id = ?').get(id) as
    | {
        id: number;
        name: string;
      }
    | undefined;

  if (!existing) {
    return c.json({ error: 'Role not found' }, 404);
  }

  let body: {
    name?: string;
    description?: string;
    permission_ids?: number[];
  };

  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  if (body.name !== undefined) {
    const nameConflict = db
      .query('SELECT id FROM roles WHERE name = ? AND id != ?')
      .get(body.name, id);
    if (nameConflict) {
      return c.json({ error: 'Role with this name already exists' }, 400);
    }
    db.run('UPDATE roles SET name = ? WHERE id = ?', [body.name, id]);
  }

  if (body.description !== undefined) {
    db.run('UPDATE roles SET description = ? WHERE id = ?', [body.description, id]);
  }

  if (body.permission_ids !== undefined) {
    db.run('DELETE FROM role_permissions WHERE role_id = ?', [id]);
    for (const permId of body.permission_ids) {
      db.run('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [
        id,
        permId,
      ]);
    }
  }

  logAudit(c, 'role.update', 'role', String(id));
  return c.json({ success: true });
});

roles.delete('/:id', requirePermission('system.roles.write'), async (c) => {
  const id = parseInt(c.req.param('id') || '');
  if (isNaN(id)) {
    return c.json({ error: 'Invalid ID' }, 400);
  }

  const db = getDb();
  const existing = db.query('SELECT * FROM roles WHERE id = ?').get(id) as
    | {
        id: number;
        name: string;
      }
    | undefined;

  if (!existing) {
    return c.json({ error: 'Role not found' }, 404);
  }

  if (BUILT_IN_ROLES.includes(existing.name)) {
    return c.json({ error: `Cannot delete built-in role: ${existing.name}` }, 400);
  }

  db.run('DELETE FROM roles WHERE id = ?', [id]);
  logAudit(c, 'role.delete', 'role', String(id));
  return c.json({ success: true });
});

export { roles };
