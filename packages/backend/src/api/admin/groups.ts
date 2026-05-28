import { Hono } from 'hono';
import { getDb } from '../../db';
import { authMiddleware } from '../../auth/middleware';
import { requirePermission } from '../../auth/rbac';
import { logAudit } from '../../lib/audit';

const groups = new Hono();

groups.use('/*', authMiddleware);

groups.get('/', requirePermission('system.users.read'), async (c) => {
  const db = getDb();
  const rows = db.query(`
    SELECT g.id, g.name, g.external_id, g.source, g.created_at,
           COUNT(ug.user_id) as member_count
    FROM groups g
    LEFT JOIN user_groups ug ON ug.group_id = g.id
    GROUP BY g.id
    ORDER BY g.id
  `).all() as {
    id: number;
    name: string;
    external_id: string | null;
    source: string;
    created_at: string;
    member_count: number;
  }[];

  return c.json(rows);
});

groups.get('/:id', requirePermission('system.users.read'), async (c) => {
  const id = parseInt(c.req.param('id') || '');
  if (isNaN(id)) {
    return c.json({ error: 'Invalid ID' }, 400);
  }

  const db = getDb();
  const group = db.query('SELECT * FROM groups WHERE id = ?').get(id) as {
    id: number;
    name: string;
    external_id: string | null;
    source: string;
    created_at: string;
  } | undefined;

  if (!group) {
    return c.json({ error: 'Group not found' }, 404);
  }

  const users = db.query(`
    SELECT u.id, u.username, u.email
    FROM users u
    JOIN user_groups ug ON ug.user_id = u.id
    WHERE ug.group_id = ?
  `).all(id) as { id: number; username: string; email: string | null }[];

  const roles = db.query(`
    SELECT r.id, r.name
    FROM roles r
    JOIN group_roles gr ON gr.role_id = r.id
    WHERE gr.group_id = ?
  `).all(id) as { id: number; name: string }[];

  return c.json({
    ...group,
    users,
    roles,
  });
});

groups.post('/', requirePermission('system.users.write'), async (c) => {
  let body: {
    name: string;
    external_id?: string;
    source?: string;
    role_ids?: number[];
  };

  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  if (!body.name) {
    return c.json({ error: 'Missing required field: name' }, 400);
  }

  const db = getDb();
  const result = db.run(
    'INSERT INTO groups (name, external_id, source) VALUES (?, ?, ?)',
    [body.name, body.external_id ?? null, body.source ?? 'local']
  );
  const groupId = Number(result.lastInsertRowid);

  if (body.role_ids && body.role_ids.length > 0) {
    for (const roleId of body.role_ids) {
      db.run('INSERT OR IGNORE INTO group_roles (group_id, role_id) VALUES (?, ?)', [groupId, roleId]);
    }
  }

  logAudit(c, 'group.create', 'group', String(groupId));
  return c.json({ id: groupId, name: body.name }, 201);
});

groups.put('/:id', requirePermission('system.users.write'), async (c) => {
  const id = parseInt(c.req.param('id') || '');
  if (isNaN(id)) {
    return c.json({ error: 'Invalid ID' }, 400);
  }

  const db = getDb();
  const existing = db.query('SELECT * FROM groups WHERE id = ?').get(id);
  if (!existing) {
    return c.json({ error: 'Group not found' }, 404);
  }

  let body: {
    name?: string;
    external_id?: string;
    role_ids?: number[];
  };

  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  if (body.name !== undefined) {
    db.run('UPDATE groups SET name = ? WHERE id = ?', [body.name, id]);
  }

  if (body.external_id !== undefined) {
    db.run('UPDATE groups SET external_id = ? WHERE id = ?', [body.external_id, id]);
  }

  if (body.role_ids !== undefined) {
    db.run('DELETE FROM group_roles WHERE group_id = ?', [id]);
    for (const roleId of body.role_ids) {
      db.run('INSERT OR IGNORE INTO group_roles (group_id, role_id) VALUES (?, ?)', [id, roleId]);
    }
  }

  logAudit(c, 'group.update', 'group', String(id));
  return c.json({ success: true });
});

groups.delete('/:id', requirePermission('system.users.write'), async (c) => {
  const id = parseInt(c.req.param('id') || '');
  if (isNaN(id)) {
    return c.json({ error: 'Invalid ID' }, 400);
  }

  const db = getDb();
  const existing = db.query('SELECT id FROM groups WHERE id = ?').get(id);
  if (!existing) {
    return c.json({ error: 'Group not found' }, 404);
  }

  db.run('DELETE FROM groups WHERE id = ?', [id]);
  logAudit(c, 'group.delete', 'group', String(id));
  return c.json({ success: true });
});

export { groups };
