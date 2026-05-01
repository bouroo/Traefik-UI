import { config } from '../config';

// TypeScript interfaces for Traefik API responses
export interface TraefikRouter {
  name: string;
  provider: string;
  status: string;
  rule?: string;
  service?: string;
  entryPoints?: string[];
  middlewares?: string[];
  tls?: {
    options?: string;
    certResolver?: string;
    domains?: { main: string; sans?: string[] }[];
  };
  priority?: number;
  using?: string[];
}

export interface TraefikService {
  name: string;
  provider: string;
  status: string;
  type?: string;
  serverStatus?: Record<string, string>;
  loadBalancer?: {
    servers?: { url: string }[];
    healthCheck?: {
      path: string;
      interval: string;
      timeout: string;
      scheme: string;
    };
    passHostHeader?: boolean;
    sticky?: {
      cookie?: {
        name: string;
        secure: boolean;
        httpOnly: boolean;
      };
    };
  };
  weighted?: { services?: { name: string; weight: number }[] };
  mirroring?: { service?: string; mirrors?: { name: string; percent: number }[] };
}

export interface TraefikMiddleware {
  name: string;
  provider: string;
  status: string;
  type: string;
  [key: string]: any;
}

export interface TraefikEntryPoint {
  name: string;
  address: string;
  transport?: {
    lifeCycle?: {
      requestAcceptGraceTimeout?: string;
      graceTimeOut?: string;
    };
    respondingTimeouts?: {
      readTimeout?: string;
      writeTimeout?: string;
      idleTimeout?: string;
    };
  };
  proxyProtocol?: { insecure?: boolean; trustedIPs?: string[] };
  forwardedHeaders?: { insecure?: boolean; trustedIPs?: string[] };
  http?: { middlewares?: string[]; tls?: any };
  http3?: { advertisedPort?: number };
}

export interface TraefikOverview {
  http: Record<string, { routers: number; services: number; middlewares: number }>;
  tcp: Record<string, { routers: number; services: number; middlewares: number }>;
  udp: Record<string, { routers: number; services: number }>;
  features: { tracing: string; metrics: string; accessLog: boolean };
  providers: string[];
}

export interface TraefikVersion {
  version: string;
  codename: string;
  startDate: string;
  uptime: string;
}

export interface TraefikRawData {
  routers?: Record<string, any>;
  services?: Record<string, any>;
  middlewares?: Record<string, any>;
}

// Generic fetch wrapper with auth support
async function fetchTraefik<T>(path: string): Promise<T | null> {
  const url = config.traefik.apiUrl + '/api' + path;

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  // Add Basic Auth if credentials are configured
  if (config.traefik.username && config.traefik.password) {
    const credentials = btoa(`${config.traefik.username}:${config.traefik.password}`);
    headers['Authorization'] = `Basic ${credentials}`;
  }

  try {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      console.error(
        `[${new Date().toISOString()}] Traefik API error: ${response.status} ${response.statusText} for ${path}`
      );
      return null;
    }

    const data = await response.json();
    return data as T;
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Traefik API fetch failed for ${path}:`,
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

/**
 * Parse raw Traefik API response into array format.
 * Handles both array format and object format { "name": { ... } }.
 */
function parseResources<T extends { name: string }>(data: T[] | Record<string, any> | null): T[] {
  if (data === null) return [];
  if (Array.isArray(data)) return data;
  return Object.entries(data).map(([name, value]) => ({
    name,
    ...value,
  }));
}

/**
 * Fetch all resources of a given type for a protocol.
 * Replaces getHttpRouters, getTcpRouters, getUdpRouters, etc.
 */
async function getAllResources<T extends { name: string }>(
  protocol: string,
  resourceType: string
): Promise<T[]> {
  const data = await fetchTraefik<T[] | Record<string, any>>(`/${protocol}/${resourceType}`);
  return parseResources<T>(data);
}

/**
 * Fetch a single resource by name for a protocol and resource type.
 * Replaces getHttpRouter, getTcpService, etc.
 */
async function getOneResource<T>(
  protocol: string,
  resourceType: string,
  name: string
): Promise<T | null> {
  return fetchTraefik<T>(`/${protocol}/${resourceType}/${encodeURIComponent(name)}`);
}

// Entry Points
async function getEntryPoints(): Promise<TraefikEntryPoint[]> {
  const result = await fetchTraefik<TraefikEntryPoint[]>('/entrypoints');
  return result ?? [];
}

async function getEntryPoint(name: string): Promise<TraefikEntryPoint | null> {
  return fetchTraefik<TraefikEntryPoint>(`/entrypoints/${encodeURIComponent(name)}`);
}

// Overview
async function getOverview(): Promise<TraefikOverview | null> {
  return fetchTraefik<TraefikOverview>('/overview');
}

// Version
async function getVersion(): Promise<TraefikVersion | null> {
  return fetchTraefik<TraefikVersion>('/version');
}

// Raw Data
async function getRawData(): Promise<TraefikRawData | null> {
  return fetchTraefik<TraefikRawData>('/rawdata');
}

// Connection check
async function checkTraefikConnection(): Promise<boolean> {
  const version = await getVersion();
  return version !== null;
}

// Backward-compatible named exports for HTTP resources
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

// Backward-compatible named exports for TCP resources
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

// Backward-compatible named exports for UDP resources
async function getUdpRouters(): Promise<TraefikRouter[]> {
  return getAllResources<TraefikRouter>('udp', 'routers');
}

async function getUdpServices(): Promise<TraefikService[]> {
  return getAllResources<TraefikService>('udp', 'services');
}

async function getUdpMiddlewares(): Promise<TraefikMiddleware[]> {
  return getAllResources<TraefikMiddleware>('udp', 'middlewares');
}

// Export all functions and interfaces
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
