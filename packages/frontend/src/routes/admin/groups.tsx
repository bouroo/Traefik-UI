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
import { getGroups, getRoles, createGroup, updateGroup, deleteGroup } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { Loader2, Plus, Pencil, Trash2 } from 'lucide-react';

interface Group {
  id: number;
  name: string;
  external_id: string | null;
  source: string;
  created_at: string;
  member_count?: number;
}

interface Role {
  id: number;
  name: string;
  description: string | null;
}

export default function GroupsPage() {
  const { hasPermission } = useAuth();
  const canWrite = hasPermission('system.users.write');
  const queryClient = useQueryClient();

  const { data: groups, isLoading, error } = useQuery<Group[]>({
    queryKey: ['admin-groups'],
    queryFn: getGroups,
    enabled: hasPermission('system.users.read'),
  });

  const { data: roles } = useQuery<Role[]>({
    queryKey: ['admin-roles'],
    queryFn: getRoles,
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<Group | null>(null);
  const [deleteGroupId, setDeleteGroupId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', external_id: '', role_ids: [] as number[] });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; external_id?: string; role_ids?: number[] }) => createGroup(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-groups'] });
      setCreateOpen(false);
      setForm({ name: '', external_id: '', role_ids: [] });
      toast.success('Group created successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create group');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string; external_id?: string; role_ids?: number[] } }) =>
      updateGroup(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-groups'] });
      setEditGroup(null);
      toast.success('Group updated successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update group');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteGroup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-groups'] });
      setDeleteGroupId(null);
      toast.success('Group deleted successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete group');
    },
  });

  const handleCreateOpen = () => {
    setForm({ name: '', external_id: '', role_ids: [] });
    setCreateOpen(true);
  };

  const handleEditOpen = (group: Group) => {
    setEditGroup(group);
    setForm({
      name: group.name,
      external_id: group.external_id || '',
      role_ids: [],
    });
  };

  const handleSave = () => {
    if (createOpen) {
      createMutation.mutate({
        name: form.name,
        external_id: form.external_id || undefined,
        role_ids: form.role_ids.length > 0 ? form.role_ids : undefined,
      });
    } else if (editGroup) {
      updateMutation.mutate({
        id: editGroup.id,
        data: {
          name: form.name,
          external_id: form.external_id || undefined,
          role_ids: form.role_ids.length > 0 ? form.role_ids : undefined,
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
        Failed to load groups: {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Groups</h1>
        {canWrite && (
          <Button onClick={handleCreateOpen}>
            <Plus className="h-4 w-4 mr-2" />
            Add Group
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Groups</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>External ID</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Members</TableHead>
                {canWrite && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups?.map((group) => (
                <TableRow key={group.id}>
                  <TableCell className="font-medium">{group.name}</TableCell>
                  <TableCell>{group.external_id || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{group.source}</Badge>
                  </TableCell>
                  <TableCell>{group.member_count}</TableCell>
                  {canWrite && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEditOpen(group)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteGroupId(group.id)}
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

      <Dialog open={createOpen || !!editGroup} onOpenChange={() => { setCreateOpen(false); setEditGroup(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{createOpen ? 'Create Group' : 'Edit Group'}</DialogTitle>
            <DialogDescription>
              {createOpen ? 'Create a new group' : 'Update group details'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Group name"
              />
            </div>
            <div className="space-y-2">
              <Label>External ID</Label>
              <Input
                value={form.external_id}
                onChange={(e) => setForm({ ...form, external_id: e.target.value })}
                placeholder="Optional external identifier"
              />
            </div>
            {roles && roles.length > 0 && (
              <div className="space-y-2">
                <Label>Roles</Label>
                <div className="flex flex-wrap gap-2">
                  {roles.map((role) => (
                    <Badge
                      key={role.id}
                      variant={form.role_ids.includes(role.id) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => {
                        if (form.role_ids.includes(role.id)) {
                          setForm({
                            ...form,
                            role_ids: form.role_ids.filter((id) => id !== role.id),
                          });
                        } else {
                          setForm({
                            ...form,
                            role_ids: [...form.role_ids, role.id],
                          });
                        }
                      }}
                    >
                      {role.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); setEditGroup(null); }}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
              {createOpen ? 'Create' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteGroupId !== null} onOpenChange={() => setDeleteGroupId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Group</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this group? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteGroupId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteGroupId !== null && deleteMutation.mutate(deleteGroupId)}
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