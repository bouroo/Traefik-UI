import { app } from './app';
import { config } from './config';
import { getDb } from './db';

// Initialize database on startup
console.log(`[${new Date().toISOString()}] Initializing database...`);
const _db = getDb();
console.log(`[${new Date().toISOString()}] Database initialized at ${config.db.path}`);

// Start server
const server = Bun.serve({
  port: config.port,
  hostname: config.host,
  fetch: app.fetch,
});

console.log(`[${new Date().toISOString()}] 🚀 Traefik-UI server started`);
console.log(`[${new Date().toISOString()}] 📡 Listening on http://${config.host}:${config.port}`);
console.log(`[${new Date().toISOString()}] 🔗 Traefik API: ${config.traefik.apiUrl}`);
console.log(`[${new Date().toISOString()}] 💾 Database: ${config.db.path}`);

// Graceful shutdown
const shutdown = () => {
  console.log(`\n[${new Date().toISOString()}] Shutting down...`);
  server.stop();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
