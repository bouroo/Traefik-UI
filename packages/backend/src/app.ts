import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serveStatic } from 'hono/bun';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from './config';
import { logError } from './lib/logger';
import { isShuttingDown } from './lib/lifecycle';
import { rateLimit } from './middleware/rate-limit';
import { securityHeaders } from './middleware/security-headers';
import { getDb } from './db';
import { getVersion } from './traefik/client';
import packageJson from '../package.json' with { type: 'json' };

import { auth } from './auth/routes';
import { sso } from './auth/sso-routes';
import { ssoProviders } from './api/admin/sso-providers';
import { users } from './api/admin/users';
import { groups } from './api/admin/groups';
import { roles } from './api/admin/roles';
import { permissions } from './api/admin/permissions';
import { dashboard } from './api/dashboard';
import { overview } from './api/overview';
import { resources } from './api/resources';
import { tls } from './api/tls';
import { logs } from './api/logs';
import { entrypoints } from './api/entrypoints';
import { system } from './api/system';
import { configfile } from './api/configfile';
import { configCrud } from './api/config-crud';

const frontendDir = existsSync(resolve(import.meta.dir, '../../frontend/dist'))
  ? resolve(import.meta.dir, '../../frontend/dist')
  : './public';

const app = new Hono();

app.use(
  '*',
  cors({
    origin: config.cors.origin,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: [
      'Content-Length',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'Retry-After',
    ],
    maxAge: 86400,
  })
);

app.use('*', securityHeaders());

if (config.logLevel !== 'silent') {
  app.use('*', logger());
}

const rateLimitDisabled = Bun.env.RATE_LIMIT_DISABLED === 'true' || Bun.env.NODE_ENV === 'test';

// Strict rate limit on login (10 req/min per IP)
app.use('/api/auth/login', rateLimit({ windowMs: 60_000, max: 10, disabled: rateLimitDisabled }));

// Looser rate limit on other auth routes (20 req/min per IP)
app.use('/api/auth/*', rateLimit({ windowMs: 60_000, max: 20, disabled: rateLimitDisabled }));

// General rate limit for all other API routes (100 req/min per IP)
app.use('/api/*', rateLimit({ windowMs: 60_000, max: 100, disabled: rateLimitDisabled }));

app.route('/api/auth', auth);
app.route('/api/auth/sso', sso);
app.route('/api/admin/sso-providers', ssoProviders);
app.route('/api/admin/users', users);
app.route('/api/admin/groups', groups);
app.route('/api/admin/roles', roles);
app.route('/api/admin/permissions', permissions);
app.route('/api/dashboard', dashboard);
app.route('/api/overview', overview);
app.route('/api/tls', tls);
app.route('/api/logs', logs);
app.route('/api/entrypoints', entrypoints);
app.route('/api/system', system);

async function checkDatabase(): Promise<{
  status: 'ok' | 'error';
  latencyMs: number;
  error?: string;
}> {
  const start = performance.now();
  try {
    const db = getDb();
    const row = db.query('SELECT 1 AS ok').get() as { ok: number } | undefined;
    if (!row || row.ok !== 1) {
      return { status: 'error', latencyMs: Math.round(performance.now() - start) };
    }
    return { status: 'ok', latencyMs: Math.round(performance.now() - start) };
  } catch (err) {
    return {
      status: 'error',
      latencyMs: Math.round(performance.now() - start),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkTraefik(): Promise<{
  status: 'ok' | 'error' | 'unreachable';
  latencyMs: number;
  version?: string;
  error?: string;
}> {
  const start = performance.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    try {
      const version = await Promise.race([
        getVersion(),
        new Promise<null>((_, reject) => {
          controller.signal.addEventListener('abort', () => reject(new Error('timeout')));
        }),
      ]);
      const latencyMs = Math.round(performance.now() - start);
      if (!version) {
        return { status: 'unreachable', latencyMs };
      }
      return { status: 'ok', latencyMs, version: version.version };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (err) {
    return {
      status: 'unreachable',
      latencyMs: Math.round(performance.now() - start),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

const startedAt = Date.now();

app.get('/api/health', async (c) => {
  if (isShuttingDown()) {
    return c.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: Math.round((Date.now() - startedAt) / 1000),
        version: packageJson.version,
        shuttingDown: true,
        checks: {
          database: { status: 'error', latencyMs: 0 },
          traefik: { status: 'unreachable', latencyMs: 0 },
        },
      },
      503
    );
  }

  const [database, traefik] = await Promise.all([checkDatabase(), checkTraefik()]);

  const dbOk = database.status === 'ok';
  const traefikOk = traefik.status === 'ok';
  const traefikReachable = traefik.status !== 'unreachable';

  let status: 'ok' | 'degraded' | 'unhealthy';
  if (!dbOk) {
    status = 'unhealthy';
  } else if (!traefikOk && traefikReachable) {
    status = 'degraded';
  } else if (!traefikOk) {
    status = 'degraded';
  } else {
    status = 'ok';
  }

  const httpStatus = status === 'unhealthy' ? 503 : 200;

  return c.json(
    {
      status,
      timestamp: new Date().toISOString(),
      uptime: Math.round((Date.now() - startedAt) / 1000),
      version: packageJson.version,
      checks: {
        database: { status: database.status, latencyMs: database.latencyMs },
        traefik: {
          status: traefik.status,
          latencyMs: traefik.latencyMs,
          ...(traefik.version ? { version: traefik.version } : {}),
        },
      },
    },
    httpStatus
  );
});

app.route('/api', resources);
app.route('/api/configfile', configfile);
app.route('/api/config-crud', configCrud);

app.use('/assets/*', serveStatic({ root: frontendDir }));
app.get('/*', serveStatic({ root: frontendDir, path: 'index.html' }));

app.onError((err, c) => {
  logError('Error:', err);
  return c.json(
    {
      error: 'Internal Server Error',
      message: config.logLevel === 'debug' ? err.message : 'An unexpected error occurred',
    },
    500
  );
});

app.notFound((c) => {
  if (c.req.path.startsWith('/api/')) {
    return c.json({ error: 'Not found', path: c.req.path }, 404);
  }
  return c.json({ error: 'Not found' }, 404);
});

export { app };
