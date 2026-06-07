import { useAuthStore } from '@/stores/auth-store';

export function useAuth() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  const isLoading = useAuthStore((s) => s.isLoading);
  const logout = useAuthStore((s) => s.logout);

  const hasPermission = (permission: string): boolean => {
    return permissions.includes(permission);
  };

  const isAdmin = user?.isAdmin ?? false;

  return {
    token,
    user,
    permissions,
    isLoading,
    isAuthenticated: !!token,
    hasPermission,
    isAdmin,
    logout,
  };
}
