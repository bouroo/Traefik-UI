import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getMiddlewares, getMiddleware } from '@/lib/api';

interface Middleware {
  name: string;
  type: string;
  provider: string;
  status: string;
  [key: string]: unknown;
}

interface MiddlewaresResponse {
  http: Middleware[];
  tcp: Middleware[];
}

interface MiddlewareDetail {
  name: string;
  type: string;
  provider: string;
  status: string;
  [key: string]: unknown;
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

function MiddlewareDetailDialog({
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
  const { data: detailData, isLoading } = useQuery<MiddlewareDetail>({
    queryKey: ['middleware', protocol, name],
    queryFn: () => getMiddleware(protocol, name) as Promise<MiddlewareDetail>,
    enabled: open && !!name,
  });

  const data = detailData;

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Loading...</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const config = data ? (({ name: _, type: __, provider: ___, status: ____, ...rest }) => rest)(data) : {};
  const configEntries = Object.entries(config);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {name}
            {data && renderStatusBadge(data.status)}
          </DialogTitle>
        </DialogHeader>
        {data && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Type</p>
                <Badge variant="outline">{data.type || '-'}</Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Provider</p>
                <p className="text-sm">{data.provider || '-'}</p>
              </div>
            </div>

            {configEntries.length > 0 && (
              <div className="border-t pt-4">
                <p className="text-xs text-muted-foreground mb-2">Configuration</p>
                <dl className="space-y-1">
                  {configEntries.map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <dt className="text-muted-foreground">{key}</dt>
                      <dd className="font-mono text-xs">
                        {typeof value === 'object'
                          ? JSON.stringify(value)
                          : String(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function MiddlewaresPage() {
  const [activeTab, setActiveTab] = useState<'http' | 'tcp'>('http');
  const [selectedMiddleware, setSelectedMiddleware] = useState<{
    protocol: string;
    name: string;
  } | null>(null);

  const { data: middlewaresData, isLoading } = useQuery<MiddlewaresResponse>({
    queryKey: ['middlewares'],
    queryFn: () => getMiddlewares() as Promise<MiddlewaresResponse>,
  });

  const middlewares = middlewaresData?.[activeTab] || [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Middlewares</h1>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="http">
              HTTP <span className="ml-1 text-xs text-muted-foreground">({middlewaresData?.http.length || 0})</span>
            </TabsTrigger>
            <TabsTrigger value="tcp">
              TCP <span className="ml-1 text-xs text-muted-foreground">({middlewaresData?.tcp.length || 0})</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="http">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <Skeleton className="h-4 w-24" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-4 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : middlewares.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12 text-muted-foreground">
                No HTTP middlewares configured
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {middlewares.map((m) => (
                <Card
                  key={m.name}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() =>
                    setSelectedMiddleware({ protocol: 'http', name: m.name })
                  }
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span className="truncate">{m.name}</span>
                      {renderStatusBadge(m.status)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Type</span>
                      <Badge variant="secondary">{m.type || 'Unknown'}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Provider</span>
                      <span>{m.provider || '-'}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tcp">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2].map((i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <Skeleton className="h-4 w-24" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-4 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : middlewares.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12 text-muted-foreground">
                No TCP middlewares configured
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {middlewares.map((m) => (
                <Card
                  key={m.name}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() =>
                    setSelectedMiddleware({ protocol: 'tcp', name: m.name })
                  }
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span className="truncate">{m.name}</span>
                      {renderStatusBadge(m.status)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Type</span>
                      <Badge variant="secondary">{m.type || 'Unknown'}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Provider</span>
                      <span>{m.provider || '-'}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {selectedMiddleware && (
        <MiddlewareDetailDialog
          protocol={selectedMiddleware.protocol}
          name={selectedMiddleware.name}
          open={!!selectedMiddleware}
          onOpenChange={(open) => !open && setSelectedMiddleware(null)}
        />
      )}
    </div>
  );
}
