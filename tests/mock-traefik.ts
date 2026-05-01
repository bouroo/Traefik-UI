// Mock Traefik API server for integration tests
// Returns fixture data matching Traefik's API response format

let server: ReturnType<typeof Bun.serve> | null = null;
let port: number = 0;

export function getMockTraefikUrl(): string {
  return `http://127.0.0.1:${port}`;
}

export function startMockTraefik(): void {
  server = Bun.serve({
    port: 0, // random available port
    hostname: '127.0.0.1',
    fetch(req) {
      const url = new URL(req.url);
      const path = url.pathname;

      // Helper: create JSON response
      const json = (data: any, status = 200) =>
        new Response(JSON.stringify(data), {
          status,
          headers: { 'Content-Type': 'application/json' },
        });

      // ---- Version ----
      if (path === '/api/version') {
        return json({
          version: '3.2.0',
          codename: 'camembert',
          startDate: '2026-05-01T00:00:00Z',
          uptime: '1h30m',
        });
      }

      // ---- Overview ----
      if (path === '/api/overview') {
        return json({
          http: {
            file: { routers: 2, services: 2, middlewares: 1 },
            docker: { routers: 1, services: 1, middlewares: 0 },
          },
          tcp: {
            file: { routers: 1, services: 1, middlewares: 0 },
          },
          udp: {
            file: { routers: 0, services: 0 },
          },
          features: { tracing: 'false', metrics: 'false', accessLog: true },
          providers: ['file', 'docker'],
        });
      }

      // ---- Raw Data ----
      if (path === '/api/rawdata') {
        return json({
          routers: {},
          services: {},
          middlewares: {},
        });
      }

      // ---- EntryPoints ----
      if (path === '/api/entrypoints') {
        return json([
          { name: 'web', address: ':80' },
          { name: 'websecure', address: ':443', http: { tls: {} } },
          { name: 'traefik', address: ':8080' },
        ]);
      }

      // Match specific entrypoint
      const epMatch = path.match(/^\/api\/entrypoints\/(.+)$/);
      if (epMatch) {
        const name = decodeURIComponent(epMatch[1]);
        if (name === 'unknown') {
          return json({ error: 'Entrypoint not found' }, 404);
        }
        return json({ name, address: `:8080` });
      }

      // ---- HTTP Routers ----
      if (path === '/api/http/routers') {
        return json([
          {
            name: 'dashboard@internal',
            provider: 'internal',
            status: 'enabled',
            rule: 'Host(`traefik.example.com`)',
            service: 'api@internal',
            entryPoints: ['traefik'],
            using: ['web'],
          },
          {
            name: 'my-app@file',
            provider: 'file',
            status: 'enabled',
            rule: 'Host(`app.example.com`)',
            service: 'my-app-service@file',
            entryPoints: ['web'],
            middlewares: ['auth-basic@file'],
          },
        ]);
      }

      const httpRouterMatch = path.match(/^\/api\/http\/routers\/(.+)$/);
      if (httpRouterMatch) {
        const name = decodeURIComponent(httpRouterMatch[1]);
        if (name === 'non-existent@file') {
          return json({ error: 'Not found' }, 404);
        }
        return json({
          name,
          provider: 'file',
          status: 'enabled',
          rule: 'Host(`example.com`)',
          service: 'my-service@file',
          entryPoints: ['web'],
        });
      }

      // ---- HTTP Services ----
      if (path === '/api/http/services') {
        return json([
          {
            name: 'api@internal',
            provider: 'internal',
            status: 'enabled',
            type: 'internal',
          },
          {
            name: 'my-app-service@file',
            provider: 'file',
            status: 'enabled',
            type: 'loadbalancer',
            loadBalancer: {
              servers: [{ url: 'http://localhost:3001' }],
              passHostHeader: true,
            },
            serverStatus: { 'http://localhost:3001': 'UP' },
          },
        ]);
      }

      const httpServiceMatch = path.match(/^\/api\/http\/services\/(.+)$/);
      if (httpServiceMatch) {
        return json({
          name: decodeURIComponent(httpServiceMatch[1]),
          provider: 'file',
          status: 'enabled',
          type: 'loadbalancer',
          loadBalancer: { servers: [{ url: 'http://localhost:3001' }] },
        });
      }

      // ---- HTTP Middlewares ----
      if (path === '/api/http/middlewares') {
        return json([
          {
            name: 'auth-basic@file',
            provider: 'file',
            status: 'enabled',
            type: 'basicauth',
            basicAuth: { users: ['test:$apr1$hash'] },
          },
          {
            name: 'rate-limit@file',
            provider: 'file',
            status: 'enabled',
            type: 'ratelimit',
            rateLimit: { average: 100, burst: 50 },
          },
        ]);
      }

      const httpMiddlewareMatch = path.match(/^\/api\/http\/middlewares\/(.+)$/);
      if (httpMiddlewareMatch) {
        return json({
          name: decodeURIComponent(httpMiddlewareMatch[1]),
          provider: 'file',
          status: 'enabled',
          type: 'headers',
        });
      }

      // ---- TCP Routers ----
      if (path === '/api/tcp/routers') {
        return json([
          {
            name: 'ssh@file',
            provider: 'file',
            status: 'enabled',
            rule: 'HostSNI(`*`)',
            service: 'ssh-service@file',
            entryPoints: ['ssh'],
          },
        ]);
      }

      // ---- TCP Services ----
      if (path === '/api/tcp/services') {
        return json([
          {
            name: 'ssh-service@file',
            provider: 'file',
            status: 'enabled',
            loadBalancer: { servers: [{ url: 'localhost:22' }] },
          },
        ]);
      }

      // ---- TCP Middlewares ----
      if (path === '/api/tcp/middlewares') {
        return json([
          {
            name: 'ip-allowlist@file',
            provider: 'file',
            status: 'enabled',
            type: 'ipallowlist',
          },
        ]);
      }

      const tcpMiddlewareMatch = path.match(/^\/api\/tcp\/middlewares\/(.+)$/);
      if (tcpMiddlewareMatch) {
        const name = decodeURIComponent(tcpMiddlewareMatch[1]);
        return json({
          name,
          provider: 'file',
          status: 'enabled',
          type: 'ipallowlist',
        });
      }

      // ---- UDP Routers ----
      if (path === '/api/udp/routers') {
        return json([]);
      }

      // ---- UDP Services ----
      if (path === '/api/udp/services') {
        return json([
          {
            name: 'dns@file',
            provider: 'file',
            status: 'enabled',
            loadBalancer: { servers: [{ url: '8.8.8.8:53' }] },
          },
        ]);
      }

      // ---- 404 fallback ----
      return json({ error: `Mock Traefik: no handler for ${path}` }, 404);
    },
  });

  port = server.port;
  console.log(`[Test] Mock Traefik running on http://127.0.0.1:${port}`);
}

export function stopMockTraefik(): void {
  if (server) {
    server.stop();
    server = null;
  }
}
