import { app } from './app';
import { config } from './config';
import { getDb } from './db';
import { logInfo } from './lib/logger';

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

const shutdown = () => {
  logInfo('Shutting down...');
  server.stop();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
