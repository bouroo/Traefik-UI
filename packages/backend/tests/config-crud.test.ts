// Set DYNAMIC_CONFIG_PATH and ACCESS_LOG_PATH to temp files BEFORE the app is imported.
// The preload module's top-level code runs before this file's body (ESM import order).
import { writeFileSync, readFileSync } from 'node:fs';
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { YAML } from 'bun';
import { SHARED_DYNAMIC_CONFIG_PATH, patchConfigPaths } from './test-paths-preload';

const tempYaml = SHARED_DYNAMIC_CONFIG_PATH;

let app: typeof import('./helpers').app;
let setupTestUser: typeof import('./helpers').setupTestUser;
let getTestToken: typeof import('./helpers').getTestToken;
let authRequest: typeof import('./helpers').authRequest;
let createRequest: typeof import('./helpers').createRequest;
let cleanupTestEnv: typeof import('./helpers').cleanupTestEnv;

function get(path: string) {
  return app.request(authRequest(path, getTestToken()));
}

function postJson(path: string, body: unknown) {
  return app.request(
    authRequest(path, getTestToken(), {
      method: 'POST',
      body: JSON.stringify(body),
    })
  );
}

function del(path: string) {
  return app.request(
    authRequest(path, getTestToken(), {
      method: 'DELETE',
    })
  );
}

describe('config-crud', () => {
  beforeAll(async () => {
    const helpers = await import('./helpers');
    app = helpers.app;
    setupTestUser = helpers.setupTestUser;
    getTestToken = helpers.getTestToken;
    authRequest = helpers.authRequest;
    createRequest = helpers.createRequest;
    cleanupTestEnv = helpers.cleanupTestEnv;
    await patchConfigPaths();
    await setupTestUser();
  });

  afterAll(() => {
    cleanupTestEnv();
  });

  describe('POST /api/config-crud/:resourceType', () => {
    it('persists the resource to the YAML and returns 200', async () => {
      const res = await postJson('/api/config-crud/routers', {
        protocol: 'http',
        name: 'demo-router',
        data: { rule: 'Host(`demo.localhost`)', service: 'demo-service' },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);

      const yamlText = readFileSync(tempYaml, 'utf-8');
      const parsed = YAML.parse(yamlText) as Record<
        string,
        Record<string, Record<string, unknown>>
      >;
      expect(parsed.http.routers['demo-router']).toBeDefined();
      expect(parsed.http.routers['demo-router'].rule).toBe('Host(`demo.localhost`)');
    });

    it('rejects invalid resourceType with 400', async () => {
      const res = await postJson('/api/config-crud/widgets', {
        protocol: 'http',
        name: 'foo',
        data: { x: 1 },
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Invalid resource type');
    });

    it('rejects invalid protocol with 400', async () => {
      const res = await postJson('/api/config-crud/routers', {
        protocol: 'smtp',
        name: 'foo',
        data: { x: 1 },
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Invalid protocol');
    });

    it('rejects udp+middlewares with 400', async () => {
      const res = await postJson('/api/config-crud/middlewares', {
        protocol: 'udp',
        name: 'mw-udp',
        data: { x: 1 },
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('UDP does not support middlewares');
    });

    it('rejects missing required fields with 400', async () => {
      const r1 = await postJson('/api/config-crud/routers', { protocol: 'http' });
      expect(r1.status).toBe(400);
      const r2 = await postJson('/api/config-crud/routers', { name: 'no-proto' });
      expect(r2.status).toBe(400);
      const r3 = await postJson('/api/config-crud/routers', { protocol: 'http', name: 'no-data' });
      expect(r3.status).toBe(400);
    });

    it('rejects unsafe resource names with 400', async () => {
      for (const badName of ['__proto__', 'constructor', 'a/b', 'has space']) {
        const res = await postJson('/api/config-crud/routers', {
          protocol: 'http',
          name: badName,
          data: { foo: 'bar' },
        });
        expect(res.status).toBe(400);
      }
    });

    it('strips @provider suffix from the resource name', async () => {
      const res = await postJson('/api/config-crud/services', {
        protocol: 'http',
        name: 'demo-service@file',
        data: { loadBalancer: { servers: [{ url: 'http://localhost:8080' }] } },
      });
      expect(res.status).toBe(200);

      const yamlText = readFileSync(tempYaml, 'utf-8');
      const parsed = YAML.parse(yamlText) as Record<
        string,
        Record<string, Record<string, unknown>>
      >;
      expect(parsed.http.services['demo-service']).toBeDefined();
      expect(parsed.http.services['demo-service@file']).toBeUndefined();
    });

    it('requires authentication (401 without token)', async () => {
      const res = await app.request(
        createRequest('/api/config-crud/routers', {
          method: 'POST',
          body: JSON.stringify({ protocol: 'http', name: 'x', data: {} }),
        })
      );
      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/config-crud/:resourceType/:protocol/:name', () => {
    beforeAll(() => {
      writeFileSync(
        tempYaml,
        YAML.stringify(
          {
            http: {
              routers: { 'seed-router': { rule: 'Host(`seed.localhost`)', service: 's' } },
              services: { 'seed-service': { loadBalancer: { servers: [{ url: 'http://x' }] } } },
            },
          },
          null,
          2
        )
      );
    });

    it('removes the entry and returns 200', async () => {
      const res = await del('/api/config-crud/routers/http/seed-router');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);

      const yamlText = readFileSync(tempYaml, 'utf-8');
      const parsed = YAML.parse(yamlText) as Record<
        string,
        Record<string, Record<string, unknown>>
      >;
      expect(parsed.http?.routers?.['seed-router']).toBeUndefined();
    });

    it('returns 404 when the resource does not exist', async () => {
      const res = await del('/api/config-crud/routers/http/nonexistent');
      expect(res.status).toBe(404);
    });

    it('returns 404 when the protocol section is missing', async () => {
      const res = await del('/api/config-crud/routers/tcp/no-such-thing');
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toContain("Protocol 'tcp' not found");
    });

    it('strips @provider suffix when deleting', async () => {
      writeFileSync(
        tempYaml,
        YAML.stringify(
          {
            http: {
              services: {
                'svc-with-provider': { loadBalancer: { servers: [{ url: 'http://x' }] } },
              },
            },
          },
          null,
          2
        )
      );
      const res = await del('/api/config-crud/services/http/svc-with-provider@file');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/config-crud/:resourceType', () => {
    beforeAll(() => {
      writeFileSync(
        tempYaml,
        YAML.stringify(
          {
            http: {
              routers: { 'get-router': { rule: 'Host(`get.localhost`)', service: 's' } },
            },
            tcp: {
              routers: { 'tcp-router': { rule: 'HostSNI(`*`)', service: 's' } },
            },
          },
          null,
          2
        )
      );
    });

    it('returns that protocol section when protocol query is present', async () => {
      const res = await get('/api/config-crud/routers?protocol=http');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('get-router');
    });

    it('returns all protocols when no protocol query is provided', async () => {
      const res = await get('/api/config-crud/routers');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('http');
      expect(body).toHaveProperty('tcp');
    });
  });
});
