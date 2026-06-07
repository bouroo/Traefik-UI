import { describe, it, expect, beforeEach, afterAll } from 'bun:test';
import { app, setupTestUser, getTestToken, authRequest, cleanupTestEnv, getDb } from './helpers';

async function authGet(path: string) {
  return app.request(authRequest(path, getTestToken()));
}

async function authPost(path: string, body: unknown) {
  return app.request(
    authRequest(path, getTestToken(), {
      method: 'POST',
      body: JSON.stringify(body),
    })
  );
}

async function authPut(path: string, body: unknown) {
  return app.request(
    authRequest(path, getTestToken(), {
      method: 'PUT',
      body: JSON.stringify(body),
    })
  );
}

async function authDelete(path: string) {
  return app.request(authRequest(path, getTestToken(), { method: 'DELETE' }));
}

describe('Admin Users API', () => {
  beforeEach(async () => {
    await setupTestUser();
  });

  it('GET /api/admin/users — lists all users with roles', async () => {
    const res = await authGet('/api/admin/users');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(body[0]).toHaveProperty('id');
    expect(body[0]).toHaveProperty('username');
    expect(body[0]).toHaveProperty('roles');
    expect(Array.isArray(body[0].roles)).toBe(true);
  });

  it('GET /api/admin/users/:id — returns single user with roles', async () => {
    const db = getDb();
    const user = db.query('SELECT id FROM users LIMIT 1').get() as { id: number };
    const res = await authGet(`/api/admin/users/${user.id}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(user.id);
    expect(body).toHaveProperty('roles');
  });

  it('GET /api/admin/users/:id — returns 404 for unknown user', async () => {
    const res = await authGet('/api/admin/users/99999');
    expect(res.status).toBe(404);
  });

  it('PUT /api/admin/users/:id — updates user roles', async () => {
    const db = getDb();
    const user = db.query('SELECT id FROM users LIMIT 1').get() as { id: number };
    const role = db.query('SELECT id FROM roles WHERE name = ?').get('viewer') as
      | { id: number }
      | undefined;
    if (!role) {
      db.run("INSERT INTO roles (name, description) VALUES ('viewer', 'Read-only')");
    }
    const viewerRole = db.query("SELECT id FROM roles WHERE name = 'viewer'").get() as {
      id: number;
    };

    const res = await authPut(`/api/admin/users/${user.id}`, {
      roles: [viewerRole.id],
    });
    expect(res.status).toBe(200);

    const auditLog = db
      .query(
        'SELECT * FROM audit_logs WHERE action = ? AND resource = ? ORDER BY created_at DESC LIMIT 1'
      )
      .get('user.update', 'user') as { action: string; resource: string } | undefined;
    expect(auditLog).toBeDefined();
    expect(auditLog?.action).toBe('user.update');
  });

  it('DELETE /api/admin/users/:id — prevents deleting last local admin', async () => {
    const db = getDb();
    const admin = db
      .query("SELECT id FROM users WHERE source = 'local' AND is_admin = 1 LIMIT 1")
      .get() as { id: number };

    const res = await authDelete(`/api/admin/users/${admin.id}`);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('last local admin');
  });
});

describe('Admin Groups API', () => {
  beforeEach(async () => {
    await setupTestUser();
  });

  it('GET /api/admin/groups — lists groups with member count', async () => {
    const res = await authGet('/api/admin/groups');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    if (body.length > 0) {
      expect(body[0]).toHaveProperty('member_count');
    }
  });

  it('POST /api/admin/groups — creates a group', async () => {
    const res = await authPost('/api/admin/groups', {
      name: 'Test Group',
      source: 'local',
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(body.name).toBe('Test Group');
  });

  it('POST /api/admin/groups — creates group with roles', async () => {
    const db = getDb();
    const role = db.query('SELECT id FROM roles LIMIT 1').get() as { id: number };
    const res = await authPost('/api/admin/groups', {
      name: 'Group With Roles',
      role_ids: [role.id],
    });
    expect(res.status).toBe(201);
  });

  it('GET /api/admin/groups/:id — returns group with users and roles', async () => {
    const db = getDb();
    const group = db
      .query('INSERT INTO groups (name) VALUES (?) RETURNING id')
      .get('Test Group 2') as { id: number };
    const res = await authGet(`/api/admin/groups/${group.id}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(group.id);
    expect(body).toHaveProperty('users');
    expect(body).toHaveProperty('roles');
  });

  it('PUT /api/admin/groups/:id — updates group', async () => {
    const db = getDb();
    const group = db
      .query('INSERT INTO groups (name) VALUES (?) RETURNING id')
      .get('Update Test') as { id: number };
    const res = await authPut(`/api/admin/groups/${group.id}`, {
      name: 'Updated Group Name',
    });
    expect(res.status).toBe(200);
  });

  it('DELETE /api/admin/groups/:id — deletes group', async () => {
    const db = getDb();
    const group = db
      .query('INSERT INTO groups (name) VALUES (?) RETURNING id')
      .get('Delete Test') as { id: number };
    const res = await authDelete(`/api/admin/groups/${group.id}`);
    expect(res.status).toBe(200);
  });
});

describe('Admin Roles API', () => {
  beforeEach(async () => {
    await setupTestUser();
  });

  it('GET /api/admin/roles — lists roles with permissions', async () => {
    const res = await authGet('/api/admin/roles');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(body[0]).toHaveProperty('permission_names');
    expect(Array.isArray(body[0].permission_names)).toBe(true);
  });

  it('GET /api/admin/roles/:id — returns single role with permissions', async () => {
    const db = getDb();
    const role = db.query('SELECT id FROM roles LIMIT 1').get() as { id: number };
    const res = await authGet(`/api/admin/roles/${role.id}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(role.id);
    expect(body).toHaveProperty('permission_names');
  });

  it('POST /api/admin/roles — creates role with permissions', async () => {
    const db = getDb();
    const perm = db.query('SELECT id FROM permissions LIMIT 1').get() as { id: number };
    const res = await authPost('/api/admin/roles', {
      name: 'Custom Role',
      description: 'A custom test role',
      permission_ids: [perm.id],
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(body.name).toBe('Custom Role');
  });

  it('PUT /api/admin/roles/:id — updates role permissions', async () => {
    const db = getDb();
    const perm1 = db.query('SELECT id FROM permissions LIMIT 1').get() as { id: number };
    const perm2 = db.query('SELECT id FROM permissions LIMIT 2').all()[1] as { id: number };

    const role = db
      .query('INSERT INTO roles (name) VALUES (?) RETURNING id')
      .get('Update Role Test') as { id: number };

    const res = await authPut(`/api/admin/roles/${role.id}`, {
      permission_ids: [perm1.id, perm2.id],
    });
    expect(res.status).toBe(200);
  });

  it('DELETE /api/admin/roles — prevents deleting built-in role', async () => {
    const db = getDb();
    const superAdmin = db.query("SELECT id FROM roles WHERE name = 'super_admin'").get() as {
      id: number;
    };

    const res = await authDelete(`/api/admin/roles/${superAdmin.id}`);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Cannot delete built-in role');
  });

  it('DELETE /api/admin/roles/:id — deletes custom role', async () => {
    const db = getDb();
    const role = db
      .query('INSERT INTO roles (name, description) VALUES (?, ?) RETURNING id')
      .get('Deletable Role', 'Will be deleted') as { id: number };
    const res = await authDelete(`/api/admin/roles/${role.id}`);
    expect(res.status).toBe(200);
  });
});

describe('Admin Permissions API', () => {
  beforeEach(async () => {
    await setupTestUser();
  });

  it('GET /api/admin/permissions — lists all permissions', async () => {
    const res = await authGet('/api/admin/permissions');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(body[0]).toHaveProperty('id');
    expect(body[0]).toHaveProperty('name');
  });

  it('GET /api/admin/permissions/:id — returns single permission', async () => {
    const db = getDb();
    const perm = db.query('SELECT id FROM permissions LIMIT 1').get() as { id: number };
    const res = await authGet(`/api/admin/permissions/${perm.id}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(perm.id);
  });

  it('GET /api/admin/permissions/:id — returns 404 for unknown', async () => {
    const res = await authGet('/api/admin/permissions/99999');
    expect(res.status).toBe(404);
  });
});

describe('Audit Log', () => {
  beforeEach(async () => {
    await setupTestUser();
  });

  it('writes audit log entry on user update', async () => {
    const db = getDb();
    const user = db.query('SELECT id FROM users LIMIT 1').get() as { id: number };

    await authPut(`/api/admin/users/${user.id}`, {
      email: 'newemail@test.com',
    });

    const auditLog = db
      .query(
        'SELECT * FROM audit_logs WHERE action = ? AND resource = ? ORDER BY created_at DESC LIMIT 1'
      )
      .get('user.update', 'user') as
      | { action: string; resource: string; resource_id: string }
      | undefined;

    expect(auditLog).toBeDefined();
    expect(auditLog?.resource_id).toBe(String(user.id));
  });
});

afterAll(() => {
  cleanupTestEnv();
});
