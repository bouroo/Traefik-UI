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
        body: JSON.stringify({
          user,
          permissions,
        }),
      });
    } else {
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Unauthorized' }) });
    }
  });

  await page.route('**/api/auth/logout', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });

  await page.addInitScript((storage) => {
    localStorage.setItem('traefik_ui_token', storage.token);
  }, { token });
}

export async function mockSsoProviders(page: Page, providers: { id: number; name: string; provider_type: string }[] = []) {
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
    version: { version: '3.0.0', codename: 'Baguette', startDate: '2024-01-01', uptime: '1d 2h 3m' },
    entrypoints: [{ name: 'web', address: ':80' }, { name: 'websecure', address: ':443' }],
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
      { name: 'http-router-1', rule: 'PathPrefix(`/api`)', service: 'api-service', entryPoints: ['web'], provider: 'file', status: 'enabled', tls: false, priority: 0 },
      { name: 'http-router-2', rule: 'Host(`example.com`)', service: 'web-service', entryPoints: ['web'], provider: 'file', status: 'enabled', tls: true, priority: 0 },
    ],
    tcp: [
      { name: 'tcp-router-1', rule: 'HostSNI(`tcp.example.com`)', service: 'tcp-service', entryPoints: ['tcp'], provider: 'file', status: 'enabled', tls: true, priority: 0 },
    ],
    udp: [
      { name: 'udp-router-1', rule: 'UDPRule', service: 'udp-service', entryPoints: ['udp'], provider: 'file', status: 'enabled', priority: 0 },
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

export const test = base.extend<{ login: () => Promise<void> }>({
  login: async ({ page }, use) => {
    await use(async () => {
      await mockAuth(page);
    });
  },
});

export { expect } from '@playwright/test';