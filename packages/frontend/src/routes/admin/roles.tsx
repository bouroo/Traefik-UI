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
import { getRoles, getPermissions, createRole, updateRole, deleteRole } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { Loader2, Plus, Pencil, Trash2 } from 'lucide-react';

interface Role {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  permission_names: string[];
}

interface Permission {
  id: number;
  name: string;
  description: string | null;
}

const BUILT_IN_ROLES = ['super_admin', 'operator', 'viewer'];

export function RolesPage() {
  const { hasPermission } = useAuth();
  const canWrite = hasPermission('system.roles.write');
  const queryClient = useQueryClient();

  const { data: roles, isLoading, error } = useQuery<Role[]>({
    queryKey: ['admin-roles'],
    queryFn: getRoles,
    enabled: hasPermission('system.roles.read'),
  });

  const { data: permissions } = useQuery<Permission[]>({
    queryKey: ['admin-permissions'],
    queryFn: getPermissions,
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editRole, setEditRole] = useState<Role | null>(null);
  const [deleteRoleId, setDeleteRoleId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', description: '', permission_ids: [] as number[] });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string; permission_ids: number[] }) => createRole(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
      setCreateOpen(false);
      setForm({ name: '', description: '', permission_ids: [] });
      toast.success('Role created successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create role');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string; description?: string; permission_ids?: number[] } }) =>
      updateRole(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
      setEditRole(null);
      toast.success('Role updated successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update role');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteRole(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
      setDeleteRoleId(null);
      toast.success('Role deleted successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete role');
    },
  });

  const handleCreateOpen = () => {
    setForm({ name: '', description: '', permission_ids: [] });
    setCreateOpen(true);
  };

  const handleEditOpen = (role: Role) => {
    setEditRole(role);
    const existingPerms = permissions?.filter((p) => role.permission_names.includes(p.name)) || [];
    setForm({
      name: role.name,
      description: role.description || '',
      permission_ids: existingPerms.map((p) => p.id),
    });
  };

  const handleSave = () => {
    if (createOpen) {
      createMutation.mutate({
        name: form.name,
        description: form.description || undefined,
        permission_ids: form.permission_ids,
      });
    } else if (editRole) {
      updateMutation.mutate({
        id: editRole.id,
        data: {
          name: form.name,
          description: form.description || undefined,
          permission_ids: form.permission_ids,
        },
      });
    }
  };

  const handleDeleteClick = (role: Role) => {
    if (BUILT_IN_ROLES.includes(role.name)) {
      toast.error(`Cannot delete built-in role: ${role.name}`);
      return;
    }
    setDeleteRoleId(role.id);
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
        Failed to load roles: {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Roles</h1>
        {canWrite && (
          <Button onClick={handleCreateOpen}>
            <Plus className="h-4 w-4 mr-2" />
            Add Role
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Roles</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Permissions</TableHead>
                {canWrite && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles?.map((role) => (
                <TableRow key={role.id}>
                  <TableCell className="font-medium">
                    {role.name}
                    {BUILT_IN_ROLES.includes(role.name) && (
                      <Badge variant="outline" className="ml-2">Built-in</Badge>
                    )}
                  </TableCell>
                  <TableCell>{role.description || '-'}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {role.permission_names.slice(0, 5).map((perm) => (
                        <Badge key={perm} variant="secondary">
                          {perm}
                        </Badge>
                      ))}
                      {role.permission_names.length > 5 && (
                        <Badge variant="outline">+{role.permission_names.length - 5} more</Badge>
                      )}
                    </div>
                  </TableCell>
                  {canWrite && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEditOpen(role)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(role)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={createOpen || !!editRole} onOpenChange={() => { setCreateOpen(false); setEditRole(null); }}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{createOpen ? 'Create Role' : 'Edit Role'}</DialogTitle>
            <DialogDescription>
              {createOpen ? 'Create a new role with permissions' : 'Update role details and permissions'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="role-name"
                disabled={editRole ? BUILT_IN_ROLES.includes(editRole.name) : false}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>
            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="flex flex-wrap gap-2">
                {permissions?.map((perm) => (
                  <Badge
                    key={perm.id}
                    variant={form.permission_ids.includes(perm.id) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => {
                      if (form.permission_ids.includes(perm.id)) {
                        setForm({
                          ...form,
                          permission_ids: form.permission_ids.filter((id) => id !== perm.id),
                        });
                      } else {
                        setForm({
                          ...form,
                          permission_ids: [...form.permission_ids, perm.id],
                        });
                      }
                    }}
                  >
                    {perm.name}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); setEditRole(null); }}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
              {createOpen ? 'Create' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteRoleId !== null} onOpenChange={() => setDeleteRoleId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Role</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this role? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteRoleId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteRoleId !== null && deleteMutation.mutate(deleteRoleId)}
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