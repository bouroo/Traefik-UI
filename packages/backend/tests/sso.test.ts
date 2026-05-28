import { describe, it, expect, beforeEach, afterAll } from 'bun:test';
import {
  app,
  setupTestUser,
  getTestToken,
  createRequest,
  authRequest,
  cleanupTestEnv,
  getDb,
} from './helpers';
import { encryptSecret } from '../src/lib/crypto';

describe('GET /api/auth/sso/providers', () => {
  beforeEach(async () => {
    await setupTestUser();
    const db = getDb();
    db.run('DELETE FROM identity_providers');
  });

  it('returns empty array when no IdPs', async () => {
    const req = createRequest('/api/auth/sso/providers');
    const res = await app.request(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it('returns enabled IdPs', async () => {
    const db = getDb();
    db.run(
      'INSERT INTO identity_providers (name, provider_type, enabled, config_json) VALUES (?, ?, ?, ?)',
      ['test-idp', 'oidc', 1, JSON.stringify({ issuerUrl: 'https://example.com', clientId: 'test', clientSecretEncrypted: '', scopes: ['openid'] })]
    );
    const req = createRequest('/api/auth/sso/providers');
    const res = await app.request(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.length).toBe(1);
    expect(body[0].name).toBe('test-idp');
    expect(body[0].provider_type).toBe('oidc');
    expect(body[0].clientSecretEncrypted).toBeUndefined();
  });
});

describe('SSO Admin API', () => {
  let superAdminToken: string;
  let regularToken: string;

  beforeEach(async () => {
    await setupTestUser();
    superAdminToken = getTestToken();
    const db = getDb();
    db.run('DELETE FROM identity_providers');
  });

  afterAll(() => {
    cleanupTestEnv();
  });

  describe('GET /api/admin/sso-providers', () => {
    it('returns 401 without token', async () => {
      const req = createRequest('/api/admin/sso-providers');
      const res = await app.request(req);
      expect(res.status).toBe(401);
    });

    it('lists IdPs', async () => {
      const db = getDb();
      db.run(
        'INSERT INTO identity_providers (name, provider_type, enabled, config_json) VALUES (?, ?, ?, ?)',
        ['idp1', 'oidc', 1, JSON.stringify({ issuerUrl: 'https://ex.com', clientId: 'c1', clientSecretEncrypted: 'enc', scopes: ['openid'] })]
      );
      const req = authRequest('/api/admin/sso-providers', superAdminToken);
      const res = await app.request(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.length).toBe(1);
      expect(body[0].name).toBe('idp1');
    });
  });

  describe('POST /api/admin/sso-providers', () => {
    it('creates an IdP', async () => {
      const req = authRequest('/api/admin/sso-providers', superAdminToken, {
        method: 'POST',
        body: JSON.stringify({
          name: 'new-idp',
          provider_type: 'oidc',
          config: {
            issuerUrl: 'https://auth.example.com',
            clientId: 'my-client',
            clientSecret: 'my-secret',
            scopes: ['openid', 'profile', 'email'],
          },
        }),
      });
      const res = await app.request(req);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.id).toBeTruthy();
      expect(body.name).toBe('new-idp');

      const db = getDb();
      const saved = db.query('SELECT * FROM identity_providers WHERE id = ?').get(body.id) as {
        config_json: string;
      };
      const config = JSON.parse(saved.config_json);
      expect(config.clientSecretEncrypted).not.toBe('my-secret');
      expect(config.clientSecretEncrypted.length).toBeGreaterThan(0);
    });

    it('returns 400 for non-oidc provider', async () => {
      const req = authRequest('/api/admin/sso-providers', superAdminToken, {
        method: 'POST',
        body: JSON.stringify({
          name: 'bad-idp',
          provider_type: 'saml',
          config: { issuerUrl: 'https://auth.example.com', clientId: 'c', clientSecret: 's' },
        }),
      });
      const res = await app.request(req);
      expect(res.status).toBe(400);
    });

    it('returns 400 for missing config fields', async () => {
      const req = authRequest('/api/admin/sso-providers', superAdminToken, {
        method: 'POST',
        body: JSON.stringify({ name: 'bad-idp', provider_type: 'oidc', config: {} }),
      });
      const res = await app.request(req);
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/admin/sso-providers/:id', () => {
    it('returns IdP without client secret', async () => {
      const db = getDb();
      const secret = await encryptSecret('the-secret');
      db.run(
        'INSERT INTO identity_providers (name, provider_type, enabled, config_json) VALUES (?, ?, ?, ?)',
        ['test-idp', 'oidc', 1, JSON.stringify({ issuerUrl: 'https://auth.example.com', clientId: 'my-client', clientSecretEncrypted: secret, scopes: ['openid'] })]
      );
      const row = db.query('SELECT id FROM identity_providers WHERE name = ?').get('test-idp') as { id: number };
      const req = authRequest(`/api/admin/sso-providers/${row.id}`, superAdminToken);
      const res = await app.request(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.config.clientSecret).toBeUndefined();
      expect(body.config.clientSecretEncrypted).toBeUndefined();
    });

    it('returns 404 for non-existent IdP', async () => {
      const req = authRequest('/api/admin/sso-providers/9999', superAdminToken);
      const res = await app.request(req);
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/admin/sso-providers/:id', () => {
    it('updates name', async () => {
      const db = getDb();
      db.run(
        'INSERT INTO identity_providers (name, provider_type, enabled, config_json) VALUES (?, ?, ?, ?)',
        ['original', 'oidc', 1, JSON.stringify({ issuerUrl: 'https://ex.com', clientId: 'c', clientSecretEncrypted: 'enc', scopes: ['openid'] })]
      );
      const row = db.query('SELECT id FROM identity_providers WHERE name = ?').get('original') as { id: number };
      const req = authRequest(`/api/admin/sso-providers/${row.id}`, superAdminToken, {
        method: 'PUT',
        body: JSON.stringify({ name: 'updated' }),
      });
      const res = await app.request(req);
      expect(res.status).toBe(200);
      const updated = db.query('SELECT name FROM identity_providers WHERE id = ?').get(row.id) as { name: string };
      expect(updated.name).toBe('updated');
    });

    it('re-encrypts client secret when provided', async () => {
      const db = getDb();
      const oldSecret = await encryptSecret('old-secret');
      db.run(
        'INSERT INTO identity_providers (name, provider_type, enabled, config_json) VALUES (?, ?, ?, ?)',
        ['test', 'oidc', 1, JSON.stringify({ issuerUrl: 'https://ex.com', clientId: 'c', clientSecretEncrypted: oldSecret, scopes: ['openid'] })]
      );
      const row = db.query('SELECT id FROM identity_providers WHERE name = ?').get('test') as { id: number };
      const req = authRequest(`/api/admin/sso-providers/${row.id}`, superAdminToken, {
        method: 'PUT',
        body: JSON.stringify({ config: { clientSecret: 'new-secret' } }),
      });
      const res = await app.request(req);
      expect(res.status).toBe(200);
      const saved = db.query('SELECT config_json FROM identity_providers WHERE id = ?').get(row.id) as { config_json: string };
      const config = JSON.parse(saved.config_json);
      expect(config.clientSecretEncrypted).not.toBe(oldSecret);
    });
  });

  describe('DELETE /api/admin/sso-providers/:id', () => {
    it('deletes IdP', async () => {
      const db = getDb();
      db.run(
        'INSERT INTO identity_providers (name, provider_type, enabled, config_json) VALUES (?, ?, ?, ?)',
        ['to-delete', 'oidc', 1, JSON.stringify({ issuerUrl: 'https://ex.com', clientId: 'c', clientSecretEncrypted: 'enc', scopes: ['openid'] })]
      );
      const row = db.query('SELECT id FROM identity_providers WHERE name = ?').get('to-delete') as { id: number };
      const req = authRequest(`/api/admin/sso-providers/${row.id}`, superAdminToken, { method: 'DELETE' });
      const res = await app.request(req);
      expect(res.status).toBe(200);
      const deleted = db.query('SELECT id FROM identity_providers WHERE id = ?').get(row.id);
      expect(deleted).toBeNull();
    });
  });
});

describe('GET /api/auth/sso/:id/initiate', () => {
  beforeEach(async () => {
    await setupTestUser();
    const db = getDb();
    db.run('DELETE FROM identity_providers');
  });

  it('returns 404 for non-existent IdP', async () => {
    const req = createRequest('/api/auth/sso/999/initiate');
    const res = await app.request(req);
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid IdP id', async () => {
    const req = createRequest('/api/auth/sso/not-a-number/initiate');
    const res = await app.request(req);
    expect(res.status).toBe(400);
  });

  it('returns 502 when issuer discovery fails', async () => {
    const db = getDb();
    const secret = await encryptSecret('test-secret');
    db.run(
      'INSERT INTO identity_providers (name, provider_type, enabled, config_json) VALUES (?, ?, ?, ?)',
      ['bad-idp', 'oidc', 1, JSON.stringify({ issuerUrl: 'https://127.0.0.1:99999/invalid', clientId: 'c', clientSecretEncrypted: secret, scopes: ['openid'] })]
    );
    const row = db.query('SELECT id FROM identity_providers WHERE name = ?').get('bad-idp') as { id: number };
    const req = createRequest(`/api/auth/sso/${row.id}/initiate`);
    const res = await app.request(req);
    expect(res.status).toBe(502);
  });
});

describe('GET /api/auth/sso/callback', () => {
  beforeEach(async () => {
    await setupTestUser();
    const db = getDb();
    db.run('DELETE FROM identity_providers');
  });

  it('returns 500 when cookies are missing', async () => {
    const req = createRequest('/api/auth/sso/callback?state=test&code=test-code');
    const res = await app.request(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('SSO authentication failed');
  });

  it('returns 400 for error param', async () => {
    const req = createRequest('/api/auth/sso/callback?error=access_denied');
    const res = await app.request(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('SSO authentication failed');
  });
});