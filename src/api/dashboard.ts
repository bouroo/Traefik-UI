import { Hono } from 'hono';
import * as traefik from '../traefik/client';
import { authMiddleware } from '../auth/middleware';

const dashboard = new Hono();

dashboard.use('*', authMiddleware);

dashboard.get('/', async (c) => {
  const _startTime = Date.now();

  const [overviewResult, versionResult, entrypointsResult] = await Promise.allSettled([
    traefik.getOverview(),
    traefik.getVersion(),
    traefik.getEntryPoints(),
  ]);

  const overview = overviewResult.status === 'fulfilled' ? overviewResult.value : null;
  const version = versionResult.status === 'fulfilled' ? versionResult.value : null;
  const entrypoints = entrypointsResult.status === 'fulfilled' ? entrypointsResult.value : null;

  const traefikConnected =
    overviewResult.status === 'fulfilled' &&
    versionResult.status === 'fulfilled' &&
    entrypointsResult.status === 'fulfilled';

  const connectionStatus: 'connected' | 'disconnected' = traefikConnected
    ? 'connected'
    : 'disconnected';

  let _uptime = 'unknown';
  if (version?.startDate) {
    const startDate = new Date(version.startDate);
    const now = new Date();
    const diffMs = now.getTime() - startDate.getTime();
    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      _uptime = `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      _uptime = `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      _uptime = `${minutes}m ${seconds % 60}s`;
    } else {
      _uptime = `${seconds}s`;
    }
  }

  void _startTime;

  return c.json({
    overview: overview ?? {
      http: {},
      tcp: {},
      udp: {},
      features: { tracing: 'disabled', metrics: 'disabled', accessLog: false },
      providers: [],
    },
    version: version ?? { version: 'unknown', codename: '', startDate: '', uptime: 'unknown' },
    entrypoints: entrypoints ?? [],
    connectionStatus,
  });
});

dashboard.get('/health', async (c) => {
  const [versionResult] = await Promise.allSettled([traefik.getVersion()]);

  const traefikConnected = versionResult.status === 'fulfilled' && versionResult.value !== null;

  const now = new Date();
  const startDate = new Date('2024-01-01T00:00:00Z');
  const diffMs = now.getTime() - startDate.getTime();
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  let uptime: string;
  if (days > 0) {
    uptime = `${days}d ${hours % 24}h ${minutes % 60}m`;
  } else if (hours > 0) {
    uptime = `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    uptime = `${minutes}m ${seconds % 60}s`;
  } else {
    uptime = `${seconds}s`;
  }

  return c.json({
    status: 'ok',
    traefikConnected,
    uptime,
  });
});

export { dashboard };
