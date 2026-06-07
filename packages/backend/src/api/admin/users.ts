import { Hono } from 'hono';
import { getDb } from '../../db';
import { authMiddleware } from '../../auth/middleware';
import { requirePermission } from '../../auth/rbac';
import { logAudit } from '../../lib/audit';

const users = new Hono();

users.use('/*', authMiddleware);

users.get('/', requirePermission('system.users.read'), async (c) => {
  const db = getDb();
  const rows = db
    .query(
      `
    SELECT u.id, u.username, u.source, u.email, u.is_active, u.is_admin, u.created_at,
           json_group_array(json_object('id', r.id, 'name', r.name)) as roles
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    GROUP BY u.id
    ORDER BY u.id
  `
    )
    .all() as {
    id: number;
    username: string;
    source: string;
    email: string | null;
    is_active: number;
    is_admin: number;
    created_at: string;
    roles: string;
  }[];

  const result = rows.map((row) => ({
    id: row.id,
    username: row.username,
    source: row.source,
    email: row.email,
    is_active: row.is_active === 1,
    is_admin: row.is_admin === 1,
    created_at: row.created_at,
    roles: JSON.parse(row.roles || '[]').filter((r: { id: number }) => r.id !== null),
  }));

  return c.json(result);
});

users.get('/:id', requirePermission('system.users.read'), async (c) => {
  const id = parseInt(c.req.param('id') || '');
  if (isNaN(id)) {
    return c.json({ error: 'Invalid ID' }, 400);
  }

  const db = getDb();
  const row = db
    .query(
      `
    SELECT u.id, u.username, u.source, u.email, u.is_active, u.is_admin, u.created_at,
           json_group_array(json_object('id', r.id, 'name', r.name)) as roles
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    WHERE u.id = ?
    GROUP BY u.id
  `
    )
    .get(id) as
    | {
        id: number;
        username: string;
        source: string;
        email: string | null;
        is_active: number;
        is_admin: number;
        created_at: string;
        roles: string;
      }
    | undefined;

  if (!row) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json({
    id: row.id,
    username: row.username,
    source: row.source,
    email: row.email,
    is_active: row.is_active === 1,
    is_admin: row.is_admin === 1,
    created_at: row.created_at,
    roles: JSON.parse(row.roles || '[]').filter((r: { id: number }) => r.id !== null),
  });
});

users.put('/:id', requirePermission('system.users.write'), async (c) => {
  const id = parseInt(c.req.param('id') || '');
  if (isNaN(id)) {
    return c.json({ error: 'Invalid ID' }, 400);
  }

  const db = getDb();
  const existing = db.query('SELECT * FROM users WHERE id = ?').get(id) as
    | {
        id: number;
        username: string;
        source: string;
        is_active: number;
        is_admin: number;
      }
    | undefined;

  if (!existing) {
    return c.json({ error: 'User not found' }, 404);
  }

  let body: {
    is_active?: boolean;
    email?: string;
    roles?: number[];
  };

  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  if (body.is_active !== undefined) {
    db.run('UPDATE users SET is_active = ?, updated_at = datetime("now") WHERE id = ?', [
      body.is_active ? 1 : 0,
      id,
    ]);
  }

  if (body.email !== undefined) {
    db.run('UPDATE users SET email = ?, updated_at = datetime("now") WHERE id = ?', [
      body.email,
      id,
    ]);
  }

  if (body.roles !== undefined) {
    db.run('DELETE FROM user_roles WHERE user_id = ?', [id]);
    for (const roleId of body.roles) {
      db.run('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)', [id, roleId]);
    }
  }

  logAudit(c, 'user.update', 'user', String(id));

  return c.json({ success: true });
});

users.delete('/:id', requirePermission('system.users.write'), async (c) => {
  const id = parseInt(c.req.param('id') || '');
  if (isNaN(id)) {
    return c.json({ error: 'Invalid ID' }, 400);
  }

  const db = getDb();
  const existing = db.query('SELECT * FROM users WHERE id = ?').get(id) as
    | {
        id: number;
        source: string;
        is_admin: number;
      }
    | undefined;

  if (!existing) {
    return c.json({ error: 'User not found' }, 404);
  }

  if (existing.source === 'local' && existing.is_admin === 1) {
    const adminCount = db
      .query("SELECT COUNT(*) as count FROM users WHERE source = 'local' AND is_admin = 1")
      .get() as { count: number };
    if (adminCount.count <= 1) {
      return c.json({ error: 'Cannot delete the last local admin' }, 400);
    }
  }

  db.run('DELETE FROM users WHERE id = ?', [id]);
  logAudit(c, 'user.delete', 'user', String(id));
  return c.json({ success: true });
});

export { users };
