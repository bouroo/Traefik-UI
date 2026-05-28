import { useQuery } from '@tanstack/react-query';
import { DataGrid, Column } from '@/components/data-grid';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { getTlsCertificates } from '@/lib/api';

interface Certificate {
  domain: string;
  sans: string[];
  notBefore: string | null;
  notAfter: string | null;
  issuer: string | null;
  serialNumber: string | null;
  isExpired: boolean;
}

interface CertificatesResponse {
  certificates: Certificate[];
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString();
}

export function TlsPage() {
  const { data: certsData, isLoading, isError, error } = useQuery<CertificatesResponse>({
    queryKey: ['certificates'],
    queryFn: () => getTlsCertificates() as Promise<CertificatesResponse>,
  });

  const columns: Column<Certificate>[] = [
    { key: 'domain', header: 'Domain' },
    {
      key: 'sans',
      header: 'SANs',
      render: (row) =>
        row.sans?.length ? (
          <span className="text-xs text-muted-foreground max-w-xs truncate block">
            {row.sans.join(', ')}
          </span>
        ) : (
          '-'
        ),
    },
    {
      key: 'notBefore',
      header: 'Not Before',
      render: (row) => <span className="text-xs">{formatDate(row.notBefore)}</span>,
    },
    {
      key: 'notAfter',
      header: 'Not After',
      render: (row) => <span className="text-xs">{formatDate(row.notAfter)}</span>,
    },
    { key: 'issuer', header: 'Issuer' },
    {
      key: 'isExpired',
      header: 'Status',
      render: (row) =>
        row.isExpired ? (
          <Badge variant="destructive">Expired</Badge>
        ) : (
          <Badge variant="default">Valid</Badge>
        ),
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">TLS Certificates</h1>
        <div className="rounded-md border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <th key={i} className="h-10 px-2 text-left">
                    <Skeleton className="h-4 w-20" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3].map((i) => (
                <tr key={i} className="border-b">
                  {[1, 2, 3, 4, 5, 6].map((j) => (
                    <td key={j} className="p-2">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
        Failed to load certificates: {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    );
  }

  const certificates = certsData?.certificates || [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">TLS Certificates</h1>

      {certificates.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground">No TLS certificates found</p>
            <p className="text-sm text-muted-foreground mt-1">
              Configure ACME in Traefik static config and mount acme.json
            </p>
          </CardContent>
        </Card>
      ) : (
        <DataGrid data={certificates} columns={columns} />
      )}
    </div>
  );
}
