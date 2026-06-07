import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Settings, FileText } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getStaticConfig, getDynamicConfig } from '@/lib/api';

function ConfigViewer({ data, isLoading }: { data?: Record<string, unknown>; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-full" />
      </div>
    );
  }

  return (
    <pre className="bg-muted p-4 rounded-lg overflow-auto text-xs font-mono max-h-[500px]">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

export function ConfigfilePage() {
  const [activeTab, setActiveTab] = useState<'static' | 'dynamic'>('dynamic');

  const {
    data: staticConfig,
    isLoading: isStaticLoading,
    isError: isStaticError,
    error: staticError,
  } = useQuery({
    queryKey: ['config', 'static'],
    queryFn: () => getStaticConfig() as Promise<Record<string, unknown>>,
    enabled: activeTab === 'static',
  });

  const {
    data: dynamicConfig,
    isLoading: isDynamicLoading,
    isError: isDynamicError,
    error: dynamicError,
  } = useQuery({
    queryKey: ['config', 'dynamic'],
    queryFn: () => getDynamicConfig() as Promise<Record<string, unknown>>,
    enabled: activeTab === 'dynamic',
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Configuration</h1>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">
            {activeTab === 'dynamic'
              ? 'Dynamic configuration (routers, services, middlewares). Changes are picked up automatically by file watcher.'
              : 'Static configuration (entryPoints, providers, certificates). May require Traefik restart to apply.'}
          </CardTitle>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="dynamic">
            <Settings className="h-4 w-4 mr-1" />
            Dynamic
          </TabsTrigger>
          <TabsTrigger value="static">
            <FileText className="h-4 w-4 mr-1" />
            Static
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dynamic" className="mt-4">
          {isDynamicError ? (
            <Card>
              <CardContent className="text-center py-12 text-destructive">
                Failed to load dynamic config:{' '}
                {dynamicError instanceof Error ? dynamicError.message : 'Unknown error'}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-4">
                <ConfigViewer data={dynamicConfig} isLoading={isDynamicLoading} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="static" className="mt-4">
          {isStaticError ? (
            <Card>
              <CardContent className="text-center py-12 text-destructive">
                Failed to load static config:{' '}
                {staticError instanceof Error ? staticError.message : 'Unknown error'}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-4">
                <ConfigViewer data={staticConfig} isLoading={isStaticLoading} />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
