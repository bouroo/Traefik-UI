import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { getSystemStats } from '@/lib/api';
import { formatUptime, formatBytes } from '@/lib/utils';

interface SystemStats {
  cpu: { usagePercent: number; cores: number; model: string };
  memory: { usedMB: number; totalMB: number; usedPercent: number; freeMB: number };
  uptime: number;
  platform: string;
  arch: string;
  bunVersion: string;
}

const MEMORY_COLORS = ['#3b82f6', '#e2e8f0'];

export function SystemPage() {
  const { data, isLoading, isError, error } = useQuery<SystemStats>({
    queryKey: ['system', 'stats'],
    queryFn: getSystemStats,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">System</h1>
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

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
        Failed to load system stats: {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    );
  }

  const memoryChartData = data
    ? [
        { name: 'Used', value: data.memory.usedMB },
        { name: 'Free', value: data.memory.freeMB },
      ]
    : [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">System</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              CPU Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold">{data?.cpu.usagePercent.toFixed(1)}%</p>
              <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/50 flex items-center justify-center text-red-600 dark:text-red-400">
                C
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {data?.cpu.cores} cores{data?.cpu.model ? ` · ${data.cpu.model}` : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Memory
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold">{data?.memory.usedPercent.toFixed(1)}%</p>
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                M
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatBytes((data?.memory.usedMB || 0) * 1024 * 1024)} /{' '}
              {formatBytes((data?.memory.totalMB || 0) * 1024 * 1024)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Uptime
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold">{formatUptime(data?.uptime || 0)}</p>
              <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/50 flex items-center justify-center text-green-600 dark:text-green-400">
                U
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Platform
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold">{data?.platform || 'N/A'}</p>
              <div className="w-10 h-10 rounded-lg bg-yellow-100 dark:bg-yellow-900/50 flex items-center justify-center text-yellow-600 dark:text-yellow-400">
                P
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{data?.arch}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Memory Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full bg-muted rounded-full h-4">
              <div
                className="bg-blue-600 h-4 rounded-full transition-all duration-500"
                style={{ width: `${data?.memory.usedPercent || 0}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>
                Used: {formatBytes((data?.memory.usedMB || 0) * 1024 * 1024)}
              </span>
              <span>
                Free: {formatBytes((data?.memory.freeMB || 0) * 1024 * 1024)}
              </span>
              <span>
                Total: {formatBytes((data?.memory.totalMB || 0) * 1024 * 1024)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Memory Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={150}>
              <PieChart>
                <Pie
                  data={memoryChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={60}
                  dataKey="value"
                >
                  {memoryChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={MEMORY_COLORS[index % MEMORY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => formatBytes(value * 1024 * 1024)}
                  contentStyle={{
                    backgroundColor: 'var(--background)',
                    border: '1px solid var(--border)',
                    borderRadius: '0.5rem',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-blue-600" /> Used
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600" /> Free
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            System Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Platform</p>
              <p className="font-medium">{data?.platform || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Architecture</p>
              <p className="font-medium">{data?.arch || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Bun Version</p>
              <p className="font-medium">{data?.bunVersion || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Uptime</p>
              <p className="font-medium">{formatUptime(data?.uptime || 0)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
