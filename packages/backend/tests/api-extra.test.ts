import { describe, it, expect, beforeEach, afterAll } from 'bun:test';
import {
  app,
  setupTestUser,
  getTestToken,
  authRequest,
  cleanupTestEnv,
  createRequest,
} from './helpers';

async function authGet(path: string) {
  return app.request(authRequest(path, getTestToken()));
}

describe('Middlewares API', () => {
  beforeEach(setupTestUser);

  it('GET /api/middlewares — returns all middlewares', async () => {
    const response = await authGet('/api/middlewares');
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('http');
    expect(body).toHaveProperty('tcp');
    expect(Array.isArray(body.http)).toBe(true);
    expect(Array.isArray(body.tcp)).toBe(true);
    expect(body.http.length).toBe(2);
  });

  it('GET /api/middlewares/http — returns HTTP middlewares', async () => {
    const response = await authGet('/api/middlewares/http');
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(2);
    expect(body[0].type).toBe('basicauth');
  });

  it('GET /api/middlewares/http/:name — returns single middleware', async () => {
    const response = await authGet('/api/middlewares/http/auth-basic@file');
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.type).toBe('headers'); // mock returns headers for all single middleware lookups
  });

  it('GET /api/middlewares/tcp — returns TCP middlewares', async () => {
    const response = await authGet('/api/middlewares/tcp');
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    const names = body.map((m: any) => m.name);
    expect(names).toContain('ip-allowlist@file');
  });

  it('GET /api/middlewares/tcp/:name — returns single TCP middleware', async () => {
    const response = await authGet('/api/middlewares/tcp/ip-allowlist@file');
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.name).toBe('ip-allowlist@file');
  });

  it('GET /api/middlewares — returns 401 without auth', async () => {
    const response = await app.request(createRequest('/api/middlewares'));
    expect(response.status).toBe(401);
  });
});

describe('EntryPoints API', () => {
  beforeEach(setupTestUser);

  it('GET /api/entrypoints — returns entrypoints', async () => {
    const response = await authGet('/api/entrypoints');
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.entrypoints)).toBe(true);
    expect(body.entrypoints.length).toBe(3);
    const names = body.entrypoints.map((e: any) => e.name);
    expect(names).toContain('web');
    expect(names).toContain('websecure');
    expect(names).toContain('traefik');
  });

  it('GET /api/entrypoints/:name — returns single entrypoint', async () => {
    const response = await authGet('/api/entrypoints/web');
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.entrypoint.name).toBe('web');
    expect(body.entrypoint).toHaveProperty('address');
  });

  it('GET /api/entrypoints/:name — returns 404 for unknown', async () => {
    const response = await authGet('/api/entrypoints/unknown');
    expect(response.status).toBe(404);
  });

  it('GET /api/entrypoints — returns 401 without auth', async () => {
    const response = await app.request(createRequest('/api/entrypoints'));
    expect(response.status).toBe(401);
  });
});

describe('TLS API', () => {
  beforeEach(setupTestUser);

  it('GET /api/tls/certificates — returns empty when no acme.json', async () => {
    const response = await authGet('/api/tls/certificates');
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.certificates).toEqual([]);
  });

  it('GET /api/tls/options — returns empty options', async () => {
    const response = await authGet('/api/tls/options');
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.options).toEqual([]);
  });
});

describe('Logs API', () => {
  beforeEach(setupTestUser);

  it('GET /api/logs/access — returns 404 when no access log configured', async () => {
    const response = await authGet('/api/logs/access');
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.lines).toEqual([]);
    expect(body.message).toBeDefined();
  });

  it('GET /api/logs/error — returns not implemented message', async () => {
    const response = await authGet('/api/logs/error');
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.message).toBeDefined();
  });
});

describe('System API', () => {
  beforeEach(setupTestUser);

  it('GET /api/system/stats — returns system stats', async () => {
    const response = await authGet('/api/system/stats');
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('cpu');
    expect(body.cpu).toHaveProperty('usagePercent');
    expect(body.cpu).toHaveProperty('cores');
    expect(body).toHaveProperty('memory');
    expect(body.memory).toHaveProperty('usedMB');
    expect(body.memory).toHaveProperty('totalMB');
    expect(body.memory).toHaveProperty('usedPercent');
    expect(body).toHaveProperty('uptime');
    expect(body).toHaveProperty('platform');
    expect(body).toHaveProperty('arch');
    expect(body).toHaveProperty('bunVersion');
  });

  it('GET /api/system/config — returns non-sensitive config', async () => {
    const response = await authGet('/api/system/config');
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('traefikApiUrl');
    expect(body).toHaveProperty('corsOrigin');
    expect(body).toHaveProperty('logLevel');
    expect(body).not.toHaveProperty('jwtSecret');
  });

  it('GET /api/system/health — returns health (no auth needed)', async () => {
    const response = await app.request(createRequest('/api/system/health'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
  });
});

describe('Health Check', () => {
  it('GET /api/health — returns ok (no auth)', async () => {
    const response = await app.request(createRequest('/api/health'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body).toHaveProperty('timestamp');
  });
});

afterAll(cleanupTestEnv);
