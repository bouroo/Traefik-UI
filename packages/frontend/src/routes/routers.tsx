import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataGrid, Column } from '@/components/data-grid';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getRouters, getRouter } from '@/lib/api';

interface Router {
  name: string;
  rule: string;
  service: string;
  entryPoints: string[];
  provider: string;
  status: string;
  tls?: boolean;
  priority?: number;
}

interface RoutersResponse {
  http: Router[];
  tcp: Router[];
  udp: Router[];
}

interface RouterDetail {
  router: Router;
  service?: {
    name: string;
    type: string;
    status: string;
    loadBalancer?: {
      servers: { url: string }[];
    };
    serverStatus?: Record<string, string>;
  };
  middlewares?: { name: string }[];
}

function renderStatusBadge(status: string | undefined) {
  if (!status) return <Badge variant="secondary">Unknown</Badge>;
  const s = status.toLowerCase();
  if (s === 'enabled' || s === 'ok' || s === 'up' || s === 'success') {
    return <Badge variant="default">{status}</Badge>;
  }
  if (s === 'disabled' || s === 'warning') {
    return <Badge variant="secondary">{status}</Badge>;
  }
  if (s === 'error') {
    return <Badge variant="destructive">{status}</Badge>;
  }
  return <Badge variant="outline">{status}</Badge>;
}

function RouterDetailDialog({
  protocol,
  name,
  open,
  onOpenChange,
}: {
  protocol: string;
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: detailData, isLoading } = useQuery<RouterDetail>({
    queryKey: ['router', protocol, name],
    queryFn: () => getRouter(protocol, name) as unknown as Promise<RouterDetail>,
    enabled: open && !!name,
  });

  const data = detailData;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {name}
            {data?.router && renderStatusBadge(data.router.status)}
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        ) : data?.router ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Rule</p>
                <p className="font-mono text-sm bg-muted p-2 rounded">
                  {data.router.rule || '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Service</p>
                <p className="text-sm">{data.router.service || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">EntryPoints</p>
                <div className="flex flex-wrap gap-1">
                  {data.router.entryPoints?.length ? (
                    data.router.entryPoints.map((ep) => (
                      <Badge key={ep} variant="secondary">
                        {ep}
                      </Badge>
                    ))
                  ) : (
                    '-'
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Priority</p>
                <p className="text-sm">{data.router.priority ?? 0}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Provider</p>
                <p className="text-sm">{data.router.provider || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">TLS</p>
                <p className="text-sm">{data.router.tls ? 'Enabled' : 'Disabled'}</p>
              </div>
            </div>

            {data.middlewares && data.middlewares.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Middlewares</p>
                <div className="flex flex-wrap gap-1">
                  {data.middlewares.map((m) => (
                    <Badge key={m.name} variant="outline">
                      {m.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {data.service && (
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold mb-3">
                  Associated Service: {data.service.name}
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Type</p>
                    <p className="text-sm">{data.service.type || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Status</p>
                    {renderStatusBadge(data.service.status)}
                  </div>
                </div>
                {data.service.loadBalancer?.servers && (
                  <div className="mt-4">
                    <p className="text-xs text-muted-foreground mb-2">Servers</p>
                    <div className="space-y-1">
                      {data.service.loadBalancer.servers.map((s) => {
                        const service = data.service!;
                        return (
                        <div
                          key={s.url}
                          className="flex items-center justify-between p-2 bg-muted rounded text-sm"
                        >
                          <span className="font-mono text-xs">{s.url}</span>
                          {service.serverStatus?.[s.url] &&
                            renderStatusBadge(service.serverStatus?.[s.url])}
                        </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function RoutersPage() {
  const [activeTab, setActiveTab] = useState<'http' | 'tcp' | 'udp'>('http');
  const [selectedRouter, setSelectedRouter] = useState<{
    protocol: string;
    name: string;
  } | null>(null);

  const { data: routersData, isLoading } = useQuery<RoutersResponse>({
    queryKey: ['routers'],
    queryFn: () => getRouters() as Promise<RoutersResponse>,
  });

  const columns: Column<Router>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <span className="font-medium">
          {row.name}
          {row.tls && (
            <Badge variant="outline" className="ml-2 text-xs">
              TLS
            </Badge>
          )}
        </span>
      ),
    },
    {
      key: 'rule',
      header: 'Rule',
      render: (row) => (
        <span className="font-mono text-xs max-w-xs truncate block">
          {row.rule || '-'}
        </span>
      ),
    },
    { key: 'service', header: 'Service' },
    { key: 'provider', header: 'Provider', render: (row) => <Badge variant="secondary">{String(row.provider)}</Badge> },
    { key: 'status', header: 'Status', render: (row) => renderStatusBadge(row.status) },
  ];

  const routers = routersData?.[activeTab] || [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Routers</h1>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="http">
              HTTP <span className="ml-1 text-xs text-muted-foreground">({routersData?.http.length || 0})</span>
            </TabsTrigger>
            <TabsTrigger value="tcp">
              TCP <span className="ml-1 text-xs text-muted-foreground">({routersData?.tcp.length || 0})</span>
            </TabsTrigger>
            <TabsTrigger value="udp">
              UDP <span className="ml-1 text-xs text-muted-foreground">({routersData?.udp.length || 0})</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="http">
          <DataGrid
            data={routers}
            columns={columns}
            isLoading={isLoading}
            onRowClick={(row) => setSelectedRouter({ protocol: 'http', name: row.name })}
          />
        </TabsContent>
        <TabsContent value="tcp">
          <DataGrid
            data={routers}
            columns={columns}
            isLoading={isLoading}
            onRowClick={(row) => setSelectedRouter({ protocol: 'tcp', name: row.name })}
          />
        </TabsContent>
        <TabsContent value="udp">
          <DataGrid
            data={routers}
            columns={columns}
            isLoading={isLoading}
            onRowClick={(row) => setSelectedRouter({ protocol: 'udp', name: row.name })}
          />
        </TabsContent>
      </Tabs>

      {selectedRouter && (
        <RouterDetailDialog
          protocol={selectedRouter.protocol}
          name={selectedRouter.name}
          open={!!selectedRouter}
          onOpenChange={(open) => !open && setSelectedRouter(null)}
        />
      )}
    </div>
  );
}
