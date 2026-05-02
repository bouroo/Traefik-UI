import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import {
  startTraefikContainer,
  stopTraefikContainer,
  detectContainerRuntime,
  setupTestUser,
  getTestToken,
  authRequest,
  createRequest,
  getApp,
} from './integration-helpers';

// Check container runtime availability synchronously at module load time
// so describe blocks can react before they are evaluated.
let skipTests = false;
try {
  detectContainerRuntime();
} catch (e: any) {
  console.warn(`[integration] Skipping all tests: ${e.message}`);
  skipTests = true;
}

let containerId = '';
let apiUrl = '';

beforeAll(async () => {
  if (skipTests) return;
  try {
    const result = await startTraefikContainer();
    apiUrl = result.apiUrl;
    containerId = result.containerId;
    process.env.TRAEFIK_API_URL = apiUrl;
    console.log(`[integration] Traefik API ready at ${apiUrl}`);
  } catch (e: any) {
    console.warn(`[integration] Container start failed, skipping tests: ${e.message}`);
    skipTests = true;
  }
}, 120000);

afterAll(() => {
  if (containerId) {
    stopTraefikContainer(containerId);
  }
});

async function authGet(path: string): Promise<Response> {
  if (skipTests) return new Response(null, { status: 204 });
  const app = await getApp();
  return app.request(authRequest(path, getTestToken()));
}

// ---- Traefik Container Health (direct calls, no UI auth) ----

describe('Traefik Container Health', () => {
  it('responds to /api/version', async () => {
    if (skipTests) return;
    const res = await fetch(`${apiUrl}/api/version`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('Version');
    expect(body).toHaveProperty('Codename');
    expect(body).toHaveProperty('startDate');
  });

  it('responds to /api/overview', async () => {
    if (skipTests) return;
    const res = await fetch(`${apiUrl}/api/overview`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('http');
    expect(body).toHaveProperty('tcp');
    expect(body).toHaveProperty('udp');
    expect(body).toHaveProperty('providers');
    expect(body.providers).toContain('File');
  });

  it('responds to /api/rawdata', async () => {
    if (skipTests) return;
    const res = await fetch(`${apiUrl}/api/rawdata`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('routers');
    expect(body).toHaveProperty('services');
    expect(body).toHaveProperty('middlewares');
  });

  it('responds to /api/entrypoints', async () => {
    if (skipTests) return;
    const res = await fetch(`${apiUrl}/api/entrypoints`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    const names = body.map((e: any) => e.name);
    expect(names).toContain('web');
    expect(names).toContain('websecure');
  });
});

// ---- Dashboard API (through UI) ----

describe('Dashboard API', () => {
  beforeEach(async () => {
    if (skipTests) return;
    await setupTestUser();
  });

  it('GET /api/dashboard — returns stats from real Traefik', async () => {
    if (skipTests) return;
    const res = await authGet('/api/dashboard');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('overview');
    expect(body).toHaveProperty('version');
    expect(body).toHaveProperty('entrypoints');
    expect(body).toHaveProperty('connectionStatus');
    expect(body.connectionStatus).toBe('connected');
  });

  it('GET /api/dashboard/health — reports connected', async () => {
    if (skipTests) return;
    const res = await authGet('/api/dashboard/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.traefikConnected).toBe(true);
  });

  it('GET /api/dashboard — returns 401 without auth', async () => {
    if (skipTests) return;
    const app = await getApp();
    const res = await app.request(createRequest('/api/dashboard'));
    expect(res.status).toBe(401);
  });
});

// ---- Overview API ----

describe('Overview API', () => {
  beforeEach(async () => {
    if (skipTests) return;
    await setupTestUser();
  });

  it('GET /api/overview — returns overview from Traefik', async () => {
    if (skipTests) return;
    const res = await authGet('/api/overview');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('http');
    expect(body).toHaveProperty('tcp');
    expect(body).toHaveProperty('udp');
    expect(body).toHaveProperty('features');
    expect(body).toHaveProperty('providers');
    expect(body.providers).toContain('File');
  });

  it('GET /api/overview/raw — returns raw config', async () => {
    if (skipTests) return;
    const res = await authGet('/api/overview/raw');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('routers');
    expect(body).toHaveProperty('services');
    expect(body).toHaveProperty('middlewares');
  });

  it('GET /api/overview/version — returns version info', async () => {
    if (skipTests) return;
    const res = await authGet('/api/overview/version');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('version');
    expect(body).toHaveProperty('codename');
    expect(body).toHaveProperty('startDate');
  });
});

// ---- Routers API ----

describe('Routers API', () => {
  beforeEach(async () => {
    if (skipTests) return;
    await setupTestUser();
  });

  it('GET /api/routers — returns routers from Traefik', async () => {
    if (skipTests) return;
    const res = await authGet('/api/routers');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('http');
    expect(body).toHaveProperty('tcp');
    expect(body).toHaveProperty('udp');
    expect(Array.isArray(body.http)).toBe(true);
    expect(body.http.length).toBeGreaterThan(0);
    const firstRouter = body.http[0];
    expect(firstRouter).toHaveProperty('name');
    expect(firstRouter).toHaveProperty('provider');
  });

  it('GET /api/routers/http — returns HTTP routers with test data', async () => {
    if (skipTests) return;
    const res = await authGet('/api/routers/http');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('routers');
    expect(Array.isArray(body.routers)).toBe(true);
    expect(body.routers.length).toBeGreaterThan(0);
    const testRouter = body.routers.find((r: any) => r.name && r.name.includes('test-app-router'));
    expect(testRouter).toBeDefined();
    if (testRouter) {
      expect(testRouter).toHaveProperty('rule');
      expect(testRouter).toHaveProperty('service');
      expect(testRouter).toHaveProperty('middlewares');
      expect(testRouter).toHaveProperty('status');
    }
  });

  it('GET /api/routers/http/:name — returns router detail', async () => {
    if (skipTests) return;
    const listRes = await authGet('/api/routers/http');
    const listBody = await listRes.json();
    expect(listBody.routers.length).toBeGreaterThan(0);
    const routerName = listBody.routers[0].name;
    const res = await authGet(`/api/routers/http/${encodeURIComponent(routerName)}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('router');
  });

  it('GET /api/routers/http/:name — returns 404 for unknown', async () => {
    if (skipTests) return;
    const res = await authGet('/api/routers/http/non-existent-router-xyz@file');
    expect(res.status).toBe(404);
  });

  it('GET /api/routers/tcp — returns TCP routers', async () => {
    if (skipTests) return;
    const res = await authGet('/api/routers/tcp');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('routers');
    expect(Array.isArray(body.routers)).toBe(true);
    expect(body.routers.length).toBeGreaterThan(0);
  });

  it('GET /api/routers/udp — returns UDP routers', async () => {
    if (skipTests) return;
    const res = await authGet('/api/routers/udp');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('routers');
    expect(Array.isArray(body.routers)).toBe(true);
  });

  it('GET /api/routers — returns 401 without auth', async () => {
    if (skipTests) return;
    const app = await getApp();
    const res = await app.request(createRequest('/api/routers'));
    expect(res.status).toBe(401);
  });
});

// ---- Services API ----

describe('Services API', () => {
  beforeEach(async () => {
    if (skipTests) return;
    await setupTestUser();
  });

  it('GET /api/services — returns services from Traefik', async () => {
    if (skipTests) return;
    const res = await authGet('/api/services');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('http');
    expect(body).toHaveProperty('tcp');
    expect(body).toHaveProperty('udp');
  });

  it('GET /api/services/http — returns HTTP services', async () => {
    if (skipTests) return;
    const res = await authGet('/api/services/http');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('services');
    expect(Array.isArray(body.services)).toBe(true);
    expect(body.services.length).toBeGreaterThan(0);
    const testSvc = body.services.find((s: any) => s.name && s.name.includes('test-app-service'));
    expect(testSvc).toBeDefined();
  });

  it('GET /api/services/http/:name — returns service detail', async () => {
    if (skipTests) return;
    const listRes = await authGet('/api/services/http');
    const listBody = await listRes.json();
    const svcName = listBody.services[0].name;
    const res = await authGet(`/api/services/http/${encodeURIComponent(svcName)}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('service');
  });

  it('GET /api/services/tcp — returns TCP services', async () => {
    if (skipTests) return;
    const res = await authGet('/api/services/tcp');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('services');
    expect(Array.isArray(body.services)).toBe(true);
  });

  it('GET /api/services/udp — returns UDP services', async () => {
    if (skipTests) return;
    const res = await authGet('/api/services/udp');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('services');
    expect(Array.isArray(body.services)).toBe(true);
  });
});

// ---- Middlewares API ----

describe('Middlewares API', () => {
  beforeEach(async () => {
    if (skipTests) return;
    await setupTestUser();
  });

  it('GET /api/middlewares — returns middlewares from Traefik', async () => {
    if (skipTests) return;
    const res = await authGet('/api/middlewares');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('http');
    expect(body).toHaveProperty('tcp');
  });

  it('GET /api/middlewares/http — returns HTTP middlewares', async () => {
    if (skipTests) return;
    const res = await authGet('/api/middlewares/http');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    const middlewareNames = body.map((m: any) => m.name);
    expect(middlewareNames.some((n: string) => n.includes('test-rate-limit'))).toBe(true);
    expect(middlewareNames.some((n: string) => n.includes('test-headers'))).toBe(true);
    expect(middlewareNames.some((n: string) => n.includes('test-compress'))).toBe(true);
  });

  it('GET /api/middlewares/http/:name — returns middleware detail', async () => {
    if (skipTests) return;
    const listRes = await authGet('/api/middlewares/http');
    const listBody = await listRes.json();
    const mwName = listBody[0].name;
    const res = await authGet(`/api/middlewares/http/${encodeURIComponent(mwName)}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe(mwName);
  });

  it('GET /api/middlewares/tcp — returns TCP middlewares', async () => {
    if (skipTests) return;
    const res = await authGet('/api/middlewares/tcp');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });
});

// ---- EntryPoints API ----

describe('EntryPoints API', () => {
  beforeEach(async () => {
    if (skipTests) return;
    await setupTestUser();
  });

  it('GET /api/entrypoints — returns entrypoints', async () => {
    if (skipTests) return;
    const res = await authGet('/api/entrypoints');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('entrypoints');
    expect(Array.isArray(body.entrypoints)).toBe(true);
    expect(body.entrypoints.length).toBeGreaterThan(0);
    const names = body.entrypoints.map((e: any) => e.name);
    expect(names).toContain('web');
  });

  it('GET /api/entrypoints/:name — returns entrypoint detail', async () => {
    if (skipTests) return;
    const res = await authGet('/api/entrypoints/web');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('entrypoint');
    expect(body.entrypoint.name).toBe('web');
    expect(body.entrypoint).toHaveProperty('address');
  });

  it('GET /api/entrypoints — returns 401 without auth', async () => {
    if (skipTests) return;
    const app = await getApp();
    const res = await app.request(createRequest('/api/entrypoints'));
    expect(res.status).toBe(401);
  });
});

// ---- System API ----

describe('System API', () => {
  beforeEach(async () => {
    if (skipTests) return;
    await setupTestUser();
  });

  it('GET /api/system/health — returns health status', async () => {
    if (skipTests) return;
    const res = await authGet('/api/system/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('status');
    expect(body.status).toBe('ok');
  });
});
