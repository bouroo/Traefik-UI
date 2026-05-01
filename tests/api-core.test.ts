import { describe, it, expect, beforeEach, afterAll } from 'bun:test';
import {
  app,
  setupTestUser,
  getTestToken,
  authRequest,
  createRequest,
  cleanupTestEnv,
} from './helpers';

async function authGet(path: string) {
  return app.request(authRequest(path, getTestToken()));
}

describe('Dashboard API', () => {
  beforeEach(async () => {
    await setupTestUser();
  });

  it('GET /api/dashboard — returns dashboard stats', async () => {
    const res = await authGet('/api/dashboard');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('overview');
    expect(body).toHaveProperty('version');
    expect(body).toHaveProperty('entrypoints');
    expect(body).toHaveProperty('connectionStatus');

    expect(body.overview).toHaveProperty('http');
    expect(body.overview.http).toHaveProperty('file');
    expect(body.overview.http).toHaveProperty('docker');

    expect(body.version.version).toBe('3.2.0');

    expect(body.entrypoints).toHaveLength(3);
  });

  it('GET /api/dashboard/health — returns health', async () => {
    const res = await authGet('/api/dashboard/health');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.traefikConnected).toBe(true);
  });

  it('GET /api/dashboard — returns 401 without auth', async () => {
    const res = await app.request(createRequest('/api/dashboard'));
    expect(res.status).toBe(401);
  });
});

describe('Overview API', () => {
  beforeEach(async () => {
    await setupTestUser();
  });

  it('GET /api/overview — returns overview', async () => {
    const res = await authGet('/api/overview');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('http');
    expect(body).toHaveProperty('tcp');
    expect(body).toHaveProperty('udp');
    expect(body).toHaveProperty('features');
    expect(body).toHaveProperty('providers');
  });

  it('GET /api/overview/raw — returns raw data', async () => {
    const res = await authGet('/api/overview/raw');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('routers');
    expect(body).toHaveProperty('services');
    expect(body).toHaveProperty('middlewares');
  });

  it('GET /api/overview/version — returns version', async () => {
    const res = await authGet('/api/overview/version');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('version');
    expect(body).toHaveProperty('codename');
  });
});

describe('Routers API', () => {
  beforeEach(async () => {
    await setupTestUser();
  });

  it('GET /api/routers — returns all routers', async () => {
    const res = await authGet('/api/routers');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('http');
    expect(body).toHaveProperty('tcp');
    expect(body).toHaveProperty('udp');
    expect(Array.isArray(body.http)).toBe(true);
    expect(Array.isArray(body.tcp)).toBe(true);
    expect(Array.isArray(body.udp)).toBe(true);
    expect(body.http.length).toBeGreaterThan(0);
  });

  it('GET /api/routers/http — returns HTTP routers', async () => {
    const res = await authGet('/api/routers/http');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('routers');
    expect(body.routers).toHaveLength(2);
  });

  it('GET /api/routers/http/:name — returns router detail', async () => {
    const res = await authGet('/api/routers/http/dashboard@internal');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('router');
    expect(body).toHaveProperty('service');
    expect(body).toHaveProperty('middlewares');
  });

  it('GET /api/routers/http/:name — returns 404 for unknown', async () => {
    const res = await authGet('/api/routers/http/non-existent@file');
    expect(res.status).toBe(404);
  });

  it('GET /api/routers/tcp — returns TCP routers', async () => {
    const res = await authGet('/api/routers/tcp');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('routers');
    expect(Array.isArray(body.routers)).toBe(true);
  });

  it('GET /api/routers/udp — returns UDP routers', async () => {
    const res = await authGet('/api/routers/udp');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('routers');
    expect(Array.isArray(body.routers)).toBe(true);
  });

  it('GET /api/routers — returns 401 without auth', async () => {
    const res = await app.request(createRequest('/api/routers'));
    expect(res.status).toBe(401);
  });
});

describe('Services API', () => {
  beforeEach(async () => {
    await setupTestUser();
  });

  it('GET /api/services — returns all services', async () => {
    const res = await authGet('/api/services');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('http');
    expect(body).toHaveProperty('tcp');
    expect(body).toHaveProperty('udp');
  });

  it('GET /api/services/http — returns HTTP services', async () => {
    const res = await authGet('/api/services/http');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('services');
    expect(body.services).toHaveLength(2);
  });

  it('GET /api/services/http/:name — returns service detail', async () => {
    const res = await authGet('/api/services/http/my-app-service@file');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('service');
    expect(body.service).toHaveProperty('loadBalancer');
  });

  it('GET /api/services/tcp — returns TCP services', async () => {
    const res = await authGet('/api/services/tcp');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('services');
  });

  it('GET /api/services/udp — returns UDP services', async () => {
    const res = await authGet('/api/services/udp');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('services');
    const dnsService = body.services.find((s: any) => s.name === 'dns@file');
    expect(dnsService).toBeDefined();
  });

  it('GET /api/services — returns 401 without auth', async () => {
    const res = await app.request(createRequest('/api/services'));
    expect(res.status).toBe(401);
  });
});

afterAll(() => {
  cleanupTestEnv();
});
