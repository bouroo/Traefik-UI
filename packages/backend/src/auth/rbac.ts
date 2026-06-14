import type { Context, Next } from 'hono';
import { getDb } from '../db';
import { config } from '../config';

interface CachedPerms {
  perms: string[];
  expiresAt: number;
}

const permCache = new Map<number, CachedPerms>();

export function invalidateUserPermissions(userId: number): void {
  permCache.delete(userId);
}

export function invalidateAllPermissions(): void {
  permCache.clear();
}

function loadPermsFromDb(userId: number): string[] {
  const db = getDb();
  const rows = db
    .query(
      `
    SELECT DISTINCT p.name
    FROM permissions p
    JOIN role_permissions rp ON rp.permission_id = p.id
    WHERE rp.role_id IN (
      SELECT role_id FROM user_roles WHERE user_id = ?
      UNION
      SELECT gr.role_id FROM user_groups ug
      JOIN group_roles gr ON gr.group_id = ug.group_id
      WHERE ug.user_id = ?
    )
  `
    )
    .all(userId, userId) as { name: string }[];

  return rows.map((r) => r.name);
}

export function getUserPermissions(userId: number): string[] {
  if (!config.rbac.permissionCacheEnabled) {
    return loadPermsFromDb(userId);
  }

  const now = Date.now();
  const cached = permCache.get(userId);
  if (cached && cached.expiresAt > now) {
    return cached.perms;
  }

  const perms = loadPermsFromDb(userId);
  permCache.set(userId, {
    perms,
    expiresAt: now + config.rbac.permissionCacheTtlMs,
  });
  return perms;
}

export function hasPermission(userId: number, permission: string): boolean {
  const perms = getUserPermissions(userId);
  return perms.includes(permission);
}

export function requirePermission(permission: string) {
  return async (c: Context, next: Next): Promise<Response | void> => {
    const userId = c.get('userId');

    if (userId === undefined || userId === null) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (!hasPermission(userId, permission)) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    return next();
  };
}

export function requireResourcePermission(paramName: string) {
  return async (c: Context, next: Next): Promise<Response | void> => {
    const userId = c.get('userId');
    if (userId === undefined || userId === null) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    const resourceType = c.req.param(paramName);
    if (!resourceType) {
      return c.json({ error: 'Bad Request' }, 400);
    }
    const map: Record<string, string> = {
      routers: 'traefik.routers.read',
      services: 'traefik.services.read',
      middlewares: 'traefik.middlewares.read',
    };
    const permission = map[resourceType] ?? 'traefik.config.read';
    if (!hasPermission(userId, permission)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    return next();
  };
}
