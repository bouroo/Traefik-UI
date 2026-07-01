import { describe, it, expect, beforeAll, afterAll } from 'bun:test';

// Set env BEFORE importing source modules so config reads the values at access time.
import './env';

const ORIGINAL_TRAEFIK_API_URL = process.env.TRAEFIK_API_URL;
const ORIGINAL_REQUEST_TIMEOUT_MS = process.env.TRAEFIK_REQUEST_TIMEOUT_MS;

process.env.TRAEFIK_REQUEST_TIMEOUT_MS = '200';

import { fetchTraefik, getHttpRouters, getHttpRouter } from '../src/traefik/client';

let server: ReturnType<typeof Bun.serve>;
let port: number;

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    async fetch(req) {
      const url = new URL(req.url);
      const path = url.pathname;

      if (path === '/api/slow') {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return new Response(JSON.stringify({ ok: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (path === '/api/http/routers') {
        return new Response(
          JSON.stringify([
            {
              name: 'dashboard@internal',
              provider: 'internal',
              status: 'enabled',
              rule: 'Host(`traefik.example.com`)',
              service: 'api@internal',
              entryPoints: ['traefik'],
            },
          ]),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (path === '/api/http/routers/fast%40internal') {
        return new Response(
          JSON.stringify({
            name: 'fast@internal',
            provider: 'internal',
            status: 'enabled',
            rule: 'Host(`fast.example.com`)',
            service: 'api@internal',
            entryPoints: ['traefik'],
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
    },
  });

  port = server.port;
  process.env.TRAEFIK_API_URL = `http://127.0.0.1:${port}`;
});

afterAll(() => {
  server?.stop();
  // Restore env so we don't poison other test files sharing this process.
  if (ORIGINAL_TRAEFIK_API_URL === undefined) delete process.env.TRAEFIK_API_URL;
  else process.env.TRAEFIK_API_URL = ORIGINAL_TRAEFIK_API_URL;
  if (ORIGINAL_REQUEST_TIMEOUT_MS === undefined) delete process.env.TRAEFIK_REQUEST_TIMEOUT_MS;
  else process.env.TRAEFIK_REQUEST_TIMEOUT_MS = ORIGINAL_REQUEST_TIMEOUT_MS;
});

describe('fetchTraefik timeout', () => {
  it('returns null promptly when the upstream request exceeds the timeout', async () => {
    const start = Date.now();
    const result = await fetchTraefik('/slow');
    const elapsed = Date.now() - start;
    expect(result).toBeNull();
    expect(elapsed).toBeLessThan(1000);
  });

  it('continues to serve fast requests after a previous timeout', async () => {
    process.env.TRAEFIK_API_URL = `http://127.0.0.1:${port}`;

    const routers = await getHttpRouters();
    expect(routers).toHaveLength(1);
    expect(routers[0].name).toBe('dashboard@internal');

    const router = await getHttpRouter('fast@internal');
    expect(router).not.toBeNull();
    expect(router!.name).toBe('fast@internal');
  });
});
