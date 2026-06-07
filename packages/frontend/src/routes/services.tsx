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
import { getServices, getService } from '@/lib/api';

interface Service {
  name: string;
  type: string;
  provider: string;
  status: string;
  loadBalancer?: {
    servers: { url: string }[];
  };
  serverStatus?: Record<string, string>;
}

interface ServicesResponse {
  http: Service[];
  tcp: Service[];
  udp: Service[];
}

interface ServiceDetail {
  service: Service;
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

function ServiceDetailDialog({
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
  const { data: detailData, isLoading } = useQuery<ServiceDetail>({
    queryKey: ['service', protocol, name],
    queryFn: () => getService(protocol, name) as unknown as Promise<ServiceDetail>,
    enabled: open && !!name,
  });

  const data = detailData;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {name}
            {data?.service && renderStatusBadge(data.service.status)}
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        ) : data?.service ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Type</p>
                <p className="text-sm">{data.service.type || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Provider</p>
                <p className="text-sm">{data.service.provider || '-'}</p>
              </div>
            </div>

            {data.service.loadBalancer?.servers && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Servers</p>
                <div className="space-y-1">
                  {data.service.loadBalancer.servers.map((s) => (
                    <div
                      key={s.url}
                      className="flex items-center justify-between p-2 bg-muted rounded text-sm"
                    >
                      <span className="font-mono text-xs">{s.url}</span>
                      {data.service.serverStatus?.[s.url] &&
                        renderStatusBadge(data.service.serverStatus?.[s.url])}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function ServicesPage() {
  const [activeTab, setActiveTab] = useState<'http' | 'tcp' | 'udp'>('http');
  const [selectedService, setSelectedService] = useState<{
    protocol: string;
    name: string;
  } | null>(null);

  const { data: servicesData, isLoading } = useQuery<ServicesResponse>({
    queryKey: ['services'],
    queryFn: () => getServices() as Promise<ServicesResponse>,
  });

  const columns: Column<Service>[] = [
    { key: 'name', header: 'Name' },
    { key: 'type', header: 'Type' },
    {
      key: 'loadBalancer',
      header: 'Servers',
      render: (row) =>
        row.loadBalancer?.servers?.length ? (
          <span className="font-mono text-xs">
            {row.loadBalancer.servers.map((s) => s.url).join(', ')}
          </span>
        ) : (
          '-'
        ),
    },
    {
      key: 'provider',
      header: 'Provider',
      render: (row) => <Badge variant="secondary">{String(row.provider)}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => renderStatusBadge(row.status),
    },
  ];

  const services = servicesData?.[activeTab] || [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Services</h1>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="http">
              HTTP <span className="ml-1 text-xs text-muted-foreground">({servicesData?.http.length || 0})</span>
            </TabsTrigger>
            <TabsTrigger value="tcp">
              TCP <span className="ml-1 text-xs text-muted-foreground">({servicesData?.tcp.length || 0})</span>
            </TabsTrigger>
            <TabsTrigger value="udp">
              UDP <span className="ml-1 text-xs text-muted-foreground">({servicesData?.udp.length || 0})</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="http">
          <DataGrid
            data={services}
            columns={columns}
            isLoading={isLoading}
            onRowClick={(row) => setSelectedService({ protocol: 'http', name: row.name })}
          />
        </TabsContent>
        <TabsContent value="tcp">
          <DataGrid
            data={services}
            columns={columns}
            isLoading={isLoading}
            onRowClick={(row) => setSelectedService({ protocol: 'tcp', name: row.name })}
          />
        </TabsContent>
        <TabsContent value="udp">
          <DataGrid
            data={services}
            columns={columns}
            isLoading={isLoading}
            onRowClick={(row) => setSelectedService({ protocol: 'udp', name: row.name })}
          />
        </TabsContent>
      </Tabs>

      {selectedService && (
        <ServiceDetailDialog
          protocol={selectedService.protocol}
          name={selectedService.name}
          open={!!selectedService}
          onOpenChange={(open) => !open && setSelectedService(null)}
        />
      )}
    </div>
  );
}
