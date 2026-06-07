import { test as base } from '@playwright/test';
import type { Page } from '@playwright/test';

export interface MockUser {
  id: number;
  username: string;
  is_admin: boolean;
  source: string;
  email: string | null;
  is_active: boolean;
  created_at: string;
}

export interface MockAuthOptions {
  user?: MockUser;
  permissions?: string[];
  token?: string;
}

const DEFAULT_TOKEN = 'mock-jwt-token-for-e2e-testing';
const DEFAULT_USER: MockUser = {
  id: 1,
  username: 'admin',
  is_admin: true,
  source: 'local',
  email: 'admin@example.com',
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
};

export const ALL_PERMISSIONS = [
  'traefik.dashboard.read',
  'traefik.routers.read',
  'traefik.services.read',
  'traefik.middlewares.read',
  'traefik.tls.read',
  'traefik.entrypoints.read',
  'traefik.logs.read',
  'traefik.system.read',
  'traefik.config.read',
  'system.users.read',
  'system.users.write',
  'system.roles.read',
  'system.roles.write',
  'system.idp.read',
  'system.idp.write',
];

const DEFAULT_PERMISSIONS = [
  'traefik.dashboard.read',
  'traefik.routers.read',
  'traefik.services.read',
  'traefik.middlewares.read',
  'traefik.tls.read',
  'traefik.entrypoints.read',
  'traefik.logs.read',
  'traefik.system.read',
  'traefik.config.read',
  'system.users.read',
  'system.roles.read',
  'system.idp.read',
];

export async function mockAuth(page: Page, options: MockAuthOptions = {}) {
  const user = options.user ?? DEFAULT_USER;
  const permissions = options.permissions ?? DEFAULT_PERMISSIONS;
  const token = options.token ?? DEFAULT_TOKEN;

  await page.route('**/api/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token, user: { id: user.id, username: user.username } }),
    });
  });

  await page.route('**/api/auth/me', async (route) => {
    const authHeader = route.request().headers()['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user, permissions }),
      });
    } else {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unauthorized' }),
      });
    }
  });

  await page.route('**/api/auth/logout', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });

  await page.addInitScript(
    (storage) => {
      localStorage.setItem('traefik_ui_token', storage.token);
    },
    { token }
  );
}

export async function mockSsoProviders(
  page: Page,
  providers: { id: number; name: string; provider_type: string }[] = []
) {
  await page.route('**/api/auth/sso/providers', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(providers),
    });
  });
}

export async function mockDashboard(page: Page, data?: Record<string, unknown>) {
  const defaultData = {
    overview: {
      http: { file: { routers: 5, services: 3, middlewares: 2 } },
      tcp: {},
      udp: {},
      features: { tracing: 'enabled', metrics: 'enabled', accessLog: true },
      providers: ['file'],
    },
    version: {
      version: '3.0.0',
      codename: 'Baguette',
      startDate: '2024-01-01',
      uptime: '1d 2h 3m',
    },
    entrypoints: [
      { name: 'web', address: ':80' },
      { name: 'websecure', address: ':443' },
    ],
    connectionStatus: 'connected',
  };
  await page.route('**/api/dashboard', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(data ?? defaultData),
    });
  });
}

export async function mockRouters(page: Page, data?: Record<string, unknown>) {
  const defaultData = {
    http: [
      {
        name: 'http-router-1',
        rule: 'PathPrefix(`/api`)',
        service: 'api-service',
        entryPoints: ['web'],
        provider: 'file',
        status: 'enabled',
        tls: false,
        priority: 0,
      },
      {
        name: 'http-router-2',
        rule: 'Host(`example.com`)',
        service: 'web-service',
        entryPoints: ['web'],
        provider: 'file',
        status: 'enabled',
        tls: true,
        priority: 0,
      },
    ],
    tcp: [
      {
        name: 'tcp-router-1',
        rule: 'HostSNI(`tcp.example.com`)',
        service: 'tcp-service',
        entryPoints: ['tcp'],
        provider: 'file',
        status: 'enabled',
        tls: true,
        priority: 0,
      },
    ],
    udp: [
      {
        name: 'udp-router-1',
        rule: 'UDPRule',
        service: 'udp-service',
        entryPoints: ['udp'],
        provider: 'file',
        status: 'enabled',
        priority: 0,
      },
    ],
  };
  await page.route('**/api/routers', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(data ?? defaultData),
    });
  });
}

export async function mockRouterDetail(
  page: Page,
  protocol: string,
  name: string,
  data?: Record<string, unknown>
) {
  const defaultData = {
    router: {
      name,
      rule: 'PathPrefix(`/api`)',
      service: 'api-service',
      entryPoints: ['web'],
      provider: 'file',
      status: 'enabled',
      tls: false,
      priority: 0,
    },
    service: {
      name: 'api-service',
      type: 'loadBalancer',
      status: 'enabled',
      loadBalancer: { servers: [{ url: 'http://127.0.0.1:8080' }] },
      serverStatus: { 'http://127.0.0.1:8080': 'up' },
    },
    middlewares: [{ name: 'strip-prefix' }],
  };
  await page.route(`**/api/routers/${protocol}/${encodeURIComponent(name)}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(data ?? defaultData),
    });
  });
}

export async function mockServices(page: Page, data?: Record<string, unknown>) {
  const defaultData = {
    http: [
      {
        name: 'api-service',
        type: 'loadBalancer',
        provider: 'file',
        status: 'enabled',
        loadBalancer: { servers: [{ url: 'http://127.0.0.1:8080' }] },
        serverStatus: { 'http://127.0.0.1:8080': 'up' },
      },
      {
        name: 'web-service',
        type: 'loadBalancer',
        provider: 'file',
        status: 'enabled',
        loadBalancer: { servers: [{ url: 'http://127.0.0.1:3000' }] },
        serverStatus: { 'http://127.0.0.1:3000': 'up' },
      },
    ],
    tcp: [
      {
        name: 'tcp-service',
        type: 'loadBalancer',
        provider: 'file',
        status: 'enabled',
        loadBalancer: { servers: [{ url: 'tcp://127.0.0.1:5432' }] },
      },
    ],
    udp: [
      {
        name: 'udp-service',
        type: 'loadBalancer',
        provider: 'file',
        status: 'enabled',
        loadBalancer: { servers: [{ url: 'udp://127.0.0.1:53' }] },
      },
    ],
  };
  await page.route('**/api/services', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(data ?? defaultData),
    });
  });
}

export async function mockServiceDetail(
  page: Page,
  protocol: string,
  name: string,
  data?: Record<string, unknown>
) {
  const defaultData = {
    service: {
      name,
      type: 'loadBalancer',
      provider: 'file',
      status: 'enabled',
      loadBalancer: { servers: [{ url: 'http://127.0.0.1:8080' }] },
      serverStatus: { 'http://127.0.0.1:8080': 'up' },
    },
  };
  await page.route(`**/api/services/${protocol}/${encodeURIComponent(name)}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(data ?? defaultData),
    });
  });
}

export async function mockMiddlewares(page: Page, data?: Record<string, unknown>) {
  const defaultData = {
    http: [
      {
        name: 'strip-prefix',
        type: 'StripPrefix',
        provider: 'file',
        status: 'enabled',
        prefixes: ['/api'],
      },
      { name: 'rate-limit', type: 'RateLimit', provider: 'file', status: 'enabled', average: 100 },
    ],
    tcp: [
      { name: 'in-flight', type: 'InFlightConn', provider: 'file', status: 'enabled', amount: 10 },
    ],
  };
  await page.route('**/api/middlewares', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(data ?? defaultData),
    });
  });
}

export async function mockMiddlewareDetail(
  page: Page,
  protocol: string,
  name: string,
  data?: Record<string, unknown>
) {
  const defaultData = {
    name,
    type: 'StripPrefix',
    provider: 'file',
    status: 'enabled',
    prefixes: ['/api'],
  };
  await page.route(`**/api/middlewares/${protocol}/${encodeURIComponent(name)}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(data ?? defaultData),
    });
  });
}

export async function mockEntrypoints(page: Page, data?: Record<string, unknown>) {
  const defaultData = {
    entrypoints: [
      { name: 'web', address: ':80' },
      { name: 'websecure', address: ':443', http3: { advertisedPort: 443 } },
    ],
  };
  await page.route('**/api/entrypoints', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(data ?? defaultData),
    });
  });
}

export async function mockTlsCertificates(page: Page, data?: Record<string, unknown>) {
  const defaultData = {
    certificates: [
      {
        domain: 'example.com',
        sans: ['www.example.com'],
        notBefore: '2024-01-01T00:00:00Z',
        notAfter: '2025-01-01T00:00:00Z',
        issuer: "Let's Encrypt",
        serialNumber: '00:01',
        isExpired: false,
      },
      {
        domain: 'expired.example.com',
        sans: [],
        notBefore: '2023-01-01T00:00:00Z',
        notAfter: '2023-12-01T00:00:00Z',
        issuer: "Let's Encrypt",
        serialNumber: '00:02',
        isExpired: true,
      },
    ],
  };
  await page.route('**/api/tls/certificates', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(data ?? defaultData),
    });
  });
}

export async function mockAccessLogs(page: Page, data?: Record<string, unknown>) {
  const defaultData = {
    lines: [
      {
        timestamp: '2024-06-01T12:00:00Z',
        clientIp: '192.168.1.1',
        method: 'GET',
        path: '/api/health',
        status: 200,
        size: 42,
        duration: 12,
      },
      {
        timestamp: '2024-06-01T12:01:00Z',
        clientIp: '192.168.1.2',
        method: 'POST',
        path: '/api/auth/login',
        status: 401,
        size: 56,
        duration: 45,
      },
    ],
    totalLines: 2,
    hasMore: false,
  };
  await page.route('**/api/logs/access?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(data ?? defaultData),
    });
  });
}

export async function mockSystemStats(page: Page, data?: Record<string, unknown>) {
  const defaultData = {
    cpu: { usagePercent: 12.5, cores: 4, model: 'Apple M1' },
    memory: { usedMB: 4096, totalMB: 16384, usedPercent: 25, freeMB: 12288 },
    uptime: 86400,
    platform: 'darwin',
    arch: 'arm64',
    bunVersion: '1.2.4',
  };
  await page.route('**/api/system/stats', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(data ?? defaultData),
    });
  });
}

export async function mockConfigFiles(
  page: Page,
  staticConfig?: Record<string, unknown>,
  dynamicConfig?: Record<string, unknown>
) {
  await page.route('**/api/configfile/static', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        staticConfig ?? {
          entryPoints: { web: { address: ':80' } },
          providers: { file: { filename: '/etc/traefik/dynamic.yml' } },
        }
      ),
    });
  });
  await page.route('**/api/configfile/dynamic', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        dynamicConfig ?? { http: { routers: {}, services: {}, middlewares: {} } }
      ),
    });
  });
}

export async function mockAdminUsers(page: Page, data?: Record<string, unknown>[]) {
  const defaultData = [
    {
      id: 1,
      username: 'admin',
      source: 'local',
      email: 'admin@example.com',
      is_active: true,
      is_admin: true,
      created_at: '2024-01-01T00:00:00Z',
      roles: [{ id: 1, name: 'super_admin' }],
    },
    {
      id: 2,
      username: 'viewer',
      source: 'local',
      email: null,
      is_active: true,
      is_admin: false,
      created_at: '2024-01-02T00:00:00Z',
      roles: [{ id: 3, name: 'viewer' }],
    },
  ];
  let currentData = [...(data ?? defaultData)];

  await page.route('**/api/admin/users', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(currentData),
    });
  });

  await page.route('**/api/admin/users/*', async (route) => {
    const method = route.request().method();
    const url = route.request().url();
    const match = url.match(/\/api\/admin\/users\/(\d+)/);
    const id = match ? parseInt(match[1], 10) : NaN;

    if (method === 'PUT') {
      let body: Record<string, unknown> = {};
      try {
        body = (await route.request().postDataJSON()) ?? {};
      } catch {
        /* ignore */
      }
      const idx = currentData.findIndex((u: any) => u.id === id);
      if (idx !== -1) {
        currentData[idx] = { ...currentData[idx], ...body };
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    } else if (method === 'DELETE') {
      currentData = currentData.filter((u: any) => u.id !== id);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    } else {
      await route.continue();
    }
  });
}

export async function mockAdminGroups(page: Page, data?: Record<string, unknown>[]) {
  const defaultData = [
    {
      id: 1,
      name: 'Admins',
      external_id: null,
      source: 'local',
      created_at: '2024-01-01T00:00:00Z',
      member_count: 2,
    },
    {
      id: 2,
      name: 'Viewers',
      external_id: null,
      source: 'local',
      created_at: '2024-01-02T00:00:00Z',
      member_count: 5,
    },
  ];
  let currentData = [...(data ?? defaultData)];

  await page.route('**/api/admin/groups', async (route) => {
    const method = route.request().method();
    if (method === 'POST') {
      let body: Record<string, unknown> = {};
      try {
        body = (await route.request().postDataJSON()) ?? {};
      } catch {
        /* ignore */
      }
      const newGroup = { id: 3, ...body, created_at: '2024-01-03T00:00:00Z' };
      currentData.push(newGroup);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(newGroup),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(currentData),
      });
    }
  });

  await page.route('**/api/admin/groups/*', async (route) => {
    const method = route.request().method();
    const url = route.request().url();
    const match = url.match(/\/api\/admin\/groups\/(\d+)/);
    const id = match ? parseInt(match[1], 10) : NaN;

    if (method === 'PUT') {
      let body: Record<string, unknown> = {};
      try {
        body = (await route.request().postDataJSON()) ?? {};
      } catch {
        /* ignore */
      }
      const idx = currentData.findIndex((g: any) => g.id === id);
      if (idx !== -1) {
        currentData[idx] = { ...currentData[idx], ...body };
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    } else if (method === 'DELETE') {
      currentData = currentData.filter((g: any) => g.id !== id);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    } else {
      await route.continue();
    }
  });
}

export async function mockAdminRoles(page: Page, data?: Record<string, unknown>[]) {
  const defaultData = [
    {
      id: 1,
      name: 'super_admin',
      description: 'Full access',
      created_at: '2024-01-01T00:00:00Z',
      permission_names: ALL_PERMISSIONS,
    },
    {
      id: 2,
      name: 'operator',
      description: 'Operator',
      created_at: '2024-01-01T00:00:00Z',
      permission_names: ['traefik.dashboard.read', 'traefik.routers.read', 'traefik.services.read'],
    },
    {
      id: 3,
      name: 'viewer',
      description: 'Read-only',
      created_at: '2024-01-01T00:00:00Z',
      permission_names: ['traefik.dashboard.read'],
    },
  ];
  let currentData = [...(data ?? defaultData)];

  await page.route('**/api/admin/roles', async (route) => {
    const method = route.request().method();
    if (method === 'POST') {
      let body: Record<string, unknown> = {};
      try {
        body = (await route.request().postDataJSON()) ?? {};
      } catch {
        /* ignore */
      }
      const newRole = {
        id: 4,
        ...body,
        permission_names: (body as any).permission_names ?? [],
        created_at: '2024-01-03T00:00:00Z',
      };
      currentData.push(newRole);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(newRole),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(currentData),
      });
    }
  });

  await page.route('**/api/admin/roles/*', async (route) => {
    const method = route.request().method();
    const url = route.request().url();
    const match = url.match(/\/api\/admin\/roles\/(\d+)/);
    const id = match ? parseInt(match[1], 10) : NaN;

    if (method === 'PUT') {
      let body: Record<string, unknown> = {};
      try {
        body = (await route.request().postDataJSON()) ?? {};
      } catch {
        /* ignore */
      }
      const idx = currentData.findIndex((r: any) => r.id === id);
      if (idx !== -1) {
        currentData[idx] = { ...currentData[idx], ...body };
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    } else if (method === 'DELETE') {
      currentData = currentData.filter((r: any) => r.id !== id);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    } else {
      await route.continue();
    }
  });
}

export async function mockAdminPermissions(page: Page, data?: Record<string, unknown>[]) {
  const defaultData = ALL_PERMISSIONS.map((name, idx) => ({
    id: idx + 1,
    name,
    description: null,
    created_at: '2024-01-01T00:00:00Z',
  }));
  await page.route('**/api/admin/permissions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(data ?? defaultData),
    });
  });
}

export async function mockAdminSsoProviders(page: Page, data?: Record<string, unknown>[]) {
  const defaultData = [
    {
      id: 1,
      name: 'Okta',
      provider_type: 'oidc',
      enabled: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
  ];
  let currentData = [...(data ?? defaultData)];

  await page.route('**/api/admin/sso-providers', async (route) => {
    const method = route.request().method();
    if (method === 'POST') {
      let body: Record<string, unknown> = {};
      try {
        body = (await route.request().postDataJSON()) ?? {};
      } catch {
        /* ignore */
      }
      const newProvider = {
        id: 2,
        ...body,
        provider_type: 'oidc',
        enabled: true,
        created_at: '2024-01-03T00:00:00Z',
        updated_at: '2024-01-03T00:00:00Z',
      };
      currentData.push(newProvider);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(newProvider),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(currentData),
      });
    }
  });

  await page.route('**/api/admin/sso-providers/*', async (route) => {
    const method = route.request().method();
    const url = route.request().url();
    const match = url.match(/\/api\/admin\/sso-providers\/(\d+)/);
    const id = match ? parseInt(match[1], 10) : NaN;

    if (method === 'PUT') {
      let body: Record<string, unknown> = {};
      try {
        body = (await route.request().postDataJSON()) ?? {};
      } catch {
        /* ignore */
      }
      const idx = currentData.findIndex((p: any) => p.id === id);
      if (idx !== -1) {
        currentData[idx] = { ...currentData[idx], ...body };
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    } else if (method === 'DELETE') {
      currentData = currentData.filter((p: any) => p.id !== id);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    } else if (method === 'GET') {
      const provider = currentData.find((p: any) => p.id === id) ?? {
        id: 1,
        name: 'Okta',
        provider_type: 'oidc',
        enabled: true,
        config: {
          issuerUrl: 'https://okta.example.com',
          clientId: 'client-id',
          scopes: ['openid', 'profile', 'email'],
          groupClaim: 'groups',
          roleMappings: {},
        },
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(provider),
      });
    } else {
      await route.continue();
    }
  });
}

export const test = base.extend<{ login: () => Promise<void> }>({
  login: async ({ page }, use) => {
    await use(async () => {
      await mockAuth(page);
    });
  },
});

export { expect } from '@playwright/test';
