import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serveStatic } from 'hono/bun';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from './config';
import { logError } from './lib/logger';

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
    exposeHeaders: ['Content-Length'],
    maxAge: 86400,
  })
);

if (config.logLevel !== 'silent') {
  app.use('*', logger());
}

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

app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

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
