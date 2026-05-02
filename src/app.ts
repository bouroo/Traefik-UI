import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serveStatic } from 'hono/bun';
import { config } from './config';

// Import all route modules
import { auth } from './auth/routes';
import { dashboard } from './api/dashboard';
import { overview } from './api/overview';
import { resources } from './api/resources';
import { tls } from './api/tls';
import { logs } from './api/logs';
import { entrypoints } from './api/entrypoints';
import { system } from './api/system';
import { configfile } from './api/configfile';
import { configCrud } from './api/config-crud';

const app = new Hono();

// Global middleware
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

// Logger middleware (skip in production/test)
if (config.logLevel !== 'silent') {
  app.use('*', logger());
}

// API routes
app.route('/api/auth', auth);
app.route('/api/dashboard', dashboard);
app.route('/api/overview', overview);
app.route('/api/tls', tls);
app.route('/api/logs', logs);
app.route('/api/entrypoints', entrypoints);
app.route('/api/system', system);

// Health check (no auth) - must be before resources mount to avoid being shadowed
app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.route('/api', resources);
app.route('/api/configfile', configfile);
app.route('/api/config-crud', configCrud);

// Serve static frontend files from public
// The frontend is a SPA — for any non-API, non-static path, serve index.html
// First, serve static assets (CSS, JS, images)
app.use('/assets/*', serveStatic({ root: './public' }));

// For any other GET request, serve index.html (SPA fallback)
// But skip API routes (they start with /api/)
app.get('/*', serveStatic({ path: './public/index.html' }));

// Error handling
app.onError((err, c) => {
  console.error(`[${new Date().toISOString()}] Error:`, err);
  return c.json(
    {
      error: 'Internal Server Error',
      message: config.logLevel === 'debug' ? err.message : 'An unexpected error occurred',
    },
    500
  );
});

// 404 for unmatched API routes
app.notFound((c) => {
  if (c.req.path.startsWith('/api/')) {
    return c.json({ error: 'Not found', path: c.req.path }, 404);
  }
  // For non-API, serve index.html (SPA routing)
  return c.json({ error: 'Not found' }, 404);
});

export { app };
