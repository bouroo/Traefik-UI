import { toast } from 'sonner';

const TOKEN_KEY = 'traefik_ui_token';

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (response.status === 403) {
    toast.error('Access Denied');
    const error = await response.json().catch(() => ({ error: 'Access denied' }));
    throw new Error(error.error || 'Access denied');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

interface LoginResponse {
  token: string;
  user: {
    id: number;
    username: string;
  };
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const response = await fetchApi<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  return response;
}

interface User {
  id: number;
  username: string;
  source: string;
  email: string | null;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
  roles: { id: number; name: string }[];
}

export async function getMe(): Promise<{ user: User; permissions: string[] }> {
  return fetchApi<{ user: User; permissions: string[] }>('/api/auth/me');
}

interface DashboardData {
  overview: {
    http: Record<string, unknown>;
    tcp: Record<string, unknown>;
    udp: Record<string, unknown>;
    features: {
      tracing: string;
      metrics: string;
      accessLog: boolean;
    };
    providers: unknown[];
  };
  version: {
    version: string;
    codename: string;
    startDate: string;
    uptime: string;
  };
  entrypoints: unknown[];
  connectionStatus: 'connected' | 'disconnected';
}

export async function getDashboard(): Promise<DashboardData> {
  return fetchApi<DashboardData>('/api/dashboard');
}

interface RoutersResponse {
  http: unknown[];
  tcp: unknown[];
  udp: unknown[];
}

export async function getRouters(): Promise<RoutersResponse> {
  return fetchApi<RoutersResponse>('/api/routers');
}

export async function getHttpRouters(): Promise<{ routers: unknown[] }> {
  return fetchApi<{ routers: unknown[] }>('/api/routers/http');
}

export async function getTcpRouters(): Promise<{ routers: unknown[] }> {
  return fetchApi<{ routers: unknown[] }>('/api/routers/tcp');
}

export async function getUdpRouters(): Promise<{ routers: unknown[] }> {
  return fetchApi<{ routers: unknown[] }>('/api/routers/udp');
}

export async function getRouter(protocol: string, name: string): Promise<unknown> {
  const encodedName = encodeURIComponent(name);
  return fetchApi<unknown>(`/api/routers/${protocol}/${encodedName}`);
}

interface ServicesResponse {
  http: unknown[];
  tcp: unknown[];
  udp: unknown[];
}

export async function getServices(): Promise<ServicesResponse> {
  return fetchApi<ServicesResponse>('/api/services');
}

export async function getService(protocol: string, name: string): Promise<unknown> {
  const encodedName = encodeURIComponent(name);
  return fetchApi<unknown>(`/api/services/${protocol}/${encodedName}`);
}

interface MiddlewaresResponse {
  http: unknown[];
  tcp: unknown[];
}

export async function getMiddlewares(): Promise<MiddlewaresResponse> {
  return fetchApi<MiddlewaresResponse>('/api/middlewares');
}

export async function getMiddleware(protocol: string, name: string): Promise<unknown> {
  const encodedName = encodeURIComponent(name);
  return fetchApi<unknown>(`/api/middlewares/${protocol}/${encodedName}`);
}

export async function getOverview(): Promise<unknown> {
  return fetchApi<unknown>('/api/overview');
}

interface SystemStats {
  cpu: { usagePercent: number; cores: number; model: string };
  memory: { usedMB: number; totalMB: number; usedPercent: number; freeMB: number };
  uptime: number;
  platform: string;
  arch: string;
  bunVersion: string;
}

export async function getSystemStats(): Promise<SystemStats> {
  return fetchApi<SystemStats>('/api/system/stats');
}

interface Certificate {
  domain: string;
  sans: string[];
  notBefore: string | null;
  notAfter: string | null;
  issuer: string | null;
  serialNumber: string | null;
  isExpired: boolean;
}

export async function getTlsCertificates(): Promise<{ certificates: Certificate[] }> {
  return fetchApi<{ certificates: Certificate[] }>('/api/tls/certificates');
}

export async function getEntrypoints(): Promise<{ entrypoints: unknown[] }> {
  return fetchApi<{ entrypoints: unknown[] }>('/api/entrypoints');
}

interface AccessLogLine {
  timestamp: string;
  clientIp: string;
  method: string;
  path: string;
  status: number;
  size: number;
  duration?: number;
}

interface LogsResponse {
  lines: AccessLogLine[];
  totalLines: number;
  hasMore: boolean;
  message?: string;
}

export async function getAccessLogs(lines = 100, offset = 0, filter = ''): Promise<LogsResponse> {
  const params = new URLSearchParams({ lines: String(lines), offset: String(offset) });
  if (filter) params.set('filter', filter);
  return fetchApi<LogsResponse>(`/api/logs/access?${params}`);
}

export async function getStaticConfig(): Promise<unknown> {
  return fetchApi<unknown>('/api/configfile/static');
}

export async function getDynamicConfig(): Promise<unknown> {
  return fetchApi<unknown>('/api/configfile/dynamic');
}

export async function getSsoProviders(): Promise<{ id: number; name: string; provider_type: string }[]> {
  return fetchApi<{ id: number; name: string; provider_type: string }[]>('/api/auth/sso/providers');
}

export async function getUsers(): Promise<User[]> {
  return fetchApi<User[]>('/api/admin/users');
}

export async function getUser(id: number): Promise<User> {
  return fetchApi<User>(`/api/admin/users/${id}`);
}

export async function updateUser(
  id: number,
  data: { is_active?: boolean; email?: string; roles?: number[] }
): Promise<{ success: boolean }> {
  return fetchApi<{ success: boolean }>(`/api/admin/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteUser(id: number): Promise<{ success: boolean }> {
  return fetchApi<{ success: boolean }>(`/api/admin/users/${id}`, {
    method: 'DELETE',
  });
}

interface Group {
  id: number;
  name: string;
  external_id: string | null;
  source: string;
  created_at: string;
  member_count?: number;
}

export async function getGroups(): Promise<Group[]> {
  return fetchApi<Group[]>('/api/admin/groups');
}

export async function getGroup(id: number): Promise<Group & { users: { id: number; username: string; email: string | null }[]; roles: { id: number; name: string }[] }> {
  return fetchApi<Group & { users: { id: number; username: string; email: string | null }[]; roles: { id: number; name: string }[] }>(`/api/admin/groups/${id}`);
}

export async function createGroup(data: { name: string; external_id?: string; source?: string; role_ids?: number[] }): Promise<{ id: number; name: string }> {
  return fetchApi<{ id: number; name: string }>('/api/admin/groups', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateGroup(
  id: number,
  data: { name?: string; external_id?: string; role_ids?: number[] }
): Promise<{ success: boolean }> {
  return fetchApi<{ success: boolean }>(`/api/admin/groups/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteGroup(id: number): Promise<{ success: boolean }> {
  return fetchApi<{ success: boolean }>(`/api/admin/groups/${id}`, {
    method: 'DELETE',
  });
}

interface Role {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  permission_names: string[];
}

export async function getRoles(): Promise<Role[]> {
  return fetchApi<Role[]>('/api/admin/roles');
}

export async function getRole(id: number): Promise<Role> {
  return fetchApi<Role>(`/api/admin/roles/${id}`);
}

export async function createRole(data: { name: string; description?: string; permission_ids: number[] }): Promise<{ id: number; name: string }> {
  return fetchApi<{ id: number; name: string }>('/api/admin/roles', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateRole(
  id: number,
  data: { name?: string; description?: string; permission_ids?: number[] }
): Promise<{ success: boolean }> {
  return fetchApi<{ success: boolean }>(`/api/admin/roles/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteRole(id: number): Promise<{ success: boolean }> {
  return fetchApi<{ success: boolean }>(`/api/admin/roles/${id}`, {
    method: 'DELETE',
  });
}

interface Permission {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
}

export async function getPermissions(): Promise<Permission[]> {
  return fetchApi<Permission[]>('/api/admin/permissions');
}

interface SsoProvider {
  id: number;
  name: string;
  provider_type: string;
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
  config?: {
    issuerUrl: string;
    clientId: string;
    scopes?: string[];
    groupClaim?: string;
    roleMappings?: Record<string, string>;
  };
}

export async function getSsoIdpProviders(): Promise<SsoProvider[]> {
  return fetchApi<SsoProvider[]>('/api/admin/sso-providers');
}

export async function getSsoIdpProvider(id: number): Promise<SsoProvider> {
  return fetchApi<SsoProvider>(`/api/admin/sso-providers/${id}`);
}

export async function createSsoProvider(data: {
  name: string;
  provider_type: string;
  enabled?: boolean;
  config: {
    issuerUrl: string;
    clientId: string;
    clientSecret: string;
    scopes?: string[];
    groupClaim?: string;
    roleMappings?: Record<string, string>;
  };
}): Promise<{ id: number; name: string }> {
  return fetchApi<{ id: number; name: string }>('/api/admin/sso-providers', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateSsoProvider(
  id: number,
  data: {
    name?: string;
    enabled?: boolean;
    config?: {
      issuerUrl?: string;
      clientId?: string;
      clientSecret?: string;
      scopes?: string[];
      groupClaim?: string;
      roleMappings?: Record<string, string>;
    };
  }
): Promise<{ id: number; name: string }> {
  return fetchApi<{ id: number; name: string }>(`/api/admin/sso-providers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteSsoProvider(id: number): Promise<{ success: boolean }> {
  return fetchApi<{ success: boolean }>(`/api/admin/sso-providers/${id}`, {
    method: 'DELETE',
  });
}