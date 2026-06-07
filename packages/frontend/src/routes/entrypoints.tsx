import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getEntrypoints } from '@/lib/api';

interface Entrypoint {
  name: string;
  address: string;
  proxyProtocol?: {
    insecure: boolean;
  };
  forwardedHeaders?: {
    insecure: boolean;
  };
  http3?: {
    advertisedPort: number;
  };
  transport?: {
    respondingTimeouts?: {
      readTimeout?: string;
    };
  };
}

interface EntrypointsResponse {
  entrypoints: Entrypoint[];
}

function EntrypointCard({ entrypoint }: { entrypoint: Entrypoint }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span>{entrypoint.name}</span>
          <Badge variant="default">Active</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Address</span>
          <span className="font-mono text-xs">{entrypoint.address || '-'}</span>
        </div>
        {entrypoint.proxyProtocol && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Proxy Protocol</span>
            <span>{entrypoint.proxyProtocol.insecure ? 'Insecure' : 'Secure'}</span>
          </div>
        )}
        {entrypoint.forwardedHeaders && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Forwarded Headers</span>
            <span>{entrypoint.forwardedHeaders.insecure ? 'Insecure' : 'Trusted'}</span>
          </div>
        )}
        {entrypoint.http3 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">HTTP/3</span>
            <Badge variant="outline">Port {entrypoint.http3.advertisedPort || 'N/A'}</Badge>
          </div>
        )}
        {entrypoint.transport?.respondingTimeouts?.readTimeout && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Read Timeout</span>
            <span>{entrypoint.transport.respondingTimeouts.readTimeout}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function EntrypointsPage() {
  const { data: entrypointsData, isLoading, isError, error } = useQuery<EntrypointsResponse>({
    queryKey: ['entrypoints'],
    queryFn: () => getEntrypoints() as Promise<EntrypointsResponse>,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Entrypoints</h1>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
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
        Failed to load entrypoints: {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    );
  }

  const entrypoints = entrypointsData?.entrypoints || [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Entrypoints</h1>

      {entrypoints.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">
            No entrypoints configured
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {entrypoints.map((ep) => (
            <EntrypointCard key={ep.name} entrypoint={ep} />
          ))}
        </div>
      )}
    </div>
  );
}
