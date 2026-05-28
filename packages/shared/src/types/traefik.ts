// Traefik API type definitions
// Shared between backend and frontend packages

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
