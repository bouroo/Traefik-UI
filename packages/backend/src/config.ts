// Configuration loaded from environment variables with sensible defaults
// Note: traefikApiUrl uses a getter to read env at access time, not module load time
// This allows test setup to set TRAEFIK_API_URL before the client reads it

export const config = {
  port: parseInt(Bun.env.PORT || '3000'),
  host: Bun.env.HOST || '0.0.0.0',

  traefik: {
    get apiUrl() {
      return Bun.env.TRAEFIK_API_URL || 'http://traefik:8080';
    },
    // Optional Traefik API authentication
    get username() {
      return Bun.env.TRAEFIK_API_USERNAME || '';
    },
    get password() {
      return Bun.env.TRAEFIK_API_PASSWORD || '';
    },
  },

  db: {
    path: Bun.env.DB_PATH || './data/traefik-ui.db',
  },

  auth: {
    jwtSecret: Bun.env.JWT_SECRET || 'change-me-in-production-please',
    jwtExpiresIn: '24h',
    argon2: {
      timeCost: 3, // iterations (higher = slower, more resistant to brute force)
      memoryCost: 65536, // KiB = 64 MiB (higher = more memory-hard, resistant to GPU/ASIC)
    },
  },

  // Paths to Traefik files (for logs, certs direct file access)
  paths: {
    acmeJson: Bun.env.ACME_JSON_PATH || '',
    accessLog: Bun.env.ACCESS_LOG_PATH || '',
    staticConfig: Bun.env.STATIC_CONFIG_PATH || '',
    dynamicConfig: Bun.env.DYNAMIC_CONFIG_PATH || '',
  },

  // CORS
  cors: {
    origin: Bun.env.CORS_ORIGIN || '*',
  },

  // Logging
  logLevel: Bun.env.LOG_LEVEL || 'info',
};
