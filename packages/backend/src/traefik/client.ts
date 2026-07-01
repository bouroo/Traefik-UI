import { config } from '../config';
import { logError } from '../lib/logger';
import type {
  TraefikRouter,
  TraefikService,
  TraefikMiddleware,
  TraefikEntryPoint,
  TraefikOverview,
  TraefikVersion,
  TraefikRawData,
} from '@traefik-ui/shared';

export type {
  TraefikRouter,
  TraefikService,
  TraefikMiddleware,
  TraefikEntryPoint,
  TraefikOverview,
  TraefikVersion,
  TraefikRawData,
} from '@traefik-ui/shared';

interface CachedEntry<T> {
  data: T;
  expiresAt: number;
}

const traefikCache = new Map<string, CachedEntry<unknown>>();

export function invalidateTraefikCache(): void {
  traefikCache.clear();
}

async function fetchTraefik<T>(path: string): Promise<T | null> {
  const url = config.traefik.apiUrl + '/api' + path;

  const now = Date.now();
  const cached = traefikCache.get(url);
  if (cached && cached.expiresAt > now) {
    return cached.data as T;
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (config.traefik.username && config.traefik.password) {
    const credentials = btoa(`${config.traefik.username}:${config.traefik.password}`);
    headers['Authorization'] = `Basic ${credentials}`;
  }

  const controller = new AbortController();
  const timeoutMs = config.traefik.requestTimeoutMs;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { headers, signal: controller.signal });

    if (!response.ok) {
      logError(`Traefik API error: ${response.status} ${response.statusText} for ${path}`);
      return null;
    }

    const data = (await response.json()) as T;
    if (data !== null && data !== undefined) {
      traefikCache.set(url, {
        data,
        expiresAt: now + config.traefik.cacheTtlMs,
      });
    }
    return data;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logError(`Traefik API request timed out after ${timeoutMs}ms for ${path}`);
      return null;
    }
    logError(
      `Traefik API fetch failed for ${path}:`,
      error instanceof Error ? error.message : String(error)
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function parseResources<T extends { name: string }>(data: T[] | Record<string, any> | null): T[] {
  if (data === null) return [];
  if (Array.isArray(data)) return data;
  return Object.entries(data).map(([name, value]) => ({
    name,
    ...(typeof value === 'object' && value !== null ? value : {}),
  }));
}

async function getAllResources<T extends { name: string }>(
  protocol: string,
  resourceType: string
): Promise<T[]> {
  const data = await fetchTraefik<T[] | Record<string, any>>(`/${protocol}/${resourceType}`);
  return parseResources<T>(data);
}

async function getOneResource<T>(
  protocol: string,
  resourceType: string,
  name: string
): Promise<T | null> {
  return fetchTraefik<T>(`/${protocol}/${resourceType}/${encodeURIComponent(name)}`);
}

async function getEntryPoints(): Promise<TraefikEntryPoint[]> {
  const data = await fetchTraefik<TraefikEntryPoint[] | Record<string, any>>('/entrypoints');
  return parseResources<TraefikEntryPoint>(data);
}

async function getEntryPoint(name: string): Promise<TraefikEntryPoint | null> {
  return fetchTraefik<TraefikEntryPoint>(`/entrypoints/${encodeURIComponent(name)}`);
}

async function getOverview(): Promise<TraefikOverview | null> {
  return fetchTraefik<TraefikOverview>('/overview');
}

function normalizeVersion(data: any): TraefikVersion {
  return {
    version: data.version || data.Version || 'unknown',
    codename: data.codename || data.Codename || '',
    startDate: data.startDate || data.StartDate || '',
    uptime: data.uptime || data.Uptime || '',
  };
}

async function getVersion(): Promise<TraefikVersion | null> {
  const data = await fetchTraefik<any>('/version');
  if (!data) return null;
  return normalizeVersion(data);
}

async function getRawData(): Promise<TraefikRawData | null> {
  return fetchTraefik<TraefikRawData>('/rawdata');
}

async function checkTraefikConnection(): Promise<boolean> {
  const version = await getVersion();
  return version !== null;
}

async function getHttpRouters(): Promise<TraefikRouter[]> {
  return getAllResources<TraefikRouter>('http', 'routers');
}

async function getHttpRouter(name: string): Promise<TraefikRouter | null> {
  return getOneResource<TraefikRouter>('http', 'routers', name);
}

async function getHttpServices(): Promise<TraefikService[]> {
  return getAllResources<TraefikService>('http', 'services');
}

async function getHttpService(name: string): Promise<TraefikService | null> {
  return getOneResource<TraefikService>('http', 'services', name);
}

async function getHttpMiddlewares(): Promise<TraefikMiddleware[]> {
  return getAllResources<TraefikMiddleware>('http', 'middlewares');
}

async function getHttpMiddleware(name: string): Promise<TraefikMiddleware | null> {
  return getOneResource<TraefikMiddleware>('http', 'middlewares', name);
}

async function getTcpRouters(): Promise<TraefikRouter[]> {
  return getAllResources<TraefikRouter>('tcp', 'routers');
}

async function getTcpServices(): Promise<TraefikService[]> {
  return getAllResources<TraefikService>('tcp', 'services');
}

async function getTcpMiddlewares(): Promise<TraefikMiddleware[]> {
  return getAllResources<TraefikMiddleware>('tcp', 'middlewares');
}

async function getTcpMiddleware(name: string): Promise<TraefikMiddleware | null> {
  return getOneResource<TraefikMiddleware>('tcp', 'middlewares', name);
}

async function getUdpRouters(): Promise<TraefikRouter[]> {
  return getAllResources<TraefikRouter>('udp', 'routers');
}

async function getUdpServices(): Promise<TraefikService[]> {
  return getAllResources<TraefikService>('udp', 'services');
}

async function getUdpMiddlewares(): Promise<TraefikMiddleware[]> {
  return getAllResources<TraefikMiddleware>('udp', 'middlewares');
}

export {
  fetchTraefik,
  getAllResources,
  getOneResource,
  getHttpRouters,
  getHttpRouter,
  getHttpServices,
  getHttpService,
  getHttpMiddlewares,
  getHttpMiddleware,
  getTcpRouters,
  getTcpServices,
  getTcpMiddlewares,
  getTcpMiddleware,
  getUdpRouters,
  getUdpServices,
  getUdpMiddlewares,
  getEntryPoints,
  getEntryPoint,
  getOverview,
  getVersion,
  getRawData,
  checkTraefikConnection,
};
