import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { getDashboard } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { ShieldAlert } from 'lucide-react';

const PROTOCOL_COLORS: Record<string, string> = {
  http: '#3b82f6',
  tcp: '#22c55e',
  udp: '#f59e0b',
};

interface ProviderStats {
  routers?: number;
  services?: number;
  middlewares?: number;
}

interface DashboardData {
  overview: {
    http: Record<string, ProviderStats>;
    tcp: Record<string, ProviderStats>;
    udp: Record<string, ProviderStats>;
    features: {
      tracing: string;
      metrics: string;
      accessLog: boolean;
    };
    providers: string[];
  };
  version: {
    version: string;
    codename: string;
    startDate: string;
    uptime: string;
  };
  entrypoints: Array<{ name: string; address?: string }>;
  connectionStatus: 'connected' | 'disconnected';
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-32" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  subtext,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  subtext?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <p className="text-2xl font-bold">{value}</p>
          {icon}
        </div>
        {subtext && <p className="text-xs text-muted-foreground mt-1">{subtext}</p>}
      </CardContent>
    </Card>
  );
}

function AccessDeniedCard() {
  return (
    <Card className="flex flex-col items-center justify-center py-12 text-center">
      <CardContent>
        <ShieldAlert className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p className="text-muted-foreground mb-4">
          You do not have permission to view the dashboard.
        </p>
        <p className="text-sm text-muted-foreground">
          Contact your administrator if you believe this is an error.
        </p>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const { hasPermission } = useAuth();
  const canViewDashboard = hasPermission('traefik.dashboard.read');

  const { data, isLoading, isError, error } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => getDashboard() as Promise<DashboardData>,
    enabled: canViewDashboard,
    retry: (failureCount, err) => {
      if (err instanceof Error && err.message.includes('Access denied')) {
        return false;
      }
      return failureCount < 2;
    },
  });

  if (!canViewDashboard) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <AccessDeniedCard />
      </div>
    );
  }

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
        Failed to load dashboard: {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    );
  }

  const overview = data?.overview || { http: {}, tcp: {}, udp: {}, features: {}, providers: [] };
  const version = data?.version || { version: '', codename: '', uptime: '' };
  const entrypoints = data?.entrypoints || [];

  let httpRouters = 0,
    httpServices = 0,
    httpMiddlewares = 0;
  let tcpRouters = 0,
    tcpServices = 0,
    tcpMiddlewares = 0;
  let udpRouters = 0,
    udpServices = 0;

  Object.values(overview.http || {}).forEach((v) => {
    const stats = v as ProviderStats;
    httpRouters += stats.routers || 0;
    httpServices += stats.services || 0;
    httpMiddlewares += stats.middlewares || 0;
  });
  Object.values(overview.tcp || {}).forEach((v) => {
    const stats = v as ProviderStats;
    tcpRouters += stats.routers || 0;
    tcpServices += stats.services || 0;
    tcpMiddlewares += stats.middlewares || 0;
  });
  Object.values(overview.udp || {}).forEach((v) => {
    const stats = v as ProviderStats;
    udpRouters += stats.routers || 0;
    udpServices += stats.services || 0;
  });

  const totalRouters = httpRouters + tcpRouters + udpRouters;
  const totalServices = httpServices + tcpServices + udpServices;
  const totalMiddlewares = httpMiddlewares + tcpMiddlewares;

  const chartData = [
    { name: 'HTTP', routers: httpRouters, color: PROTOCOL_COLORS.http },
    { name: 'TCP', routers: tcpRouters, color: PROTOCOL_COLORS.tcp },
    { name: 'UDP', routers: udpRouters, color: PROTOCOL_COLORS.udp },
  ].filter((d) => d.routers > 0);

  const providerStatsData = (
    ['http', 'tcp', 'udp'] as const
  ).flatMap((protocol) => {
    const providers = overview[protocol];
    if (!providers) return [];
    return Object.entries(providers).map(([provider, stats]) => ({
      provider,
      protocol: protocol.toUpperCase(),
      routers: stats.routers || 0,
      services: stats.services || 0,
      middlewares: (stats as { middlewares?: number }).middlewares || 0,
    }));
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {data?.connectionStatus !== 'connected' && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg">
          <span className="text-yellow-700 dark:text-yellow-300">
            Traefik API is not reachable. Some features may be unavailable.
          </span>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="HTTP Routers"
          value={httpRouters}
          icon={<div className="w-8 h-8 rounded bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400">R</div>}
          subtext={`Total: ${totalRouters}`}
        />
        <StatCard
          title="Services"
          value={totalServices}
          icon={<div className="w-8 h-8 rounded bg-green-100 dark:bg-green-900/50 flex items-center justify-center text-green-600 dark:text-green-400">S</div>}
          subtext={`HTTP: ${httpServices} | TCP: ${tcpServices} | UDP: ${udpServices}`}
        />
        <StatCard
          title="Middlewares"
          value={totalMiddlewares}
          icon={<div className="w-8 h-8 rounded bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center text-purple-600 dark:text-purple-400">M</div>}
          subtext={`HTTP: ${httpMiddlewares} | TCP: ${tcpMiddlewares}`}
        />
        <StatCard
          title="Entrypoints"
          value={entrypoints.length}
          icon={<div className="w-8 h-8 rounded bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center text-orange-600 dark:text-orange-400">E</div>}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Traefik Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Version</span>
              <span className="text-sm font-mono">{version.version || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Codename</span>
              <span className="text-sm">{version.codename || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Uptime</span>
              <span className="text-sm">{version.uptime || 'N/A'}</span>
            </div>
            {overview.providers && overview.providers.length > 0 && (
              <div className="pt-2">
                <p className="text-xs font-medium text-muted-foreground mb-2">Providers</p>
                <div className="flex flex-wrap gap-1">
                  {overview.providers.map((p) => (
                    <Badge key={p} variant="secondary">
                      {p}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Routers by Protocol
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={chartData} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={40} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--background)',
                      border: '1px solid var(--border)',
                      borderRadius: '0.5rem',
                    }}
                  />
                  <Bar dataKey="routers" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No router data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {providerStatsData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Resources by Provider
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="text-left py-2 px-2">Provider</th>
                    <th className="text-left py-2 px-2">Protocol</th>
                    <th className="text-right py-2 px-2">Routers</th>
                    <th className="text-right py-2 px-2">Services</th>
                    <th className="text-right py-2 px-2">Middlewares</th>
                  </tr>
                </thead>
                <tbody>
                  {providerStatsData.map((row) => (
                    <tr key={`${row.provider}-${row.protocol}`} className="border-t">
                      <td className="py-2 px-2 font-medium">{row.provider}</td>
                      <td className="py-2 px-2">
                        <Badge variant="outline">{row.protocol}</Badge>
                      </td>
                      <td className="py-2 px-2 text-right">{row.routers}</td>
                      <td className="py-2 px-2 text-right">{row.services}</td>
                      <td className="py-2 px-2 text-right">{row.middlewares}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}