import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardPage } from '../dashboard';

vi.mock('@/lib/api', () => ({
  getDashboard: vi.fn(),
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    hasPermission: (perm: string) => perm === 'traefik.dashboard.read',
  }),
}));

import { getDashboard } from '@/lib/api';

const mockGetDashboard = vi.mocked(getDashboard);

const REAL_OVERVIEW = {
  http: {
    routers: { total: 7, warnings: 0, errors: 1 },
    services: { total: 9, warnings: 0, errors: 0 },
    middlewares: { total: 9, warnings: 0, errors: 0 },
  },
  tcp: {
    routers: { total: 2, warnings: 0, errors: 0 },
    services: { total: 2, warnings: 0, errors: 0 },
    middlewares: { total: 0, warnings: 0, errors: 0 },
  },
  udp: {
    routers: { total: 2, warnings: 0, errors: 0 },
    services: { total: 2, warnings: 0, errors: 0 },
  },
  features: { tracing: '', metrics: '', accessLog: true },
  providers: ['File'],
};

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardPage />
    </QueryClientProvider>,
  );
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDashboard.mockResolvedValue({
      overview: REAL_OVERVIEW,
      version: {
        version: '3.7.6',
        codename: 'traefik',
        startDate: '2026-06-30T00:00:00Z',
        uptime: '1d',
      },
      entrypoints: [{ name: 'web', address: ':80' }],
      connectionStatus: 'connected',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders HTTP Routers total from overview.http.routers.total', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('HTTP Routers')).toBeInTheDocument();
    });
    const httpRoutersValue = screen.getByText('7', { selector: 'p.text-2xl' });
    expect(httpRoutersValue).toBeInTheDocument();
  });

  it('renders Services total summed across all protocols (9+2+2=13)', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Services', { selector: 'h3' })).toBeInTheDocument();
    });
    const servicesValue = screen.getByText('13', { selector: 'p.text-2xl' });
    expect(servicesValue).toBeInTheDocument();
  });

  it('renders Middlewares total (http 9 + tcp 0 = 9)', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Middlewares', { selector: 'h3' })).toBeInTheDocument();
    });
    const middlewaresValue = screen.getByText('9', { selector: 'p.text-2xl' });
    expect(middlewaresValue).toBeInTheDocument();
  });

  it('renders Routers by Protocol chart and not the "No router data" fallback', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Routers by Protocol')).toBeInTheDocument();
    });
    expect(screen.queryByText('No router data')).not.toBeInTheDocument();
  });

  it('renders Resources by Protocol table with HTTP, TCP, UDP rows', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Resources by Protocol')).toBeInTheDocument();
    });
    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();

    for (const proto of ['HTTP', 'TCP', 'UDP']) {
      expect(within(table).getByText(proto)).toBeInTheDocument();
    }
  });

  it('renders the Providers badge list from overview.providers', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Providers')).toBeInTheDocument();
    });
    expect(screen.getByText('File')).toBeInTheDocument();
  });
});
