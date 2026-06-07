import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataGrid, Column } from '@/components/data-grid';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getAccessLogs } from '@/lib/api';

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

function renderStatusBadge(status: number | undefined) {
  if (!status) return <Badge variant="secondary">-</Badge>;
  if (status >= 200 && status < 300) return <Badge variant="default">{status}</Badge>;
  if (status >= 400 && status < 500) return <Badge variant="secondary">{status}</Badge>;
  if (status >= 500) return <Badge variant="destructive">{status}</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

const LOG_LINES_INITIAL = 100;

export function LogsPage() {
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState('');
  const [appliedFilter, setAppliedFilter] = useState('');

  const { data: logsData, isLoading, isError, error, refetch } = useQuery<LogsResponse>({
    queryKey: ['logs', appliedFilter, offset],
    queryFn: () => getAccessLogs(LOG_LINES_INITIAL, offset, appliedFilter) as Promise<LogsResponse>,
    refetchInterval: false,
  });

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0);
    setAppliedFilter(filter);
  };

  const handleLoadMore = () => {
    setOffset((prev) => prev + LOG_LINES_INITIAL);
  };

  const handleRefresh = () => {
    setOffset(0);
    refetch();
  };

  const columns: Column<AccessLogLine>[] = [
    {
      key: 'timestamp',
      header: 'Time',
      render: (row) => (
        <span className="text-xs whitespace-nowrap">{row.timestamp || '-'}</span>
      ),
    },
    {
      key: 'clientIp',
      header: 'Client IP',
      render: (row) => (
        <span className="font-mono text-xs">{row.clientIp || '-'}</span>
      ),
    },
    {
      key: 'method',
      header: 'Method',
      render: (row) => <Badge variant="outline">{row.method || '-'}</Badge>,
    },
    {
      key: 'path',
      header: 'Path',
      render: (row) => (
        <span className="font-mono text-xs max-w-xs truncate block">
          {row.path || '-'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => renderStatusBadge(row.status),
    },
    {
      key: 'duration',
      header: 'Duration',
      render: (row) => (
        <span className="text-xs">{row.duration ? `${row.duration}ms` : '-'}</span>
      ),
    },
  ];

  const filteredLines = logsData?.lines || [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Access Logs</h1>

      <div className="flex items-center justify-between gap-4">
        <form onSubmit={handleFilterSubmit} className="flex gap-2 flex-1 max-w-md">
          <Input
            placeholder="Filter by client IP..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" variant="secondary">
            Filter
          </Button>
        </form>
        <Button variant="outline" onClick={handleRefresh}>
          Refresh
        </Button>
      </div>

      {isLoading && offset === 0 ? (
        <Card>
          <CardContent className="p-0">
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : isError ? (
        <Card>
          <CardContent className="text-center py-12 text-destructive">
            Failed to load logs: {error instanceof Error ? error.message : 'Unknown error'}
          </CardContent>
        </Card>
      ) : filteredLines.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground">No log entries found</p>
            <p className="text-sm text-muted-foreground mt-1">
              Configure access log path in Traefik-UI settings
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <DataGrid data={filteredLines} columns={columns} />
          {logsData?.hasMore && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={handleLoadMore}>
                Load more
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground text-center">
            Showing {filteredLines.length} entries
            {logsData?.totalLines ? ` of ${logsData.totalLines} total` : ''}
          </p>
        </>
      )}
    </div>
  );
}
