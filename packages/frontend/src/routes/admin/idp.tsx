import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getSsoIdpProviders, getSsoIdpProvider, createSsoProvider, updateSsoProvider, deleteSsoProvider } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { Loader2, Plus, Pencil, Trash2 } from 'lucide-react';

interface SsoProvider {
  id: number;
  name: string;
  provider_type: string;
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

export default function IdpPage() {
  const { hasPermission } = useAuth();
  const canWrite = hasPermission('system.idp.write');
  const queryClient = useQueryClient();

  const { data: providers, isLoading, error } = useQuery<SsoProvider[]>({
    queryKey: ['admin-sso-providers'],
    queryFn: getSsoIdpProviders,
    enabled: hasPermission('system.idp.read'),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editProvider, setEditProvider] = useState<SsoProvider | null>(null);
  const [deleteProviderId, setDeleteProviderId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: '',
    enabled: true,
    issuerUrl: '',
    clientId: '',
    clientSecret: '',
    scopes: 'openid,profile,email',
    groupClaim: 'groups',
    roleMappings: '',
  });

  const createMutation = useMutation({
    mutationFn: (data: {
      name: string;
      provider_type: string;
      enabled: boolean;
      config: {
        issuerUrl: string;
        clientId: string;
        clientSecret: string;
        scopes?: string[];
        groupClaim?: string;
        roleMappings?: Record<string, string>;
      };
    }) => createSsoProvider(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-sso-providers'] });
      setCreateOpen(false);
      resetForm();
      toast.success('Identity provider created successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create identity provider');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: {
      name?: string;
      enabled?: boolean;
      config?: {
        issuerUrl?: string;
        clientId?: string;
        clientSecret?: string;
        scopes?: string[];
        groupClaim?: string;
        roleMappings?: Record<string, string>;
      };
    } }) => updateSsoProvider(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-sso-providers'] });
      setEditProvider(null);
      resetForm();
      toast.success('Identity provider updated successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update identity provider');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteSsoProvider(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-sso-providers'] });
      setDeleteProviderId(null);
      toast.success('Identity provider deleted successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete identity provider');
    },
  });

  const resetForm = () => {
    setForm({
      name: '',
      enabled: true,
      issuerUrl: '',
      clientId: '',
      clientSecret: '',
      scopes: 'openid,profile,email',
      groupClaim: 'groups',
      roleMappings: '',
    });
  };

  const handleCreateOpen = () => {
    resetForm();
    setCreateOpen(true);
  };

  const handleEditOpen = async (provider: SsoProvider) => {
    try {
      const fullProvider = await getSsoIdpProvider(provider.id);
      setEditProvider(fullProvider);
      setForm({
        name: fullProvider.name,
        enabled: fullProvider.enabled,
        issuerUrl: fullProvider.config?.issuerUrl || '',
        clientId: fullProvider.config?.clientId || '',
        clientSecret: '',
        scopes: fullProvider.config?.scopes?.join(',') || 'openid,profile,email',
        groupClaim: fullProvider.config?.groupClaim || 'groups',
        roleMappings: fullProvider.config?.roleMappings
          ? JSON.stringify(fullProvider.config.roleMappings, null, 2)
          : '',
      });
    } catch {
      toast.error('Failed to load provider details');
    }
  };

  const handleSave = () => {
    let roleMappings: Record<string, string> = {};
    if (form.roleMappings) {
      try {
        roleMappings = JSON.parse(form.roleMappings);
      } catch {
        toast.error('Invalid JSON in Role Mappings');
        return;
      }
    }

    const config = {
      issuerUrl: form.issuerUrl,
      clientId: form.clientId,
      clientSecret: form.clientSecret,
      scopes: form.scopes.split(',').map((s) => s.trim()),
      groupClaim: form.groupClaim,
      roleMappings,
    };

    if (createOpen) {
      createMutation.mutate({
        name: form.name,
        provider_type: 'oidc',
        enabled: form.enabled,
        config,
      });
    } else if (editProvider) {
      updateMutation.mutate({
        id: editProvider.id,
        data: {
          name: form.name,
          enabled: form.enabled,
          config,
        },
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
        Failed to load identity providers: {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Identity Providers</h1>
        {canWrite && (
          <Button onClick={handleCreateOpen}>
            <Plus className="h-4 w-4 mr-2" />
            Add Provider
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>OIDC / SSO Providers</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Enabled</TableHead>
                {canWrite && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {providers?.map((provider) => (
                <TableRow key={provider.id}>
                  <TableCell className="font-medium">{provider.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{provider.provider_type.toUpperCase()}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={provider.enabled ? 'default' : 'secondary'}>
                      {provider.enabled ? 'Yes' : 'No'}
                    </Badge>
                  </TableCell>
                  {canWrite && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEditOpen(provider)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteProviderId(provider.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {(!providers || providers.length === 0) && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                    No identity providers configured
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={createOpen || !!editProvider} onOpenChange={() => { setCreateOpen(false); setEditProvider(null); }}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{createOpen ? 'Create Identity Provider' : 'Edit Identity Provider'}</DialogTitle>
            <DialogDescription>
              Configure an OIDC identity provider for SSO authentication
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="My Identity Provider"
              />
            </div>
            <div className="space-y-2">
              <Label>Enabled</Label>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                  className="h-4 w-4"
                />
                <span>Provider is enabled</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Issuer URL</Label>
              <Input
                value={form.issuerUrl}
                onChange={(e) => setForm({ ...form, issuerUrl: e.target.value })}
                placeholder="https://idp.example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Client ID</Label>
              <Input
                value={form.clientId}
                onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                placeholder="client-id-from-idp"
              />
            </div>
            <div className="space-y-2">
              <Label>{editProvider ? 'Client Secret (leave blank to keep current)' : 'Client Secret'}</Label>
              <Input
                type="password"
                value={form.clientSecret}
                onChange={(e) => setForm({ ...form, clientSecret: e.target.value })}
                placeholder={editProvider ? '••••••••' : 'client-secret-from-idp'}
              />
            </div>
            <div className="space-y-2">
              <Label>Scopes</Label>
              <Input
                value={form.scopes}
                onChange={(e) => setForm({ ...form, scopes: e.target.value })}
                placeholder="openid,profile,email"
              />
            </div>
            <div className="space-y-2">
              <Label>Group Claim</Label>
              <Input
                value={form.groupClaim}
                onChange={(e) => setForm({ ...form, groupClaim: e.target.value })}
                placeholder="groups"
              />
            </div>
            <div className="space-y-2">
              <Label>Role Mappings (JSON)</Label>
              <textarea
                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.roleMappings}
                onChange={(e) => setForm({ ...form, roleMappings: e.target.value })}
                placeholder='{"admin": "super_admin", "user": "viewer"}'
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); setEditProvider(null); }}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
              {createOpen ? 'Create' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteProviderId !== null} onOpenChange={() => setDeleteProviderId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Identity Provider</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this identity provider? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteProviderId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteProviderId !== null && deleteMutation.mutate(deleteProviderId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}