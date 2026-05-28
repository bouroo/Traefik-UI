import { Hono } from 'hono';
import { getDb } from '../../db';
import { authMiddleware } from '../../auth/middleware';
import { requirePermission } from '../../auth/rbac';

const permissions = new Hono();

permissions.use('/*', authMiddleware);

permissions.get('/', requirePermission('system.roles.read'), async (c) => {
  const db = getDb();
  const rows = db.query(`
    SELECT id, name, description, created_at
    FROM permissions
    ORDER BY id
  `).all() as {
    id: number;
    name: string;
    description: string | null;
    created_at: string;
  }[];

  return c.json(rows);
});

permissions.get('/:id', requirePermission('system.roles.read'), async (c) => {
  const id = parseInt(c.req.param('id') || '');
  if (isNaN(id)) {
    return c.json({ error: 'Invalid ID' }, 400);
  }

  const db = getDb();
  const row = db.query('SELECT id, name, description, created_at FROM permissions WHERE id = ?').get(id) as {
    id: number;
    name: string;
    description: string | null;
    created_at: string;
  } | undefined;

  if (!row) {
    return c.json({ error: 'Permission not found' }, 404);
  }

  return c.json(row);
});

export { permissions };
