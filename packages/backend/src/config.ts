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
    // TTL (ms) for in-process cache of upstream Traefik API GET responses.
    // Short default: Traefik config can change at any time via dynamic config.
    get cacheTtlMs() {
      return parseInt(Bun.env.TRAEFIK_CACHE_TTL_MS || '2000');
    },
    // Request timeout (ms) for upstream Traefik API calls.
    get requestTimeoutMs() {
      return parseInt(Bun.env.TRAEFIK_REQUEST_TIMEOUT_MS || '5000');
    },
  },

  rbac: {
    // TTL (ms) for in-process permission cache (Map<userId, perms>).
    get permissionCacheTtlMs() {
      return parseInt(Bun.env.PERMISSION_CACHE_TTL_MS || '60000');
    },
    // Master switch — set PERMISSION_CACHE_ENABLED=false to bypass cache (tests).
    get permissionCacheEnabled() {
      const v = Bun.env.PERMISSION_CACHE_ENABLED;
      return v === undefined || v === '' ? true : v !== 'false';
    },
  },

  db: {
    get path() {
      return Bun.env.DB_PATH || './data/traefik-ui.db';
    },
  },

  auth: {
    jwtSecret: Bun.env.JWT_SECRET || 'change-me-in-production-please',
    encryptionKey: Bun.env.ENCRYPTION_KEY || Bun.env.JWT_SECRET || 'change-me-in-production-please',
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

  // Security
  security: {
    hsts: Bun.env.HSTS_ENABLED === 'true',
  },

  // Logging
  logLevel: Bun.env.LOG_LEVEL || 'info',

  // Node environment (read at access time so tests can mutate)
  get nodeEnv(): string {
    return Bun.env.NODE_ENV || 'development';
  },
  get isTest(): boolean {
    return this.nodeEnv === 'test';
  },

  // Rate limiting
  rateLimit: {
    get disabled() {
      return Bun.env.RATE_LIMIT_DISABLED === 'true' || Bun.env.NODE_ENV === 'test';
    },
  },

  // First-run bootstrap (env-driven admin provisioning)
  bootstrap: {
    get adminUsername() {
      return Bun.env.ADMIN_USERNAME || 'admin';
    },
    get adminPassword() {
      return Bun.env.ADMIN_PASSWORD || '';
    },
  },
};
