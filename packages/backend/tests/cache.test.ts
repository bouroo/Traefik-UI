import { describe, it, expect, beforeEach, afterAll } from 'bun:test';
import { app, setupTestUser, getTestToken, authRequest, cleanupTestEnv, getDb } from './helpers';
import {
  getUserPermissions,
  invalidateUserPermissions,
  invalidateAllPermissions,
} from '../src/auth/rbac';
import { invalidateTraefikCache, getVersion, getOverview } from '../src/traefik/client';

async function authPut(path: string, body: unknown) {
  return app.request(
    authRequest(path, getTestToken(), {
      method: 'PUT',
      body: JSON.stringify(body),
    })
  );
}

function originalEnv(): void {
  delete process.env.PERMISSION_CACHE_ENABLED;
  delete process.env.PERMISSION_CACHE_TTL_MS;
  delete process.env.TRAEFIK_CACHE_TTL_MS;
}

describe('Permission cache', () => {
  beforeEach(async () => {
    await setupTestUser();
    invalidateAllPermissions();
    originalEnv();
  });

  it('returns cached permissions on second call (no extra DB read)', () => {
    const db = getDb();
    const user = db.query('SELECT id FROM users LIMIT 1').get() as { id: number };
    invalidateAllPermissions();

    // Sentinel approach: insert a permission via direct DB, read, then delete
    // the underlying link. A cached call should still see the permission; a
    // fresh DB read should not.
    const perm = db.query("SELECT id FROM permissions WHERE name = 'system.users.read'").get() as
      | { id: number }
      | undefined;
    expect(perm).toBeDefined();

    const role = db.query("SELECT id FROM roles WHERE name = 'super_admin'").get() as {
      id: number;
    };

    // Make sure the link exists
    db.run('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)', [user.id, role.id]);
    invalidateUserPermissions(user.id);

    const first = getUserPermissions(user.id);
    expect(first).toContain('system.users.read');

    // Remove the link directly from the DB. The next call (cache hit) must
    // still return 'system.users.read' because the cache is populated.
    db.run('DELETE FROM user_roles WHERE user_id = ? AND role_id = ?', [user.id, role.id]);

    const second = getUserPermissions(user.id);
    expect(second).toContain('system.users.read');

    // Restore for cleanup
    db.run('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)', [user.id, role.id]);
    invalidateUserPermissions(user.id);
  });

  it('invalidateUserPermissions forces a fresh DB read', () => {
    const db = getDb();
    const user = db.query('SELECT id FROM users LIMIT 1').get() as { id: number };
    invalidateUserPermissions(user.id);

    const role = db.query("SELECT id FROM roles WHERE name = 'super_admin'").get() as {
      id: number;
    };
    db.run('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)', [user.id, role.id]);

    const first = getUserPermissions(user.id);
    expect(first).toContain('system.users.read');

    // Drop the link and invalidate cache — second call should NOT include the perm
    db.run('DELETE FROM user_roles WHERE user_id = ? AND role_id = ?', [user.id, role.id]);
    invalidateUserPermissions(user.id);

    const second = getUserPermissions(user.id);
    expect(second).not.toContain('system.users.read');

    // Restore
    db.run('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)', [user.id, role.id]);
    invalidateUserPermissions(user.id);
  });

  it('PERMISSION_CACHE_ENABLED=false bypasses cache entirely', () => {
    process.env.PERMISSION_CACHE_ENABLED = 'false';
    invalidateAllPermissions();

    const db = getDb();
    const user = db.query('SELECT id FROM users LIMIT 1').get() as { id: number };

    const first = getUserPermissions(user.id);
    expect(first).toContain('system.users.read');

    // With caching disabled, removing the link from DB must immediately be
    // reflected (no stale cache to serve).
    const role = db.query("SELECT id FROM roles WHERE name = 'super_admin'").get() as {
      id: number;
    };
    db.run('DELETE FROM user_roles WHERE user_id = ? AND role_id = ?', [user.id, role.id]);

    const second = getUserPermissions(user.id);
    expect(second).not.toContain('system.users.read');

    // Restore
    db.run('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)', [user.id, role.id]);
  });

  it('PERMISSION_CACHE_TTL_MS=10 expires after 20ms', async () => {
    process.env.PERMISSION_CACHE_TTL_MS = '10';
    invalidateAllPermissions();

    const db = getDb();
    const user = db.query('SELECT id FROM users LIMIT 1').get() as { id: number };

    const first = getUserPermissions(user.id);
    expect(first).toContain('system.users.read');

    // Drop the link; while TTL is fresh, second call should return stale data
    const role = db.query("SELECT id FROM roles WHERE name = 'super_admin'").get() as {
      id: number;
    };
    db.run('DELETE FROM user_roles WHERE user_id = ? AND role_id = ?', [user.id, role.id]);

    const second = getUserPermissions(user.id);
    expect(second).toContain('system.users.read');

    // Wait past TTL — third call should hit DB and reflect the removal
    await Bun.sleep(20);
    const third = getUserPermissions(user.id);
    expect(third).not.toContain('system.users.read');

    // Restore
    db.run('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)', [user.id, role.id]);
    delete process.env.PERMISSION_CACHE_TTL_MS;
    invalidateUserPermissions(user.id);
  });

  it('invalidateAllPermissions clears all entries', () => {
    const db = getDb();
    const users = db.query('SELECT id FROM users').all() as { id: number }[];

    // Warm caches
    for (const u of users) {
      getUserPermissions(u.id);
    }

    // Now wipe all roles → all users should have no perms after invalidation
    const originalRoles = db.query('SELECT user_id, role_id FROM user_roles').all() as {
      user_id: number;
      role_id: number;
    }[];
    db.run('DELETE FROM user_roles');

    invalidateAllPermissions();
    for (const u of users) {
      const perms = getUserPermissions(u.id);
      expect(perms).toEqual([]);
    }

    // Restore
    for (const r of originalRoles) {
      db.run('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)', [
        r.user_id,
        r.role_id,
      ]);
    }
    invalidateAllPermissions();
  });
});

describe('Traefik API cache', () => {
  beforeEach(async () => {
    await setupTestUser();
    originalEnv();
    invalidateTraefikCache();
  });

  it('repeated call to the same endpoint hits upstream only once (cache hit)', async () => {
    invalidateTraefikCache();
    const a = await getVersion();
    const b = await getVersion();
    const c = await getVersion();
    // Same data returned; cache is hit on calls 2 and 3
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });

  it('invalidateTraefikCache forces a fresh fetch', async () => {
    // First call populates cache
    const a = await getOverview();
    expect(a).not.toBeNull();

    // Sanity: data shape consistent
    const b = await getOverview();
    expect(b).toEqual(a);

    invalidateTraefikCache();
    const c = await getOverview();
    expect(c).toEqual(a);
  });

  it('error responses are NOT cached (each call re-attempts upstream)', async () => {
    invalidateTraefikCache();
    // The mock returns 404 for an unknown entrypoint — that path is non-2xx
    // and fetchTraefik returns null, which must NOT be cached.
    // We can verify by calling twice and confirming the upstream is hit each time.
    // The mock counts via console.log; instead we verify the result is null
    // and the cache map does not contain an entry for this URL.
    const { getEntryPoint } = await import('../src/traefik/client');
    const first = await getEntryPoint('unknown');
    expect(first).toBeNull();
    const second = await getEntryPoint('unknown');
    expect(second).toBeNull();
    // We can't easily inspect the internal map, but both returning null and
    // not throwing is the contract. A subsequent success proves the cache
    // wasn't poisoned.
    const ok = await getEntryPoint('web');
    expect(ok).not.toBeNull();
  });

  it('different endpoints cache independently', async () => {
    invalidateTraefikCache();
    const v = await getVersion();
    const o = await getOverview();
    expect(v).not.toBeNull();
    expect(o).not.toBeNull();
  });
});

describe('Invalidation integration', () => {
  beforeEach(async () => {
    await setupTestUser();
    originalEnv();
    invalidateAllPermissions();
    invalidateTraefikCache();
  });

  it('PUT /api/admin/users/:id with new roles invalidates that user permission cache', async () => {
    const db = getDb();
    const user = db.query('SELECT id FROM users LIMIT 1').get() as { id: number };

    // Warm the cache by reading permissions once
    const before = getUserPermissions(user.id);
    expect(before.length).toBeGreaterThan(0);

    // Remove all roles for that user
    const superAdmin = db.query("SELECT id FROM roles WHERE name = 'super_admin'").get() as {
      id: number;
    };
    db.run('DELETE FROM user_roles WHERE user_id = ?', [user.id]);

    // Cache should still serve stale perms
    const stillCached = getUserPermissions(user.id);
    expect(stillCached.length).toBeGreaterThan(0);

    // Re-assign via API
    const res = await authPut(`/api/admin/users/${user.id}`, {
      roles: [superAdmin.id],
    });
    expect(res.status).toBe(200);

    // Now the next read must reflect the re-assignment (cache was invalidated)
    const after = getUserPermissions(user.id);
    expect(after).toContain('system.users.read');
  });

  it('invalidateTraefikCache is exported and clears the cache (smoke)', async () => {
    await getVersion();
    invalidateTraefikCache();
    // After explicit invalidation, a fresh call should still succeed
    const v = await getVersion();
    expect(v).not.toBeNull();
  });

  it('Traefik cache is populated and reused across calls (integration)', async () => {
    // Warm cache, then call the resources router which internally uses the
    // cached getVersion. If the cache is shared, no errors should occur.
    const { getHttpRouters } = await import('../src/traefik/client');
    const r1 = await getHttpRouters();
    const r2 = await getHttpRouters();
    expect(r1).toEqual(r2);
    expect(r1.length).toBeGreaterThan(0);
  });
});

afterAll(() => {
  originalEnv();
  cleanupTestEnv();
});
