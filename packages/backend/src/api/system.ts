import { Hono } from 'hono';
import { authMiddleware } from '../auth/middleware';
import { config } from '../config';

const system = new Hono();

// Auth middleware applied per-route, not globally

// Interface for system stats response
interface SystemStats {
  cpu: {
    usagePercent: number;
    cores: number;
    model: string;
  };
  memory: {
    usedMB: number;
    totalMB: number;
    usedPercent: number;
    freeMB: number;
  };
  uptime: number;
  platform: string;
  arch: string;
  bunVersion: string;
}

// Get CPU usage by comparing idle vs total time across cores
function getCpuInfo(os: typeof import('node:os')): {
  usagePercent: number;
  cores: number;
  model: string;
} {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;

  for (const cpu of cpus) {
    for (const type in cpu.times) {
      totalTick += cpu.times[type as keyof typeof cpu.times];
    }
    totalIdle += cpu.times.idle;
  }

  const usagePercent = totalTick > 0 ? Math.round((1 - totalIdle / totalTick) * 100) : 0;
  const model = cpus.length > 0 ? cpus[0].model : 'unknown';

  return {
    usagePercent,
    cores: cpus.length,
    model,
  };
}

// GET /api/system/stats
// Returns basic system stats (CPU, memory, disk for the UI container)
// Returns: { cpu: { usagePercent, cores, model }, memory: { usedMB, totalMB, usedPercent, freeMB }, uptime: seconds, platform, arch, bunVersion }
system.get('/stats', authMiddleware, async (c) => {
  try {
    const os = await import('node:os');

    // Memory stats
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const usedMB = Math.round(usedMem / 1024 / 1024);
    const totalMB = Math.round(totalMem / 1024 / 1024);
    const freeMB = Math.round(freeMem / 1024 / 1024);
    const usedPercent = Math.round((usedMem / totalMem) * 100);

    // CPU stats
    const cpuInfo = getCpuInfo(os);

    // System info
    const uptime = os.uptime();
    const platform = os.platform();
    const arch = os.arch();
    const bunVersion = typeof Bun !== 'undefined' ? Bun.version : 'unknown';

    const stats: SystemStats = {
      cpu: {
        usagePercent: cpuInfo.usagePercent,
        cores: cpuInfo.cores,
        model: cpuInfo.model,
      },
      memory: {
        usedMB,
        totalMB,
        usedPercent,
        freeMB,
      },
      uptime: Math.round(uptime),
      platform,
      arch,
      bunVersion,
    };

    return c.json(stats);
  } catch (error) {
    console.error(
      '[system] Error fetching system stats:',
      error instanceof Error ? error.message : String(error)
    );
    return c.json({ error: 'Failed to fetch system stats' }, 500);
  }
});

// GET /api/system/config
// Returns current UI configuration (non-sensitive only!)
system.get('/config', authMiddleware, async (c) => {
  try {
    // Return only non-sensitive public configuration
    return c.json({
      traefikApiUrl: config.traefik.apiUrl,
      corsOrigin: config.cors.origin,
      logLevel: config.logLevel,
      paths: {
        acmeJson: config.paths.acmeJson ? '(configured)' : '',
        accessLog: config.paths.accessLog ? '(configured)' : '',
        staticConfig: config.paths.staticConfig ? '(configured)' : '',
      },
      auth: {
        jwtExpiresIn: config.auth.jwtExpiresIn,
        // Don't expose jwtSecret!
      },
    });
  } catch (error) {
    console.error(
      '[system] Error fetching config:',
      error instanceof Error ? error.message : String(error)
    );
    return c.json({ error: 'Failed to fetch config' }, 500);
  }
});

// GET /api/system/health
// Simple health check endpoint (no auth required)
system.get('/health', async (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GET /api/system/acme
// Returns ACME (Let's Encrypt) certificates data if configured
system.get('/acme', authMiddleware, async (c) => {
  const acmePath = config.paths.acmeJson;

  if (!acmePath) {
    return c.json({ error: 'ACME JSON path not configured' }, 404);
  }

  if (!(await Bun.file(acmePath).exists())) {
    return c.json({ error: 'ACME JSON file not found' }, 404);
  }

  try {
    const content = await Bun.file(acmePath).text();
    const acmeData = JSON.parse(content);

    // Return only relevant certificate info, redacting sensitive data
    // The full ACME JSON can contain private keys so we extract only public info
    const certs = acmeData.Certificates || acmeData.certificates || [];

    const certSummary = certs.map((cert: any) => ({
      domain: cert.domain || cert.main || 'unknown',
      sans: cert.sans || [],
      keyType: cert.keyType || 'RSA4096',
      expiration: cert.expirationTime || cert.notAfter || null,
    }));

    return c.json({
      certificates: certSummary,
      note: 'Sensitive key data has been redacted',
    });
  } catch (error) {
    console.error(
      '[system] Error reading ACME file:',
      error instanceof Error ? error.message : String(error)
    );
    return c.json({ error: 'Failed to read ACME data' }, 500);
  }
});

export { system };
