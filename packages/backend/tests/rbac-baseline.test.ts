import { describe, it, expect, beforeEach, afterAll } from 'bun:test';
import { Hono } from 'hono';
import {
  requireResourcePermission,
  getUserPermissions,
  invalidateUserPermissions,
  invalidateAllPermissions,
  hasPermission,
} from '../src/auth/rbac';
import { getDb, resetDb } from '../src/db';
import { setupTestUser, cleanupTestEnv } from './helpers';

async function runMiddleware(
  middleware: (c: import('hono').Context, next: import('hono').Next) => Promise<Response | void>,
  opts: { userId?: number; resourceType?: string } = {}
): Promise<{ status: number; nextCalled: boolean; body: unknown }> {
  const resourceType = opts.resourceType ?? 'routers';
  const req = new Request(`http://localhost/${encodeURIComponent(resourceType)}`);
  const app = new Hono();
  let nextCalled = false;
  app.use('/:resourceType', async (c, next) => {
    if (opts.userId !== undefined) c.set('userId', opts.userId);
    const result = await middleware(c, next);
    if (result) return result;
    await next();
    nextCalled = true;
    return c.json({ ok: true });
  });
  const res = await app.fetch(req);
  const body = await res.json().catch(() => null);
  return { status: res.status, nextCalled, body };
}

describe('rbac', () => {
  beforeEach(async () => {
    resetDb();
    await setupTestUser();
    invalidateAllPermissions();
  });

  afterAll(() => {
    cleanupTestEnv();
  });

  describe('requireResourcePermission mapping', () => {
    it('returns 401 when userId is not set on context', async () => {
      const result = await runMiddleware(requireResourcePermission('resourceType'), {
        resourceType: 'routers',
      });
      expect(result.status).toBe(401);
      expect(result.nextCalled).toBe(false);
    });

    it('maps "routers" to traefik.routers.read and grants user with that perm', async () => {
      const db = getDb();
      const userId = 9001;
      db.run('INSERT INTO users (id, username, password_hash, is_admin) VALUES (?, ?, ?, 0)', [
        userId,
        'router_user',
        'hash',
      ]);
      const perm = db
        .query('SELECT id FROM permissions WHERE name = ?')
        .get('traefik.routers.read') as { id: number } | undefined;
      expect(perm).toBeDefined();
      const role = db
        .query('INSERT INTO roles (name) VALUES (?) RETURNING id')
        .get('temp_routers_role') as { id: number } | null;
      const roleId =
        role?.id ??
        Number(
          db.query('SELECT id FROM roles WHERE name = ?').get('temp_routers_role') as { id: number }
        ).id;
      db.run('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [
        roleId,
        perm!.id,
      ]);
      db.run('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [userId, roleId]);
      invalidateAllPermissions();

      const result = await runMiddleware(requireResourcePermission('resourceType'), {
        userId,
        resourceType: 'routers',
      });
      expect(result.status).toBe(200);
      expect(result.nextCalled).toBe(true);
    });

    it('maps "services" to traefik.services.read and denies user lacking it', async () => {
      const db = getDb();
      const userId = 9002;
      db.run('INSERT INTO users (id, username, password_hash, is_admin) VALUES (?, ?, ?, 0)', [
        userId,
        'svc_user',
        'hash',
      ]);
      // Give the user only a routers.read permission
      const perm = db
        .query('SELECT id FROM permissions WHERE name = ?')
        .get('traefik.routers.read') as { id: number } | undefined;
      const role = db
        .query('INSERT INTO roles (name) VALUES (?) RETURNING id')
        .get('temp_svc_role') as { id: number } | null;
      const roleId =
        role?.id ??
        Number(
          db.query('SELECT id FROM roles WHERE name = ?').get('temp_svc_role') as { id: number }
        ).id;
      db.run('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [
        roleId,
        perm!.id,
      ]);
      db.run('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [userId, roleId]);
      invalidateAllPermissions();

      const result = await runMiddleware(requireResourcePermission('resourceType'), {
        userId,
        resourceType: 'services',
      });
      expect(result.status).toBe(403);
      expect(result.nextCalled).toBe(false);
    });

    it('maps "middlewares" to traefik.middlewares.read', async () => {
      const db = getDb();
      const userId = 9003;
      db.run('INSERT INTO users (id, username, password_hash, is_admin) VALUES (?, ?, ?, 0)', [
        userId,
        'mw_user',
        'hash',
      ]);
      const perm = db
        .query('SELECT id FROM permissions WHERE name = ?')
        .get('traefik.middlewares.read') as { id: number } | undefined;
      const role = db
        .query('INSERT INTO roles (name) VALUES (?) RETURNING id')
        .get('temp_mw_role') as { id: number } | null;
      const roleId =
        role?.id ??
        Number(
          db.query('SELECT id FROM roles WHERE name = ?').get('temp_mw_role') as { id: number }
        ).id;
      db.run('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [
        roleId,
        perm!.id,
      ]);
      db.run('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [userId, roleId]);
      invalidateAllPermissions();

      const result = await runMiddleware(requireResourcePermission('resourceType'), {
        userId,
        resourceType: 'middlewares',
      });
      expect(result.status).toBe(200);
      expect(result.nextCalled).toBe(true);
    });

    it('maps unknown resourceType to traefik.config.read and denies user lacking it', async () => {
      const db = getDb();
      const userId = 9004;
      db.run('INSERT INTO users (id, username, password_hash, is_admin) VALUES (?, ?, ?, 0)', [
        userId,
        'cfg_user',
        'hash',
      ]);
      // Give user only a routers.read permission (no config.read)
      const perm = db
        .query('SELECT id FROM permissions WHERE name = ?')
        .get('traefik.routers.read') as { id: number } | undefined;
      const role = db
        .query('INSERT INTO roles (name) VALUES (?) RETURNING id')
        .get('temp_cfg_role') as { id: number } | null;
      const roleId =
        role?.id ??
        Number(
          db.query('SELECT id FROM roles WHERE name = ?').get('temp_cfg_role') as { id: number }
        ).id;
      db.run('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [
        roleId,
        perm!.id,
      ]);
      db.run('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [userId, roleId]);
      invalidateAllPermissions();

      const result = await runMiddleware(requireResourcePermission('resourceType'), {
        userId,
        resourceType: 'widgets',
      });
      expect(result.status).toBe(403);
      expect(result.nextCalled).toBe(false);
    });
  });

  describe('getUserPermissions cache behavior', () => {
    it('returns the permission list for a user', async () => {
      const db = getDb();
      const userId = 9101;
      db.run('INSERT INTO users (id, username, password_hash, is_admin) VALUES (?, ?, ?, 0)', [
        userId,
        'perm_user',
        'hash',
      ]);
      const perms = ['traefik.routers.read', 'traefik.services.read'];
      for (const p of perms) {
        const row = db.query('SELECT id FROM permissions WHERE name = ?').get(p) as
          | { id: number }
          | undefined;
        if (!row) continue;
        const role = db
          .query('INSERT INTO roles (name) VALUES (?) RETURNING id')
          .get(`perm_role_${userId}_${p}`) as { id: number } | null;
        const roleId =
          role?.id ??
          Number(
            db.query('SELECT id FROM roles WHERE name = ?').get(`perm_role_${userId}_${p}`) as {
              id: number;
            }
          ).id;
        db.run('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [
          roleId,
          row.id,
        ]);
        db.run('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [userId, roleId]);
      }
      invalidateAllPermissions();

      const result = getUserPermissions(userId);
      expect(result).toContain('traefik.routers.read');
      expect(result).toContain('traefik.services.read');
    });

    it('invalidateUserPermissions forces a DB re-read on next call', async () => {
      const db = getDb();
      const userId = 9102;
      db.run('INSERT INTO users (id, username, password_hash, is_admin) VALUES (?, ?, ?, 0)', [
        userId,
        'cache_user',
        'hash',
      ]);
      const perm = db
        .query('SELECT id FROM permissions WHERE name = ?')
        .get('traefik.routers.read') as { id: number } | undefined;
      const role = db
        .query('INSERT INTO roles (name) VALUES (?) RETURNING id')
        .get('cache_role') as { id: number } | null;
      const roleId =
        role?.id ??
        Number(db.query('SELECT id FROM roles WHERE name = ?').get('cache_role') as { id: number })
          .id;
      db.run('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [
        roleId,
        perm!.id,
      ]);
      db.run('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [userId, roleId]);
      invalidateAllPermissions();

      // Prime cache
      const first = getUserPermissions(userId);
      expect(first).toContain('traefik.routers.read');

      // Remove the role assignment, but cache should still show the old perms
      db.run('DELETE FROM user_roles WHERE user_id = ? AND role_id = ?', [userId, roleId]);
      const cached = getUserPermissions(userId);
      expect(cached).toContain('traefik.routers.read');

      // Invalidate, then re-read — should reflect the deletion
      invalidateUserPermissions(userId);
      const fresh = getUserPermissions(userId);
      expect(fresh).not.toContain('traefik.routers.read');
    });

    it('invalidateAllPermissions clears the whole cache', async () => {
      const db = getDb();
      const userId = 9103;
      db.run('INSERT INTO users (id, username, password_hash, is_admin) VALUES (?, ?, ?, 0)', [
        userId,
        'all_cache_user',
        'hash',
      ]);
      const perm = db
        .query('SELECT id FROM permissions WHERE name = ?')
        .get('traefik.routers.read') as { id: number } | undefined;
      const role = db
        .query('INSERT INTO roles (name) VALUES (?) RETURNING id')
        .get('all_cache_role') as { id: number } | null;
      const roleId =
        role?.id ??
        Number(
          db.query('SELECT id FROM roles WHERE name = ?').get('all_cache_role') as { id: number }
        ).id;
      db.run('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [
        roleId,
        perm!.id,
      ]);
      db.run('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [userId, roleId]);
      invalidateAllPermissions();

      expect(getUserPermissions(userId)).toContain('traefik.routers.read');

      // Remove role
      db.run('DELETE FROM user_roles WHERE user_id = ? AND role_id = ?', [userId, roleId]);

      // Without invalidation, cache is stale
      expect(getUserPermissions(userId)).toContain('traefik.routers.read');

      // Clear all
      invalidateAllPermissions();
      expect(getUserPermissions(userId)).not.toContain('traefik.routers.read');
    });

    it('hasPermission returns true for granted permission and false for missing', async () => {
      const db = getDb();
      const userId = 9104;
      db.run('INSERT INTO users (id, username, password_hash, is_admin) VALUES (?, ?, ?, 0)', [
        userId,
        'has_user',
        'hash',
      ]);
      const perm = db
        .query('SELECT id FROM permissions WHERE name = ?')
        .get('traefik.routers.read') as { id: number } | undefined;
      const role = db.query('INSERT INTO roles (name) VALUES (?) RETURNING id').get('has_role') as {
        id: number;
      } | null;
      const roleId =
        role?.id ??
        Number(db.query('SELECT id FROM roles WHERE name = ?').get('has_role') as { id: number })
          .id;
      db.run('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [
        roleId,
        perm!.id,
      ]);
      db.run('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [userId, roleId]);
      invalidateAllPermissions();

      expect(hasPermission(userId, 'traefik.routers.read')).toBe(true);
      expect(hasPermission(userId, 'system.users.write')).toBe(false);
    });
  });
});
