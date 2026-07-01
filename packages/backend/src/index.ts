import { app } from './app';
import { config } from './config';
import { getDb, closeDb } from './db';
import { logInfo, logWarn } from './lib/logger';
import { markShuttingDown } from './lib/lifecycle';

logInfo('Initializing database...');
const _db = getDb();
logInfo(`Database initialized at ${config.db.path}`);

const server = Bun.serve({
  port: config.port,
  hostname: config.host,
  fetch: app.fetch,
});

logInfo('Traefik-UI server started');
logInfo(`Listening on http://${config.host}:${config.port}`);
logInfo(`Traefik API: ${config.traefik.apiUrl}`);
logInfo(`Database: ${config.db.path}`);

let shuttingDown = false;

const shutdown = (signal: string): void => {
  if (shuttingDown) {
    logWarn(`Received ${signal} during shutdown, ignoring`);
    return;
  }
  shuttingDown = true;

  logInfo(`Received ${signal}, beginning graceful shutdown...`);

  const forceExit = setTimeout(() => {
    logWarn('Forced exit after 10s shutdown timeout');
    process.exit(1);
  }, 10_000);
  if (typeof forceExit === 'object' && forceExit && 'unref' in forceExit) {
    (forceExit as unknown as { unref: () => void }).unref();
  }

  markShuttingDown();

  logInfo('Stopping HTTP server (draining in-flight requests)...');
  server.stop();

  logInfo('Closing database connection...');
  try {
    closeDb();
  } catch (err) {
    logWarn('Error closing database:', err instanceof Error ? err.message : String(err));
  }

  logInfo('Shutdown complete');
  clearTimeout(forceExit);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
