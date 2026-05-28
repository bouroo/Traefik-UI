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
import { getUsers, getRoles, updateUser, deleteUser } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { Loader2, Pencil, Trash2 } from 'lucide-react';

interface User {
  id: number;
  username: string;
  source: string;
  email: string | null;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
  roles: { id: number; name: string }[];
}

interface Role {
  id: number;
  name: string;
  description: string | null;
}

export function UsersPage() {
  const { hasPermission } = useAuth();
  const canWrite = hasPermission('system.users.write');
  const queryClient = useQueryClient();

  const { data: users, isLoading, error } = useQuery<User[]>({
    queryKey: ['admin-users'],
    queryFn: getUsers,
    enabled: hasPermission('system.users.read'),
  });

  const { data: roles } = useQuery<Role[]>({
    queryKey: ['admin-roles'],
    queryFn: getRoles,
  });

  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ is_active: false, email: '', roles: [] as number[] });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { is_active?: boolean; email?: string; roles?: number[] } }) =>
      updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setEditUser(null);
      toast.success('User updated successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update user');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setDeleteUserId(null);
      toast.success('User deleted successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete user');
    },
  });

  const handleEditOpen = (user: User) => {
    setEditUser(user);
    setEditForm({
      is_active: user.is_active,
      email: user.email || '',
      roles: user.roles.map((r) => r.id),
    });
  };

  const handleEditSave = () => {
    if (!editUser) return;
    updateMutation.mutate({
      id: editUser.id,
      data: {
        is_active: editForm.is_active,
        email: editForm.email,
        roles: editForm.roles,
      },
    });
  };

  const handleDeleteConfirm = () => {
    if (deleteUserId !== null) {
      deleteMutation.mutate(deleteUserId);
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
        Failed to load users: {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Users</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Roles</TableHead>
                {canWrite && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.username}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{user.source}</Badge>
                  </TableCell>
                  <TableCell>{user.email || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={user.is_active ? 'default' : 'secondary'}>
                      {user.is_active ? 'Yes' : 'No'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map((role) => (
                        <Badge key={role.id} variant="secondary">
                          {role.name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  {canWrite && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEditOpen(user)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteUserId(user.id)}
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

      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user details and roles</DialogDescription>
          </DialogHeader>
          {editUser && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Username</Label>
                <Input value={editUser.username} disabled />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  placeholder="user@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Active</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editForm.is_active}
                    onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <span>User is active</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Roles</Label>
                <div className="flex flex-wrap gap-2">
                  {roles?.map((role) => (
                    <Badge
                      key={role.id}
                      variant={editForm.roles.includes(role.id) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => {
                        if (editForm.roles.includes(role.id)) {
                          setEditForm({
                            ...editForm,
                            roles: editForm.roles.filter((id) => id !== role.id),
                          });
                        } else {
                          setEditForm({
                            ...editForm,
                            roles: [...editForm.roles, role.id],
                          });
                        }
                      }}
                    >
                      {role.name}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>
              Cancel
            </Button>
            <Button onClick={handleEditSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteUserId !== null} onOpenChange={() => setDeleteUserId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this user? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUserId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
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