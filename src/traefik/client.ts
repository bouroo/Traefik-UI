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

// HTTP Routers
async function getHttpRouters(): Promise<TraefikRouter[]> {
  const data = await fetchTraefik<TraefikRouter[] | Record<string, any>>('/http/routers');
  if (data === null) return [];
  if (Array.isArray(data)) return data;
  // Handle object format: { "router-name": { ... } }
  return Object.entries(data).map(([name, value]) => ({
    name,
    ...value,
  }));
}

async function getHttpRouter(name: string): Promise<TraefikRouter | null> {
  return fetchTraefik<TraefikRouter>(`/http/routers/${encodeURIComponent(name)}`);
}

// HTTP Services
async function getHttpServices(): Promise<TraefikService[]> {
  const data = await fetchTraefik<TraefikService[] | Record<string, any>>('/http/services');
  if (data === null) return [];
  if (Array.isArray(data)) return data;
  return Object.entries(data).map(([name, value]) => ({
    name,
    ...value,
  }));
}

async function getHttpService(name: string): Promise<TraefikService | null> {
  return fetchTraefik<TraefikService>(`/http/services/${encodeURIComponent(name)}`);
}

// HTTP Middlewares
async function getHttpMiddlewares(): Promise<TraefikMiddleware[]> {
  const data = await fetchTraefik<TraefikMiddleware[] | Record<string, any>>('/http/middlewares');
  if (data === null) return [];
  if (Array.isArray(data)) return data;
  return Object.entries(data).map(([name, value]) => ({
    name,
    ...value,
  }));
}

async function getHttpMiddleware(name: string): Promise<TraefikMiddleware | null> {
  return fetchTraefik<TraefikMiddleware>(`/http/middlewares/${encodeURIComponent(name)}`);
}

// TCP Routers
async function getTcpRouters(): Promise<TraefikRouter[]> {
  const data = await fetchTraefik<TraefikRouter[] | Record<string, any>>('/tcp/routers');
  if (data === null) return [];
  if (Array.isArray(data)) return data;
  return Object.entries(data).map(([name, value]) => ({
    name,
    ...value,
  }));
}

// TCP Services
async function getTcpServices(): Promise<TraefikService[]> {
  const data = await fetchTraefik<TraefikService[] | Record<string, any>>('/tcp/services');
  if (data === null) return [];
  if (Array.isArray(data)) return data;
  return Object.entries(data).map(([name, value]) => ({
    name,
    ...value,
  }));
}

// TCP Middlewares
async function getTcpMiddlewares(): Promise<TraefikMiddleware[]> {
  const data = await fetchTraefik<TraefikMiddleware[] | Record<string, any>>('/tcp/middlewares');
  if (data === null) return [];
  if (Array.isArray(data)) return data;
  return Object.entries(data).map(([name, value]) => ({
    name,
    ...value,
  }));
}

async function getTcpMiddleware(name: string): Promise<TraefikMiddleware | null> {
  return fetchTraefik<TraefikMiddleware>(`/tcp/middlewares/${encodeURIComponent(name)}`);
}

// UDP Middlewares
async function getUdpMiddlewares(): Promise<TraefikMiddleware[]> {
  const data = await fetchTraefik<TraefikMiddleware[] | Record<string, any>>('/udp/middlewares');
  if (data === null) return [];
  if (Array.isArray(data)) return data;
  return Object.entries(data).map(([name, value]) => ({
    name,
    ...value,
  }));
}

// UDP Routers
async function getUdpRouters(): Promise<TraefikRouter[]> {
  const data = await fetchTraefik<TraefikRouter[] | Record<string, any>>('/udp/routers');
  if (data === null) return [];
  if (Array.isArray(data)) return data;
  return Object.entries(data).map(([name, value]) => ({
    name,
    ...value,
  }));
}

// UDP Services
async function getUdpServices(): Promise<TraefikService[]> {
  const data = await fetchTraefik<TraefikService[] | Record<string, any>>('/udp/services');
  if (data === null) return [];
  if (Array.isArray(data)) return data;
  return Object.entries(data).map(([name, value]) => ({
    name,
    ...value,
  }));
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

// Export all functions and interfaces
export {
  fetchTraefik,
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
