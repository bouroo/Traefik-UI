import { describe, it, expect, afterAll } from 'bun:test';

// Import helpers to start mock Traefik and set env vars
import { cleanupTestEnv } from './client-helpers';

// Now import the client (it reads config.traefik.apiUrl which points to mock)
import {
  getHttpRouters,
  getHttpRouter,
  getHttpServices,
  getHttpService,
  getHttpMiddlewares,
  getHttpMiddleware,
  getTcpRouters,
  getTcpServices,
  getTcpMiddlewares,
  getUdpRouters,
  getUdpServices,
  getEntryPoints,
  getEntryPoint,
  getOverview,
  getVersion,
  getRawData,
  checkTraefikConnection,
} from '../src/traefik/client';

// ---- Suite: HTTP Routers ----

describe('HTTP Routers', () => {
  it('getHttpRouters() returns routers', async () => {
    const routers = await getHttpRouters();
    expect(routers.length).toBeGreaterThanOrEqual(2);
    expect(routers[0]).toMatchObject({
      name: expect.any(String),
      provider: expect.any(String),
      status: expect.any(String),
    });
    // Check required fields exist on first router
    const first = routers[0];
    expect(first.name).toBeDefined();
    expect(first.provider).toBeDefined();
    expect(first.status).toBeDefined();
    expect(first.rule).toBeDefined();
    expect(first.service).toBeDefined();
    expect(first.entryPoints).toBeDefined();
  });

  it('getHttpRouter(name) returns single router', async () => {
    const router = await getHttpRouter('dashboard@internal');
    expect(router).not.toBeNull();
    expect(router!.name).toBe('dashboard@internal');
  });

  it('getHttpRouter(name) returns null for unknown', async () => {
    const router = await getHttpRouter('non-existent@file');
    expect(router).toBeNull();
  });
});

// ---- Suite: HTTP Services ----

describe('HTTP Services', () => {
  it('getHttpServices() returns services', async () => {
    const services = await getHttpServices();
    expect(services.length).toBeGreaterThanOrEqual(2);
    const first = services.find((s) => s.type === 'loadbalancer');
    expect(first).toBeDefined();
    expect(first!.loadBalancer).toBeDefined();
    expect(first!.loadBalancer!.servers).toBeDefined();
    expect(first!.loadBalancer!.servers!.length).toBeGreaterThan(0);
  });

  it('getHttpService(name) returns single service', async () => {
    const service = await getHttpService('my-app-service@file');
    expect(service).not.toBeNull();
    expect(service!.name).toBe('my-app-service@file');
    expect(service!.loadBalancer).toBeDefined();
  });
});

// ---- Suite: HTTP Middlewares ----

describe('HTTP Middlewares', () => {
  it('getHttpMiddlewares() returns middlewares', async () => {
    const middlewares = await getHttpMiddlewares();
    expect(middlewares.length).toBeGreaterThanOrEqual(2);
    const types = middlewares.map((m) => m.type);
    expect(types).toContain('basicauth');
    expect(types).toContain('ratelimit');
  });

  it('getHttpMiddleware(name) returns single middleware', async () => {
    const middleware = await getHttpMiddleware('auth-basic@file');
    expect(middleware).not.toBeNull();
    expect(middleware!.name).toBe('auth-basic@file');
    expect(middleware!.type).toBe('headers'); // mock returns headers for all single middleware lookups
  });
});

// ---- Suite: TCP Objects ----

describe('TCP Objects', () => {
  it('getTcpRouters() returns routers', async () => {
    const routers = await getTcpRouters();
    expect(routers.length).toBeGreaterThanOrEqual(1);
    expect(routers[0].name).toBe('ssh@file');
  });

  it('getTcpServices() returns services', async () => {
    const services = await getTcpServices();
    expect(services.length).toBeGreaterThanOrEqual(1);
    const names = services.map((s) => s.name);
    expect(names).toContain('ssh-service@file');
  });

  it('getTcpMiddlewares() returns middlewares', async () => {
    const middlewares = await getTcpMiddlewares();
    const names = middlewares.map((m) => m.name);
    expect(names).toContain('ip-allowlist@file');
  });
});

// ---- Suite: UDP Objects ----

describe('UDP Objects', () => {
  it('getUdpRouters() returns routers', async () => {
    const routers = await getUdpRouters();
    expect(Array.isArray(routers)).toBe(true);
  });

  it('getUdpServices() returns services', async () => {
    const services = await getUdpServices();
    expect(services.length).toBeGreaterThanOrEqual(1);
    const names = services.map((s) => s.name);
    expect(names).toContain('dns@file');
  });
});

// ---- Suite: Other Endpoints ----

describe('Other Endpoints', () => {
  it('getEntryPoints() returns entrypoints', async () => {
    const entrypoints = await getEntryPoints();
    expect(entrypoints.length).toBe(3);
    const names = entrypoints.map((ep) => ep.name);
    expect(names).toContain('web');
    expect(names).toContain('websecure');
    expect(names).toContain('traefik');
  });

  it('getEntryPoint(name) returns specific', async () => {
    const entrypoint = await getEntryPoint('web');
    expect(entrypoint).not.toBeNull();
    expect(entrypoint!.name).toBe('web');
    expect(entrypoint!.address).toBeDefined();
  });

  it('getOverview() returns overview', async () => {
    const overview = await getOverview();
    expect(overview).not.toBeNull();
    expect(overview!.http).toBeDefined();
    expect(overview!.tcp).toBeDefined();
    expect(overview!.udp).toBeDefined();
    expect(overview!.features).toBeDefined();
    expect(overview!.providers).toBeDefined();
    expect(Array.isArray(overview!.providers)).toBe(true);
  });

  it('getVersion() returns version', async () => {
    const version = await getVersion();
    expect(version).not.toBeNull();
    expect(version!.version).toBe('3.2.0');
    expect(version!.codename).toBe('camembert');
  });

  it('getRawData() returns raw data', async () => {
    const rawData = await getRawData();
    expect(rawData).not.toBeNull();
    expect(rawData!.routers).toBeDefined();
    expect(rawData!.services).toBeDefined();
    expect(rawData!.middlewares).toBeDefined();
  });

  it('checkTraefikConnection() returns true', async () => {
    const connected = await checkTraefikConnection();
    expect(connected).toBe(true);
  });
});

// ---- Suite: Error Handling ----

describe('Error Handling', () => {
  it('Handles non-existent endpoint gracefully', async () => {
    const router = await getHttpRouter('non-existent@file');
    expect(router).toBeNull();
  });
});

// ---- Lifecycle ----

afterAll(() => {
  cleanupTestEnv();
});
